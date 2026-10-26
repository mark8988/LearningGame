using System.Text.Json;

namespace ContentFactory;

public sealed class DocumentStore
{
    private readonly string root;
    private readonly object gate = new();
    private readonly Dictionary<Guid, SourceDocument> documents = [];
    public DocumentStore(FactoryOptions options)
    {
        root = Path.GetFullPath(options.DataDirectory);
        Directory.CreateDirectory(root);
        foreach (var path in Directory.EnumerateFiles(root, "document.json", SearchOption.AllDirectories))
        {
            try
            {
                var document = JsonSerializer.Deserialize<SourceDocument>(File.ReadAllText(path), FactoryJson.Options);
                if (document is { SchemaVersion: 1 } && Path.GetDirectoryName(path) == Folder(document.Id)) documents[document.Id] = document;
            }
            catch (JsonException) { /* Preserve corrupt files for local recovery. */ }
        }
    }
    public string Folder(Guid id) => Path.Combine(root, id.ToString("N"));
    public string FilePath(Guid id, SourceFile file) => Path.Combine(Folder(id), file.StoredName);
    public SourceDocument[] List() { lock (gate) return documents.Values.OrderByDescending(d => d.CreatedAt).Select(FactoryJson.Clone).ToArray(); }
    public SourceDocument Get(Guid id) { lock (gate) return documents.TryGetValue(id, out var doc) ? FactoryJson.Clone(doc) : throw new KeyNotFoundException("找不到教材。"); }
    public void Create(SourceDocument document)
    {
        lock (gate) { if (documents.ContainsKey(document.Id)) throw new FactoryException("教材已存在。"); Persist(document); documents[document.Id] = FactoryJson.Clone(document); }
    }
    public SourceDocument Update(Guid id, Action<SourceDocument> change)
    {
        lock (gate)
        {
            var doc = Get(id); change(doc); doc.UpdatedAt = DateTimeOffset.UtcNow; doc.Revision++;
            Persist(doc); documents[id] = doc; return FactoryJson.Clone(doc);
        }
    }
    private void Persist(SourceDocument doc)
    {
        Directory.CreateDirectory(Folder(doc.Id));
        var path = Path.Combine(Folder(doc.Id), "document.json"); var temp = path + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(doc, FactoryJson.Options)); File.Move(temp, path, true);
    }
    public static void Stage(SourceDocument doc, DocumentStatus status, int progress, string message)
    {
        doc.Status = status; doc.Progress = progress; doc.Message = message; doc.Error = null;
        doc.History.Add(new(DateTimeOffset.UtcNow, message)); if (doc.History.Count > 100) doc.History.RemoveAt(0);
    }
}
