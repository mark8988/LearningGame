import { describe, expect, it } from 'vitest';
import { loadBuiltinPack } from '../data/loader';
import { LocalSaveRepository, newGame, SAVE_KEY } from './save';
function memory() { const data = new Map<string, string>(); return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; }
describe('本機存檔', () => {
  it('新遊戲含四件 starter 家具，房間先保持空場景', () => { const save = newGame(loadBuiltinPack()); expect(save.ownedItemIds).toEqual(['bed', 'desk', 'chair', 'rug']); expect(save.inventory.desk).toBe(1); expect(save.roomLayout).toEqual([]); });
  it('存入後可由新 repository 還原', () => { const storage = memory(); const save = newGame(loadBuiltinPack()); save.coins = 123; new LocalSaveRepository(storage).save(save); expect(new LocalSaveRepository(storage).load().save).toEqual(save); });
  it('備份損毀資料，不靜默丟棄', () => { const storage = memory(); storage.setItem(SAVE_KEY, '{bad'); const result = new LocalSaveRepository(storage).load(); expect(result.save).toBeNull(); expect(result.warning).toContain('已保留備份'); expect([...storage.data.keys()].some(k => k.includes(':corrupt:'))).toBe(true); });
  it('拒絕未來版本且保留原檔', () => { const storage = memory(); const raw = JSON.stringify({ saveVersion: 99 }); storage.setItem(SAVE_KEY, raw); const result = new LocalSaveRepository(storage).load(); expect(result.warning).toContain('原始存檔已保留'); expect(storage.getItem(SAVE_KEY)).toBe(raw); });
  it('負數金幣視為損毀存檔', () => { const storage = memory(); storage.setItem(SAVE_KEY, JSON.stringify({ ...newGame(loadBuiltinPack()), coins: -1 })); expect(new LocalSaveRepository(storage).load().save).toBeNull(); });
  it('儲存空間不足時向上回報', () => { const repository = new LocalSaveRepository({ getItem: () => null, setItem: () => { throw new Error('quota'); } }); expect(() => repository.save(newGame(loadBuiltinPack()))).toThrow('quota'); });
});
