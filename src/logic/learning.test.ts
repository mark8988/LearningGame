import { describe, expect, it } from 'vitest';
import { loadBuiltinPack } from '../data/loader';
import { newGame } from './save';
import { answerReview, obtainHints, reviewQuestions, unlockedEntries } from './learning';
import { achievementProgress, unlockAchievements } from './achievements';
const pack = loadBuiltinPack();
describe('知識圖鑑與錯題複習', () => {
  it('通關才解鎖該單元三條知識', () => { const player = newGame(pack); expect(unlockedEntries(player, pack)).toHaveLength(0); player.clearedUnitIds = [pack.units[0].id]; expect(unlockedEntries(player, pack).map(entry => entry.id)).toEqual(pack.units[0].encyclopediaIds); });
  it('題庫完整：五單元各十二題及三條插圖知識，答案分布與難度配比有效', () => {
    for (const unit of pack.units) { const pool = pack.questions.filter(q => unit.questionPool.includes(q.id)); expect(pool).toHaveLength(12); expect(pack.encyclopedia.filter(entry => entry.unitId === unit.id)).toHaveLength(3); expect([1, 2, 3].map(d => pool.filter(q => q.difficulty === d).length)).toEqual([4, 6, 2]); for (let answer = 0; answer < 4; answer++) expect(pool.filter(q => q.answerIndex === answer)).toHaveLength(3); }
  });
  it('錯題來源去重並略過題庫不存在的紀錄', () => { const player = newGame(pack); player.wrongQuestionIds = [pack.questions[0].id, pack.questions[0].id, 'missing']; expect(reviewQuestions(player, pack)).toEqual([pack.questions[0]]); });
  it('答對僅加二金幣、移除錯題，經驗不變且不能再刷同一道', () => {
    const player = newGame(pack); const q = pack.questions[0]; player.xp = 345; player.wrongQuestionIds = [q.id]; const result = answerReview(player, q, q.answerIndex)!;
    expect(result.correct).toBe(true); expect(result.player.coins).toBe(2); expect(result.player.xp).toBe(345); expect(result.player.wrongQuestionIds).toEqual([]); expect(result.player.stats.correct).toBe(1); expect(answerReview(result.player, q, q.answerIndex)).toBeNull(); expect(player.wrongQuestionIds).toEqual([q.id]);
  });
  it('答錯保留待複習，不扣金幣或獎勵，也拒絕非法選項', () => { const player = newGame(pack); const q = pack.questions[0]; player.coins = 50; player.wrongQuestionIds = [q.id]; const result = answerReview(player, q, (q.answerIndex + 1) % 4)!; expect(result.player.wrongQuestionIds).toEqual([q.id]); expect(result.player.coins).toBe(50); expect(result.player.stats.questionsAnswered).toBe(1); expect(answerReview(player, q, -1)).toBeNull(); });
  it('道具線索來自實際商店、關卡、成就定義', () => { expect(obtainHints('knowledge-trophy', pack)).toEqual(['成就「答對 100 題」']); expect(obtainHints('rainbow-window', pack)).toEqual(['天氣觀測 · 冒險寶箱']); expect(obtainHints('desk', pack)).toContain('森林商店 · 50 金幣'); });
});
describe('成就只發獎一次', () => {
  it('99 題不發、100 題發獎盃，重複檢查不再入庫', () => {
    const player = newGame(pack); player.stats.correct = 99; expect(unlockAchievements(player, pack).awards).toEqual([]); player.stats.correct = 100; const result = unlockAchievements(player, pack);
    expect(result.player.inventory['knowledge-trophy']).toBe(1); expect(result.player.unlockedAchievementIds).toContain('curious-100'); expect(result.awards).toHaveLength(1); expect(unlockAchievements(result.player, pack).awards).toHaveLength(0); expect(player.inventory['knowledge-trophy']).toBeUndefined();
  });
  it('佈置十件家具給限定旗；金幣成就與獎品同一次結算', () => { const player = newGame(pack); player.roomLayout = Array.from({ length: 10 }, (_, x) => ({ itemId: 'chair', x, y: 0, rotation: 0 })); player.stats.battlesWon = 5; const result = unlockAchievements(player, pack); expect(result.player.inventory['decor-banner']).toBe(1); expect(result.player.coins).toBe(110); expect(result.awards.map(a => a.id)).toEqual(['first-adventure', 'cozy-ten', 'forest-five']); });
  it('獎勵增加收藏數時可連鎖解鎖，仍保證終止且不重複', () => {
    const player = newGame(pack); const custom = { ...pack, achievements: [{ id: 'a', name: 'A', metric: 'correct' as const, target: 1, rewardItemId: 'knowledge-trophy' }, { id: 'b', name: 'B', metric: 'collection' as const, target: 5, coins: 20 }] }; player.stats.correct = 1;
    const result = unlockAchievements(player, custom); expect(result.awards.map(a => a.id)).toEqual(['a', 'b']); expect(result.player.coins).toBe(20); expect(unlockAchievements(result.player, custom).awards).toEqual([]);
  });
  it('家具獎品滿九件時轉為金幣，收藏計數不計重複或未知道具', () => { const player = newGame(pack); player.stats.correct = 100; player.inventory['knowledge-trophy'] = 9; player.ownedItemIds.push('knowledge-trophy', 'unknown'); player.inventory.unknown = 99; const result = unlockAchievements(player, pack); expect(result.player.inventory['knowledge-trophy']).toBe(9); expect(result.player.coins).toBe(30); expect(result.awards[0].converted).toBe(true); expect(achievementProgress(player, pack, 'collection')).toBe(5); });
});
