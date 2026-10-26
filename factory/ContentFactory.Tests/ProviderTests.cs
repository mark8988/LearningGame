using ContentFactory;
using System.Net;
using System.Text;
using Xunit;

namespace ContentFactoryTests;

public sealed class ProviderTests
{
    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond(request));
    }
    private static HttpResponseMessage Json(string json, HttpStatusCode code = HttpStatusCode.OK) => new(code) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    [Fact] public async Task AnthropicValidatesModelResultAndKeepsSourceAsData()
    {
        string? body = null;
        var client = new HttpClient(new Handler(request =>
        {
            Assert.Equal("api.anthropic.com", request.RequestUri!.Host); Assert.True(request.Headers.Contains("x-api-key"));
            body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return Json("""{"content":[{"type":"text","text":"{\"school\":\"國小\",\"grade\":3,\"subject\":\"自然科學\",\"publisher\":\"康軒\",\"confidence\":0.9,\"evidence\":[\"封面明確標示\"]}"}]}""");
        }));
        var provider = new AnthropicClassificationProvider(client, new() { AnthropicApiKey = "test-only", AnthropicModel = "configured-model" });
        var result = await provider.ClassifyAsync([new(1, "封面 國小三年級自然", "test", 1, Guid.NewGuid()), new(2, "目錄 植物與動物", "test", 1, Guid.NewGuid())], 1, 2, default);
        Assert.Equal(3, result.Grade); Assert.Equal("anthropic", result.Provider); Assert.Contains("configured-model", body); Assert.Contains("max_tokens", body);
    }
    [Fact] public async Task AnthropicRejectsOutOfRangeConfidence()
    {
        var client = new HttpClient(new Handler(_ => Json("""{"content":[{"type":"text","text":"{\"school\":\"國小\",\"grade\":3,\"subject\":\"自然科學\",\"publisher\":\"\",\"confidence\":2,\"evidence\":[]}"}]}""")));
        await Assert.ThrowsAsync<FactoryException>(() => new AnthropicClassificationProvider(client, new() { AnthropicApiKey = "test", AnthropicModel = "test" }).ClassifyAsync([new(1, "x", "test", 1, Guid.NewGuid())], 1, 1, default));
    }
    [Fact] public async Task AzureNeverForwardsKeyToAnotherHost()
    {
        using var files = new TemporaryFiles(); var path = Path.Combine(files.Root, "page.png"); await File.WriteAllTextAsync(path, "test");
        var calls = 0; var client = new HttpClient(new Handler(_ => { calls++; var response = new HttpResponseMessage(HttpStatusCode.Accepted); response.Headers.Add("Operation-Location", "https://untrusted.invalid/result"); return response; }));
        await Assert.ThrowsAsync<FactoryException>(() => new AzureOcrProvider(client, new() { AzureEndpoint = "https://configured.cognitiveservices.azure.com", AzureKey = "test" }).ReadAsync(path, null, default)); Assert.Equal(1, calls);
    }
    [Fact] public async Task AzureParsesCompletedOperation()
    {
        using var files = new TemporaryFiles(); var path = Path.Combine(files.Root, "page.png"); await File.WriteAllTextAsync(path, "test"); var calls = 0;
        var client = new HttpClient(new Handler(request => { calls++; if (request.Method == HttpMethod.Post) { var accepted = new HttpResponseMessage(HttpStatusCode.Accepted); accepted.Headers.Add("Operation-Location", "https://configured.cognitiveservices.azure.com/result"); return accepted; } return Json("""{"status":"succeeded","analyzeResult":{"content":"教材內容與頁碼"}}"""); }));
        var result = await new AzureOcrProvider(client, new() { AzureEndpoint = "https://configured.cognitiveservices.azure.com", AzureKey = "test" }).ReadAsync(path, 1, default); Assert.Equal("教材內容與頁碼", result.Text); Assert.Equal(2, calls);
    }
}
