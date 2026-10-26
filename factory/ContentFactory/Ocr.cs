using System.Net.Http.Headers;
using System.Text.Json;
using Tesseract;

namespace ContentFactory;

public sealed record OcrText(string Text, double Confidence, string Method);
public interface IOcrProvider { Task<OcrText> ReadAsync(string path, int? pdfPage, CancellationToken token); }
public sealed class LocalOcrProvider(FactoryOptions options) : IOcrProvider
{
    public Task<OcrText> ReadAsync(string path, int? pdfPage, CancellationToken token) => Task.Run(() =>
    {
        token.ThrowIfCancellationRequested();
        if (!OperatingSystem.IsWindows()) throw new FactoryException("目前本機 OCR 套件以 Windows x64 驗收，其他平台請配置原生 Tesseract 或 Azure 供應商。");
        var data = Path.GetFullPath(options.TessdataDirectory);
        if (!File.Exists(Path.Combine(data, "chi_tra.traineddata")) || !File.Exists(Path.Combine(data, "eng.traineddata"))) throw new FactoryException("本機 OCR 語言包尚未準備，請執行 scripts/Setup-Factory.ps1 後重試。");
        byte[] image;
        if (pdfPage.HasValue)
        {
            var dpi = 200;
            using (var source = UglyToad.PdfPig.PdfDocument.Open(path))
            {
                var sourcePage = source.GetPage(pdfPage.Value);
                var scan = sourcePage.GetImages().OrderByDescending(i => (long)i.WidthInSamples * i.HeightInSamples).FirstOrDefault();
                if (scan is not null && scan.BoundingBox.Width >= sourcePage.Width * 0.8 && scan.BoundingBox.Height >= sourcePage.Height * 0.8)
                    dpi = (int)Math.Clamp(Math.Round(scan.WidthInSamples * 72 / scan.BoundingBox.Width), 72, 200);
            }
            using var input = File.OpenRead(path); using var output = new MemoryStream();
            // PDFtoImage's platform names use different casing from the SDK guard.
#pragma warning disable CA1416
            PDFtoImage.Conversion.SavePng(output, input, page: pdfPage.Value - 1, options: new PDFtoImage.RenderOptions(Dpi: dpi));
#pragma warning restore CA1416
            image = output.ToArray();
        }
        else image = File.ReadAllBytes(path);
        using var pix = Pix.LoadFromMemory(image);
        if ((long)pix.Width * pix.Height > 50_000_000) throw new FactoryException("圖片解析度過大，請縮小至五千萬像素以內。");
        using var engine = new TesseractEngine(data, "chi_tra+eng", EngineMode.LstmOnly);
        OcrText Recognize(PageSegMode mode)
        {
            using var page = engine.Process(pix, mode); return new(page.GetText(), page.GetMeanConfidence(), "tesseract");
        }
        var result = Recognize(PageSegMode.Auto);
        if (result.Confidence < 0.93)
        {
            var block = Recognize(PageSegMode.SingleBlock);
            if (block.Confidence > result.Confidence) result = block;
        }
        token.ThrowIfCancellationRequested(); return result;
    }, token);
}
public sealed class AzureOcrProvider(HttpClient client, FactoryOptions options) : IOcrProvider
{
    public async Task<OcrText> ReadAsync(string path, int? pdfPage, CancellationToken token)
    {
        if (!Uri.TryCreate(options.AzureEndpoint.TrimEnd('/') + "/", UriKind.Absolute, out var endpoint) || endpoint.Scheme != "https" || string.IsNullOrWhiteSpace(options.AzureKey)) throw new FactoryException("Azure OCR 尚未設定 Endpoint 與 Key。");
        var url = new Uri(endpoint, $"documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30&locale=zh-Hant{(pdfPage.HasValue ? $"&pages={pdfPage}" : "")}");
        await using var stream = File.OpenRead(path); using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = new StreamContent(stream) };
        request.Headers.Add("Ocp-Apim-Subscription-Key", options.AzureKey); request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        using var response = await client.SendAsync(request, token);
        if (!response.IsSuccessStatusCode || !response.Headers.TryGetValues("Operation-Location", out var locations)) throw new FactoryException("Azure OCR 無法接受教材，請檢查服務設定與檔案格式。");
        if (!Uri.TryCreate(locations.First(), UriKind.Absolute, out var location) || location.Scheme != "https" || location.Host != endpoint.Host || location.Port != endpoint.Port) throw new FactoryException("Azure OCR 回傳了不符服務位置的結果網址。");
        for (var attempt = 0; attempt < 120; attempt++)
        {
            await Task.Delay(TimeSpan.FromSeconds(1), token); using var poll = new HttpRequestMessage(HttpMethod.Get, location); poll.Headers.Add("Ocp-Apim-Subscription-Key", options.AzureKey);
            using var result = await client.SendAsync(poll, token); if (!result.IsSuccessStatusCode) throw new FactoryException("Azure OCR 查詢失敗，請稍後重試。");
            using var json = JsonDocument.Parse(await result.Content.ReadAsStringAsync(token)); var root = json.RootElement;
            var status = root.GetProperty("status").GetString(); if (status == "failed") throw new FactoryException("Azure OCR 擷取失敗，請檢查掃描品質。");
            if (status == "succeeded")
            {
                var analysis = root.GetProperty("analyzeResult"); var confidence = new List<double>();
                if (analysis.TryGetProperty("pages", out var pages)) foreach (var page in pages.EnumerateArray()) if (page.TryGetProperty("words", out var words)) foreach (var word in words.EnumerateArray()) if (word.TryGetProperty("confidence", out var score)) confidence.Add(score.GetDouble());
                return new(analysis.GetProperty("content").GetString() ?? "", confidence.Count > 0 ? confidence.Average() : 0, "azure");
            }
        }
        throw new FactoryException("Azure OCR 等待逾時，請稍後重試。");
    }
}
