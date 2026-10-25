import { useEffect, useState } from 'react';
import { boot } from '../stores/gameStore';
let registration: Promise<ServiceWorkerRegistration> | null = null;
export function OfflineStatus() {
  const [offline, setOffline] = useState(!navigator.onLine); const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null); const [failed, setFailed] = useState(false); const [updating, setUpdating] = useState(false);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine); window.addEventListener('online', online); window.addEventListener('offline', online);
    let disposed = false; const cleanup: (() => void)[] = [];
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      registration ??= navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' });
      void registration.then(reg => {
        if (disposed) return;
        const update = () => { if (!disposed) { setWaiting(reg.waiting); setReady(!!reg.active); } };
        update(); const found = () => { const worker = reg.installing; if (worker) { worker.addEventListener('statechange', update); cleanup.push(() => worker.removeEventListener('statechange', update)); } };
        reg.addEventListener('updatefound', found); found(); cleanup.push(() => reg.removeEventListener('updatefound', found));
        void navigator.serviceWorker.ready.then(() => { if (!disposed) setReady(true); });
      }).catch(() => { if (!disposed) setFailed(true); });
    }
    return () => { disposed = true; window.removeEventListener('online', online); window.removeEventListener('offline', online); cleanup.forEach(fn => fn()); };
  }, []);
  const update = () => { boot?.flush(); if (boot?.store.getState().saveStatus !== 'saved') { setFailed(true); return; } setUpdating(true); navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); waiting?.postMessage('ACTIVATE_UPDATE'); };
  return <span className="offline-status"><span>{offline ? ready ? '離線中 · 冒險照常' : '目前離線' : ready ? '離線遊玩已就緒' : failed ? '離線準備未完成，請保留網路並重新整理' : import.meta.env.DEV ? '本機開發模式' : '正在準備離線遊玩…'}</span>{waiting && <button disabled={updating} onClick={update}>{updating ? '正在更新…' : '保存並更新版本'}</button>}</span>;
}
