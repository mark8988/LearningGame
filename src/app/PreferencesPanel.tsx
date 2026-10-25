import { Dialog } from '../components/Dialog';
import { usePreferences } from '../stores/preferences';
import { playSound } from '../logic/sound';
export function PreferencesPanel({ onClose }: { onClose(): void }) {
  const preferences = usePreferences();
  return <Dialog title="讓探索更舒服" onClose={onClose}><div className="preference-options"><label><input type="checkbox" checked={!preferences.muted} onChange={e => { preferences.change('muted', !e.target.checked); if (e.target.checked) playSound('correct'); }} /><span><b>開啟音效</b><small>答對、答錯及取得獎勵時播放輕柔提示，預設靜音。</small></span></label><label><input type="checkbox" checked={preferences.largeText} onChange={e => preferences.change('largeText', e.target.checked)} /><span><b>放大閱讀文字</b><small>放大題目、選項、解析及知識內文。</small></span></label><label><input type="checkbox" checked={preferences.zhuyin} onChange={e => preferences.change('zhuyin', e.target.checked)} /><span><b>顯示題幹注音</b><small>有提供注音的題目會標示；未提供的題目保留原文。</small></span></label></div>{preferences.error && <p role="alert">{preferences.error}</p>}<button className="primary" onClick={onClose}>完成設定</button></Dialog>;
}
