using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ContentFactory;

public sealed record BatchVersion(Guid BatchId, int Revision);
public sealed record CreatePackageRequest(int Revision, string Name, BatchVersion[] Batches);
public sealed record BuiltPackage(string Id, string Version, string Name, Guid DocumentId, string SourceHash, BatchVersion[] Batches, int UnitCount, int QuestionCount, DateTimeOffset CreatedAt, byte[] Bytes);

public static class PackageBuilder
{
    public const int MaxBytes = 5 * 1024 * 1024;
    private static JsonArray Asset(string name) => JsonNode.Parse(typeof(PackageBuilder).Assembly.GetManifestResourceStream("FactoryAssets." + name) ?? throw new InvalidOperationException("缺少內建遊戲資產。"))!.AsArray();
    private static JsonNode Node(object value) => JsonSerializer.SerializeToNode(value, FactoryJson.Options)!;
    public static void RequireBatch(SourceDocument source, DraftBatch batch)
    {
        if (batch.DocumentId != source.Id) throw new FactoryException("batches：批次不屬於這份教材。");
        DraftQuality.RequireCurrent(batch, source); DraftQuality.Valid(DraftQuality.ReleaseErrors(batch));
        if (batch.Questions.Count(q => q.Status == ReviewStatus.Approved) < 20) throw new FactoryException($"questions.json：{batch.UnitName} 至少需要 20 題已核准題目，請補充教材並產生新批次。");
        if (batch.Questions.Any(q => q.Status == ReviewStatus.Approved && q.ReviewedAt is null) || batch.Entries.Any(e => e.Status == ReviewStatus.Approved && e.ReviewedAt is null)) throw new FactoryException("reviewedAt：已核准內容缺少審核時間，請重新審核。");
        if (batch.Plan is null || batch.Plan.Points.Length == 0) throw new FactoryException("knowledge-points.json：這批草稿缺乏知識點對應，請以新版產題流程建立批次。");
    }
    public static BuiltPackage Build(SourceDocument source, IReadOnlyList<DraftBatch> input, string name, DateTimeOffset? createdAt = null)
    {
        DraftQuality.RequireSource(source);
        name = name.Trim(); if (name.Length is < 1 or > 120) throw new FactoryException("pack.json.name：題庫名稱需為 1–120 字。");
        if (input.Count == 0) throw new FactoryException("batches：請至少選擇一個已完成審核的單元。");
        if (input.Select(b => b.UnitIndex).Distinct().Count() != input.Count) throw new FactoryException("batches：同一單元只能選擇一個批次。");
        var batches = input.OrderBy(b => b.UnitIndex).ToArray(); foreach (var batch in batches) RequireBatch(source, batch);
        var originalItems = Asset("items.json"); var models = Asset("outfit-models.json"); var originalDrops = Asset("drops.json"); var achievements = Asset("achievements.json");
        var sourceHash = DraftQuality.Fingerprint(source);
        var seed = JsonSerializer.SerializeToUtf8Bytes(new { builderVersion = 1, name, source.Id, sourceHash, batches, originalItems, models, originalDrops, achievements }, FactoryJson.Options);
        var digest = Convert.ToHexString(SHA256.HashData(seed)).ToLowerInvariant(); var id = "factory-" + digest[..24]; var version = "1.0.0+" + digest[..12]; var at = createdAt ?? DateTimeOffset.UtcNow;
        var items = new JsonArray(originalItems.Where(i => !(i!["rarity"]!.GetValue<string>() == "epic" && i["obtainFrom"]!.AsArray().Any(o => o!.GetValue<string>() == "drop"))).Select(i => i!.DeepClone()).ToArray());
        var epics = originalItems.Where(i => i!["rarity"]!.GetValue<string>() == "epic" && i["obtainFrom"]!.AsArray().Any(o => o!.GetValue<string>() == "drop")).ToArray();
        var units = new JsonArray(); var questions = new JsonArray(); var entries = new JsonArray(); var points = new JsonArray(); var drops = new JsonArray(); var bindings = new JsonArray(); var unitIds = new List<string>();
        foreach (var (batch, order) in batches.Select((batch, index) => (batch, index)))
        {
            var unitId = $"unit-{source.Id:N}-{batch.UnitIndex + 1}"; var dropId = unitId + "-drops"; var pointIds = new HashSet<int>(); var questionIds = new List<string>(); var entryIds = new List<string>();
            foreach (var q in batch.Questions.Where(q => q.Status == ReviewStatus.Approved).OrderBy(q => q.Slot))
            {
                var target = QuestionPlanning.Target(batch, q.Slot); var plan = QuestionPlanning.For(batch);
                if (target.PointIndex < 0 || target.PointIndex >= plan.Points.Length) throw new FactoryException($"knowledge-points.json：第 {q.Slot + 1} 題缺乏有效知識點。");
                var pointId = unitId + $"-kp{target.PointIndex + 1}";
                if (pointIds.Add(target.PointIndex))
                {
                    var point = plan.Points[target.PointIndex]; var reference = new SourceReference(source.Id, point.PageNumber, point.Text);
                    var errors = DraftQuality.Citation(reference, batch); if (errors.Length > 0) throw new FactoryException($"knowledge-points.json.{pointId}.sourceRef：{string.Join('；', errors)}");
                    points.Add(Node(new { id = pointId, unitId, text = point.Text, sourceRef = reference }));
                }
                if (q.ReviewedAt is null) throw new FactoryException($"questions.json：第 {q.Slot + 1} 題缺少審核時間。");
                var questionId = $"q-{q.Id:N}"; questionIds.Add(questionId);
                var question = Node(new { id = questionId, unitId, type = q.Content.Type, q.Content.Stem, q.Content.Options, q.Content.AnswerIndex, acceptedAnswers = q.Content.AcceptedAnswers ?? [], q.Content.Explanation, q.Content.Difficulty, q.Content.SourceRef, knowledgePointId = pointId, sourceQuestionId = q.Id, q.ReviewedAt }).AsObject();
                if (q.Content.Type != "fillBlank") question.Remove("acceptedAnswers");
                questions.Add(question);
            }
            foreach (var entry in batch.Entries.Where(e => e.Status == ReviewStatus.Approved).OrderBy(e => e.Slot))
            {
                if (entry.ReviewedAt is null) throw new FactoryException("encyclopedia.json：知識草稿缺少審核時間。");
                var entryId = $"entry-{entry.Id:N}"; entryIds.Add(entryId);
                entries.Add(Node(new { id = entryId, unitId, entry.Content.Title, entry.Content.Text, entry.Content.Illustration, entry.Content.SourceRef, entry.ReviewedAt }));
            }
            var reward = epics[order % epics.Length]!.DeepClone(); var rewardId = unitId + "-reward"; reward["id"] = rewardId; reward["name"] = batch.UnitName + "紀念藏品"; items.Add(reward);
            drops.Add(new JsonObject { ["id"] = dropId, ["common"] = originalDrops[0]!["common"]!.DeepClone(), ["rare"] = originalDrops[0]!["rare"]!.DeepClone(), ["epic"] = Node(new[] { rewardId }) });
            var unit = Node(new { id = unitId, name = batch.UnitName, order = order + 1, boss = new { name = batch.UnitName + "守護者", asset = "procedural:" + batch.Entries.First(e => e.Status == ReviewStatus.Approved).Content.Illustration, hp = 135, attack = 22 }, questionPool = questionIds, encyclopediaIds = entryIds, dropTableId = dropId }).AsObject();
            if (order > 0) unit["unlockAfter"] = unitIds[^1]; units.Add(unit); unitIds.Add(unitId);
            var range = source.Units[batch.UnitIndex]; bindings.Add(Node(new { unitId, unitIndex = batch.UnitIndex, batchId = batch.Id, batchRevision = batch.Revision, range.StartPage, range.EndPage }));
        }
        foreach (var achievement in achievements)
        {
            if (achievement!["metric"]!.GetValue<string>() == "collection") { var target = Math.Min(achievement["target"]!.GetValue<int>(), items.Count); achievement["target"] = target; achievement["name"] = $"收藏 {target} 款道具"; }
            if (achievement["id"]!.GetValue<string>() == "first-adventure") achievement["name"] = "第一場學習冒險";
        }
        var grade = source.Confirmation?.Grade ?? source.Classification!.Grade!.Value; var subject = source.Confirmation?.Subject ?? source.Classification!.Subject;
        var manifest = Node(new { id, name, version, subject, grade, unitIds, demo = false, provenance = new { format = "learning-adventure:factory", schemaVersion = 1, packageId = id, documentId = source.Id, sourceHash, sourceTitle = source.Title, createdAt = at, units = bindings } });
        var files = new JsonObject { ["pack.json"] = manifest, ["questions.json"] = questions, ["units.json"] = units, ["items.json"] = items, ["outfit-models.json"] = models, ["drops.json"] = drops, ["encyclopedia.json"] = entries, ["achievements.json"] = achievements, ["knowledge-points.json"] = points };
        var bytes = JsonSerializer.SerializeToUtf8Bytes(new { format = "learning-adventure:pack", version = 1, files }, FactoryJson.Options);
        if (bytes.Length > MaxBytes) throw new FactoryException("package：內容包超過遊戲匯入的 5 MB 限制，請選較少單元分開打包；不會截斷題目。");
        return new(id, version, name, source.Id, sourceHash, batches.Select(b => new BatchVersion(b.Id, b.Revision)).ToArray(), units.Count, questions.Count, at, bytes);
    }
}
