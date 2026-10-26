using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ContentFactory;

public static class DraftQuality
{
    public static readonly int[] Difficulties = [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3];
    public static bool IsBlankSlot(int slot) => slot is 3 or 7 or 9 or 11;
    public static int ChoicePosition(int slot) => Enumerable.Range(0, slot).Count(s => !IsBlankSlot(s)) % 4;
    public static readonly string[] Illustrations = ["plant", "animal", "weather", "magnet", "water"];
    public static string Normalize(string value) => Regex.Replace((value ?? "").Normalize(NormalizationForm.FormKC), @"\s+", "");
    public static string StemKey(string value) => Regex.Replace(Normalize(value), @"[\p{P}\p{S}]", "");
    public static string Fingerprint(SourceDocument source) => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new { source.Id, source.Pages, source.Units, source.Classification, source.Confirmation, source.CoverPage, source.TocPage }, FactoryJson.Options)));
    public static void RequireSource(SourceDocument source)
    {
        if (source.Status != DocumentStatus.Ready || source.Classification is null || source.Units.Length == 0) throw new FactoryException("請先完成教材擷取及歸類確認。");
        if ((source.Pages.Any(p => p.Method is "tesseract" or "azure") || DocumentStructure.RequiresReview(source.Classification, source.Units)) && source.Confirmation is null) throw new FactoryException("此教材需要家長先確認歸類，才能產題。");
        var grade = source.Confirmation?.Grade ?? source.Classification.Grade;
        if (grade is null or < 1 or > 9) throw new FactoryException("目前產題支援台灣國小一年級至國中九年級，請確認教材年級。");
    }
    public static void RequireCurrent(DraftBatch batch, SourceDocument current)
    {
        RequireSource(current); if (Fingerprint(current) != batch.SourceHash) throw new FactoryException("教材文字或單元已變更，請以新版教材重新產生草稿。");
    }
    public static string[] Citation(SourceReference? sourceRef, DraftBatch batch)
    {
        if (sourceRef is null || sourceRef.DocumentId != batch.DocumentId) return ["必須引用這份教材的來源頁。"];
        var unit = batch.Snapshot.Units[batch.UnitIndex]; var page = batch.Snapshot.Pages.FirstOrDefault(p => p.Number == sourceRef.PageNumber);
        if (page is null || sourceRef.PageNumber < unit.StartPage || sourceRef.PageNumber > unit.EndPage) return ["來源頁碼必須位於目前單元範圍內。"];
        var quote = Normalize(sourceRef.Quote); if (quote.Length < 8 || quote.Length > 500 || !Normalize(page.Text).Contains(quote, StringComparison.Ordinal)) return ["來源摘錄須為該頁實際原文，長度至少 8 字。"];
        return [];
    }
    public static string[] Question(QuestionContent? content, DraftBatch batch, Guid? ignoreId = null)
    {
        if (content is null) return ["題目內容不可空白。"];
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(content.Stem) || content.Stem.Length is < 8 or > 220) errors.Add("題幹需為 8–220 字。");
        if (content.Type is not ("choice" or "fillBlank")) errors.Add("題型必須是選擇題或填空題。");
        if (content.Type == "choice" && (content.Options is not { Length: 4 } || content.Options.Any(o => string.IsNullOrWhiteSpace(o) || o.Length > 150))) errors.Add("選擇題需有四個非空白選項，每項最多 150 字。");
        else if (content.Type == "choice")
        {
            var options = content.Options.Select(Normalize).ToArray();
            if (options.Distinct().Count() != 4) errors.Add("四個選項不可重複。");
            if (options.Max(o => o.Length) > Math.Max(12, options.Min(o => o.Length) * 3)) errors.Add("選項長度差異過大，請使用長度相近的干擾選項。");
        }
        if (content.Type == "choice" && (content.AnswerIndex is < 0 or > 3)) errors.Add("正確選項必須是 A–D。");
        if (content.Type == "fillBlank")
        {
            if (Regex.Matches(content.Stem ?? "", "_{3,}").Count != 1) errors.Add("填空題題幹須有且僅有一個 ___ 空格。");
            if (content.AcceptedAnswers is not { Length: > 0 and <= 8 } || content.AcceptedAnswers.Any(a => string.IsNullOrWhiteSpace(a) || a.Length > 120)) errors.Add("填空題需提供 1–8 個可接受答案，每個最多 120 字。");
            else
            {
                if (content.AcceptedAnswers.Select(Normalize).Distinct(StringComparer.OrdinalIgnoreCase).Count() != content.AcceptedAnswers.Length) errors.Add("可接受答案不可重複。");
                var unit = batch.Snapshot.Units[batch.UnitIndex]; var source = string.Join("", batch.Snapshot.Pages.Where(p => p.Number >= unit.StartPage && p.Number <= unit.EndPage).Select(p => p.Text));
                if (!Normalize(source).Contains(Normalize(content.AcceptedAnswers[0]), StringComparison.OrdinalIgnoreCase)) errors.Add("填空題標準答案須能在單元原文找到。");
            }
        }
        if (string.IsNullOrWhiteSpace(content.Explanation) || content.Explanation.Length is < 12 or > 1200) errors.Add("解析需為 12–1200 字。");
        if (content.Difficulty is < 1 or > 3) errors.Add("難度必須是易、中或難。");
        if (batch.Questions.Any(q => q.Id != ignoreId && StemKey(q.Content.Stem) == StemKey(content.Stem ?? ""))) errors.Add("同單元題幹不可重複。");
        errors.AddRange(Citation(content.SourceRef, batch)); return errors.Distinct().ToArray();
    }
    public static string[] Entry(EntryContent? content, DraftBatch batch, Guid? ignoreId = null)
    {
        if (content is null) return ["知識條目不可空白。"];
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(content.Title) || content.Title.Length is < 2 or > 60) errors.Add("知識標題需為 2–60 字。");
        if (string.IsNullOrWhiteSpace(content.Text) || content.Text.Length is < 25 or > 1000) errors.Add("知識說明需為 25–1000 字。");
        if (!Illustrations.Contains(content.Illustration)) errors.Add("請選擇可用的圖示主題。");
        if (batch.Entries.Any(e => e.Id != ignoreId && StemKey(e.Content.Title) == StemKey(content.Title))) errors.Add("知識標題不可重複。");
        errors.AddRange(Citation(content.SourceRef, batch)); return errors.Distinct().ToArray();
    }
    public static string[] SetErrors(IEnumerable<QuestionDraft> questions)
    {
        var all = questions.ToArray(); var errors = new List<string>();
        if (all.Length < 12) errors.Add("每單元至少需要 12 題。");
        if (all.Length > 0)
        {
            var choices = all.Where(q => q.Content.Type == "choice").ToArray();
            if (choices.Length != 8 || all.Count(q => q.Content.Type == "fillBlank") != 4) errors.Add("每批需包含 8 題選擇題與 4 題填空題。");
            for (var position = 0; position < 4; position++) { var ratio = choices.Length == 0 ? 0 : choices.Count(q => q.Content.AnswerIndex == position) / (double)choices.Length; if (ratio is < 0.15 or > 0.35) errors.Add($"選擇題正確選項 {"ABCD"[position]} 的比例須為 15%–35%。"); }
            if (all.Length == 12 && Enumerable.Range(1, 3).Any(d => all.Count(q => q.Content.Difficulty == d) != new[] { 4, 6, 2 }[d - 1])) errors.Add("十二題難度需為易 4／中 6／難 2。");
        }
        return errors.ToArray();
    }
    public static string[] ReleaseErrors(DraftBatch batch)
    {
        var errors = new List<string>();
        if (batch.Status != BatchStatus.Review) errors.Add("請等待草稿產生完成。");
        var questions = batch.Questions.Where(q => q.Status == ReviewStatus.Approved).ToArray(); var entries = batch.Entries.Where(e => e.Status == ReviewStatus.Approved).ToArray();
        errors.AddRange(SetErrors(questions)); if (entries.Length is < 2 or > 3) errors.Add("每單元需要 2–3 篇已核准知識條目。");
        foreach (var question in questions) errors.AddRange(Question(question.Content, batch, question.Id));
        foreach (var entry in entries) errors.AddRange(Entry(entry.Content, batch, entry.Id));
        return errors.Distinct().ToArray();
    }
    public static void Valid(string[] errors) { if (errors.Length > 0) throw new FactoryException(string.Join('；', errors)); }
}
