using System.Text.Json;

namespace ContentFactory;

public sealed class DraftStore
{
    private readonly string root; private readonly object gate = new(); private readonly Dictionary<Guid, DraftBatch> batches = [];
    public DraftStore(FactoryOptions options)
    {
        root = Path.Combine(Path.GetFullPath(options.DataDirectory), "drafts"); Directory.CreateDirectory(root);
        foreach (var file in Directory.EnumerateFiles(root, "*.draft.json"))
        {
            try { var batch = JsonSerializer.Deserialize<DraftBatch>(File.ReadAllText(file), FactoryJson.Options); if (batch is { SchemaVersion: 1 }) batches[batch.Id] = batch; } catch (JsonException) { }
        }
    }
    public DraftBatch Get(Guid id) { lock (gate) return batches.TryGetValue(id, out var batch) ? FactoryJson.Clone(batch) : throw new KeyNotFoundException("找不到草稿批次。"); }
    public DraftBatch[] List(Guid? documentId = null) { lock (gate) return batches.Values.Where(b => documentId is null || b.DocumentId == documentId).OrderByDescending(b => b.CreatedAt).Select(FactoryJson.Clone).ToArray(); }
    public void Create(DraftBatch batch)
    {
        lock (gate)
        {
            if (batches.Values.Any(b => b.DocumentId == batch.DocumentId && b.UnitIndex == batch.UnitIndex && b.Status is BatchStatus.Queued or BatchStatus.Generating)) throw new FactoryException("這個單元已有產題工作，請先等待或停止。");
            Persist(batch); batches[batch.Id] = FactoryJson.Clone(batch);
        }
    }
    public DraftBatch Update(Guid id, Action<DraftBatch> change)
    {
        lock (gate) { var next = Get(id); change(next); next.Revision++; next.UpdatedAt = DateTimeOffset.UtcNow; Persist(next); batches[id] = next; return FactoryJson.Clone(next); }
    }
    private void Persist(DraftBatch batch)
    {
        var target = Path.Combine(root, $"{batch.Id:N}.draft.json"); File.WriteAllText(target + ".tmp", JsonSerializer.Serialize(batch, FactoryJson.Options)); File.Move(target + ".tmp", target, true);
    }
    public void SaveAttempt(Guid id, string purpose, string prompt, string response, string[] errors)
    {
        var folder = Path.Combine(root, id.ToString("N")); Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, $"attempt-{Guid.NewGuid():N}.json"), JsonSerializer.Serialize(new { at = DateTimeOffset.UtcNow, purpose, prompt, response, errors }, FactoryJson.Options));
    }
    public static void Archive(QuestionDraft question, string action) => question.History.Add(new(DateTimeOffset.UtcNow, action, JsonSerializer.Serialize(new { question.Content, question.Status, question.Note, question.Revision }, FactoryJson.Options)));
    public static void Archive(EntryDraft entry, string action) => entry.History.Add(new(DateTimeOffset.UtcNow, action, JsonSerializer.Serialize(new { entry.Content, entry.Status, entry.Note, entry.Revision }, FactoryJson.Options)));
}
