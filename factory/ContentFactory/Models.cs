using System.Text.Json;
using System.Text.Json.Serialization;

namespace ContentFactory;

public static class FactoryJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };
    public static T Clone<T>(T value) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Options), Options)!;
}
public enum DocumentStatus { Queued, Extracting, Classifying, NeedsPages, NeedsReview, Ready, Failed }
public sealed record SourceFile(Guid Id, string Name, string StoredName, string MediaType, long Size);
public sealed record SourcePage(int Number, string Text, string Method, double Confidence, Guid FileId, string? Section = null);
public sealed record UnitCandidate(string Name, int StartPage, int EndPage, bool LowConfidence);
public sealed record TextChunk(string Id, string Heading, int StartPage, int EndPage, string Text, bool LowConfidence);
public sealed record ClassificationResult(string School, int? Grade, string Subject, string Publisher, double Confidence, string Provider, string[] Evidence);
public sealed record ClassificationConfirmation(string School, int Grade, string Subject, string Publisher, UnitCandidate[] Units);
public sealed record StatusEvent(DateTimeOffset At, string Message);
public sealed class SourceDocument
{
    public int SchemaVersion { get; set; } = 1;
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public SourceFile[] Files { get; set; } = [];
    public Dictionary<int, SourceFile> Replacements { get; set; } = [];
    public int CoverPage { get; set; } = 1;
    public int TocPage { get; set; } = 2;
    public DocumentStatus Status { get; set; } = DocumentStatus.Queued;
    public int Progress { get; set; }
    public string Message { get; set; } = "等待文字擷取";
    public string? Error { get; set; }
    public SourcePage[] Pages { get; set; } = [];
    public TextChunk[] Chunks { get; set; } = [];
    public UnitCandidate[] Units { get; set; } = [];
    public ClassificationResult? Classification { get; set; }
    public ClassificationConfirmation? Confirmation { get; set; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    public int Revision { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<StatusEvent> History { get; set; } = [];
}
public sealed class FactoryOptions
{
    public string DataDirectory { get; set; } = "../../factory-data";
    public string TessdataDirectory { get; set; } = "../../.tools/tessdata";
    public string OcrProvider { get; set; } = "Local";
    public string ClassificationProvider { get; set; } = "Local";
    public string AzureEndpoint { get; set; } = "";
    public string AzureKey { get; set; } = "";
    public string AnthropicApiKey { get; set; } = "";
    public string AnthropicModel { get; set; } = "";
    public string LocalModelEndpoint { get; set; } = "http://127.0.0.1:8080/";
    public string OllamaEndpoint { get; set; } = "http://127.0.0.1:11434/";
    public const long MaxUploadBytes = 200L * 1024 * 1024;
    public const int MaxPages = 600;
}
public sealed class FactoryException(string message) : Exception(message);
