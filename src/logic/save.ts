import { z } from 'zod';
import type { ContentPack } from '../data/schemas';
const nonnegative = z.number().int().nonnegative();
const outfitSlot = z.enum(['hair', 'top', 'bottom', 'shoes', 'hat', 'accessory', 'handheld']);
export const saveSchema = z.object({
  saveVersion: z.literal(1), contentPackId: z.string(), coins: nonnegative, xp: nonnegative, potions: nonnegative.max(99).default(0),
  ownedItemIds: z.array(z.string()), inventory: z.record(z.string(), nonnegative), equippedOutfit: z.partialRecord(outfitSlot, z.string()),
  roomLayout: z.array(z.object({ itemId: z.string(), x: nonnegative, y: nonnegative, rotation: z.union([z.literal(0), z.literal(1)]) })),
  clearedUnitIds: z.array(z.string()), unitStars: z.record(z.string(), z.number().int().min(1).max(3)), readEncyclopediaIds: z.array(z.string()), wrongQuestionIds: z.array(z.string()), unlockedAchievementIds: z.array(z.string()),
  stats: z.object({ battlesWon: nonnegative, questionsAnswered: nonnegative, correct: nonnegative }), updatedAt: z.string().datetime(),
});
export type PlayerSave = z.infer<typeof saveSchema>;
export function newGame(pack: ContentPack): PlayerSave {
  const starter = pack.items.filter(i => i.obtainFrom.includes('starter'));
  return { saveVersion: 1, contentPackId: pack.manifest.id, coins: 0, xp: 0, potions: 0, ownedItemIds: starter.map(i => i.id), inventory: Object.fromEntries(starter.map(i => [i.id, 1])), equippedOutfit: {}, roomLayout: [], clearedUnitIds: [], unitStars: {}, readEncyclopediaIds: [], wrongQuestionIds: [], unlockedAchievementIds: [], stats: { battlesWon: 0, questionsAnswered: 0, correct: 0 }, updatedAt: new Date().toISOString() };
}
export interface SaveRepository { load(): { save: PlayerSave | null; warning?: string }; save(value: PlayerSave): void }
export const SAVE_KEY = 'learning-adventure:save:v1';
export class LocalSaveRepository implements SaveRepository {
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'>, private key = SAVE_KEY) {}
  load(): { save: PlayerSave | null; warning?: string } {
    let raw: string | null;
    try { raw = this.storage.getItem(this.key); } catch { return { save: null, warning: '無法讀取本機存檔；目前進度只保留到關閉頁面。' }; }
    if (!raw) return { save: null };
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return this.recover(raw); }
    if (typeof data === 'object' && data !== null && 'saveVersion' in data && data.saveVersion !== 1) return { save: null, warning: '這份存檔版本尚不支援，原始存檔已保留；請使用相符版本開啟。' };
    const result = saveSchema.safeParse(data);
    return result.success ? { save: result.data } : this.recover(raw);
  }
  private recover(raw: string) {
    try { this.storage.setItem(`${this.key}:corrupt:${Date.now()}`, raw); } catch { return { save: null, warning: '存檔損毀且備份失敗，原始存檔將保留；請家長協助。' }; }
    return { save: null, warning: '存檔損毀，已保留備份並建立新遊戲，請家長協助檢查。' };
  }
  save(value: PlayerSave) { this.storage.setItem(this.key, JSON.stringify(saveSchema.parse(value))); }
}
