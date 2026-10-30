using ContentFactory;
using System.Text.Json;
using Xunit;

namespace ContentFactoryTests;

public sealed class PackageTests
{
    private const string Facts = "質量表示物體所含物質的量，常用單位為公克。天平用來測量物體質量，讀數應註明單位。體積表示物體占有的空間，常用單位為立方公分。量筒用來測量液體體積，常用單位為毫升。一毫升等於一立方公分，兩者可互相換算。凹液面的讀數以最低處為準，不能讀液面邊緣。讀刻度時眼睛應與液面等高，以避免視差。溫度表示物體冷熱的程度，使用溫度計測量。攝氏度是常用的溫度單位，符號為°C。完整紀錄應寫出數值與單位，並註明使用器材。";
    private static readonly DateTimeOffset At = DateTimeOffset.Parse("2026-10-28T00:00:00Z");
    public static (SourceDocument Source, DraftBatch[] Batches) Fixture(int count = 1)
    {
        var source = new SourceDocument { Title = "自編測量測試教材", Status = DocumentStatus.Ready, Classification = new("國中", 8, "自然科學", "自編", 1, "test", []), Pages = Enumerable.Range(1, count).Select(n => new SourcePage(n, Facts, "pdf", 1, Guid.NewGuid())).ToArray(), Units = Enumerable.Range(1, count).Select(n => new UnitCandidate($"測量單元{n}", n, n, false)).ToArray() };
        var batches = Enumerable.Range(0, count).Select(index =>
        {
            var plan = QuestionPlanning.Build(source, index); var b = new DraftBatch { DocumentId = source.Id, Snapshot = FactoryJson.Clone(source), SourceHash = DraftQuality.Fingerprint(source), UnitIndex = index, UnitName = source.Units[index].Name, Plan = plan, Status = BatchStatus.Review, Revision = 10 };
            b.Questions = plan.Targets.Select(t => new QuestionDraft { Slot = t.Slot, Status = ReviewStatus.Approved, ReviewedAt = At, Content = new($"第{t.Slot + 1}個測量考點應如何正確辨認" + (t.Type == "fillBlank" ? "：___。" : "？"), t.Type == "choice" ? ["天平", "量筒", "直尺", "磁鐵"] : [], t.AnswerIndex, "請依教材原文辨認測量工具與數量的意義。", t.Difficulty, new(source.Id, t.PageNumber, plan.Points[t.PointIndex].Text), t.Type, t.Type == "fillBlank" ? [plan.Points[t.PointIndex].Text[..2]] : []) }).ToList();
            b.Entries = Enumerable.Range(0, 3).Select(n => new EntryDraft { Slot = n, Status = n == 2 ? ReviewStatus.Returned : ReviewStatus.Approved, ReviewedAt = At, Content = new($"測量知識{n}", Facts[..80], "water", new(source.Id, index + 1, plan.Points[0].Text)) }).ToList(); return b;
        }).ToArray(); return (source, batches);
    }
    [Theory] [InlineData(1)] [InlineData(2)]
    public void BuildsGameEnvelopeOnlyFromApprovedContentAndWritesCrossLanguageContract(int count)
    {
        var (source, batches) = Fixture(count); var built = PackageBuilder.Build(source, batches, "國中測量題庫", At); using var json = JsonDocument.Parse(built.Bytes); var files = json.RootElement.GetProperty("files");
        Assert.Equal("learning-adventure:pack", json.RootElement.GetProperty("format").GetString()); Assert.Equal(count * 20, files.GetProperty("questions.json").GetArrayLength()); Assert.Equal(count * 2, files.GetProperty("encyclopedia.json").GetArrayLength());
        Assert.Equal(count, files.GetProperty("units.json").GetArrayLength()); Assert.True(files.GetProperty("knowledge-points.json").GetArrayLength() > 0); Assert.DoesNotContain("測量知識2", System.Text.Encoding.UTF8.GetString(built.Bytes)); Assert.False(files.GetProperty("pack.json").GetProperty("demo").GetBoolean());
        var folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../.local/factory-contracts")); Directory.CreateDirectory(folder); File.WriteAllBytes(Path.Combine(folder, built.Id + ".json"), built.Bytes);
    }
    [Fact] public void SnapshotIdentityIsRepeatableAndChangesWithReviewOrName()
    {
        var (source, batches) = Fixture(); var first = PackageBuilder.Build(source, batches, "題庫", At); Assert.Equal(first.Id, PackageBuilder.Build(source, batches, "題庫", At).Id); Assert.NotEqual(first.Id, PackageBuilder.Build(source, batches, "新題庫", At).Id);
        batches[0].Revision++; Assert.NotEqual(first.Id, PackageBuilder.Build(source, batches, "題庫", At).Id);
    }
    [Fact] public void PreviewDraftsReturnedQuestionsAndShortUnitsCannotPackage()
    {
        var (source, batches) = Fixture(); batches[0].IsPreview = true; Assert.Throws<FactoryException>(() => PackageBuilder.Build(source, batches, "題庫")); batches[0].IsPreview = false;
        batches[0].Questions[0].Status = ReviewStatus.Draft; Assert.Throws<FactoryException>(() => PackageBuilder.Build(source, batches, "題庫")); batches[0].Questions.RemoveAt(0); Assert.Throws<FactoryException>(() => PackageBuilder.Build(source, batches, "題庫"));
    }
    [Fact] public void DuplicateUnitsWrongDocumentStaleSourceAndMissingKnowledgeAreRejected()
    {
        var (source, batches) = Fixture(); Assert.Throws<FactoryException>(() => PackageBuilder.Build(source, [batches[0], batches[0]], "題庫"));
        var wrong = FactoryJson.Clone(source); wrong.Id = Guid.NewGuid(); Assert.Throws<FactoryException>(() => PackageBuilder.Build(wrong, batches, "題庫"));
        var changed = FactoryJson.Clone(source); changed.Pages[0] = changed.Pages[0] with { Text = Facts + "補充內容" }; Assert.Throws<FactoryException>(() => PackageBuilder.Build(changed, batches, "題庫"));
        batches[0].Plan = batches[0].Plan! with { Points = [] }; Assert.Throws<FactoryException>(() => PackageBuilder.Build(source, batches, "題庫"));
    }
    [Fact] public void PackageStoreKeepsOriginalBytesAndDetectsCorruption()
    {
        using var files = new TemporaryFiles(); var store = new PackageStore(new() { DataDirectory = files.Root }); var (source, batches) = Fixture(); var built = PackageBuilder.Build(source, batches, "題庫", At); var record = store.Save(built);
        Assert.Equal(built.Bytes, store.Read(record)); var cached = store.Save(PackageBuilder.Build(source, batches, "題庫", At.AddDays(1))); Assert.Equal(record.CreatedAt, cached.CreatedAt); Assert.Equal(record.Id, cached.Id); Assert.Equal(built.Bytes, store.Read(cached));
        File.AppendAllText(Path.Combine(files.Root, "packages", record.Id + ".pack.json"), "changed"); Assert.Throws<FactoryException>(() => store.Read(record)); Assert.True(File.Exists(Path.Combine(files.Root, "packages", record.Id + ".pack.json")));
    }
    [Fact] public void PreviouslyCreatedPackageStopsDownloadingAfterReviewOrSourceChanges()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var docs = new DocumentStore(options); var drafts = new DraftStore(options); var packages = new PackageStore(options); var (source, batches) = Fixture(); docs.Create(source); drafts.Create(batches[0]);
        var record = packages.Save(PackageBuilder.Build(source, batches, "題庫", At)); Assert.Empty(PackageEndpoints.Errors(record, docs, drafts));
        drafts.Update(batches[0].Id, b => b.Questions[0].Status = ReviewStatus.Returned); Assert.NotEmpty(PackageEndpoints.Errors(record, docs, drafts)); Assert.NotEmpty(packages.Read(record));
        docs.Update(source.Id, d => d.Pages[0] = d.Pages[0] with { Text = Facts + "修正" }); Assert.NotEmpty(PackageEndpoints.Errors(record, docs, drafts));
    }
    [Fact] public void MoreThanFiftyQuestionsCanPackageWithoutTruncation()
    {
        var (source, batches) = Fixture(); var batch = batches[0]; var original = batch.Questions[0];
        batch.Plan = batch.Plan! with { Targets = Enumerable.Range(0, 80).Select(i => new QuestionTarget(i, i % batch.Plan.Points.Length, 1, "choice", 1, i % 4, "理解")).ToArray(), RecommendedCount = 80 };
        batch.Questions = batch.Plan.Targets.Select(t => new QuestionDraft { Slot = t.Slot, Status = ReviewStatus.Approved, ReviewedAt = At, Content = original.Content with { Type = "choice", Stem = $"第{t.Slot + 1}個測量問題應如何作答？", Options = ["天平", "量筒", "直尺", "磁鐵"], AnswerIndex = t.AnswerIndex, AcceptedAnswers = null } }).ToList();
        var built = PackageBuilder.Build(source, batches, "八十題題庫", At); Assert.Equal(80, built.QuestionCount);
        var folder = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../.local/factory-contracts")); Directory.CreateDirectory(folder); File.WriteAllBytes(Path.Combine(folder, built.Id + ".json"), built.Bytes);
    }
}
