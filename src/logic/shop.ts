import type { ContentPack } from '../data/schemas';
import { gameConfig } from '../data/gameConfig';
import type { PlayerSave } from './save';

export type PurchaseResult = { ok: true; player: PlayerSave; message: string } | { ok: false; message: string };
export function purchase(player: PlayerSave, productId: string, pack: ContentPack): PurchaseResult {
  if (productId === gameConfig.potion.id) {
    if (player.potions >= gameConfig.potion.limit) return { ok: false, message: '藥水已達 99 瓶上限。' };
    if (player.coins < gameConfig.potion.price) return { ok: false, message: '金幣不足，完成冒險就能獲得更多金幣！' };
    return { ok: true, message: '森林 HP 藥水已放進背包。', player: { ...player, coins: player.coins - gameConfig.potion.price, potions: player.potions + 1 } };
  }
  const item = pack.items.find(i => i.id === productId);
  if (!item || !item.obtainFrom.includes('shop') || item.price <= 0) return { ok: false, message: '這件道具無法在商店購買。' };
  const quantity = player.inventory[item.id] ?? 0;
  if (item.kind === 'outfit' && (quantity > 0 || player.ownedItemIds.includes(item.id))) return { ok: false, message: '你已經擁有這件裝扮囉！' };
  if (item.kind === 'furniture' && quantity >= gameConfig.furnitureLimit) return { ok: false, message: '這款家具已達 9 件上限。' };
  if (player.coins < item.price) return { ok: false, message: '金幣不足，完成冒險就能獲得更多金幣！' };
  return { ok: true, message: `${item.name}已放進收藏背包。`, player: { ...player, coins: player.coins - item.price, inventory: { ...player.inventory, [item.id]: quantity + 1 }, ownedItemIds: [...new Set([...player.ownedItemIds, item.id])] } };
}
export function healWithPotion(hp: number, max: number, potions: number) {
  if (potions <= 0 || hp <= 0 || hp >= max) return null;
  return { hp: Math.min(max, hp + gameConfig.potion.heal), potions: potions - 1, healed: Math.min(gameConfig.potion.heal, max - hp) };
}
