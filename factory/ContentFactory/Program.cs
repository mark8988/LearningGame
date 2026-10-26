using ContentFactory;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
var localUrl = builder.Configuration["Factory:Url"] ?? "http://127.0.0.1:5088";
if (!Uri.TryCreate(localUrl, UriKind.Absolute, out var localUri) || !localUri.IsLoopback || localUri.Scheme is not ("http" or "https")) throw new InvalidOperationException("本機版本只允許 loopback 服務位址。");
builder.WebHost.UseUrls(localUrl);
var options = builder.Configuration.GetSection("Factory").Get<FactoryOptions>() ?? new();
options.DataDirectory = Path.GetFullPath(options.DataDirectory, builder.Environment.ContentRootPath);
options.TessdataDirectory = Path.GetFullPath(options.TessdataDirectory, builder.Environment.ContentRootPath);
Directory.CreateDirectory(Path.Combine(options.DataDirectory, "tmp"));
Environment.SetEnvironmentVariable("ASPNETCORE_TEMP", Path.Combine(options.DataDirectory, "tmp"));
builder.WebHost.ConfigureKestrel(server => server.Limits.MaxRequestBodySize = FactoryOptions.MaxUploadBytes + 1024 * 1024);
builder.Services.Configure<FormOptions>(form => { form.MultipartBodyLengthLimit = FactoryOptions.MaxUploadBytes + 1024 * 1024; form.ValueLengthLimit = 1024; form.MultipartHeadersLengthLimit = 8192; });
builder.Services.Configure<JsonOptions>(json => json.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase)));
builder.Services.AddSingleton(options); builder.Services.AddSingleton<DocumentStore>(); builder.Services.AddSingleton<JobQueue>();
builder.Services.AddHttpClient("providers", client => client.Timeout = TimeSpan.FromMinutes(4)).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddSingleton<IOcrProvider>(services => options.OcrProvider.Equals("Azure", StringComparison.OrdinalIgnoreCase) ? new AzureOcrProvider(services.GetRequiredService<IHttpClientFactory>().CreateClient("providers"), options) : new LocalOcrProvider(options));
builder.Services.AddSingleton<ILlmProvider>(services => options.ClassificationProvider.Equals("Anthropic", StringComparison.OrdinalIgnoreCase) ? new AnthropicClassificationProvider(services.GetRequiredService<IHttpClientFactory>().CreateClient("providers"), options) : new LocalClassificationProvider());
builder.Services.AddSingleton<DocumentExtractor>(); builder.Services.AddHostedService<DocumentWorker>();
var app = builder.Build();
// This build is intentionally loopback-only; no textbook API is exposed to the LAN.
app.Use(async (context, next) =>
{
    if (context.Connection.RemoteIpAddress is { } remote && !System.Net.IPAddress.IsLoopback(remote)) { context.Response.StatusCode = 403; return; }
    if (context.Request.Host.Host is not ("127.0.0.1" or "localhost" or "[::1]")) { context.Response.StatusCode = 403; return; }
    if (context.Request.Path.StartsWithSegments("/api") && context.Request.Method != "GET" && context.Request.Headers.Origin is { Count: > 0 } origin && origin != $"{context.Request.Scheme}://{context.Request.Host}") { context.Response.StatusCode = 403; return; }
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (Exception ex) when (ex is FactoryException or KeyNotFoundException or InvalidDataException or BadHttpRequestException or System.Text.Json.JsonException)
    {
        context.Response.StatusCode = ex is KeyNotFoundException ? 404 : ex is BadHttpRequestException { StatusCode: 413 } ? 413 : 400;
        await context.Response.WriteAsJsonAsync(new { error = ex is FactoryException or KeyNotFoundException ? ex.Message : "檔案或請求格式不符，請檢查大小、內容及欄位。" });
    }
});
app.UseDefaultFiles(); app.UseStaticFiles();
app.MapGet("/api/health", () => new { version = "0.7.0", mode = "local", ocrProvider = options.OcrProvider, classificationProvider = options.ClassificationProvider, ocrReady = options.OcrProvider == "Azure" ? !string.IsNullOrEmpty(options.AzureKey) : File.Exists(Path.Combine(options.TessdataDirectory, "chi_tra.traineddata")) && File.Exists(Path.Combine(options.TessdataDirectory, "eng.traineddata")), maxUploadBytes = FactoryOptions.MaxUploadBytes, schools = Curriculum.Schools, subjects = Curriculum.Subjects });
app.MapGet("/api/documents", (DocumentStore store) => store.List().Select(d => new { d.Id, d.Title, d.Status, d.Progress, d.Message, d.CreatedAt, d.UpdatedAt }));
app.MapGet("/api/documents/{id:guid}", (Guid id, DocumentStore store) => store.Get(id));
app.MapPost("/api/documents", async (HttpRequest request, DocumentStore store, JobQueue queue, CancellationToken token) =>
{
    if (!request.HasFormContentType) throw new FactoryException("請使用檔案上傳表單。");
    var form = await request.ReadFormAsync(token); var files = form.Files;
    UploadValidation.ValidateSet(files.Select(f => (f.FileName, f.Length)).ToArray());
    if (!int.TryParse(form["coverPage"], out var cover) || cover < 1 || !int.TryParse(form["tocPage"], out var toc) || toc < 1 || cover == toc) throw new FactoryException("請指定不同的封面與目錄頁碼。");
    var title = form["title"].ToString().Trim(); if (title.Length is < 1 or > 120) throw new FactoryException("教材名稱需為 1 至 120 字。");
    var doc = new SourceDocument { Title = title, CoverPage = cover, TocPage = toc };
    Directory.CreateDirectory(store.Folder(doc.Id)); var sources = new List<SourceFile>();
    foreach (var file in files)
    {
        var ext = UploadValidation.Extension(file.FileName); var source = new SourceFile(Guid.NewGuid(), Path.GetFileName(file.FileName), Guid.NewGuid().ToString("N") + ext, UploadValidation.Types[ext], file.Length);
        var path = store.FilePath(doc.Id, source); await using (var output = File.Create(path)) await file.CopyToAsync(output, token);
        await UploadValidation.ValidateSignature(path, ext, token); sources.Add(source);
    }
    doc.Files = sources.ToArray(); DocumentStore.Stage(doc, DocumentStatus.Queued, 0, "教材已保存，等待文字擷取"); store.Create(doc); queue.Enqueue(doc.Id);
    return Results.Accepted($"/api/documents/{doc.Id}", doc);
});
app.MapPost("/api/documents/{id:guid}/confirm", (Guid id, ConfirmRequest input, DocumentStore store) => store.Update(id, doc =>
{
    if (doc.Revision != input.Revision || doc.Status is not (DocumentStatus.NeedsReview or DocumentStatus.Ready)) throw new FactoryException("教材狀態已變更，請重新載入後確認。");
    Curriculum.ValidateConfirmation(input.Metadata, doc);
    doc.Confirmation = input.Metadata; doc.ConfirmedAt = DateTimeOffset.UtcNow; doc.Units = input.Metadata.Units.Select(u => u with { Name = u.Name.Trim(), LowConfidence = false }).ToArray(); doc.Chunks = DocumentStructure.Chunks(doc.Pages, doc.Units);
    DocumentStore.Stage(doc, DocumentStatus.Ready, 100, "家長已確認歸類與單元頁碼");
}));
app.MapPost("/api/documents/{id:guid}/retry", (Guid id, RetryRequest input, DocumentStore store, JobQueue queue) =>
{
    var doc = store.Update(id, doc =>
    {
        if (doc.Revision != input.Revision || doc.Status is DocumentStatus.Queued or DocumentStatus.Extracting or DocumentStatus.Classifying) throw new FactoryException("教材正在處理或已變更，請稍後重試。");
        if (input.CoverPage < 1 || input.TocPage < 1 || input.CoverPage == input.TocPage) throw new FactoryException("請選擇不同的封面與目錄頁碼。");
        doc.CoverPage = input.CoverPage; doc.TocPage = input.TocPage; doc.Classification = null; doc.Confirmation = null; doc.ConfirmedAt = null; doc.Units = []; doc.Chunks = [];
        DocumentStore.Stage(doc, DocumentStatus.Queued, 0, "已排入重新擷取佇列");
    }); queue.Enqueue(id); return Results.Accepted($"/api/documents/{id}", doc);
});
app.MapPost("/api/documents/{id:guid}/pages/{number:int}", async (Guid id, int number, HttpRequest request, DocumentStore store, CancellationToken token) =>
{
    var current = store.Get(id); if (current.Status is DocumentStatus.Queued or DocumentStatus.Extracting or DocumentStatus.Classifying || number < 1 || number > current.Pages.Length) throw new FactoryException("請在擷取完成後選擇要補傳的頁面。");
    var form = await request.ReadFormAsync(token); var file = form.Files.SingleOrDefault() ?? throw new FactoryException("請選擇一張頁面圖片。");
    UploadValidation.ValidateSet([(file.FileName, file.Length)]); var ext = UploadValidation.Extension(file.FileName); if (ext is not (".png" or ".jpg" or ".jpeg")) throw new FactoryException("補傳頁面只接受 JPG 或 PNG。");
    var source = new SourceFile(Guid.NewGuid(), Path.GetFileName(file.FileName), Guid.NewGuid().ToString("N") + ext, UploadValidation.Types[ext], file.Length);
    var path = store.FilePath(id, source); await using (var output = File.Create(path)) await file.CopyToAsync(output, token); await UploadValidation.ValidateSignature(path, ext, token);
    return store.Update(id, doc =>
    {
        if (doc.Revision != current.Revision) throw new FactoryException("教材狀態已變更，請重新載入。");
        doc.Replacements[number] = source; doc.Classification = null; doc.Confirmation = null; doc.ConfirmedAt = null; doc.Units = []; doc.Chunks = [];
        DocumentStore.Stage(doc, DocumentStatus.NeedsPages, 70, $"第 {number} 頁補傳已保存，請按重新擷取。");
    });
});
app.MapGet("/api/documents/{id:guid}/files/{fileId:guid}", (Guid id, Guid fileId, DocumentStore store) =>
{
    var doc = store.Get(id); var file = doc.Files.Concat(doc.Replacements.Values).FirstOrDefault(f => f.Id == fileId) ?? throw new KeyNotFoundException("找不到教材原檔。");
    return Results.File(store.FilePath(id, file), file.MediaType, enableRangeProcessing: true);
});
app.MapGet("/api/documents/{id:guid}/export", (Guid id, DocumentStore store) => Results.File(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(store.Get(id), FactoryJson.Options), "application/json", $"source-{id}.json"));
app.Map("/api/{**path}", () => Results.NotFound(new { error = "找不到此 API。" }));
app.MapFallbackToFile("index.html");
app.Run();
public sealed record ConfirmRequest(int Revision, ClassificationConfirmation Metadata);
public sealed record RetryRequest(int Revision, int CoverPage, int TocPage);
