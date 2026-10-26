using ContentFactory;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text.Json;
using Xunit;

namespace ContentFactoryTests;

public sealed class DraftTests
{
    private const string Text = "植物的根吸收水分與礦物質，莖支撐植物並運送水分，葉片進行光合作用製造養分。觀察結果需要記錄日期及實際測量數字，不能任意改動紀錄。";
    private static DraftBatch Batch()
    {
        var source = new SourceDocument { Status = DocumentStatus.Ready, Pages = [new(1, Text, "pdf", 1, Guid.NewGuid())], Units = [new("植物觀察", 1, 1, false)], Classification = new("國中", 8, "自然科學", "自編", .99, "test", []) };
        return new() { DocumentId = source.Id, Snapshot = source, SourceHash = DraftQuality.Fingerprint(source), UnitIndex = 0, UnitName = "植物觀察" };
    }
    private static QuestionContent Content(DraftBatch b, int slot) => new($"植物觀察的第{slot + 1}項問題應如何回答" + (DraftQuality.IsBlankSlot(slot) ? "：___。" : "？"), DraftQuality.IsBlankSlot(slot) ? [] : ["根部", "莖部", "葉片", "花朵"], DraftQuality.IsBlankSlot(slot) ? 0 : DraftQuality.ChoicePosition(slot), "根能吸收水分與礦物質，與其他構造的功能不同。", DraftQuality.Difficulties[slot], new(b.DocumentId, 1, slot is 9 or 11 ? "莖支撐植物並運送水分，葉片進行光合作用製造養分。" : "植物的根吸收水分與礦物質"), DraftQuality.IsBlankSlot(slot) ? "fillBlank" : "choice", DraftQuality.IsBlankSlot(slot) ? [slot == 3 ? "水分" : slot == 7 ? "礦物質" : slot == 9 ? "莖" : "葉片"] : []);
    [Fact] public void MixedSetRequiresEightChoicesFourBlanksAndBalancedDifficulty()
    {
        var b = Batch(); b.Questions = Enumerable.Range(0, 12).Select(s => new QuestionDraft { Slot = s, Content = Content(b, s), Status = ReviewStatus.Approved }).ToList();
        Assert.Empty(DraftQuality.SetErrors(b.Questions)); Assert.All(b.Questions, q => Assert.Empty(DraftQuality.Question(q.Content, b, q.Id)));
        b.Questions[3].Content = b.Questions[3].Content with { Type = "choice", Options = ["甲", "乙", "丙", "丁"] }; Assert.NotEmpty(DraftQuality.SetErrors(b.Questions));
    }
    [Fact] public void BlankNeedsOneGapAndSourceGroundedPrimaryAnswer()
    {
        var b = Batch(); var q = Content(b, 3); Assert.Empty(DraftQuality.Question(q, b));
        Assert.NotEmpty(DraftQuality.Question(q with { Stem = "沒有空格的填空題目內容" }, b));
        Assert.NotEmpty(DraftQuality.Question(q with { AcceptedAnswers = [] }, b));
        Assert.NotEmpty(DraftQuality.Question(q with { AcceptedAnswers = ["教材沒有的名詞"] }, b));
        Assert.NotEmpty(DraftQuality.Question(q with { AcceptedAnswers = ["水分", "水分"] }, b));
    }
    [Fact] public void CitationMustMatchDocumentPageAndOriginalText()
    {
        var b = Batch(); var q = Content(b, 0);
        Assert.NotEmpty(DraftQuality.Question(q with { SourceRef = q.SourceRef with { DocumentId = Guid.NewGuid() } }, b));
        Assert.NotEmpty(DraftQuality.Question(q with { SourceRef = q.SourceRef with { PageNumber = 2 } }, b));
        Assert.NotEmpty(DraftQuality.Question(q with { SourceRef = q.SourceRef with { Quote = "這是模型自行編造的出處摘錄" } }, b));
    }
    [Fact] public void RejectsDuplicateStemsAndUnbalancedOptions()
    {
        var b = Batch(); var q = Content(b, 0); b.Questions.Add(new() { Content = q });
        Assert.NotEmpty(DraftQuality.Question(q, b)); Assert.Empty(DraftQuality.Question(q, b, b.Questions[0].Id));
        Assert.NotEmpty(DraftQuality.Question(q with { Options = ["甲", "甲", "丙", "丁"] }, b));
        Assert.NotEmpty(DraftQuality.Question(q with { Options = ["甲", "乙", "丙", new string('字', 100)] }, b));
    }
    [Fact] public void ReleaseIncludesOnlyApprovedItemsAndRequiresReviewState()
    {
        var b = Batch(); b.Status = BatchStatus.Review;
        b.Questions = Enumerable.Range(0, 12).Select(s => new QuestionDraft { Slot = s, Content = Content(b, s), Status = ReviewStatus.Approved }).ToList();
        b.Entries = Enumerable.Range(0, 3).Select(s => new EntryDraft { Content = new($"植物知識{s}", Text, "plant", new(b.DocumentId, 1, "植物的根吸收水分與礦物質")), Status = s < 2 ? ReviewStatus.Approved : ReviewStatus.Returned }).ToList();
        Assert.Empty(DraftQuality.ReleaseErrors(b)); b.Questions[0].Status = ReviewStatus.Draft; Assert.NotEmpty(DraftQuality.ReleaseErrors(b));
        b.Questions[0].Status = ReviewStatus.Approved; b.Status = BatchStatus.Generating; Assert.NotEmpty(DraftQuality.ReleaseErrors(b));
    }
    [Fact] public void SourceChangesInvalidateOldDraftsButProgressDoesNot()
    {
        var b = Batch(); b.Snapshot.Progress++; DraftQuality.RequireCurrent(b, b.Snapshot);
        b.Snapshot.Pages[0] = b.Snapshot.Pages[0] with { Text = Text + "文字修正" }; Assert.Throws<FactoryException>(() => DraftQuality.RequireCurrent(b, b.Snapshot));
    }
    [Fact] public void OcrAndUncertainMetadataNeedParentConfirmation()
    {
        var b = Batch(); b.Snapshot.Pages[0] = b.Snapshot.Pages[0] with { Method = "tesseract" };
        Assert.Throws<FactoryException>(() => DraftQuality.RequireSource(b.Snapshot));
        b.Snapshot.Confirmation = new("國中", 8, "自然科學", "自編", b.Snapshot.Units); DraftQuality.RequireSource(b.Snapshot);
    }
    [Theory] [InlineData(1)] [InlineData(6)] [InlineData(7)] [InlineData(8)] [InlineData(9)]
    public void GenerationSupportsPrimaryThroughJuniorHigh(int grade) { var b = Batch(); b.Snapshot.Classification = b.Snapshot.Classification! with { Grade = grade, School = Curriculum.SchoolFor(grade) }; DraftQuality.RequireSource(b.Snapshot); }
    [Fact] public void SeniorHighGenerationDoesNotClaimUnsupportedCoverage() { var b = Batch(); b.Snapshot.Classification = b.Snapshot.Classification! with { Grade = 10 }; Assert.Throws<FactoryException>(() => DraftQuality.RequireSource(b.Snapshot)); }
    [Theory]
    [InlineData("國中七年級 國文", 7, "國語文")]
    [InlineData("國中二年級 理化", 8, "自然科學")]
    [InlineData("國中九年級 自然科學 地球科學", 9, "自然科學")]
    [InlineData("國中三年級 公民", 9, "公民與社會")]
    public async Task JuniorHighSubjectAliases(string cover, int grade, string subject)
    {
        var result = await new LocalClassificationProvider().ClassifyAsync([new(1, cover, "pdf", 1, Guid.NewGuid()), new(2, "目錄 第一單元 學習探索", "pdf", 1, Guid.NewGuid())], 1, 2, default);
        Assert.Equal(grade, result.Grade); Assert.Equal(subject, result.Subject);
    }
    [Fact] public void StoreKeepsVersionsAttemptsAndFailedTransactions()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var store = new DraftStore(options); var b = Batch(); store.Create(b);
        store.Update(b.Id, next => { next.Questions.Add(new() { Content = Content(b, 0), Status = ReviewStatus.Approved }); next.Status = BatchStatus.Review; });
        store.Update(b.Id, next => { DraftStore.Archive(next.Questions[0], "修改"); next.Questions[0].Status = ReviewStatus.Draft; });
        Assert.Throws<FactoryException>(() => store.Update(b.Id, next => { next.Questions.Clear(); throw new FactoryException("失敗"); }));
        store.SaveAttempt(b.Id, "test", "prompt", "response", []); var restored = new DraftStore(options).Get(b.Id);
        Assert.Single(restored.Questions); Assert.Single(restored.Questions[0].History); Assert.Contains("approved", restored.Questions[0].History[0].Json); Assert.Single(Directory.GetFiles(files.Root, "attempt-*.json", SearchOption.AllDirectories));
    }
    [Theory] [InlineData("https://example.com/")] [InlineData("http://user:secret@127.0.0.1/")] [InlineData("file:///tmp/")]
    public void ModelEndpointsMustStayLocal(string endpoint) => Assert.Throws<FactoryException>(() => LocalGenerationProvider.LocalEndpoint(endpoint));
    [Fact] public async Task WorkerCreatesMixedDraftsAndRegenerationPreservesOtherApprovals()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var documents = new DocumentStore(options); var drafts = new DraftStore(options); var batch = Batch(); documents.Create(batch.Snapshot); drafts.Create(batch);
        var provider = new FakeGenerator(batch); var worker = new GenerationWorker(drafts, documents, new GenerationQueue(), provider, NullLogger<GenerationWorker>.Instance);
        await worker.Process(batch.Id, default); var result = drafts.Get(batch.Id); Assert.Equal(BatchStatus.Review, result.Status); Assert.Equal(12, result.Questions.Count); Assert.Equal(3, result.Entries.Count); Assert.All(result.Questions, q => Assert.Equal(ReviewStatus.Draft, q.Status)); Assert.Empty(DraftQuality.SetErrors(result.Questions));
        var target = result.Questions[3].Id; var other = result.Questions[0].Id;
        drafts.Update(batch.Id, b => { b.Questions.ForEach(q => q.Status = ReviewStatus.Approved); b.Status = BatchStatus.Queued; b.PendingItemId = target; b.PendingKind = "question"; });
        provider.RegenerateSlot = 3; await worker.Process(batch.Id, default); result = drafts.Get(batch.Id);
        Assert.Equal(ReviewStatus.Draft, result.Questions.Single(q => q.Id == target).Status); Assert.Single(result.Questions.Single(q => q.Id == target).History); Assert.Equal(ReviewStatus.Approved, result.Questions.Single(q => q.Id == other).Status);
    }
    private sealed class FakeGenerator(DraftBatch b) : IGenerationProvider
    {
        public int? RegenerateSlot { get; set; }
        public Task<LocalModel[]> Models(CancellationToken token) => Task.FromResult(Array.Empty<LocalModel>());
        public Task<ModelOutput> Generate(ModelSelection model, string prompt, object schema, CancellationToken token)
        {
            object output;
            if (prompt.Contains("輸出entries")) output = new { insufficientMaterial = false, entries = Enumerable.Range(0, 3).Select(s => new { title = $"知識條目{s}", text = Text, illustration = "plant", pageNumber = 1, sourceQuote = "植物的根吸收水分與礦物質" }) };
            else { int[] slots = RegenerateSlot.HasValue ? [RegenerateSlot.Value] : [int.Parse(System.Text.RegularExpressions.Regex.Match(prompt, @"第(\d+)題：").Groups[1].Value) - 1]; output = new { insufficientMaterial = false, questions = slots.Select(s => { var q = Content(b, s); return new { type = q.Type, stem = q.Stem + (RegenerateSlot.HasValue ? "重生" : ""), options = q.Options, answerIndex = q.AnswerIndex, acceptedAnswers = q.AcceptedAnswers, explanation = q.Explanation, difficulty = q.Difficulty, pageNumber = 1, sourceQuote = q.SourceRef.Quote }; }) }; }
            var raw = JsonSerializer.Serialize(output); using var json = JsonDocument.Parse(raw); return Task.FromResult(new ModelOutput(json.RootElement.Clone(), raw));
        }
    }
}
