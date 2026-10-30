using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ContentFactory;

public sealed record PackageRecord(string Id, string Name, string Version, Guid DocumentId, string SourceHash, BatchVersion[] Batches, int UnitCount, int QuestionCount, DateTimeOffset CreatedAt, string FileHash, int ByteSize);
public sealed class PackageStore
{
    private readonly string root; private readonly object gate = new();
    public PackageStore(FactoryOptions options) { root = Path.Combine(Path.GetFullPath(options.DataDirectory), "packages"); Directory.CreateDirectory(root); }
    private string PathFor(string id, string suffix) { if (!Regex.IsMatch(id, "^factory-[a-f0-9]{24}$")) throw new FactoryException("package.id：題庫識別碼格式不符。"); return Path.Combine(root, id + suffix); }
    public PackageRecord Get(string id) => JsonSerializer.Deserialize<PackageRecord>(File.ReadAllText(PathFor(id, ".record.json")), FactoryJson.Options) ?? throw new FactoryException("題庫紀錄損毀。");
    public PackageRecord[] List(Guid documentId) => Directory.EnumerateFiles(root, "*.record.json").Select(file => { try { return JsonSerializer.Deserialize<PackageRecord>(File.ReadAllText(file), FactoryJson.Options); } catch (JsonException) { return null; } }).OfType<PackageRecord>().Where(p => p.DocumentId == documentId).OrderByDescending(p => p.CreatedAt).ToArray();
    public PackageRecord Save(BuiltPackage package)
    {
        lock (gate)
        {
            var recordPath = PathFor(package.Id, ".record.json");
            if (File.Exists(recordPath)) { var existing = Get(package.Id); _ = Read(existing); return existing; }
            var hash = Convert.ToHexString(SHA256.HashData(package.Bytes));
            var record = new PackageRecord(package.Id, package.Name, package.Version, package.DocumentId, package.SourceHash, package.Batches, package.UnitCount, package.QuestionCount, package.CreatedAt, hash, package.Bytes.Length);
            var packPath = PathFor(package.Id, ".pack.json");
            if (File.Exists(packPath)) throw new FactoryException("題庫原檔已存在但紀錄不完整，檔案保留，請檢查本機資料。");
            File.WriteAllBytes(packPath + ".tmp", package.Bytes); File.Move(packPath + ".tmp", packPath);
            File.WriteAllText(recordPath + ".tmp", JsonSerializer.Serialize(record, FactoryJson.Options)); File.Move(recordPath + ".tmp", recordPath);
            return record;
        }
    }
    public byte[] Read(PackageRecord record)
    {
        var bytes = File.ReadAllBytes(PathFor(record.Id, ".pack.json"));
        if (bytes.Length != record.ByteSize || Convert.ToHexString(SHA256.HashData(bytes)) != record.FileHash) throw new FactoryException("package：題庫檔案完整性檢查失敗，原檔保留，請重新建立內容快照。");
        return bytes;
    }
}
public static class PackageEndpoints
{
    public static string[] Errors(PackageRecord record, DocumentStore documents, DraftStore drafts)
    {
        try
        {
            var source = documents.Get(record.DocumentId); DraftQuality.RequireSource(source);
            if (record.SourceHash != DraftQuality.Fingerprint(source)) throw new FactoryException("教材已變更，請重新審核及打包。");
            foreach (var reference in record.Batches) { var batch = drafts.Get(reference.BatchId); if (batch.Revision != reference.Revision) throw new FactoryException("草稿或審核狀態已變更，這份快照停止下載，請重新打包。"); PackageBuilder.RequireBatch(source, batch); }
            return [];
        }
        catch (Exception error) when (error is FactoryException or KeyNotFoundException) { return [error.Message]; }
    }
    public static void MapPackageEndpoints(this WebApplication app)
    {
        app.MapGet("/api/documents/{id:guid}/package-candidates", (Guid id, DocumentStore documents, DraftStore drafts) =>
        {
            var source = documents.Get(id);
            return drafts.List(id).Where(b => !b.IsPreview).Select(b => { string[] errors = []; try { PackageBuilder.RequireBatch(source, b); } catch (FactoryException e) { errors = [e.Message]; } return new { b.Id, b.UnitIndex, b.UnitName, b.Revision, b.CreatedAt, questionCount = b.Questions.Count(q => q.Status == ReviewStatus.Approved), errors, canPackage = errors.Length == 0 }; });
        });
        app.MapGet("/api/documents/{id:guid}/packages", (Guid id, DocumentStore documents, DraftStore drafts, PackageStore packages) => { _ = documents.Get(id); return packages.List(id).Select(p => { var errors = Errors(p, documents, drafts); return new { p.Id, p.Name, p.Version, p.UnitCount, p.QuestionCount, p.CreatedAt, p.ByteSize, errors, canDownload = errors.Length == 0 }; }); });
        app.MapPost("/api/documents/{id:guid}/packages", (Guid id, CreatePackageRequest input, DocumentStore documents, DraftStore drafts, PackageStore packages) =>
        {
            var source = documents.Get(id); if (source.Revision != input.Revision) throw new FactoryException("教材版本已變更，請重新載入再打包。");
            if (input.Batches is null || input.Batches.Length == 0 || input.Batches.Select(b => b.BatchId).Distinct().Count() != input.Batches.Length) throw new FactoryException("batches：請選擇不重複的審核批次。");
            var batches = input.Batches.Select(reference => { var batch = drafts.Get(reference.BatchId); if (reference.Revision != batch.Revision) throw new FactoryException("草稿版本已變更，請重新載入再打包。"); return batch; }).ToArray();
            var built = PackageBuilder.Build(source, batches, input.Name ?? "");
            if (documents.Get(id).Revision != source.Revision || batches.Any(b => drafts.Get(b.Id).Revision != b.Revision)) throw new FactoryException("打包期間教材或審核變更，請重新打包。");
            var record = packages.Save(built); return Results.Created($"/api/packages/{record.Id}/download", new { record.Id, record.Name, record.Version, record.UnitCount, record.QuestionCount, record.ByteSize });
        });
        app.MapGet("/api/packages/{id}/download", (string id, PackageStore packages, DocumentStore documents, DraftStore drafts) =>
        {
            PackageRecord record; try { record = packages.Get(id); } catch (FileNotFoundException) { throw new KeyNotFoundException("找不到題庫快照。"); }
            DraftQuality.Valid(Errors(record, documents, drafts)); return Results.File(packages.Read(record), "application/json", record.Id + ".json");
        });
    }
}
