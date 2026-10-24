import { describe, expect, it } from 'vitest';
import { counterDamage, hitDamage, isUnlocked, levelFromXp, maxHp, selectQuestions, starCount, victoryCoins } from './battle';
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
  it('首通、全對金幣與星等', () => { expect(victoryCoins(10, 10, true)).toBe(230); expect(victoryCoins(10, 10, false)).toBe(130); expect(victoryCoins(8, 10, false)).toBe(90); expect(starCount(10, 10)).toBe(3); expect(starCount(8, 10)).toBe(2); expect(starCount(7, 10)).toBe(1); });
  it('線性關卡解鎖', () => { expect(isUnlocked(pack.units[0], [])).toBe(true); expect(isUnlocked(pack.units[1], [])).toBe(false); expect(isUnlocked(pack.units[1], [pack.units[0].id])).toBe(true); });
});
