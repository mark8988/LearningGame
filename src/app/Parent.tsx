import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Download, FileUp, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Dialog } from '../components/Dialog';
import { boot } from '../stores/gameStore';
import { newGame, type PlayerSave } from '../logic/save';
import { exportPack, importPack, importProgress, MAX_TRANSFER_BYTES } from '../logic/transfers';
import { addLibraryPack, readLibrary, selectLibraryPack } from '../data/library';
import { loadBuiltinPack } from '../data/loader';
import type { ContentPack } from '../data/schemas';

export function ParentGate({ onClose, onVerified }: { onClose(): void; onVerified(): void }) {
  const [held, setHeld] = useState(false); const [pressing, setPressing] = useState(false);
  const [challenge] = useState(() => [Math.floor(Math.random() * 8) + 5, Math.floor(Math.random() * 8) + 3]);
  const [answer, setAnswer] = useState(''); const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; setPressing(false); };
  const start = () => { if (timer.current || held) return; setPressing(true); timer.current = setTimeout(() => { setHeld(true); setPressing(false); timer.current = undefined; }, 1200); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <Dialog title="家長驗證" onClose={onClose}><p>請由家長操作，先長按，再回答一道算術題。</p>{!held ? <button className={`hold-button ${pressing ? 'holding' : ''}`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); start(); }} onPointerMove={e => { if (!timer.current) return; const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) cancel(); }} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) start(); } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') cancel(); }}><LockKeyhole size={20} />長按 1.2 秒進入<span /></button> : <form className="parent-challenge" onSubmit={e => { e.preventDefault(); if (Number(answer) === challenge[0] + challenge[1] && answer.trim()) onVerified(); else { setError('答案不太對，請再算一次。'); setAnswer(''); } }}><label htmlFor="parent-answer">{challenge[0]} + {challenge[1]} = ？</label><input id="parent-answer" type="number" inputMode="numeric" value={answer} onChange={e => setAnswer(e.target.value)} autoFocus required /><button className="primary" type="submit">確認答案<ShieldCheck size={17} /></button>{error && <p role="alert">{error}</p>}</form>}<p className="parent-note">這個入口用來避免誤觸，離開家長模式後會重新上鎖。</p></Dialog>;
}
function download(name: string, raw: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Pending = { type: 'save'; save: PlayerSave } | { type: 'pack'; pack: ContentPack } | { type: 'switch'; id: string } | { type: 'reset' };
export function Parent() {
  const game = boot!.store(); const { player, pack } = game;
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [pending, setPending] = useState<Pending | null>(null);
  const [packs, setPacks] = useState<ContentPack[]>([pack]);
  const [resetText, setResetText] = useState(''); const [reading, setReading] = useState(false);
  useEffect(() => { try { setPacks(readLibrary(localStorage, loadBuiltinPack())); } catch (e) { setError((e as Error).message); } }, []);
  if (!game.parentUnlocked) return null;
  const attempt = (work: () => void) => { setError(''); setMessage(''); try { work(); } catch (e) { setError((e as Error).message); } };
  const read = async (event: ChangeEvent<HTMLInputElement>, kind: 'save' | 'pack') => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setError(''); setMessage(''); setReading(true);
    try { if (file.size > MAX_TRANSFER_BYTES) throw new Error('檔案不可超過 5 MB。'); const raw = await file.text(); setPending(kind === 'save' ? { type: 'save', save: importProgress(raw, pack) } : { type: 'pack', pack: importPack(raw) }); }
    catch (e) { setError((e as Error).message); } finally { setReading(false); }
  };
  const confirm = () => attempt(() => {
    if (!pending) return;
    if (pending.type === 'save') game.replaceProgress(pending.save);
    if (pending.type === 'reset') { if (resetText !== '重新開始') return; game.replaceProgress(newGame(pack)); }
    if (pending.type === 'pack') { addLibraryPack(localStorage, pending.pack, loadBuiltinPack()); setPacks(readLibrary(localStorage, loadBuiltinPack())); setMessage('題庫已加入，選擇「切換題庫」即可遊玩。'); }
    if (pending.type === 'switch') { boot!.flush(); if (boot!.store.getState().saveStatus !== 'saved') throw new Error('目前進度未能保存，請先匯出存檔。'); selectLibraryPack(localStorage, pending.id, loadBuiltinPack()); window.location.reload(); }
    setPending(null); setResetText('');
  });
  const wrong = pack.questions.filter(q => player.wrongQuestionIds.includes(q.id));
  const accuracy = player.stats.questionsAnswered ? `${Math.round(player.stats.correct / player.stats.questionsAnswered * 100)}%` : '尚未作答';
  return <div className="parent-page"><div className="parent-intro"><ShieldCheck size={28} /><div><h2>一起看見孩子的進步</h2><p>目前題庫：{pack.manifest.name} · v{pack.manifest.version}</p></div><button className="text-button" onClick={() => game.navigate('home')}><ArrowLeft size={16} />離開並上鎖</button></div>
    {error && <p className="transfer-error" role="alert">{error}</p>}{message && <p className="transfer-success" role="status">{message}</p>}
    <section className="parent-section" aria-label="學習報表"><h2>學習足跡</h2><p>累計包含冒險與複習的作答；沒有作答時間或每單元正確率紀錄。</p><div className="report-stats"><div><span>累計作答</span><b>{player.stats.questionsAnswered} 題</b></div><div><span>答對題數</span><b>{player.stats.correct} 題</b></div><div><span>整體正確率</span><b>{accuracy}</b></div><div><span>成功冒險</span><b>{player.stats.battlesWon} 場</b></div></div><div className="report-units">{pack.units.map(unit => <div key={unit.id}><b>{unit.name}</b><span>{player.clearedUnitIds.includes(unit.id) ? `已通關 · ${player.unitStars[unit.id] ?? 0} 星` : '尚未通關'}</span><span>待複習 {wrong.filter(q => q.unitId === unit.id).length} 題</span></div>)}</div><details><summary>待複習題目（{wrong.length}）</summary>{wrong.length ? wrong.map(q => <article className="wrong-record" key={q.id}><h3>{q.stem}</h3><p>正確答案：{q.options[q.answerIndex]}</p><p>{q.explanation}</p></article>) : <p>目前沒有待複習題目。</p>}</details></section>
    <section className="parent-section" aria-label="存檔備份與還原"><h2>把冒險好好保存</h2><p>存檔包含金幣、關卡、穿搭及小屋。換裝置時，先加入相同題庫再還原存檔。還原會取代這份題庫目前的進度。</p><div className="transfer-actions"><button className="secondary" onClick={() => attempt(() => download(`LearningGame-save-${pack.manifest.id}-${Date.now()}.json`, JSON.stringify(player, null, 2)))}><Download size={17} />匯出存檔</button><label className="file-action"><FileUp size={17} />選擇存檔備份<input aria-label="匯入存檔" type="file" accept=".json,application/json" disabled={reading} onChange={e => void read(e, 'save')} /></label></div></section>
    <section className="parent-section" aria-label="題庫管理"><h2>為下一段探索準備題庫</h2><p>題庫備份是單一 JSON，包含完整關卡、道具、3D 模型定義及知識。每份題庫各自保存進度。教材上傳與自動產題屬後續內容工廠。</p><div className="transfer-actions"><button className="secondary" onClick={() => attempt(() => download(`LearningGame-pack-${pack.manifest.id}.json`, exportPack(pack)))}><Download size={17} />匯出目前題庫</button><label className="file-action"><FileUp size={17} />加入題庫 JSON<input aria-label="匯入題庫" type="file" accept=".json,application/json" disabled={reading} onChange={e => void read(e, 'pack')} /></label></div><div className="pack-list">{packs.map(p => <article key={p.manifest.id}><div><b>{p.manifest.name}</b><p>{p.manifest.grade} 年級 · {p.manifest.subject} · {p.questions.length} 題{p.manifest.demo ? ' · 示範資料' : ''}</p></div><button className="secondary" disabled={p.manifest.id === pack.manifest.id} onClick={() => setPending({ type: 'switch', id: p.manifest.id })}>{p.manifest.id === pack.manifest.id ? '目前使用' : `切換題庫：${p.manifest.name}`}</button></article>)}</div><p className="parent-note">最多十份匯入題庫、每個檔案 5 MB。清除網站資料也會移除題庫與進度，請定期匯出兩種備份。請僅使用有權使用且已審核的教材。</p></section>
    <section className="parent-section reset-section"><h2>重新開始這份題庫</h2><p>清空目前題庫的進度，保留其他題庫與閱讀設定。建議先匯出存檔。</p><button className="text-button" onClick={() => { setResetText(''); setPending({ type: 'reset' }); }}>重置目前進度</button></section>
    {pending && <Dialog title={pending.type === 'save' ? '確認還原存檔' : pending.type === 'pack' ? '確認加入題庫' : pending.type === 'switch' ? '確認切換題庫' : '確認重置進度'} onClose={() => { setPending(null); setError(''); }}><p>{pending.type === 'save' ? `將取代目前進度：${pending.save.stats.questionsAnswered} 題作答、${pending.save.coins} 金幣、${pending.save.clearedUnitIds.length} 個通關單元。` : pending.type === 'pack' ? `${pending.pack.manifest.name}，${pending.pack.units.length} 個單元、${pending.pack.questions.length} 題。加入後可從清單切換。` : pending.type === 'switch' ? '目前進度會先保存，接著重新開啟所選題庫。家長入口會重新上鎖。' : '這會清除目前題庫的金幣、經驗、道具與學習紀錄。請輸入「重新開始」確認。'}</p>{pending.type === 'reset' && <label className="reset-label">確認文字<input aria-label="重置確認文字" value={resetText} onChange={e => setResetText(e.target.value)} /></label>}{error && <p role="alert">{error}</p>}<button className="primary" disabled={pending.type === 'reset' && resetText !== '重新開始'} onClick={confirm}>{pending.type === 'save' ? '還原並取代進度' : pending.type === 'pack' ? '確認加入' : pending.type === 'switch' ? '保存並切換' : '確認重置'}</button><button className="text-button" onClick={() => setPending(null)}>取消</button></Dialog>}
  </div>;
}
