import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { loadBuiltinPack } from '../data/loader';
import { outfitAnchors, outfitBounds, outfitSlots } from '../data/outfitConfig';
import { createOutfitModel, disposeOutfitModel } from '../components/outfitModel';
import { equipOutfit, normalizeOutfit, resolveOutfit, tryOnOutfit } from './outfits';
import { newGame } from './save';
const pack = loadBuiltinPack();
function collected() { const player = newGame(pack); for (const item of pack.items.filter(i => i.kind === 'outfit')) { player.inventory[item.id] = 1; player.ownedItemIds.push(item.id); } return player; }
describe('衣櫃與預覽', () => {
  it('只能穿戴已收藏且部位正確的裝扮', () => {
    const player = newGame(pack); expect(equipOutfit(player, pack, 'hat', 'explorer-hat').ok).toBe(false);
    const owned = collected(); expect(equipOutfit(owned, pack, 'top', 'explorer-hat').ok).toBe(false); expect(equipOutfit(owned, pack, 'hat', 'desk').ok).toBe(false);
  });
  it('每部位只能一件，其他部位、庫存與數值不變', () => {
    const player = collected(); player.equippedOutfit = { hat: 'explorer-hat', top: 'ranger-top' };
    const before = structuredClone(player); const result = equipOutfit(player, pack, 'hat', 'leaf-crown'); if (!result.ok) throw new Error(result.message);
    expect(result.player.equippedOutfit).toEqual({ hat: 'leaf-crown', top: 'ranger-top' }); expect(result.player.inventory).toEqual(before.inventory); expect(player).toEqual(before); expect(result.player.xp).toBe(before.xp); expect(result.player.coins).toBe(before.coins);
  });
  it('單部位還原不會脫掉其他部位或刪除收藏', () => { const player = collected(); player.equippedOutfit = { hat: 'explorer-hat', top: 'ranger-top' }; const result = equipOutfit(player, pack, 'hat', null); if (!result.ok) throw new Error(result.message); expect(result.player.equippedOutfit).toEqual({ top: 'ranger-top' }); expect(result.player.inventory['explorer-hat']).toBe(1); });
  it('未購買也可試穿，原始玩家與金幣完全不變', () => { const player = newGame(pack); const before = structuredClone(player); const preview = tryOnOutfit(player, 'ranger-top', pack); expect(resolveOutfit(preview, pack).map(p => p.item.id)).toContain('ranger-top'); expect(player).toEqual(before); expect(preview.coins).toBe(player.coins); expect(preview.xp).toBe(player.xp); });
  it('七個 slot 都有可穿戴模型並按固定順序合成', () => {
    let player = collected(); for (const slot of outfitSlots) { const item = pack.items.find(i => i.kind === 'outfit' && i.outfitSlot === slot)!; const result = equipOutfit(player, pack, slot, item.id); if (!result.ok) throw new Error(result.message); player = result.player; }
    expect(resolveOutfit(player, pack).map(p => p.slot)).toEqual([...outfitSlots]);
  });
  it('未知、未持有、錯誤部位的存檔外觀不會進入場景', () => { const player = newGame(pack); player.equippedOutfit = { hat: 'missing', top: 'explorer-hat', handheld: 'lantern' }; expect(normalizeOutfit(player, pack)).toEqual({}); expect(resolveOutfit(player, pack)).toHaveLength(0); });
});
describe('3D 裝扮資產', () => {
  for (const model of pack.outfitModels) it(`${model.asset} 錨點與幾何尺寸符合角色規範`, () => {
    const group = createOutfitModel(model);
    try {
      expect(group.position.toArray()).toEqual(outfitAnchors[model.slot]); const box = new Box3().setFromObject(group); const size = box.getSize(new Vector3()).toArray();
      expect(group.children.length).toBeGreaterThan(0); size.forEach((value, i) => { expect(value).toBeGreaterThan(0); expect(value).toBeLessThanOrEqual(outfitBounds[model.slot][i] + 0.001); }); expect(box.min.y).toBeGreaterThanOrEqual(-0.001); expect(box.max.y).toBeLessThan(2.5);
    } finally { disposeOutfitModel(group); }
  });
});
