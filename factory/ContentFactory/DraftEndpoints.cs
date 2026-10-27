using System.Text.Json;

namespace ContentFactory;

public static class DraftEndpoints
{
    public static object View(DraftBatch batch, DocumentStore documents)
    {
        string? sourceError = null;
        try { DraftQuality.RequireCurrent(batch, documents.Get(batch.DocumentId)); } catch (FactoryException error) { sourceError = error.Message; }
        var releaseErrors = DraftQuality.ReleaseErrors(batch).ToList(); if (sourceError is not null) releaseErrors.Insert(0, sourceError);
        return new { batch.Id, batch.DocumentId, batch.UnitIndex, batch.UnitName, batch.Model, batch.IsPreview, batch.GenerationStartedAt, batch.GenerationCompletedAt, batch.Status, batch.Message, batch.Error, batch.Progress, batch.Revision, batch.CreatedAt, batch.UpdatedAt, sourceError, plan = QuestionPlanning.For(batch), skippedQuestions = batch.SkippedQuestions.Select(p => new { slot = p.Key, reason = p.Value }), targetCount = QuestionPlanning.For(batch).QuestionCount - batch.SkippedQuestions.Count, releaseErrors, canRelease = releaseErrors.Count == 0, questions = batch.Questions.OrderBy(q => q.Slot).Select(q => new { q.Id, q.Slot, q.Revision, q.Content, q.Status, q.Note, q.ReviewedAt, versions = q.History.Count, errors = DraftQuality.Question(q.Content, batch, q.Id) }), entries = batch.Entries.OrderBy(e => e.Slot).Select(e => new { e.Id, e.Slot, e.Revision, e.Content, e.Status, e.Note, e.ReviewedAt, versions = e.History.Count, errors = DraftQuality.Entry(e.Content, batch, e.Id) }) };
    }
    private static void Editable(DraftBatch batch, DocumentStore documents)
    {
        if (batch.IsPreview) throw new FactoryException("模型預覽僅供比較，請選定模型後產生正式題庫草稿。");
        DraftQuality.RequireCurrent(batch, documents.Get(batch.DocumentId)); if (batch.Status is not (BatchStatus.Review or BatchStatus.Failed or BatchStatus.Cancelled)) throw new FactoryException("請等待產生完成或停止工作後，再修改與審核。");
    }
    public static void MapDraftEndpoints(this WebApplication app)
    {
        app.MapGet("/api/documents/{id:guid}/question-plan", (Guid id, int unitIndex, DocumentStore documents) => { var source = documents.Get(id); DraftQuality.RequireSource(source); return QuestionPlanning.Build(source, unitIndex); });
        app.MapGet("/api/documents/{id:guid}/model-previews", (Guid id, int unitIndex, DocumentStore documents, DraftStore drafts) => { _ = documents.Get(id); return drafts.List(id).Where(b => b.IsPreview && b.UnitIndex == unitIndex).Select(b => View(b, documents)); });
        app.MapPost("/api/documents/{id:guid}/model-previews", async (Guid id, StartDraftRequest input, DocumentStore documents, DraftStore drafts, GenerationQueue queue, IGenerationProvider provider, CancellationToken token) =>
        {
            var source = documents.Get(id); DraftQuality.RequireSource(source);
            if (source.Revision != input.Revision) throw new FactoryException("教材已變更，請重新載入後預覽。");
            var plan = QuestionPlanning.Preview(QuestionPlanning.Build(source, input.UnitIndex));
            var models = await provider.Models(token); if (input.Model is null || !models.Any(m => m.Provider == input.Model.Provider && m.Model == input.Model.Model)) throw new FactoryException("選擇的本機模型尚未提供服務。");
            var batch = new DraftBatch { DocumentId = id, UnitIndex = input.UnitIndex, UnitName = source.Units[input.UnitIndex].Name, SourceHash = DraftQuality.Fingerprint(source), Snapshot = source, Model = input.Model, Plan = plan, IsPreview = true, Message = "等待本機模型預覽" };
            drafts.Create(batch); queue.Enqueue(batch.Id); return Results.Accepted($"/api/batches/{batch.Id}", View(batch, documents));
        });
        app.MapGet("/api/generation/models", async (IGenerationProvider provider, CancellationToken token) => new { models = await provider.Models(token), localOnly = true });
        app.MapGet("/api/documents/{id:guid}/batches", (Guid id, DraftStore drafts, DocumentStore documents) =>
        {
            _ = documents.Get(id);
            return drafts.List(id).Where(batch => !batch.IsPreview).Select(batch => new { batch.Id, batch.UnitIndex, batch.UnitName, batch.Status, batch.Message, batch.Progress, batch.Model, batch.CreatedAt, batch.UpdatedAt, questions = batch.Questions.Count, approvedQuestions = batch.Questions.Count(q => q.Status == ReviewStatus.Approved), entries = batch.Entries.Count, approvedEntries = batch.Entries.Count(e => e.Status == ReviewStatus.Approved) });
        });
        app.MapPost("/api/documents/{id:guid}/batches", async (Guid id, StartDraftRequest input, DocumentStore documents, DraftStore drafts, GenerationQueue queue, IGenerationProvider provider, CancellationToken token) =>
        {
            var source = documents.Get(id); DraftQuality.RequireSource(source);
            if (source.Revision != input.Revision) throw new FactoryException("教材已變更，請重新載入後產題。");
            if (input.UnitIndex < 0 || input.UnitIndex >= source.Units.Length) throw new FactoryException("找不到這個單元。");
            var unit = source.Units[input.UnitIndex];
            var plan = QuestionPlanning.Build(source, input.UnitIndex);
            QuestionPlanning.RequireGeneratable(plan);
            var models = await provider.Models(token); if (input.Model is null || !models.Any(m => m.Provider == input.Model.Provider && m.Model == input.Model.Model)) throw new FactoryException("選擇的本機模型尚未提供服務，請啟動模型後重新整理清單。");
            var batch = new DraftBatch { DocumentId = id, UnitIndex = input.UnitIndex, UnitName = unit.Name, SourceHash = DraftQuality.Fingerprint(source), Snapshot = source, Model = input.Model, Plan = plan };
            drafts.Create(batch); queue.Enqueue(batch.Id); return Results.Accepted($"/api/batches/{batch.Id}", View(batch, documents));
        });
        app.MapGet("/api/batches/{id:guid}", (Guid id, DraftStore drafts, DocumentStore documents) => View(drafts.Get(id), documents));
        app.MapPost("/api/batches/{id:guid}/retry", (Guid id, DraftStore drafts, DocumentStore documents, GenerationQueue queue) =>
        {
            if (queue.Active.ContainsKey(id)) throw new FactoryException("上一個工作正在結束，請稍後重試。");
            var batch = drafts.Update(id, b => { Editable(b, documents); if (b.Status is not (BatchStatus.Failed or BatchStatus.Cancelled)) throw new FactoryException("只有未完成或已停止批次可重試。"); b.Status = BatchStatus.Queued; b.Error = null; b.Message = "等待重試，保留已完成草稿與審核結果"; });
            queue.Enqueue(id); return Results.Accepted($"/api/batches/{id}", View(batch, documents));
        });
        app.MapPost("/api/batches/{id:guid}/cancel", (Guid id, DraftStore drafts, GenerationQueue queue, DocumentStore documents) =>
        {
            var batch = drafts.Update(id, batch => { if (batch.Status is not (BatchStatus.Queued or BatchStatus.Generating)) throw new FactoryException("這批草稿目前沒有進行中的工作。"); batch.GenerationCompletedAt = DateTimeOffset.UtcNow; batch.Status = BatchStatus.Cancelled; batch.Message = "已停止，現有草稿與產生紀錄保留"; }); queue.Cancel(id); return View(batch, documents);
        });
        app.MapPut("/api/batches/{id:guid}/questions/{questionId:guid}", (Guid id, Guid questionId, ReviewQuestionRequest input, DraftStore drafts, DocumentStore documents) =>
        {
            var batch = drafts.Update(id, batch =>
            {
                Editable(batch, documents); var item = batch.Questions.SingleOrDefault(q => q.Id == questionId) ?? throw new KeyNotFoundException("找不到這題草稿。");
                if (item.Revision != input.Revision) throw new FactoryException("這題已被修改，請重新載入。"); DraftQuality.Valid(DraftQuality.Question(input.Content, batch, item.Id));
                DraftStore.Archive(item, "修改"); item.Content = input.Content; item.Status = ReviewStatus.Draft; item.ReviewedAt = null; item.Note = ""; item.Revision++;
            }); return View(batch, documents);
        });
        app.MapPut("/api/batches/{id:guid}/entries/{entryId:guid}", (Guid id, Guid entryId, ReviewEntryRequest input, DraftStore drafts, DocumentStore documents) =>
        {
            var batch = drafts.Update(id, batch =>
            {
                Editable(batch, documents); var item = batch.Entries.SingleOrDefault(e => e.Id == entryId) ?? throw new KeyNotFoundException("找不到這篇知識草稿。");
                if (item.Revision != input.Revision) throw new FactoryException("這篇草稿已被修改，請重新載入。"); DraftQuality.Valid(DraftQuality.Entry(input.Content, batch, item.Id));
                DraftStore.Archive(item, "修改"); item.Content = input.Content; item.Status = ReviewStatus.Draft; item.ReviewedAt = null; item.Note = ""; item.Revision++;
            }); return View(batch, documents);
        });
        app.MapPost("/api/batches/{id:guid}/{kind}/{itemId:guid}/review", (Guid id, string kind, Guid itemId, ReviewActionRequest input, DraftStore drafts, DocumentStore documents) =>
        {
            if (input.Action is not ("approve" or "return")) throw new FactoryException("請選擇核准或退回。");
            if (input.Action == "return" && (string.IsNullOrWhiteSpace(input.Note) || input.Note.Length > 500)) throw new FactoryException("退回時請填寫原因，最多 500 字。");
            var batch = drafts.Update(id, batch =>
            {
                Editable(batch, documents);
                if (kind == "questions")
                {
                    var item = batch.Questions.SingleOrDefault(q => q.Id == itemId) ?? throw new KeyNotFoundException("找不到這題草稿。"); if (item.Revision != input.Revision) throw new FactoryException("這題狀態已變更，請重新載入。");
                    if (input.Action == "approve") DraftQuality.Valid(DraftQuality.Question(item.Content, batch, item.Id)); DraftStore.Archive(item, input.Action);
                    item.Status = input.Action == "approve" ? ReviewStatus.Approved : ReviewStatus.Returned; item.Note = input.Note ?? ""; item.ReviewedAt = DateTimeOffset.UtcNow; item.Revision++;
                }
                else if (kind == "entries")
                {
                    var item = batch.Entries.SingleOrDefault(e => e.Id == itemId) ?? throw new KeyNotFoundException("找不到這篇草稿。"); if (item.Revision != input.Revision) throw new FactoryException("這篇狀態已變更，請重新載入。");
                    if (input.Action == "approve") DraftQuality.Valid(DraftQuality.Entry(item.Content, batch, item.Id)); DraftStore.Archive(item, input.Action);
                    item.Status = input.Action == "approve" ? ReviewStatus.Approved : ReviewStatus.Returned; item.Note = input.Note ?? ""; item.ReviewedAt = DateTimeOffset.UtcNow; item.Revision++;
                }
                else throw new FactoryException("未知的草稿分類。");
            }); return View(batch, documents);
        });
        app.MapPost("/api/batches/{id:guid}/{kind}/{itemId:guid}/regenerate", (Guid id, string kind, Guid itemId, RegenerateRequest input, DraftStore drafts, DocumentStore documents, GenerationQueue queue) =>
        {
            if ((input.Instruction?.Length ?? 0) > 500) throw new FactoryException("重生意見最多 500 字。");
            var batch = drafts.Update(id, batch =>
            {
                Editable(batch, documents);
                if (kind == "questions")
                {
                    var item = batch.Questions.SingleOrDefault(q => q.Id == itemId) ?? throw new KeyNotFoundException("找不到題目。"); if (item.Revision != input.Revision) throw new FactoryException("題目已變更。");
                    DraftStore.Archive(item, "要求重生"); item.Status = ReviewStatus.Draft; item.ReviewedAt = null; item.Revision++;
                }
                else if (kind == "entries")
                {
                    var item = batch.Entries.SingleOrDefault(e => e.Id == itemId) ?? throw new KeyNotFoundException("找不到知識條目。"); if (item.Revision != input.Revision) throw new FactoryException("條目已變更。");
                    DraftStore.Archive(item, "要求重生"); item.Status = ReviewStatus.Draft; item.ReviewedAt = null; item.Revision++;
                }
                else throw new FactoryException("未知的草稿分類。");
                batch.PendingItemId = itemId; batch.PendingKind = kind == "questions" ? "question" : "entry"; batch.Instruction = input.Instruction ?? ""; batch.Status = BatchStatus.Queued; batch.Progress = 0; batch.Message = "等待重新產生，原版本已保留"; batch.Error = null;
            }); queue.Enqueue(id); return Results.Accepted($"/api/batches/{id}", View(batch, documents));
        });
        app.MapGet("/api/batches/{id:guid}/approved", (Guid id, DraftStore drafts, DocumentStore documents) =>
        {
            var batch = drafts.Get(id); DraftQuality.RequireCurrent(batch, documents.Get(batch.DocumentId)); DraftQuality.Valid(DraftQuality.ReleaseErrors(batch));
            var artifact = new { format = "learning-adventure:approved-drafts", version = 1, batchId = batch.Id, sourceDocumentId = batch.DocumentId, sourceHash = batch.SourceHash, unitName = batch.UnitName, plan = QuestionPlanning.For(batch), skippedQuestions = batch.SkippedQuestions, metadata = (object?)batch.Snapshot.Confirmation ?? batch.Snapshot.Classification, questions = batch.Questions.Where(q => q.Status == ReviewStatus.Approved).OrderBy(q => q.Slot).Select(q => new { q.Id, q.Slot, pointIndex = (int?)QuestionPlanning.Target(batch, q.Slot).PointIndex, q.Content, q.ReviewedAt }), entries = batch.Entries.Where(e => e.Status == ReviewStatus.Approved).OrderBy(e => e.Slot).Select(e => new { e.Id, e.Content, e.ReviewedAt }) };
            return Results.File(JsonSerializer.SerializeToUtf8Bytes(artifact, FactoryJson.Options), "application/json", $"approved-drafts-{id}.json");
        });
    }
}
