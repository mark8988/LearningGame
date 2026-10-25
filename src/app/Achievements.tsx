import { Award, Coins, Gift, Trophy, X } from 'lucide-react';
import { boot } from '../stores/gameStore';
import { achievementProgress } from '../logic/achievements';
export function Achievements() {
  const { pack, player } = boot!.store();
  return <><div className="learning-summary"><span>已達成 {pack.achievements.filter(a => player.unlockedAchievementIds.includes(a.id)).length} / {pack.achievements.length} 項</span><span>達成時自動領取，每項獎勵只發一次</span></div><div className="achievement-grid">{pack.achievements.map(achievement => {
    const claimed = player.unlockedAchievementIds.includes(achievement.id); const progress = achievementProgress(player, pack, achievement.metric);
    const item = pack.items.find(item => item.id === achievement.rewardItemId);
    return <section key={achievement.id} className={`achievement-card ${claimed ? 'claimed' : ''}`} aria-label={achievement.name}><span className="achievement-emblem"><Trophy size={27} strokeWidth={1.4} /></span><span className="eyebrow">{claimed ? '已達成・獎勵已入帳' : '每一步都在靠近'}</span><h2>{achievement.name}</h2><div className="achievement-progress"><progress max={achievement.target} value={claimed ? achievement.target : Math.min(progress, achievement.target)} aria-label={`${achievement.name}進度`} /><span>{claimed ? achievement.target : Math.min(progress, achievement.target)} / {achievement.target}</span></div><div className="achievement-reward">{item && <span><Gift size={16} />{item.name}</span>}{!!achievement.coins && <span><Coins size={16} />{achievement.coins} 金幣</span>}</div></section>;
  })}</div></>;
}
export function AchievementNotice() {
  const game = boot!.store(); const award = game.achievementQueue[0]; if (!award) return null;
  const achievement = game.pack.achievements.find(a => a.id === award.id)!;
  const item = game.pack.items.find(item => item.id === award.itemId);
  return <div className="achievement-notice" role="region" aria-label="成就通知" aria-live="polite"><Award size={25} /><div><b>成就達成：{achievement.name}</b><p>{item && !award.converted ? `${item.name}已加入收藏。` : ''}{award.coins ? `獲得 ${award.coins} 金幣${award.converted ? '（含重複／滿額道具轉換）' : ''}。` : ''}</p></div><button aria-label="關閉成就通知" onClick={game.dismissAchievement}><X size={18} /></button></div>;
}
