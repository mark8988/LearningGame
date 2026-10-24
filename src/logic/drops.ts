import type { ContentPack, DropTable } from '../data/schemas';
import { gameConfig } from '../data/gameConfig';
import type { PlayerSave } from './save';

export interface DropReceipt { itemId: string; disposition: 'added' | 'duplicate-outfit' | 'full-furniture'; coins: number }
export function rollDrops(table: DropTable, random: () => number = Math.random): string[] {
  const count = random() < gameConfig.bonusDropChance ? 2 : 1;
  return Array.from({ length: count }, () => {
    const value = random();
    const rarity = value < gameConfig.dropWeights.common ? 'common' : value < gameConfig.dropWeights.common + gameConfig.dropWeights.rare ? 'rare' : 'epic';
    return table[rarity][Math.floor(random() * table[rarity].length)];
  });
}
export function awardDrops(player: PlayerSave, ids: string[], pack: ContentPack) {
  const inventory = { ...player.inventory };
  const owned = new Set(player.ownedItemIds);
  const receipts: DropReceipt[] = ids.map(itemId => {
    const item = pack.items.find(i => i.id === itemId);
    if (!item) throw new Error(`掉落道具不存在：${itemId}`);
    const quantity = inventory[itemId] ?? 0;
    const disposition = item.kind === 'outfit' && (quantity > 0 || owned.has(itemId)) ? 'duplicate-outfit' : item.kind === 'furniture' && quantity >= gameConfig.furnitureLimit ? 'full-furniture' : 'added';
    if (disposition === 'added') { inventory[itemId] = quantity + 1; owned.add(itemId); }
    return { itemId, disposition, coins: disposition === 'added' ? 0 : gameConfig.duplicateCoins };
  });
  const bonusCoins = receipts.reduce((sum, receipt) => sum + receipt.coins, 0);
  return { player: { ...player, inventory, ownedItemIds: [...owned], coins: player.coins + bonusCoins }, receipts, bonusCoins };
}
