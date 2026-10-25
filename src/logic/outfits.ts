import type { ContentPack, OutfitSlot } from '../data/schemas';
import { outfitSlots } from '../data/outfitConfig';
import type { PlayerSave } from './save';
export function resolveOutfit(player: PlayerSave, pack: Pick<ContentPack, 'items' | 'outfitModels'>) {
  return outfitSlots.flatMap(slot => {
    const id = player.equippedOutfit[slot];
    const item = pack.items.find(i => i.id === id && i.kind === 'outfit' && i.outfitSlot === slot);
    const model = item && pack.outfitModels.find(m => m.asset === item.asset && m.slot === slot);
    return item && model && (player.inventory[item.id] ?? 0) > 0 && player.ownedItemIds.includes(item.id) ? [{ slot, item, model }] : [];
  });
}
export function normalizeOutfit(player: PlayerSave, pack: ContentPack) {
  return Object.fromEntries(resolveOutfit(player, pack).map(part => [part.slot, part.item.id])) as PlayerSave['equippedOutfit'];
}
export function equipOutfit(player: PlayerSave, pack: ContentPack, slot: OutfitSlot, itemId: string | null) {
  if (!outfitSlots.includes(slot)) return { ok: false as const, message: '找不到這個裝扮部位。' };
  if (itemId === null) {
    const equippedOutfit = { ...player.equippedOutfit }; delete equippedOutfit[slot];
    return { ok: true as const, player: { ...player, equippedOutfit }, message: '已還原這個部位的預設外觀。' };
  }
  const item = pack.items.find(i => i.id === itemId && i.kind === 'outfit' && i.outfitSlot === slot);
  if (!item || !(player.inventory[itemId] > 0) || !player.ownedItemIds.includes(itemId)) return { ok: false as const, message: '只能穿戴已收藏且符合部位的裝扮。' };
  if (!pack.outfitModels.some(m => m.asset === item.asset && m.slot === slot)) return { ok: false as const, message: '這件裝扮的 3D 模型尚未就緒。' };
  return { ok: true as const, player: { ...player, equippedOutfit: { ...player.equippedOutfit, [slot]: itemId } }, message: `已換上${item.name}，小屋與冒險中都看得見！` };
}
export function tryOnOutfit(player: PlayerSave, itemId: string, pack: ContentPack): PlayerSave {
  const item = pack.items.find(i => i.id === itemId && i.kind === 'outfit');
  if (!item?.outfitSlot) return player;
  // 僅建立預覽副本，所有場景仍經過相同的模型解析。
  return { ...player, inventory: { ...player.inventory, [item.id]: 1 }, ownedItemIds: [...new Set([...player.ownedItemIds, item.id])], equippedOutfit: { ...player.equippedOutfit, [item.outfitSlot]: item.id } };
}
