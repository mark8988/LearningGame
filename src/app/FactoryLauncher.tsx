import { useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
const KEY = 'learning-adventure:factory-url:v1';
export function localFactoryUrl(value: string) {
  try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) return null; url.pathname = '/'; url.search = ''; url.hash = ''; return url.href; } catch { return null; }
}
export function FactoryLauncher() {
  const [value, setValue] = useState(() => { try { return localStorage.getItem(KEY) ?? 'http://127.0.0.1:5088/'; } catch { return 'http://127.0.0.1:5088/'; } });
  const [error, setError] = useState(''); const url = localFactoryUrl(value);
  return <section className="parent-section factory-launcher" aria-label="教材內容工廠"><h2><BookOpen size={20} />讓課本成為下一場冒險</h2><p>本機內容工廠可上傳 PDF、EPUB 或掃描圖片，擷取文字並確認科目、年級及單元。請在已啟動內容工廠的電腦開啟；教材保留在電腦上。可比較本機模型、產生並審核題目，再打包成遊戲題庫 JSON，回到這裡匯入遊玩。</p><details><summary>本機服務位址</summary><label>內容工廠位址<input aria-label="內容工廠位址" type="url" value={value} onChange={e => { setValue(e.target.value); setError(''); }} /></label><p>預設使用這台電腦的本機服務，可調整連接埠。</p></details>{!url && <p role="alert">請填寫 localhost 或 127.0.0.1 的本機 HTTP／HTTPS 位址。</p>}{error && <p role="alert">{error}</p>}<a className="secondary" href={url ?? undefined} aria-disabled={!url} target="_blank" rel="noopener noreferrer" onClick={e => { if (!url) { e.preventDefault(); return; } try { localStorage.setItem(KEY, url); } catch { setError('位址暫時無法保存，仍可開啟內容工廠。'); } }}>開啟本機內容工廠<ArrowUpRight size={16} /></a></section>;
}
