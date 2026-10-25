import type { ContentPack } from './schemas';
import { loadBuiltinPack } from './loader';
import { exportPack, importPack } from '../logic/transfers';
import { SAVE_KEY } from '../logic/save';
const LIBRARY_KEY = 'learning-adventure:library:v1';
const ACTIVE_KEY = 'learning-adventure:active-pack:v1';
export const progressKey = (id: string, builtinId = 'science-g3') => id === builtinId ? SAVE_KEY : `${SAVE_KEY}:pack:${encodeURIComponent(id)}`;
export function readLibrary(storage: Pick<Storage, 'getItem'>, builtin: ContentPack): ContentPack[] {
  const raw = storage.getItem(LIBRARY_KEY); if (!raw) return [builtin];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.length > 10) throw new Error('本機題庫清單格式不符，請還原題庫備份。');
  const imported = entries.map(entry => { if (typeof entry !== 'string') throw new Error('本機題庫清單格式不符。'); return importPack(entry); });
  if (new Set(imported.map(p => p.manifest.id)).size !== imported.length || imported.some(p => p.manifest.id === builtin.manifest.id)) throw new Error('本機題庫 ID 重複。');
  return [builtin, ...imported];
}
export function addLibraryPack(storage: Pick<Storage, 'getItem' | 'setItem'>, pack: ContentPack, builtin: ContentPack) {
  const packs = readLibrary(storage, builtin);
  const existing = packs.find(p => p.manifest.id === pack.manifest.id);
  if (existing) { if (exportPack(existing) === exportPack(pack)) return; throw new Error('相同 ID 的題庫已存在。請使用原題庫，或由製作者提供新的 ID。'); }
  if (packs.length >= 11) throw new Error('最多可加入十份題庫。');
  storage.setItem(LIBRARY_KEY, JSON.stringify([...packs.slice(1), pack].map(exportPack)));
}
export function selectLibraryPack(storage: Pick<Storage, 'getItem' | 'setItem'>, id: string, builtin: ContentPack) {
  if (!readLibrary(storage, builtin).some(p => p.manifest.id === id)) throw new Error('找不到這份題庫。');
  storage.setItem(ACTIVE_KEY, id);
}
export function bootContent(storage: Pick<Storage, 'getItem'>) {
  const builtin = loadBuiltinPack();
  try {
    const packs = readLibrary(storage, builtin); const selected = storage.getItem(ACTIVE_KEY);
    const pack = packs.find(p => p.manifest.id === selected) ?? builtin;
    return { pack, key: progressKey(pack.manifest.id, builtin.manifest.id), warning: selected && !packs.some(p => p.manifest.id === selected) ? '找不到上次使用的題庫，已開啟內建題庫，原資料保留。' : null };
  } catch {
    return { pack: builtin, key: progressKey(builtin.manifest.id), warning: '無法讀取題庫清單，已開啟內建題庫。原資料保留，請家長檢查瀏覽器儲存或題庫備份。' };
  }
}
