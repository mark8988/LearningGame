import type { ContentPack } from '../data/schemas';
import type { PlayerSave } from './save';
import { awardDrops } from './drops';
export interface AchievementAward { id: string; coins: number; itemId?: string; converted: boolean }
export function achievementProgress(player: PlayerSave, pack: ContentPack, metric: ContentPack['achievements'][number]['metric']) {
  switch (metric) {
    case 'correct': return player.stats.correct;
    case 'battlesWon': return player.stats.battlesWon;
    case 'placed': return player.roomLayout.length;
    case 'collection': return pack.items.filter(item => (player.inventory[item.id] ?? 0) > 0 && player.ownedItemIds.includes(item.id)).length;
  }
}
export function unlockAchievements(player: PlayerSave, pack: ContentPack) {
  let next = player; const awards: AchievementAward[] = []; const unlocked = new Set(player.unlockedAchievementIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const achievement of pack.achievements) {
      if (unlocked.has(achievement.id) || achievementProgress(next, pack, achievement.metric) < achievement.target) continue;
      unlocked.add(achievement.id); changed = true;
      const drop = awardDrops(next, achievement.rewardItemId ? [achievement.rewardItemId] : [], pack);
      const coins = (achievement.coins ?? 0) + drop.bonusCoins;
      next = { ...drop.player, coins: drop.player.coins + (achievement.coins ?? 0), unlockedAchievementIds: [...unlocked] };
      awards.push({ id: achievement.id, coins, itemId: achievement.rewardItemId, converted: drop.receipts.some(receipt => receipt.disposition !== 'added') });
    }
  }
  return { player: next, awards };
}
