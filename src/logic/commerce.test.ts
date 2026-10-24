import { describe, expect, it } from 'vitest';
import { loadBuiltinPack } from '../data/loader';
import { gameConfig } from '../data/gameConfig';
import { newGame, LocalSaveRepository, SAVE_KEY } from './save';
import { awardDrops, rollDrops } from './drops';
import { healWithPotion, purchase } from './shop';
const pack = loadBuiltinPack();
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
describe('掉落與收藏', () => {
  it('每次保證一件，25% 邊界控制額外掉落', () => {
    let values = [0.249, 0.7, 0, 0.95, 0]; expect(rollDrops(pack.dropTables[0], () => values.shift()!)).toHaveLength(2);
    values = [0.25, 0, 0]; expect(rollDrops(pack.dropTables[0], () => values.shift()!)).toHaveLength(1);
  });
  it('稀有度邊界與單元限定史詩', () => {
    for (const [value, rarity] of [[0.699, 'common'], [0.7, 'rare'], [0.949, 'rare'], [0.95, 'epic']] as const) {
      const values = [0.5, value, 0]; const [id] = rollDrops(pack.dropTables[2], () => values.shift()!);
      expect(pack.items.find(i => i.id === id)?.rarity).toBe(rarity);
      if (rarity === 'epic') expect(id).toBe('rainbow-window');
    }
  });
  it('1000 場固定種子模擬：普通掉落 70%±3%、稀有及史詩可取得', () => {
    const random = seeded(20261024); const counts = { common: 0, rare: 0, epic: 0 }; let extra = 0;
    for (let i = 0; i < 1000; i++) { const drops = rollDrops(pack.dropTables[0], random); extra += drops.length - 1; for (const id of drops) counts[pack.items.find(item => item.id === id)!.rarity]++; }
    const total = counts.common + counts.rare + counts.epic;
    expect(counts.common / total).toBeGreaterThanOrEqual(0.67); expect(counts.common / total).toBeLessThanOrEqual(0.73);
    expect(counts.rare / total).toBeGreaterThan(0.2); expect(counts.rare / total).toBeLessThan(0.3);
    expect(counts.epic / total).toBeGreaterThan(0.02); expect(counts.epic / total).toBeLessThan(0.08);
    expect(extra).toBeGreaterThan(210); expect(extra).toBeLessThan(290);
  });
  it('同箱重複裝扮逐件轉換，只留一件且不更動輸入', () => {
    const initial = newGame(pack); const awarded = awardDrops(initial, ['explorer-hat', 'explorer-hat'], pack);
    expect(awarded.player.inventory['explorer-hat']).toBe(1); expect(awarded.player.coins).toBe(30); expect(awarded.receipts[1].disposition).toBe('duplicate-outfit'); expect(initial.inventory['explorer-hat']).toBeUndefined();
  });
  it('家具可重複至九件，額外掉落不超量也不消失', () => {
    const initial = newGame(pack); initial.inventory.desk = 8;
    const awarded = awardDrops(initial, ['desk', 'desk'], pack);
    expect(awarded.player.inventory.desk).toBe(9); expect(awarded.bonusCoins).toBe(30); expect(awarded.receipts[1].disposition).toBe('full-furniture');
  });
});
describe('商店與補給', () => {
  it('金幣不足不能購買或改動進度', () => { const initial = newGame(pack); const before = structuredClone(initial); const result = purchase(initial, 'desk', pack); expect(result.ok).toBe(false); expect(result.message).toContain('金幣不足'); expect(initial).toEqual(before); });
  it('正好足額可買家具，扣款並入庫', () => { const initial = newGame(pack); initial.coins = 50; const result = purchase(initial, 'desk', pack); if (!result.ok) throw new Error(result.message); expect(result.player.coins).toBe(0); expect(result.player.inventory.desk).toBe(2); expect(result.player.ownedItemIds.filter(id => id === 'desk')).toHaveLength(1); });
  it('不能買重複裝扮、滿額家具或掉落限定商品', () => { const initial = newGame(pack); initial.coins = 999; initial.inventory.desk = 9; initial.inventory['explorer-hat'] = 1; for (const id of ['desk', 'explorer-hat', 'leaf-crown', 'missing']) expect(purchase(initial, id, pack).ok).toBe(false); });
  it('購買藥水扣款，不加入外觀收藏', () => { const initial = newGame(pack); initial.coins = 25; const result = purchase(initial, gameConfig.potion.id, pack); if (!result.ok) throw new Error(result.message); expect(result.player.potions).toBe(1); expect(result.player.coins).toBe(0); expect(result.player.ownedItemIds).toEqual(initial.ownedItemIds); });
  it('補血不超上限、滿血或零庫存不能消耗', () => { expect(healWithPotion(30, 100, 2)).toEqual({ hp: 80, potions: 1, healed: 50 }); expect(healWithPotion(79, 100, 2)).toEqual({ hp: 100, potions: 1, healed: 21 }); expect(healWithPotion(100, 100, 2)).toBeNull(); expect(healWithPotion(70, 100, 0)).toBeNull(); expect(healWithPotion(0, 100, 2)).toBeNull(); });
  it('舊版 v1 存檔補入零藥水並保留所有進度', () => {
    const old: Record<string, unknown> = { ...newGame(pack), coins: 375, xp: 140 }; delete old.potions;
    const storage = { getItem: (key: string) => key === SAVE_KEY ? JSON.stringify(old) : null, setItem: () => {} };
    const result = new LocalSaveRepository(storage).load(); expect(result.warning).toBeUndefined(); expect(result.save?.potions).toBe(0); expect(result.save?.coins).toBe(375); expect(result.save?.xp).toBe(140);
  });
});
