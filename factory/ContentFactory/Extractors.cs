using System.IO.Compression;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using System.Text;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace ContentFactory;

public sealed class DocumentExtractor(IOcrProvider ocr)
{
    public static bool HasText(string text) => text.Count(char.IsLetterOrDigit) >= 6;
    public async Task<SourcePage[]> Extract(SourceDocument document, DocumentStore store, Func<int, string, Task> progress, CancellationToken token)
    {
        var pages = new List<SourcePage>();
        if (document.Files.Length == 1 && document.Files[0].MediaType == "application/pdf")
        {
            var file = document.Files[0]; var path = store.FilePath(document.Id, file);
            using var pdf = PdfDocument.Open(path);
            if (pdf.NumberOfPages > FactoryOptions.MaxPages) throw new FactoryException("教材最多支援 600 頁，請依章節分開上傳。");
            foreach (var page in pdf.GetPages())
            {
                token.ThrowIfCancellationRequested(); var text = ContentOrderTextExtractor.GetText(page); var method = "pdf-text"; var confidence = 1d;
                if (document.Replacements.TryGetValue(page.Number, out var replacement)) { var result = await ocr.ReadAsync(store.FilePath(document.Id, replacement), null, token); text = result.Text; method = result.Method; confidence = result.Confidence; }
                else if (!HasText(text)) { var result = await ocr.ReadAsync(path, page.Number, token); text = result.Text; method = result.Method; confidence = result.Confidence; }
                pages.Add(new(page.Number, Normalize(text), method, confidence, replacement?.Id ?? file.Id));
                await progress(5 + page.Number * 65 / pdf.NumberOfPages, $"已擷取第 {page.Number} / {pdf.NumberOfPages} 頁");
            }
        }
        else if (document.Files.Length == 1 && document.Files[0].MediaType == "application/epub+zip")
        {
            pages.AddRange(ReadEpub(store.FilePath(document.Id, document.Files[0]), document.Files[0].Id));
            foreach (var (number, replacement) in document.Replacements)
            {
                if (number < 1 || number > pages.Count) continue; var result = await ocr.ReadAsync(store.FilePath(document.Id, replacement), null, token);
                pages[number - 1] = new(number, Normalize(result.Text), result.Method, result.Confidence, replacement.Id, pages[number - 1].Section);
            }
            await progress(70, $"已擷取 EPUB {pages.Count} 個閱讀段落（依閱讀順序編頁）");
        }
        else
        {
            foreach (var file in document.Files)
            {
                var source = document.Replacements.GetValueOrDefault(pages.Count + 1) ?? file;
                var result = await ocr.ReadAsync(store.FilePath(document.Id, source), null, token);
                pages.Add(new(pages.Count + 1, Normalize(result.Text), result.Method, result.Confidence, source.Id));
                await progress(5 + pages.Count * 65 / document.Files.Length, $"已辨識第 {pages.Count} / {document.Files.Length} 張圖片");
            }
        }
        if (pages.Sum(p => p.Text.Length) > 2_000_000) throw new FactoryException("教材文字量超過兩百萬字，請依章節拆分。");
        return pages.ToArray();
    }
    public static string Normalize(string text) => Regex.Replace(Regex.Replace(text.Normalize(NormalizationForm.FormKC).Replace("\r", ""), @"[ \t]+", " "), @"(?<=[\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])", "").Trim();
    private static XDocument Xml(ZipArchiveEntry entry)
    {
        if (entry.Length > 10 * 1024 * 1024) throw new FactoryException("EPUB 單一章節過大。");
        using var stream = entry.Open(); using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore, XmlResolver = null, MaxCharactersInDocument = 10 * 1024 * 1024 }); return XDocument.Load(reader);
    }
    private static string ResolveEntry(string directory, string href)
    {
        if (Uri.TryCreate(href, UriKind.Absolute, out _)) throw new FactoryException("EPUB 章節不可引用外部網址。");
        var resolved = new Uri(new Uri("https://epub.invalid/" + directory), href).AbsolutePath.TrimStart('/'); return Uri.UnescapeDataString(resolved.Split('#')[0]);
    }
    private static string Text(XDocument xml)
    {
        xml.Descendants().Where(e => e.Name.LocalName is "script" or "style").Remove();
        var body = xml.Descendants().FirstOrDefault(e => e.Name.LocalName == "body") ?? xml.Root!;
        var blocks = body.Descendants().Where(e => e.Name.LocalName is "h1" or "h2" or "h3" or "p" or "li").Where(e => !e.Ancestors().Any(a => a.Name.LocalName is "p" or "li")).Select(e => e.Value.Trim()).Where(v => v.Length > 0).ToArray();
        return Normalize(blocks.Length > 0 ? string.Join('\n', blocks) : body.Value);
    }
    public static SourcePage[] ReadEpub(string path, Guid fileId)
    {
        using var archive = ZipFile.OpenRead(path);
        var container = Xml(archive.GetEntry("META-INF/container.xml") ?? throw new FactoryException("EPUB 缺少 container.xml。"));
        var opfPath = container.Descendants().FirstOrDefault(e => e.Name.LocalName == "rootfile")?.Attribute("full-path")?.Value ?? throw new FactoryException("EPUB 缺少閱讀清單。");
        var opf = Xml(archive.GetEntry(opfPath) ?? throw new FactoryException("EPUB 找不到內容描述檔。"));
        var directory = opfPath.Contains('/') ? opfPath[..(opfPath.LastIndexOf('/') + 1)] : "";
        var items = opf.Descendants().Where(e => e.Name.LocalName == "item").ToDictionary(e => e.Attribute("id")!.Value);
        var metadata = string.Join('\n', opf.Descendants().Where(e => e.Name.LocalName is "title" or "creator" or "publisher" or "subject" or "description").Select(e => e.Value));
        var nav = items.Values.FirstOrDefault(e => (e.Attribute("properties")?.Value.Split(' ') ?? []).Contains("nav"));
        var toc = nav is null ? "" : Text(Xml(archive.GetEntry(ResolveEntry(directory, nav.Attribute("href")!.Value)) ?? throw new FactoryException("EPUB 找不到目錄檔。")));
        if (nav is null)
        {
            var ncx = items.Values.FirstOrDefault(e => e.Attribute("media-type")?.Value == "application/x-dtbncx+xml");
            if (ncx is not null) { var xml = Xml(archive.GetEntry(ResolveEntry(directory, ncx.Attribute("href")!.Value))!); toc = string.Join('\n', xml.Descendants().Where(e => e.Name.LocalName == "text").Select(e => e.Value)); }
        }
        var pages = new List<SourcePage> { new(1, Normalize(metadata), "epub-metadata", 1, fileId, "書籍資訊"), new(2, Normalize(toc), "epub-toc", 1, fileId, "目錄") };
        foreach (var reference in opf.Descendants().Where(e => e.Name.LocalName == "itemref"))
        {
            if (!items.TryGetValue(reference.Attribute("idref")?.Value ?? "", out var item)) throw new FactoryException("EPUB spine 引用了不存在的章節。");
            if (item == nav) continue;
            var href = ResolveEntry(directory, item.Attribute("href")?.Value ?? ""); var entry = archive.GetEntry(href) ?? throw new FactoryException("EPUB 找不到閱讀章節。");
            var text = Text(Xml(entry)); if (!HasText(text) && (item.Attribute("properties")?.Value.Contains("cover") == true || href.Contains("cover", StringComparison.OrdinalIgnoreCase))) continue;
            pages.Add(new(pages.Count + 1, text, "epub-text", 1, fileId, href));
            if (pages.Count > FactoryOptions.MaxPages) throw new FactoryException("EPUB 超過 600 個閱讀段落。");
        }
        return pages.ToArray();
    }
}
