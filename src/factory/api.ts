export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, cache: 'no-store' });
  let data: unknown; try { data = await response.json(); } catch { throw new Error('無法讀取本機服務的回應，請確認內容工廠已啟動。'); }
  if (!response.ok) throw new Error((data as { error?: string }).error ?? '本機服務暫時無法完成操作。');
  return data as T;
}
export function jsonPost<T>(path: string, data: unknown) { return api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
export function upload(form: FormData, progress: (percent: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/documents'); xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error('上傳連線中斷，請確認本機服務已啟動。')); xhr.ontimeout = () => reject(new Error('上傳逾時，請重新上傳。'));
    xhr.onload = () => { try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(data); else reject(new Error(data.error ?? '教材上傳失敗。')); } catch { reject(new Error('本機服務回應格式不符。')); } };
    xhr.send(form);
  });
}
