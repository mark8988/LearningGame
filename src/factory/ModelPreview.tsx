import { useEffect, useState } from 'react';
import { Check, RefreshCw, Square } from 'lucide-react';
import { api, jsonPost } from './api';
import type { Document } from './types';
import { batchBusy, type Batch, type ModelChoice } from './drafts';

const modelKey = (model: { provider: string; model: string }) => `${model.provider}|${model.model}`;
const modelName = (model: string) => model.split(/[\\/]/).at(-1) ?? model;
export function ModelPreview({ document, unit, models, onChoose, onSource }: { document: Document; unit: number; models: ModelChoice[]; onChoose(model: ModelChoice): void; onSource(page: number): void }) {
  const [selected, setSelected] = useState<string[]>([]); const [previews, setPreviews] = useState<Batch[]>([]);
  const [working, setWorking] = useState(false); const [error, setError] = useState('');
  useEffect(() => { setSelected(previous => { const valid = previous.filter(key => models.some(m => modelKey(m) === key)); return valid.length ? valid : models[0] ? [modelKey(models[0])] : []; }); }, [models]);
  useEffect(() => {
    const controller = new AbortController(); let busy = false; setPreviews([]); setError('');
    const refresh = async () => {
      if (busy || document.status !== 'ready') return; busy = true;
      try { const data = await api<Batch[]>(`/documents/${document.id}/model-previews?unitIndex=${unit}`, { signal: controller.signal }); if (!controller.signal.aborted) setPreviews(data); }
      catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { busy = false; }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 1500); return () => { controller.abort(); clearInterval(timer); };
  }, [document.id, document.revision, document.status, unit]);
  const latest = (model: ModelChoice) => previews.find(p => modelKey(p.model) === modelKey(model));
  const start = async () => {
    setWorking(true); setError('');
    const requested = models.filter(m => selected.includes(modelKey(m)) && !batchBusy(latest(m) ?? null));
    const results = await Promise.allSettled(requested.map(model => jsonPost<Batch>(`/documents/${document.id}/model-previews`, { revision: document.revision, unitIndex: unit, model: { provider: model.provider, model: model.model } })));
    const failures: string[] = [];
    for (const result of results) { if (result.status === 'fulfilled') setPreviews(previous => [result.value, ...previous.filter(p => p.id !== result.value.id)]); else failures.push((result.reason as Error).message); }
    setError(failures.join('；')); setWorking(false);
  };
  const stop = async (batch: Batch) => { try { const value = await jsonPost<Batch>(`/batches/${batch.id}/cancel`, {}); setPreviews(previous => previous.map(p => p.id === value.id ? value : p)); } catch (e) { setError((e as Error).message); } };
  const selectedModels = models.filter(m => selected.includes(modelKey(m)));
  return <section className="model-preview" aria-label="不同模型試題預覽"><h3>先看試題，再選模型</h3><p>勾選模型，使用相同教材、知識點、題型與提示，各產生一題選擇、一題填空，讓你人工比較。這些樣題不會納入正式題庫。</p>
    <div className="preview-model-options">{models.map(model => <label key={modelKey(model)}><input type="checkbox" checked={selected.includes(modelKey(model))} onChange={event => setSelected(previous => event.target.checked ? [...previous, modelKey(model)] : previous.filter(key => key !== modelKey(model)))} /><span>{model.label}<small>{model.provider === 'ollama' ? 'Ollama' : 'llama.cpp'}</small></span></label>)}</div>
    <button className="factory-secondary" disabled={working || document.status !== 'ready' || !selected.length || selectedModels.every(m => batchBusy(latest(m) ?? null))} onClick={() => void start()}><RefreshCw size={15} />產生所選模型預覽（各 2 題）</button>
    {!models.length && <p className="factory-note">請先啟動本機模型服務，再重新讀取模型清單。</p>}
    {error && <p className="factory-error" role="alert">{error}</p>}
    <div className="preview-comparison">{selectedModels.map(model => {
      const batch = latest(model); const started = batch?.generationStartedAt; const finished = batch?.generationCompletedAt;
      const seconds = started && finished ? Math.max(0, (Date.parse(finished) - Date.parse(started)) / 1000).toFixed(1) : null;
      return <article className="preview-model-card" key={modelKey(model)} aria-label={`模型預覽：${model.label}`}><header><h4>{modelName(model.model)}</h4><span>{model.provider === 'ollama' ? 'Ollama' : 'llama.cpp'}</span></header>
        {!batch ? <p>尚未產生預覽</p> : <><p className="preview-status" aria-live="polite">{batch.message}</p><p>{batch.questions.length} / 2 題{seconds !== null && ` · 本次運算 ${seconds} 秒`}</p>
          {batchBusy(batch) && <button className="factory-secondary" onClick={() => void stop(batch)}><Square size={13} />停止此模型預覽</button>}
          {batch.error && <p className="factory-error" role="alert">{batch.error}</p>}{batch.sourceError && <p className="factory-notice">{batch.sourceError}</p>}
          {batch.skippedQuestions.length > 0 && <p className="factory-notice">有考點來源不足，預覽不完整；請對照教材。</p>}
          {batch.questions.map(question => <div className="preview-question" key={question.id}><b>{question.content.type === 'fillBlank' ? '填空題' : '選擇題'}</b><p>候選知識點 {(batch.plan.targets.find(t => t.slot === question.slot)?.pointIndex ?? -1) + 1} · {batch.plan.targets.find(t => t.slot === question.slot)?.intent}</p><h5>{question.content.stem}</h5>
            {question.content.type === 'choice' && <ol type="A">{question.content.options.map((option, i) => <li key={i}>{option}</li>)}</ol>}
            <p><strong>答案：</strong>{question.content.type === 'fillBlank' ? question.content.acceptedAnswers?.join('／') : question.content.options[question.content.answerIndex]}</p><p><strong>解析：</strong>{question.content.explanation}</p>
            <details><summary>來源第 {question.content.sourceRef.pageNumber} 頁與檢查結果</summary><blockquote>{question.content.sourceRef.quote}</blockquote><p>{question.errors.length ? question.errors.join('；') : '結構與原文引用檢查通過，內容仍需人工判斷。'}</p><button className="factory-export" onClick={() => onSource(question.content.sourceRef.pageNumber)}>對照教材頁面</button></details>
          </div>)}
          <button className="factory-secondary" disabled={batchBusy(batch) || !!batch.sourceError} onClick={() => onChoose(model)}><Check size={14} />選用此模型產生題庫</button>
        </>}
      </article>;
    })}</div>
    <p className="factory-note">耗時包含本次模型載入與重試，排隊時間不計；不是正式效能評測。預覽紀錄保留本機，系統不替你排名或判定哪個模型較好。</p>
  </section>;
}
