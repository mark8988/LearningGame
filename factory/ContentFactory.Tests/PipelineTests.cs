using ContentFactory;
using Microsoft.Extensions.Logging.Abstractions;
using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace ContentFactoryTests;

public sealed class TemporaryFiles : IDisposable
{
    public string Root { get; } = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../.local/factory-unit-data", Guid.NewGuid().ToString("N")));
    public TemporaryFiles() => Directory.CreateDirectory(Root);
    public void Dispose() { /* Retain generated test materials and records at the user's request. */ }
}
public sealed class PipelineTests
{
    [Fact] public void NormalizesPdfRadicalsAndOcrSpacingWithoutChangingSourcePages() => Assert.Equal("第一單元自然", DocumentExtractor.Normalize("第⼀單元 自 然"));
    private static SourcePage Page(int number, string text) => new(number, text, "test", 1, Guid.NewGuid());
    [Theory]
    [InlineData("國小一年級 國語 翰林", "國小", 1, "國語文")]
    [InlineData("國小二年級 數學 南一", "國小", 2, "數學")]
    [InlineData("國小三年級 自然 康軒", "國小", 3, "自然科學")]
    [InlineData("國小四年級 社會 翰林", "國小", 4, "社會")]
    [InlineData("國小五年級 英語 南一", "國小", 5, "英語文")]
    [InlineData("國小六年級 健康與體育 康軒", "國小", 6, "健康與體育")]
    [InlineData("國中一年級 數學 南一", "國中", 7, "數學")]
    [InlineData("國中二年級 自然科學 康軒", "國中", 8, "自然科學")]
    [InlineData("高中一年級 歷史 三民", "高中", 10, "歷史")]
    [InlineData("高中二年級 化學 龍騰", "高中", 11, "化學")]
    public async Task ClassifiesTenExplicitCurriculumCovers(string text, string school, int grade, string subject)
    {
        var result = await new LocalClassificationProvider().ClassifyAsync([Page(1, text), Page(2, "目錄 第一單元 學習與發現")], 1, 2, default);
        Assert.Equal(school, result.School); Assert.Equal(grade, result.Grade); Assert.Equal(subject, result.Subject); Assert.True(result.Confidence >= 0.7); Assert.NotEmpty(result.Evidence);
    }
    [Theory]
    [InlineData("觀察與探索手冊 自然")]
    [InlineData("國小三年級 自然與數學 跨領域")]
    [InlineData("家庭學習講義 未註明年級")]
    public async Task AmbiguousMetadataAlwaysRequiresReview(string text)
    {
        var result = await new LocalClassificationProvider().ClassifyAsync([Page(1, text), Page(2, "目錄 第一單元 探索")], 1, 2, default);
        Assert.True(result.Confidence < 0.7); Assert.True(DocumentStructure.RequiresReview(result, [new("探索", 3, 3, false)]));
    }
    [Fact] public void HeadingAndTocAndFallbackRetainPageRanges()
    {
        var pages = new[] { Page(1, "封面 年級 科目"), Page(2, "目錄 學習單元清單"), Page(3, "第一單元 植物\n植物有根莖葉"), Page(4, "觀察植物的葉子"), Page(5, "第二單元 動物\n動物具有特徵") };
        var units = DocumentStructure.Units(pages, 1, 2); Assert.Equal(2, units.Length); Assert.Equal(4, units[0].EndPage); Assert.Equal(5, units[1].StartPage);
        var toc = new[] { Page(1, "封面 年級 科目"), Page(2, "植物世界 …… 3\n動物世界 …… 5"), Page(3, "觀察植物根莖葉"), Page(4, "植物需要水分"), Page(5, "動物的特徵觀察") };
        Assert.Equal("植物世界", DocumentStructure.Units(toc, 1, 2)[0].Name);
        var fallback = DocumentStructure.Units(pages.Select(p => p.Number == 2 || p.Number >= 3 ? p with { Text = "沒有章節標題的學習內容" } : p).ToArray(), 1, 2);
        Assert.All(fallback, u => Assert.True(u.LowConfidence)); Assert.Equal(3, fallback[0].StartPage);
        var chunks = DocumentStructure.Chunks(pages, units); Assert.Contains("第 3 頁", chunks[0].Text); Assert.Equal(3, chunks[0].StartPage);
    }
    [Fact] public void UnitAmbiguityRequiresReviewEvenWhenCoverIsConfident()
    {
        var result = new ClassificationResult("國小", 3, "自然科學", "康軒", 0.99, "test", []);
        Assert.True(DocumentStructure.RequiresReview(result, [])); Assert.True(DocumentStructure.RequiresReview(result, [new("待確認單元 1", 3, 3, true)]));
    }
    [Fact] public void ConfirmationRejectsInvalidCurriculumAndOverlappingRanges()
    {
        var doc = new SourceDocument { Pages = [Page(1, "一"), Page(2, "二"), Page(3, "三"), Page(4, "四")] };
        var input = new ClassificationConfirmation("國小", 3, "自然科學", "康軒", [new("植物", 3, 4, false)]);
        Curriculum.ValidateConfirmation(input, doc);
        Assert.Throws<FactoryException>(() => Curriculum.ValidateConfirmation(input with { Grade = 8 }, doc));
        Assert.Throws<FactoryException>(() => Curriculum.ValidateConfirmation(input with { Units = [new("甲", 2, 3, false), new("乙", 3, 4, false)] }, doc));
        Assert.Throws<FactoryException>(() => Curriculum.ValidateConfirmation(input with { Units = [new("待確認單元 1", 3, 4, false)] }, doc));
    }
    [Fact] public void DurableStoreRecoversAndReturnsIndependentSnapshots()
    {
        using var files = new TemporaryFiles(); var options = new FactoryOptions { DataDirectory = files.Root }; var store = new DocumentStore(options); var doc = new SourceDocument { Title = "本機教材" }; store.Create(doc);
        store.Update(doc.Id, d => DocumentStore.Stage(d, DocumentStatus.NeedsReview, 100, "待家長確認"));
        var restored = new DocumentStore(options).Get(doc.Id); Assert.Equal(DocumentStatus.NeedsReview, restored.Status); Assert.Equal(1, restored.Revision);
        restored.Title = "修改副本"; Assert.Equal("本機教材", store.Get(doc.Id).Title);
        Assert.Throws<FactoryException>(() => store.Update(doc.Id, d => { d.Title = "不可提交"; throw new FactoryException("fail"); })); Assert.Equal("本機教材", store.Get(doc.Id).Title);
    }
    [Fact] public void UploadRulesRejectWrongFormatsMixedBooksAndOverLimit()
    {
        Assert.Throws<FactoryException>(() => UploadValidation.ValidateSet([("book.pdf", FactoryOptions.MaxUploadBytes + 1)]));
        Assert.Throws<FactoryException>(() => UploadValidation.ValidateSet([("book.pdf", 10), ("page.png", 10)]));
        Assert.Throws<FactoryException>(() => UploadValidation.ValidateSet([("run.exe", 10)]));
        UploadValidation.ValidateSet([("cover.PNG", 10), ("toc.jpg", 10)]);
    }
    [Fact] public async Task WrongFileSignatureIsRejected()
    {
        using var files = new TemporaryFiles(); var path = Path.Combine(files.Root, "fake.pdf"); await File.WriteAllTextAsync(path, "not a pdf"); await Assert.ThrowsAsync<FactoryException>(() => UploadValidation.ValidateSignature(path, ".pdf", default));
    }
    [Fact] public async Task WorkerBlocksUnreadableCoverBeforeClassifier()
    {
        using var files = new TemporaryFiles(); var store = new DocumentStore(new() { DataDirectory = files.Root }); var doc = new SourceDocument { Files = [new(Guid.NewGuid(), "cover.png", "1.png", "image/png", 10), new(Guid.NewGuid(), "toc.png", "2.png", "image/png", 10), new(Guid.NewGuid(), "body.png", "3.png", "image/png", 10)] }; store.Create(doc);
        var ocr = new FakeOcr(["", "目錄 第一單元 觀察植物", "第一單元 植物\n觀察植物根莖葉"]); var classifier = new CountingClassifier();
        var worker = new DocumentWorker(store, new(), new(ocr), classifier, NullLogger<DocumentWorker>.Instance); await worker.Process(doc.Id, default);
        Assert.Equal(DocumentStatus.NeedsPages, store.Get(doc.Id).Status); Assert.Equal(0, classifier.Calls); Assert.Null(store.Get(doc.Id).Classification);
    }
    [Fact] public async Task WorkerPersistsLowConfidenceGateAndDoesNotClaimReady()
    {
        using var files = new TemporaryFiles(); var store = new DocumentStore(new() { DataDirectory = files.Root }); var doc = new SourceDocument { Files = Enumerable.Range(1, 3).Select(i => new SourceFile(Guid.NewGuid(), $"{i}.png", $"{i}.png", "image/png", 10)).ToArray() }; store.Create(doc);
        var worker = new DocumentWorker(store, new(), new(new FakeOcr(["家庭學習講義 未註明課程", "目錄 日常觀察與實驗", "我們一起來觀察植物的根葉"])), new LocalClassificationProvider(), NullLogger<DocumentWorker>.Instance);
        await worker.Process(doc.Id, default); var result = store.Get(doc.Id); Assert.Equal(DocumentStatus.NeedsReview, result.Status); Assert.All(result.Units, u => Assert.True(u.LowConfidence)); Assert.NotEmpty(result.Chunks); Assert.Null(result.ConfirmedAt);
    }
    [Fact] public void EpubUsesSpineOrderAndPreservesHeadingsWithoutNetworkAccess()
    {
        using var files = new TemporaryFiles(); var path = Path.Combine(files.Root, "book.epub");
        using (var zip = ZipFile.Open(path, ZipArchiveMode.Create))
        {
            Add(zip, "META-INF/container.xml", "<container><rootfiles><rootfile full-path='OPS/book.opf'/></rootfiles></container>");
            Add(zip, "OPS/book.opf", "<package><metadata><title>國小三年級自然康軒教材</title></metadata><manifest><item id='nav' href='nav.xhtml' properties='nav'/><item id='a' href='a.xhtml'/><item id='b' href='b.xhtml'/></manifest><spine><itemref idref='b'/><itemref idref='a'/></spine></package>");
            Add(zip, "OPS/nav.xhtml", "<html><body><p>目錄 第一單元 植物</p></body></html>"); Add(zip, "OPS/a.xhtml", "<html><body><h1>第二單元 動物</h1><p>動物會生長</p></body></html>"); Add(zip, "OPS/b.xhtml", "<html><body><h1>第一單元 植物</h1><p>根莖葉的功能</p><script>ignore me</script></body></html>");
        }
        var pages = DocumentExtractor.ReadEpub(path, Guid.NewGuid()); Assert.Equal(4, pages.Length); Assert.Contains("第一單元", pages[2].Text); Assert.DoesNotContain("ignore me", pages[2].Text); Assert.Equal("OPS/b.xhtml", pages[2].Section); Assert.Equal(3, pages[2].Number);
    }
    private static void Add(ZipArchive zip, string name, string value) { using var stream = new StreamWriter(zip.CreateEntry(name).Open()); stream.Write(value); }
    private sealed class FakeOcr(string[] texts) : IOcrProvider { private int index; public Task<OcrText> ReadAsync(string path, int? page, CancellationToken token) => Task.FromResult(new OcrText(texts[index++], 0.9, "fake")); }
    private sealed class CountingClassifier : ILlmProvider { public int Calls; public Task<ClassificationResult> ClassifyAsync(SourcePage[] pages, int coverPage, int tocPage, CancellationToken token) { Calls++; return Task.FromResult(new ClassificationResult("", null, "", "", 0, "test", [])); } }
}
