import { useEffect, useState } from 'react';
import { Download, PackageCheck } from 'lucide-react';
import { api, jsonPost } from './api';
import type { Document } from './types';
import './packages.css';

interface Candidate { id: string; unitIndex: number; unitName: string; revision: number; questionCount: number; canPackage: boolean; errors: string[]; createdAt: string }
interface PackageRecord { id: string; name: string; version: string; unitCount: number; questionCount: number; createdAt: string; byteSize: number; canDownload: boolean; errors: string[] }
export function PackagePanel({ document }: { document: Document }) {
  const [name, setName] = useState(() => (document.title + '題庫').slice(0, 120)); const [selected, setSelected] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]); const [packages, setPackages] = useState<PackageRecord[]>([]); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [working, setWorking] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let loading = false;
    const refresh = async () => { if (loading) return; loading = true;
      const result = await Promise.allSettled([api<Candidate[]>(`/documents/${document.id}/package-candidates`, { signal: controller.signal }), api<PackageRecord[]>(`/documents/${document.id}/packages`, { signal: controller.signal })]);
      if (!controller.signal.aborted) for (let i = 0; i < result.length; i++) { const item = result[i]; if (item.status === 'rejected') setError((item.reason as Error).message); else if (i === 0) setCandidates(item.value as Candidate[]); else setPackages(item.value as PackageRecord[]); }
      loading = false;
    }; void refresh(); const timer = setInterval(() => void refresh(), 1500); return () => { controller.abort(); clearInterval(timer); };
  }, [document.id]);
  const chosen = candidates.filter(c => selected.includes(c.id));
  const create = async () => {
    setWorking(true); setError(''); setMessage('');
    try {
      await jsonPost(`/documents/${document.id}/packages`, { revision: document.revision, name, batches: chosen.map(c => ({ batchId: c.id, revision: c.revision })) });
      setPackages(await api<PackageRecord[]>(`/documents/${document.id}/packages`)); setMessage('遊戲題庫已建立，下載後可在遊戲家長模式加入並切換。');
    } catch (e) { setError((e as Error).message); } finally { setWorking(false); }
  };
  const download = async (record: PackageRecord) => {
    setError('');
    try {
      const response = await fetch(`/api/packages/${record.id}/download`); if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? '題庫下載失敗'); }
      const url = URL.createObjectURL(await response.blob()); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = record.id + '.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); }
  };
  return <section className="factory-card package-panel" aria-label="正式題庫打包"><div className="factory-section-heading"><h2><PackageCheck size={20} />把學習帶進冒險</h2><span className="factory-tag">正式遊戲題庫</span></div><p>選擇已審核的單元，每單元至少二十題，不設題數上限。同一單元選一個批次；預覽樣題不會納入。</p>
    <label>題庫名稱<input aria-label="正式題庫名稱" maxLength={120} required value={name} onChange={e => setName(e.target.value)} /></label>
    <div className="package-candidates">{candidates.length === 0 && <p>完成產題與逐項審核後，單元會顯示在這裡。</p>}{candidates.map(candidate => <article key={candidate.id}><label><input type="checkbox" checked={selected.includes(candidate.id)} disabled={working || (!candidate.canPackage && !selected.includes(candidate.id))} onChange={e => setSelected(previous => e.target.checked ? [...previous.filter(id => candidates.find(c => c.id === id)?.unitIndex !== candidate.unitIndex), candidate.id] : previous.filter(id => id !== candidate.id))} /><span><b>{candidate.unitName}</b><small>{candidate.questionCount} 題 · {new Date(candidate.createdAt).toLocaleString('zh-TW')}</small></span></label>{candidate.errors.length > 0 && <details><summary>查看尚未符合的條件</summary><ul>{candidate.errors.map(reason => <li key={reason}>{reason}</li>)}</ul></details>}</article>)}</div>
    <button className="factory-primary" disabled={working || !name.trim() || !chosen.length || chosen.some(c => !c.canPackage) || document.status !== 'ready'} onClick={() => void create()}><PackageCheck size={16} />打包所選單元</button>
    {message && <p className="factory-note" role="status">{message}</p>}{error && <p className="factory-error" role="alert">{error}</p>}
    <div className="package-history">{packages.map(record => <article className="package-record" key={record.id}><h3>{record.name}</h3><p>{record.unitCount} 單元 · {record.questionCount} 題 · {(record.byteSize / 1024).toFixed(1)} KB</p><small>v{record.version} · {new Date(record.createdAt).toLocaleString('zh-TW')}</small>{record.errors.map(reason => <p className="factory-notice" key={reason}>{reason}</p>)}<button className="factory-secondary" disabled={!record.canDownload || working} onClick={() => void download(record)}><Download size={15} />下載遊戲題庫 JSON</button></article>)}</div>
    <p className="factory-note">下載後，在遊戲「家長模式 → 加入題庫 JSON」確認加入，再選「切換題庫」。每份快照獨立保存進度；來源或審核變更後，舊快照會停止下載，已下載的本機檔案仍保留。</p>
  </section>;
}
