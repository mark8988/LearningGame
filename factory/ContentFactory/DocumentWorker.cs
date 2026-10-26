using System.Threading.Channels;

namespace ContentFactory;

public sealed class JobQueue
{
    public readonly Channel<Guid> Channel = System.Threading.Channels.Channel.CreateUnbounded<Guid>(new UnboundedChannelOptions { SingleReader = true });
    public void Enqueue(Guid id) => Channel.Writer.TryWrite(id);
}
public sealed class DocumentWorker(DocumentStore store, JobQueue queue, DocumentExtractor extractor, ILlmProvider classifier, ILogger<DocumentWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        foreach (var doc in store.List().Where(d => d.Status is DocumentStatus.Queued or DocumentStatus.Extracting or DocumentStatus.Classifying))
        {
            store.Update(doc.Id, d => DocumentStore.Stage(d, DocumentStatus.Queued, 0, "服務重新啟動，已恢復處理佇列")); queue.Enqueue(doc.Id);
        }
        await foreach (var id in queue.Channel.Reader.ReadAllAsync(stoppingToken))
        {
            try { await Process(id, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception)
            {
                logger.LogWarning("教材 {DocumentId} 處理未完成：{ErrorType}", id, exception.GetType().Name);
                store.Update(id, d => { DocumentStore.Stage(d, DocumentStatus.Failed, d.Progress, "教材處理未完成"); d.Error = exception is FactoryException ? exception.Message : "無法讀取教材，請確認檔案未加密、未損毀，並檢查本機 OCR 設定。"; });
            }
        }
    }
    public async Task Process(Guid id, CancellationToken token)
    {
        var doc = store.Get(id); if (doc.Status != DocumentStatus.Queued) return;
        store.Update(id, d => DocumentStore.Stage(d, DocumentStatus.Extracting, 3, "正在擷取教材文字"));
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token); timeout.CancelAfter(TimeSpan.FromMinutes(30));
        var pages = await extractor.Extract(doc, store, (progress, message) => { store.Update(id, d => { d.Progress = progress; d.Message = message; }); return Task.CompletedTask; }, timeout.Token);
        store.Update(id, d => d.Pages = pages);
        var missing = pages.Where(p => !DocumentExtractor.HasText(p.Text)).Select(p => p.Number).ToArray();
        var critical = doc.CoverPage == doc.TocPage || !pages.Any(p => p.Number == doc.CoverPage && DocumentExtractor.HasText(p.Text)) || !pages.Any(p => p.Number == doc.TocPage && DocumentExtractor.HasText(p.Text));
        if (critical || missing.Length > 0)
        {
            store.Update(id, d => { DocumentStore.Stage(d, DocumentStatus.NeedsPages, 70, "需補齊可讀的封面、目錄或內頁"); d.Error = critical ? "封面與目錄必須指定不同且可讀的頁面。請調整頁碼，或補傳清晰圖片後重試。" : $"第 {string.Join('、', missing)} 頁文字不足，請補傳清晰圖片。"; }); return;
        }
        store.Update(id, d => DocumentStore.Stage(d, DocumentStatus.Classifying, 78, "正在辨識學制、科目與單元"));
        var units = DocumentStructure.Units(pages, doc.CoverPage, doc.TocPage);
        var classification = await classifier.ClassifyAsync(pages, doc.CoverPage, doc.TocPage, timeout.Token);
        var review = DocumentStructure.RequiresReview(classification, units) || pages.Any(p => p.Method is "tesseract" or "azure");
        store.Update(id, d => { d.Units = units; d.Chunks = DocumentStructure.Chunks(pages, units); d.Classification = classification; d.Confirmation = null; d.ConfirmedAt = null; DocumentStore.Stage(d, review ? DocumentStatus.NeedsReview : DocumentStatus.Ready, 100, review ? "請家長確認歸類與單元頁碼" : "教材擷取與歸類完成"); });
    }
}
