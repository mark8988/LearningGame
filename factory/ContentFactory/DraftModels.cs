namespace ContentFactory;

public enum BatchStatus { Queued, Generating, Review, Failed, Cancelled, Stale }
public enum ReviewStatus { Draft, Approved, Returned }
public sealed record ModelSelection(string Provider, string Model);
public sealed record LocalModel(string Provider, string Model, string Label);
public sealed record SourceReference(Guid DocumentId, int PageNumber, string Quote);
public sealed record QuestionContent(string Stem, string[] Options, int AnswerIndex, string Explanation, int Difficulty, SourceReference SourceRef, string Type = "choice", string[]? AcceptedAnswers = null);
public sealed record EntryContent(string Title, string Text, string Illustration, SourceReference SourceRef);
public sealed record DraftVersion(DateTimeOffset At, string Action, string Json);
public sealed class QuestionDraft
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int Slot { get; set; }
    public int Revision { get; set; }
    public QuestionContent Content { get; set; } = null!;
    public ReviewStatus Status { get; set; } = ReviewStatus.Draft;
    public string Note { get; set; } = "";
    public DateTimeOffset? ReviewedAt { get; set; }
    public List<DraftVersion> History { get; set; } = [];
}
public sealed class EntryDraft
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int Slot { get; set; }
    public int Revision { get; set; }
    public EntryContent Content { get; set; } = null!;
    public ReviewStatus Status { get; set; } = ReviewStatus.Draft;
    public string Note { get; set; } = "";
    public DateTimeOffset? ReviewedAt { get; set; }
    public List<DraftVersion> History { get; set; } = [];
}
public sealed class DraftBatch
{
    public int SchemaVersion { get; set; } = 1;
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DocumentId { get; set; }
    public int UnitIndex { get; set; }
    public string UnitName { get; set; } = "";
    public string SourceHash { get; set; } = "";
    public SourceDocument Snapshot { get; set; } = null!;
    public ModelSelection Model { get; set; } = new("llamaCpp", "");
    public BatchStatus Status { get; set; } = BatchStatus.Queued;
    public string Message { get; set; } = "等待本機模型產題";
    public string? Error { get; set; }
    public int Progress { get; set; }
    public int Revision { get; set; }
    public Guid? PendingItemId { get; set; }
    public string? PendingKind { get; set; }
    public string Instruction { get; set; } = "";
    public QuestionPlan? Plan { get; set; }
    public Dictionary<int, string> SkippedQuestions { get; set; } = [];
    public List<QuestionDraft> Questions { get; set; } = [];
    public List<EntryDraft> Entries { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed record StartDraftRequest(int Revision, int UnitIndex, ModelSelection Model);
public sealed record ReviewQuestionRequest(int Revision, QuestionContent Content);
public sealed record ReviewEntryRequest(int Revision, EntryContent Content);
public sealed record ReviewActionRequest(int Revision, string Action, string Note = "");
public sealed record RegenerateRequest(int Revision, string Instruction = "");
