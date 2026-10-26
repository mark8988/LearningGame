using System.Text;
using System.Text.RegularExpressions;

namespace ContentFactory;

public sealed record KnowledgePoint(int PageNumber, string Text, int Complexity, string[] Reasons);
public sealed record QuestionTarget(int Slot, int PointIndex, int PageNumber, string Type, int Difficulty, int AnswerIndex, string Intent);
public sealed record QuestionPlan(string Method, KnowledgePoint[] Points, QuestionTarget[] Targets, int EntryCount)
{
    public int QuestionCount => Targets.Length;
    public int ChoiceCount => Targets.Count(t => t.Type == "choice");
    public int BlankCount => Targets.Count(t => t.Type == "fillBlank");
    public int[] DifficultyCounts => Enumerable.Range(1, 3).Select(d => Targets.Count(t => t.Difficulty == d)).ToArray();
}

public static class QuestionPlanning
{
    public static string NormalizeText(string text) => Regex.Replace(Regex.Replace(text.Normalize(NormalizationForm.FormKC), @"\s+", " "), @"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "");
    // These are explainable estimates, not a claim of calibrated academic difficulty.
    private static readonly (string Reason, string Pattern)[] ComplexitySignals =
    [
        ("因果、條件或比較", @"因為|因此|導致|若|如果|比較|不同|相同|影響|because|therefore|\bif\b|compare"),
        ("實驗、程序或推論", @"變因|實驗|步驟|推論|先.{1,35}再|控制|驗證|experiment|procedure|infer"),
        ("公式或計算", @"[=＝÷×]|計算|除以|乘以|比值|比例|\d\s*[+*/−-]\s*\d|calculate|equation")
    ];
    public static QuestionPlan Build(SourceDocument source, int unitIndex)
    {
        if (unitIndex < 0 || unitIndex >= source.Units.Length) throw new FactoryException("找不到這個單元。");
        var unit = source.Units[unitIndex]; var points = new List<KnowledgePoint>(); var seen = new HashSet<string>();
        foreach (var page in source.Pages.Where(p => p.Number >= unit.StartPage && p.Number <= unit.EndPage))
        {
            var lines = page.Text.Normalize(NormalizationForm.FormKC).Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0 && !(l.Length < 80 && !Regex.IsMatch(l, @"[。！？]") && Regex.IsMatch(l, @"^(?:第[一二三四五六七八九十\d]+[單元章課節]|目錄|第?\s*\d+\s*頁$)")));
            var text = NormalizeText(string.Join(" ", lines));
            foreach (var sentence in Regex.Split(text, @"(?<=[。！？；;])\s*|(?<=[.!?])\s+(?=[A-Za-z])"))
            {
                // Split unusually long paragraphs at clauses; never inflate counts from wrapped PDF lines.
                var parts = sentence.Length > 300 ? Regex.Split(sentence, @"(?<=[，,：:])\s*") : new[] { sentence };
                foreach (var part in parts.SelectMany(p => p.Length <= 300 ? new[] { p } : p.EnumerateRunes().Chunk(240).Select(chunk => string.Concat(chunk.Select(r => r.ToString())))).ToArray())
                {
                    var value = part.Trim(); var key = DraftQuality.StemKey(value);
                    if (value.Length < 12 || value.Count(char.IsLetterOrDigit) < 8 || !seen.Add(key)) continue;
                    var reasons = ComplexitySignals.Where(s => Regex.IsMatch(value, s.Pattern, RegexOptions.IgnoreCase)).Select(s => s.Reason).ToArray();
                    points.Add(new(page.Number, value, 1 + Math.Min(2, reasons.Length), reasons));
                }
            }
        }
        if (points.Count == 0) throw new FactoryException("單元內沒有足夠可辨識的知識敘述，請補充或確認教材文字。");
        var targets = new List<QuestionTarget>();
        for (var index = 0; index < points.Count; index++)
        {
            var point = points[index];
            for (var variant = 0; variant < point.Complexity; variant++)
                targets.Add(new(targets.Count, index, point.PageNumber, "choice", variant + 1, 0, new[] { "理解知識重點", "情境應用", "比較與推論" }[variant]));
        }
        var blanks = targets.Count < 2 ? 0 : Math.Max(1, (int)Math.Round(targets.Count / 3.0)); var choice = 0;
        var blankPoints = Enumerable.Range(0, points.Count).Where(i => (i + 1) * blanks / points.Count > i * blanks / points.Count).ToHashSet();
        var usedBlankPoints = new HashSet<int>();
        for (var index = 0; index < targets.Count; index++)
        {
            // Use recall targets for blanks, preserving application/inference targets for richer questions.
            var blank = blankPoints.Contains(targets[index].PointIndex) && usedBlankPoints.Add(targets[index].PointIndex);
            targets[index] = targets[index] with { Type = blank ? "fillBlank" : "choice", AnswerIndex = blank ? 0 : choice++ % 4, Difficulty = blank ? Math.Min(2, points[targets[index].PointIndex].Complexity) : targets[index].Difficulty, Intent = blank ? "原文重點回想" : targets[index].Intent };
        }
        return new("source-rules-v1", points.ToArray(), targets.ToArray(), Math.Min(3, points.Count));
    }
    public static QuestionPlan For(DraftBatch batch)
    {
        if (batch.Plan is not null) return batch.Plan;
        // Preserve review and regeneration of pre-adaptive batches without rewriting their data.
        var unit = batch.Snapshot.Units[batch.UnitIndex]; var pages = batch.Snapshot.Pages.Where(p => p.Number >= unit.StartPage && p.Number <= unit.EndPage).ToArray();
        return new("legacy-12", [], Enumerable.Range(0, 12).Select(s => new QuestionTarget(s, -1, pages[s * pages.Length / 12].Number, DraftQuality.IsBlankSlot(s) ? "fillBlank" : "choice", DraftQuality.Difficulties[s], DraftQuality.IsBlankSlot(s) ? 0 : DraftQuality.ChoicePosition(s), "依原批次考點命題")).ToArray(), 3);
    }
    public static QuestionTarget Target(DraftBatch batch, int slot) => For(batch).Targets.Single(t => t.Slot == slot);

    public static void BalanceChoices(DraftBatch batch)
    {
        if (batch.Plan is null) return;
        var choices = batch.Questions.Where(q => q.Content.Type == "choice").OrderBy(q => q.Slot).ToArray(); var counts = new int[4];
        foreach (var q in choices.Where(q => q.Status != ReviewStatus.Draft)) counts[q.Content.AnswerIndex]++;
        foreach (var q in choices.Where(q => q.Status == ReviewStatus.Draft))
        {
            var position = Enumerable.Range(0, 4).MinBy(i => counts[i]); counts[position]++;
            if (q.Content.AnswerIndex == position) continue;
            var options = q.Content.Options.ToArray(); (options[position], options[q.Content.AnswerIndex]) = (options[q.Content.AnswerIndex], options[position]);
            DraftStore.Archive(q, "平衡選項位置（保留正確答案內容）"); q.Content = q.Content with { Options = options, AnswerIndex = position }; q.Revision++;
        }
        batch.Plan = batch.Plan with { Targets = batch.Plan.Targets.Select(t => choices.FirstOrDefault(q => q.Slot == t.Slot) is { } q ? t with { AnswerIndex = q.Content.AnswerIndex } : t).ToArray() };
    }
}

public sealed class InsufficientQuestionMaterialException : Exception { }
