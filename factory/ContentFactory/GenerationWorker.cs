using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;

namespace ContentFactory;

public sealed class GenerationQueue
{
    public readonly Channel<Guid> Channel = System.Threading.Channels.Channel.CreateUnbounded<Guid>(new UnboundedChannelOptions { SingleReader = true });
    public readonly ConcurrentDictionary<Guid, CancellationTokenSource> Active = new();
    public void Enqueue(Guid id) => Channel.Writer.TryWrite(id);
    public void Cancel(Guid id) { if (Active.TryGetValue(id, out var token)) token.Cancel(); }
}
public sealed class GenerationWorker(DraftStore drafts, DocumentStore documents, GenerationQueue queue, IGenerationProvider provider, ILogger<GenerationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        foreach (var batch in drafts.List().Where(b => b.Status is BatchStatus.Queued or BatchStatus.Generating)) { drafts.Update(batch.Id, b => { b.Status = BatchStatus.Queued; b.Message = "服務重啟，已恢復產題工作"; }); queue.Enqueue(batch.Id); }
        await foreach (var id in queue.Channel.Reader.ReadAllAsync(stoppingToken))
        {
            using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken); cancellation.CancelAfter(TimeSpan.FromMinutes(20));
            queue.Active[id] = cancellation;
            try { await Process(id, cancellation.Token); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                logger.LogWarning("草稿批次 {Id} 未完成：{ErrorType}", id, error.GetType().Name);
                drafts.Update(id, b => { if (b.Status is BatchStatus.Cancelled or BatchStatus.Stale) return; b.GenerationCompletedAt = DateTimeOffset.UtcNow; b.Status = BatchStatus.Failed; b.Error = error is FactoryException ? error.Message : error is OperationCanceledException ? "本機模型處理逾時，已保留進度，可重試續跑或更換模型。" : "本機模型回傳格式不符，已保留產生紀錄，請重試或更換模型。"; b.Message = "草稿產生未完成，已保留現有內容"; });
            }
            finally { queue.Active.TryRemove(id, out _); }
        }
    }
    private DraftBatch Current(Guid id)
    {
        var batch = drafts.Get(id);
        if (batch.Status == BatchStatus.Cancelled) throw new OperationCanceledException();
        try { DraftQuality.RequireCurrent(batch, documents.Get(batch.DocumentId)); }
        catch (FactoryException) { drafts.Update(id, b => { b.Status = BatchStatus.Stale; b.Error = "來源教材已變更，這批草稿停止使用；請從新版來源重新產生。"; }); throw; }
        return batch;
    }
    public async Task Process(Guid id, CancellationToken token)
    {
        var initial = Current(id); if (initial.Status != BatchStatus.Queued) return;
        QuestionPlanning.RequireGeneratable(QuestionPlanning.For(initial));
        drafts.Update(id, b => { b.GenerationStartedAt = DateTimeOffset.UtcNow; b.GenerationCompletedAt = null; b.Status = BatchStatus.Generating; b.Error = null; b.Message = "正在使用本機模型整理草稿"; });
        if (initial.PendingItemId is { } itemId)
        {
            if (initial.PendingKind == "question")
            {
                var old = initial.Questions.Single(q => q.Id == itemId); var result = await Questions(id, [old.Slot], token);
                Current(id); drafts.Update(id, b => { var item = b.Questions.Single(q => q.Id == itemId); DraftStore.Archive(item, "重新產生"); item.Content = result[0]; item.Status = ReviewStatus.Draft; item.Note = ""; item.ReviewedAt = null; item.Revision++; });
            }
            else
            {
                var result = await Entries(id, 1, token); Current(id);
                drafts.Update(id, b => { var item = b.Entries.Single(e => e.Id == itemId); DraftStore.Archive(item, "重新產生"); item.Content = result[0]; item.Status = ReviewStatus.Draft; item.Note = ""; item.ReviewedAt = null; item.Revision++; });
            }
        }
        else
        {
            var plan = QuestionPlanning.For(initial);
            foreach (var target in plan.Targets)
            {
                var slot = target.Slot; var current = Current(id);
                if (current.Questions.Any(q => q.Slot == slot) || current.SkippedQuestions.ContainsKey(slot)) continue;
                try
                {
                    var result = await Questions(id, [slot], token); Current(id);
                    drafts.Update(id, b => b.Questions.Add(new QuestionDraft { Slot = slot, Content = result[0] }));
                }
                catch (InsufficientQuestionMaterialException) when (initial.Plan is not null)
                { drafts.Update(id, b => b.SkippedQuestions[slot] = "模型判定此考點不足以再出一道有來源支持的題目，未硬湊題數。"); }
                drafts.Update(id, b => { b.Progress = (b.Questions.Count + b.SkippedQuestions.Count) * 80 / plan.QuestionCount; b.Message = $"已建立 {b.Questions.Count} 題／預估 {plan.QuestionCount} 題，略過 {b.SkippedQuestions.Count} 題"; });
            }
            if (Current(id).Questions.Count == 0) throw new FactoryException("目前教材未能產生有來源支持的題目，請補充內容。");
            if (Current(id).Entries.Count < plan.EntryCount)
            {
                var entries = await Entries(id, plan.EntryCount, token); Current(id);
                drafts.Update(id, b => { b.Entries = entries.Select((content, index) => new EntryDraft { Slot = index, Content = content }).ToList(); });
            }
        }
        Current(id); drafts.Update(id, b => { QuestionPlanning.BalanceChoices(b); b.GenerationCompletedAt = DateTimeOffset.UtcNow; b.Status = BatchStatus.Review; b.Progress = 100; b.Message = b.IsPreview ? "模型預覽已完成，請人工對照判斷" : "草稿已建立，請逐題對照來源並審核"; b.PendingItemId = null; b.PendingKind = null; b.Instruction = ""; });
    }
    private async Task<QuestionContent[]> Questions(Guid id, int[] slots, CancellationToken token, int group = -1)
    {
        var errors = "";
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var batch = Current(id); var prompt = GenerationPrompts.Questions(batch, slots, errors, batch.Instruction, group); string raw = "";
            try
            {
                var output = await provider.Generate(batch.Model, prompt, GenerationPrompts.Schema(false, slots.Length, slots[0], batch), token); raw = output.Raw;
                if (output.Data.GetProperty("insufficientMaterial").GetBoolean()) { drafts.SaveAttempt(id, "insufficient", prompt, raw, ["來源文字不足"]); throw new InsufficientQuestionMaterialException(); }
                var questions = output.Data.GetProperty("questions").EnumerateArray().Select(q => GenerationPrompts.Question(q, batch.DocumentId)).ToArray();
                var issues = new List<string>(); if (questions.Length != slots.Length) issues.Add($"本次需要 {slots.Length} 題。");
                for (var i = 0; i < questions.Length && i < slots.Length; i++)
                {
                    var existing = batch.Questions.SingleOrDefault(q => q.Slot == slots[i]);
                    var target = QuestionPlanning.Target(batch, slots[i]);
                    if (questions[i].Type != target.Type) issues.Add($"第{slots[i]+1}題型不符，請依指定選擇／填空題型產生。");
                    issues.AddRange(DraftQuality.Question(questions[i], batch, existing?.Id));
                    if (questions[i].Type == "choice" && questions[i].AnswerIndex != target.AnswerIndex) issues.Add($"第{slots[i] + 1}題的answerIndex需為{target.AnswerIndex}。");
                    if (questions[i].Difficulty != target.Difficulty) issues.Add($"第{slots[i] + 1}題的難度需為{target.Difficulty}。");
                }
                if (questions.Select(q => DraftQuality.StemKey(q.Stem)).Distinct().Count() != questions.Length) issues.Add("本次題目中有重複題幹。");
                drafts.SaveAttempt(id, "questions", prompt, raw, issues.ToArray());
                if (issues.Count == 0) return questions; errors = string.Join('；', issues.Distinct());
            }
            catch (Exception error) when (error is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
            {
                errors = error is FormatException ? error.Message : "JSON 欄位或型別不符，請完整依結構輸出。"; drafts.SaveAttempt(id, "questions-invalid", prompt, raw, [errors]);
            }
        }
        throw new FactoryException($"連續三次未通過題目檢查：{errors}");
    }
    private async Task<EntryContent[]> Entries(Guid id, int count, CancellationToken token)
    {
        var errors = "";
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var batch = Current(id); var prompt = GenerationPrompts.Entries(batch, count, errors, batch.Instruction); var output = await provider.Generate(batch.Model, prompt, GenerationPrompts.Schema(true, count), token);
            if (output.Data.GetProperty("insufficientMaterial").GetBoolean()) throw new FactoryException("來源文字不足以建立知識條目，請補充教材。");
            var entries = output.Data.GetProperty("entries").EnumerateArray().Select(e => GenerationPrompts.Entry(e, batch.DocumentId)).ToArray(); var issues = new List<string>();
            if (entries.Length != count) issues.Add($"需提供 {count} 篇知識條目。");
            var ignore = batch.PendingKind == "entry" ? batch.PendingItemId : null;
            foreach (var entry in entries) issues.AddRange(DraftQuality.Entry(entry, batch, ignore));
            if (entries.Select(e => DraftQuality.StemKey(e.Title)).Distinct().Count() != entries.Length) issues.Add("知識標題不可重複。");
            drafts.SaveAttempt(id, "entries", prompt, output.Raw, issues.ToArray()); if (issues.Count == 0) return entries; errors = string.Join('；', issues.Distinct());
        }
        throw new FactoryException($"連續三次未通過知識條目檢查：{errors}");
    }
}
