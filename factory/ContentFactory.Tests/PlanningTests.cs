using ContentFactory;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text.Json;
using Xunit;

namespace ContentFactoryTests;

public sealed class PlanningTests
{
    private const string Simple = "金屬的質量可用天平測量，常用單位是公克。液體的體積可以使用量筒測量，常用單位是毫升。";
    private const string Complex = "密度等於質量除以體積，計算時必須注意單位一致。若比較同種物質的不同樣本，應控制測量的條件，才能推論密度是否相同。";
    private static SourceDocument Source(string text) => new() { Status = DocumentStatus.Ready, Pages = [new(1, text, "pdf", 1, Guid.NewGuid())], Units = [new("測量", 1, 1, false)], Classification = new("國中", 8, "自然科學", "自編", 1, "test", []) };
    private static DraftBatch Batch(SourceDocument source, bool current = false)
    {
        var plan = QuestionPlanning.Build(source, 0);
        if (!current) plan = plan with { Method = "source-rules-v1", Targets = plan.Targets.Take(plan.Points.Sum(p => p.Complexity)).ToArray(), RecommendedCount = null };
        return new() { DocumentId = source.Id, Snapshot = source, SourceHash = DraftQuality.Fingerprint(source), UnitName = "測量", Plan = plan };
    }
    [Fact] public void InsufficientContentShowsTwentyQuestionGoalAndRequiresMoreMaterial()
    {
        var shortPlan = QuestionPlanning.Build(Source(Simple), 0); var longPlan = QuestionPlanning.Build(Source(Simple + Complex), 0);
        Assert.Equal(20, shortPlan.TargetQuestionCount); Assert.False(shortPlan.CanGenerate); Assert.NotEmpty(shortPlan.Warnings); Assert.True(longPlan.QuestionCount > shortPlan.QuestionCount); Assert.True(shortPlan.QuestionCount < 12);
        Assert.True(shortPlan.ChoiceCount > 0); Assert.True(shortPlan.BlankCount > 0);
    }
    [Fact] public void RepeatedTextAndPdfWrappingDoNotInflateCounts()
    {
        var original = QuestionPlanning.Build(Source(Simple), 0);
        Assert.Equal(original.QuestionCount, QuestionPlanning.Build(Source(Simple + Simple + Simple), 0).QuestionCount);
        Assert.Equal(original.QuestionCount, QuestionPlanning.Build(Source(Simple.Replace("測量", "測\n量")), 0).QuestionCount);
    }
    [Fact] public void ComplexityChangesQuantityAndDifficultyWithVisibleReasons()
    {
        var basic = QuestionPlanning.Build(Source(Simple), 0); var advanced = QuestionPlanning.Build(Source(Complex), 0);
        Assert.Equal(basic.Points.Length, advanced.Points.Length); Assert.True(advanced.QuestionCount > basic.QuestionCount);
        Assert.Contains(advanced.Points, p => p.Complexity == 3 && p.Reasons.Length >= 2); Assert.Contains(advanced.Targets, t => t.Difficulty == 3 && t.Type == "choice");
    }
    [Fact] public void EveryPageIsRepresentedInsteadOfSamplingOnlyFirstPages()
    {
        var source = Source(Simple); source.Pages = Enumerable.Range(1, 8).Select(n => new SourcePage(n, $"第{n}項測量紀錄應註明器材名稱及單位。", "pdf", 1, Guid.NewGuid())).ToArray(); source.Units = [new("測量", 1, 8, false)];
        var plan = QuestionPlanning.Build(source, 0); Assert.Equal(Enumerable.Range(1, 8), plan.Targets.Select(t => t.PageNumber).Distinct());
    }
    [Fact] public void EmptyOrUnreadableUnitCannotBeMadeIntoQuestions() => Assert.Throws<FactoryException>(() => QuestionPlanning.Build(Source("目錄\n123"), 0));
    [Fact] public void PreviewAndGenerationPlanAreDeterministic() { var source = Source(Simple + Complex); Assert.Equal(JsonSerializer.Serialize(QuestionPlanning.Build(source, 0)), JsonSerializer.Serialize(QuestionPlanning.Build(source, 0))); }
    [Fact] public void LongUnpunctuatedOcrTextHasBoundedTargetsWithoutDroppingTheRest()
    {
        var source = Source(string.Join("", Enumerable.Range(0, 150).Select(i => $"測量紀錄{i}包含器材及單位")));
        var plan = QuestionPlanning.Build(source, 0); Assert.True(plan.Points.Length > 1); Assert.All(plan.Points, point => Assert.InRange(point.Text.Length, 12, 480)); Assert.Contains(plan.Points, p => p.Text.Contains("149"));
    }
    [Fact] public void OcrHeadingAndBodyOnTheSameLineDoNotLoseTheBody() { var plan = QuestionPlanning.Build(Source("第一單元 測量 " + Simple), 0); Assert.Equal(2, plan.Points.Length); }
    [Fact] public void MathOperatorsAndParenthesesRemainDistinctWhenDeduplicating()
    {
        Assert.NotEqual(DraftQuality.StemKey("請計算 2+3 的結果？"), DraftQuality.StemKey("請計算 2-3 的結果？"));
        Assert.NotEqual(DraftQuality.StemKey("比較 (1,2) 與原點的位置？"), DraftQuality.StemKey("比較 (12) 與原點的位置？"));
        Assert.Equal(DraftQuality.StemKey("植物吸收水分的部位？"), DraftQuality.StemKey("植物吸收水分的部位?"));
    }
    private static SourceDocument Course(int points, bool complex = false) => Source(string.Join("", Enumerable.Range(0, points).Select(i => complex ? $"第{i}項測量應比較不同條件，因此需控制實驗變因並依公式計算結果。" : $"第{i}個量測重點是使用正確器材並保留數據。")));
    [Theory] [InlineData(7, false, 20)] [InlineData(10, false, 20)] [InlineData(15, false, 30)] [InlineData(10, true, 40)] [InlineData(25, false, 50)] [InlineData(100, true, 400)]
    public void CoursePlansHaveMinimumTwentyWithoutAnUpperLimit(int points, bool complex, int expected)
    {
        var plan = QuestionPlanning.Build(Course(points, complex), 0); Assert.True(plan.CanGenerate); Assert.Equal(expected, plan.QuestionCount); Assert.Equal(expected, plan.TargetQuestionCount); Assert.Equal(plan.QuestionCount, plan.Targets.Select(t => t.Slot).Distinct().Count());
        Assert.All(plan.Targets, t => Assert.InRange(t.PointIndex, 0, points - 1)); Assert.Equal(plan.Targets.Where(t => t.Type == "fillBlank").Count(), plan.Targets.Where(t => t.Type == "fillBlank").Select(t => t.PointIndex).Distinct().Count());
        Assert.Equal(points, plan.CoveredPointCount); Assert.Contains(plan.Targets, t => t.PointIndex == points - 1); Assert.Empty(plan.Warnings);
    }
    [Fact] public async Task ModelPreviewUsesSameTwoTargetsAndCannotReleaseAsCourse()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var source = Source(Simple); var batch = Batch(source, true); batch.IsPreview = true; batch.Plan = QuestionPlanning.Preview(batch.Plan!);
        Assert.True(batch.Plan.CanGenerate); Assert.Equal(new[] { "choice", "fillBlank" }, batch.Plan.Targets.Select(t => t.Type));
        var other = FactoryJson.Clone(batch); other.Model = new("ollama", "other-model"); Assert.Equal(JsonSerializer.Serialize(batch.Plan), JsonSerializer.Serialize(other.Plan));
        var docs = new DocumentStore(options); var drafts = new DraftStore(options); docs.Create(source); drafts.Create(batch);
        await new GenerationWorker(drafts, docs, new GenerationQueue(), new PlannedGenerator(batch), NullLogger<GenerationWorker>.Instance).Process(batch.Id, default);
        var result = drafts.Get(batch.Id); Assert.Equal(2, result.Questions.Count); Assert.Empty(result.Entries); Assert.NotNull(result.GenerationStartedAt); Assert.NotNull(result.GenerationCompletedAt); Assert.All(result.Questions, q => Assert.Equal(ReviewStatus.Draft, q.Status));
        result.Questions.ForEach(q => q.Status = ReviewStatus.Approved); Assert.Contains(DraftQuality.ReleaseErrors(result), e => e.Contains("模型預覽僅供人工比較"));
    }
    [Fact] public void PreviewQueuesAllowDifferentModelsAndDoNotBlockFormalWork()
    {
        using var files = new TemporaryFiles(); var store = new DraftStore(new() { DataDirectory = files.Root }); var source = Course(10); var course = Batch(source, true); store.Create(course);
        var a = FactoryJson.Clone(course); a.Id = Guid.NewGuid(); a.IsPreview = true; a.Plan = QuestionPlanning.Preview(course.Plan!); a.Model = new("llamaCpp", "model-a"); store.Create(a);
        var b = FactoryJson.Clone(a); b.Id = Guid.NewGuid(); b.Model = new("ollama", "model-b"); store.Create(b);
        var duplicate = FactoryJson.Clone(a); duplicate.Id = Guid.NewGuid(); Assert.Throws<FactoryException>(() => store.Create(duplicate)); Assert.Equal(3, store.List(source.Id).Length);
    }
    [Fact] public void FillBlankUsesAnIntactClauseWhenAnswerAlsoAppearsInACompound()
    {
        using var data = JsonDocument.Parse("""{"type":"fillBlank","stem":"___","options":[],"answerIndex":0,"acceptedAnswers":["溫度"],"explanation":"溫度表示物體冷熱的程度，可以使用溫度計測量。","difficulty":1,"pageNumber":1,"sourceQuote":"溫度表示物體冷熱的程度，可使用溫度計測量。"}""");
        var q = GenerationPrompts.Question(data.RootElement, Guid.NewGuid()); Assert.Equal("請填入適當詞語：___表示物體冷熱的程度", q.Stem); Assert.Equal("溫度表示物體冷熱的程度，可使用溫度計測量。", q.SourceRef.Quote);
    }
    [Fact] public async Task WorkerRejectsTooShortNewCourseWithoutCallingModel()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var source = Source(Simple); var batch = Batch(source, true); var docs = new DocumentStore(options); var drafts = new DraftStore(options); docs.Create(source); drafts.Create(batch);
        await Assert.ThrowsAsync<FactoryException>(() => new GenerationWorker(drafts, docs, new GenerationQueue(), new PlannedGenerator(batch), NullLogger<GenerationWorker>.Instance).Process(batch.Id, default)); Assert.Empty(drafts.Get(batch.Id).Questions);
    }
    [Fact] public async Task CourseReleasesTwentyApprovedQuestionsAndBlocksBelowMinimumAfterSkipping()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var source = Course(10); var batch = Batch(source, true); var docs = new DocumentStore(options); var drafts = new DraftStore(options); docs.Create(source); drafts.Create(batch);
        await new GenerationWorker(drafts, docs, new GenerationQueue(), new PlannedGenerator(batch), NullLogger<GenerationWorker>.Instance).Process(batch.Id, default);
        var result = drafts.Get(batch.Id); Assert.Equal(20, result.Questions.Count); result.Questions.ForEach(q => q.Status = ReviewStatus.Approved); result.Entries.ForEach(e => e.Status = ReviewStatus.Approved); Assert.Empty(DraftQuality.ReleaseErrors(result));
        var skipped = result.Questions[0]; result.Questions.RemoveAt(0); result.SkippedQuestions[skipped.Slot] = "來源不足"; Assert.Contains(DraftQuality.ReleaseErrors(result), e => e.Contains("至少 20 題"));
    }
    [Fact] public async Task WorkerUsesAdaptiveTargetsAndRecordsInsufficientMaterialWithoutPadding()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var source = Source(Simple + Complex); var batch = Batch(source); var docs = new DocumentStore(options); var drafts = new DraftStore(options); docs.Create(source); drafts.Create(batch);
        var model = new PlannedGenerator(batch) { SkipSlot = 0 }; var worker = new GenerationWorker(drafts, docs, new GenerationQueue(), model, NullLogger<GenerationWorker>.Instance);
        await worker.Process(batch.Id, default); var result = drafts.Get(batch.Id);
        Assert.Equal(BatchStatus.Review, result.Status); Assert.Equal(batch.Plan!.QuestionCount - 1, result.Questions.Count); Assert.Single(result.SkippedQuestions); Assert.Equal(3, result.Entries.Count);
        Assert.Empty(DraftQuality.SetErrors(result.Questions, result)); Assert.All(result.Questions, q => Assert.Equal(ReviewStatus.Draft, q.Status)); Assert.NotEmpty(DraftQuality.ReleaseErrors(result));
        result.Questions.ForEach(q => q.Status = ReviewStatus.Approved); result.Entries.ForEach(e => e.Status = ReviewStatus.Approved); Assert.Empty(DraftQuality.ReleaseErrors(result));
        result.Questions.RemoveAt(0); Assert.NotEmpty(DraftQuality.ReleaseErrors(result));
        Assert.Single(new DraftStore(options).Get(batch.Id).SkippedQuestions);
    }
    [Fact] public async Task ShortUnitCanCompleteAndBeReviewedWithoutTwelveQuestions()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var source = Source(Simple.Split('。')[0] + "。"); var batch = Batch(source); var docs = new DocumentStore(options); var drafts = new DraftStore(options); docs.Create(source); drafts.Create(batch);
        await new GenerationWorker(drafts, docs, new GenerationQueue(), new PlannedGenerator(batch), NullLogger<GenerationWorker>.Instance).Process(batch.Id, default);
        var result = drafts.Get(batch.Id); Assert.Single(result.Questions); Assert.Single(result.Entries); result.Questions[0].Status = ReviewStatus.Approved; result.Entries[0].Status = ReviewStatus.Approved; Assert.Empty(DraftQuality.ReleaseErrors(result));
    }
    [Fact] public async Task PartialWorkResumesWithoutReplacingExistingQuestionIds()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var source = Source(Simple + Complex); var batch = Batch(source); var docs = new DocumentStore(options); var drafts = new DraftStore(options); docs.Create(source); drafts.Create(batch);
        var model = new PlannedGenerator(batch) { FailSlot = 2 }; var worker = new GenerationWorker(drafts, docs, new GenerationQueue(), model, NullLogger<GenerationWorker>.Instance);
        await Assert.ThrowsAsync<HttpRequestException>(() => worker.Process(batch.Id, default)); var ids = drafts.Get(batch.Id).Questions.Select(q => q.Id).ToArray(); Assert.Equal(2, ids.Length);
        drafts.Update(batch.Id, b => b.Status = BatchStatus.Queued); model.FailSlot = null; await worker.Process(batch.Id, default);
        var result = drafts.Get(batch.Id); Assert.All(ids, id => Assert.Contains(result.Questions, q => q.Id == id)); Assert.Equal(batch.Plan!.QuestionCount, result.Questions.Count);
    }
    private sealed class PlannedGenerator(DraftBatch batch) : IGenerationProvider
    {
        public int? SkipSlot { get; set; } public int? FailSlot { get; set; }
        public Task<LocalModel[]> Models(CancellationToken token) => Task.FromResult(Array.Empty<LocalModel>());
        public Task<ModelOutput> Generate(ModelSelection model, string prompt, object schema, CancellationToken token)
        {
            token.ThrowIfCancellationRequested(); object output;
            if (prompt.Contains("輸出entries")) output = new { insufficientMaterial = false, entries = Enumerable.Range(0, batch.Plan!.EntryCount).Select(i => new { title = $"測量知識{i}", text = Simple, illustration = "water", pageNumber = 1, sourceQuote = batch.Plan!.Points[0].Text }) };
            else
            {
                var slot = int.Parse(System.Text.RegularExpressions.Regex.Match(prompt, @"第(\d+)題：").Groups[1].Value) - 1; var t = batch.Plan!.Targets[slot]; var point = batch.Plan.Points[t.PointIndex];
                if (slot == FailSlot) throw new HttpRequestException("測試中斷");
                var answer = point.Text.Contains("個量測重點") ? "器材" : point.Text[..2];
                output = slot == SkipSlot ? (object)new { insufficientMaterial = true, questions = Array.Empty<object>() } : new { insufficientMaterial = false, questions = new[] { new { type = t.Type, stem = $"教材第{slot + 1}項考點應該如何正確判斷？", options = t.Type == "choice" ? new[] { "天平", "量筒", "直尺", "磁鐵" } : [], answerIndex = t.AnswerIndex, acceptedAnswers = t.Type == "fillBlank" ? new[] { answer } : [], difficulty = t.Difficulty, explanation = "請依教材原文辨認測量方法與數量之間的關係。", pageNumber = point.PageNumber, sourceQuote = point.Text } } };
            }
            var raw = JsonSerializer.Serialize(output); using var json = JsonDocument.Parse(raw); return Task.FromResult(new ModelOutput(json.RootElement.Clone(), raw));
        }
    }
}
