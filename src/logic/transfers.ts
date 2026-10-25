import { validatePack } from '../data/loader';
import type { ContentPack } from '../data/schemas';
import { saveSchema, type PlayerSave } from './save';
import { placeFurniture } from './placement';

export const MAX_TRANSFER_BYTES = 5 * 1024 * 1024;
export function readTransfer(raw: string): unknown {
  if (new TextEncoder().encode(raw).length > MAX_TRANSFER_BYTES) throw new Error('檔案不可超過 5 MB。');
  try { return JSON.parse(raw); } catch { throw new Error('檔案不是有效的 JSON。'); }
}
export function packFiles(pack: ContentPack) {
  return { 'pack.json': pack.manifest, 'questions.json': pack.questions, 'units.json': pack.units, 'items.json': pack.items, 'outfit-models.json': pack.outfitModels, 'drops.json': pack.dropTables, 'encyclopedia.json': pack.encyclopedia, 'achievements.json': pack.achievements };
}
export function exportPack(pack: ContentPack) { return JSON.stringify({ format: 'learning-adventure:pack', version: 1, files: packFiles(pack) }, null, 2); }
export function importPack(raw: string) {
  const data = readTransfer(raw) as { format?: string; version?: number; files?: Record<string, unknown> } | null;
  if (!data || data.format !== 'learning-adventure:pack' || data.version !== 1 || !data.files) throw new Error('請選擇版本 1 的題庫備份。');
  const pack = validatePack(data.files);
  for (const unit of pack.units) if (unit.questionPool.length < 12) throw new Error(`${unit.name} 至少需要 12 題。`);
  return pack;
}
export function validateProgress(input: unknown, pack: ContentPack): PlayerSave {
  const result = saveSchema.safeParse(input);
  if (!result.success) throw new Error(`存檔格式不符：${result.error.issues[0]?.path.join('.')}`);
  const save = result.data;
  if (save.contentPackId !== pack.manifest.id) throw new Error('存檔屬於其他內容包，請先切換到相同題庫。');
  const has = (ids: string[], allowed: string[]) => ids.every(id => allowed.includes(id)) && new Set(ids).size === ids.length;
  if (!has(save.ownedItemIds, pack.items.map(i => i.id)) || !has(Object.keys(save.inventory), pack.items.map(i => i.id)) ||
    !has(save.clearedUnitIds, pack.units.map(u => u.id)) || !has(Object.keys(save.unitStars), save.clearedUnitIds) ||
    !has(save.wrongQuestionIds, pack.questions.map(q => q.id)) || !has(save.readEncyclopediaIds, pack.encyclopedia.filter(e => save.clearedUnitIds.includes(e.unitId)).map(e => e.id)) ||
    !has(save.unlockedAchievementIds, pack.achievements.map(a => a.id))) throw new Error('存檔含未知、重複或不符合進度的項目。');
  if (save.stats.correct > save.stats.questionsAnswered) throw new Error('答對題數不可超過作答題數。');
  for (const item of pack.items) {
    const count = save.inventory[item.id] ?? 0;
    if (count > (item.kind === 'outfit' ? 1 : 9) || (count > 0) !== save.ownedItemIds.includes(item.id)) throw new Error(`道具庫存不符：${item.name}`);
  }
  for (const [slot, id] of Object.entries(save.equippedOutfit)) if (!pack.items.some(i => i.id === id && i.kind === 'outfit' && i.outfitSlot === slot && (save.inventory[id] ?? 0) > 0)) throw new Error('穿搭包含未持有或部位不符的道具。');
  let placed: PlayerSave = { ...save, roomLayout: [] };
  for (const position of save.roomLayout) { const next = placeFurniture(placed, pack.items, position); if (!next.ok) throw new Error(`小屋配置不符：${next.message}`); placed = next.player; }
  return save;
}
export function importProgress(raw: string, pack: ContentPack) { return validateProgress(readTransfer(raw), pack); }
