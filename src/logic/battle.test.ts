import { describe, expect, it } from 'vitest';
import { challengeBossHp, counterDamage, hitDamage, isUnlocked, levelFromXp, maxHp, selectQuestions, starCount, victoryCoins } from './battle';
import { loadBuiltinPack } from '../data/loader';
const pack = loadBuiltinPack();
describe('戰鬥公式與抽題', () => {
  it.each([[0, 1], [99, 1], [100, 2], [399, 2], [400, 3], [900, 4], [-1, 1]])('xp %i 對應等級 %i', (xp, level) => expect(levelFromXp(xp)).toBe(level));
  it('只有冒險等級決定生命與基本傷害', () => { expect(maxHp(1)).toBe(100); expect(maxHp(4)).toBe(130); expect(hitDamage(1, () => 0.5)).toEqual({ damage: 18, critical: false }); expect(hitDamage(4, () => 0.5).damage).toBe(24); });
  it('±15% 傷害與 10% 爆擊邊界', () => {
    let values = [0.1, 0]; expect(hitDamage(1, () => values.shift()!)).toEqual({ damage: 15, critical: false });
    values = [0.1, 1]; expect(hitDamage(1, () => values.shift()!).damage).toBe(21);
    values = [0.099, 0.5]; expect(hitDamage(1, () => values.shift()!)).toEqual({ damage: 27, critical: true });
  });
  it('反擊最低為五', () => { expect(counterDamage(22, 1)).toBe(21); expect(counterDamage(10, 100)).toBe(5); });
  it('抽十題不重複且不更動原題池', () => { const pool = pack.questions.slice(0, 12); const ids = pool.map(q => q.id); const picked = selectQuestions([...pool, pool[0]], [], () => 0.5); expect(picked).toHaveLength(10); expect(new Set(picked.map(q => q.id)).size).toBe(10); expect(pool.map(q => q.id)).toEqual(ids); });
  it('一般題足夠時，優先混入最多三道錯題', () => { const pool = pack.questions.slice(0, 20); const wrong = pool.slice(0, 8).map(q => q.id); const picked = selectQuestions(pool, wrong, () => 0.4); expect(picked.filter(q => wrong.includes(q.id))).toHaveLength(3); });
  it('全部題目都在錯題池時仍能抽十題', () => { const pool = pack.questions.slice(0, 12); const picked = selectQuestions(pool, pool.map(q => q.id)); expect(picked).toHaveLength(10); expect(new Set(picked.map(q => q.id)).size).toBe(10); });
  it('題庫可大於單次挑戰，反覆挑戰的題目與順序會隨機改變', () => {
    let seed = 17; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pool = Array.from({ length: 100 }, (_, n) => ({ ...pack.questions[0], id: `q${n}` })); const wrong = pool.slice(0, 20).map(q => q.id);
    const rounds = Array.from({ length: 12 }, () => selectQuestions(pool, [...wrong, 'other-unit'], random));
    for (const round of rounds) { expect(round).toHaveLength(10); expect(new Set(round.map(q => q.id)).size).toBe(10); expect(round.filter(q => wrong.includes(q.id))).toHaveLength(3); }
    expect(new Set(rounds.map(round => round.map(q => q.id).join(','))).size).toBe(12); expect(new Set(rounds.flatMap(round => round.map(q => q.id))).size).toBeGreaterThan(10);
  });
  it('短題庫只抽實際題數，普通題不足才補錯題，忽略跨單元錯題', () => {
    const pool = pack.questions.slice(0, 4); const wrong = [pool[0].id, pool[1].id, 'other-unit']; const round = selectQuestions(pool, wrong);
    expect(round).toHaveLength(4); expect(new Set(round.map(q => q.id)).size).toBe(4); expect(round.every(q => pool.some(p => p.id === q.id))).toBe(true); expect(selectQuestions([], wrong)).toEqual([]);
  });
  it('短挑戰全對可打完，十題挑戰保留原Boss數值', () => { expect(challengeBossHp(1000, 2)).toBe(30); expect(challengeBossHp(1000, 2, 3)).toBe(38); expect(challengeBossHp(1000, 10)).toBe(1000); });
  it('首通、全對金幣與星等', () => { expect(victoryCoins(10, 10, true)).toBe(230); expect(victoryCoins(10, 10, false)).toBe(130); expect(victoryCoins(8, 10, false)).toBe(90); expect(starCount(10, 10)).toBe(3); expect(starCount(8, 10)).toBe(2); expect(starCount(7, 10)).toBe(1); });
  it('線性關卡解鎖', () => { expect(isUnlocked(pack.units[0], [])).toBe(true); expect(isUnlocked(pack.units[1], [])).toBe(false); expect(isUnlocked(pack.units[1], [pack.units[0].id])).toBe(true); });
});
