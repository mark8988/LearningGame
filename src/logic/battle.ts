import type { Question, Unit } from '../data/schemas';
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
export const maxHp = (level: number) => 100 + (level - 1) * 10;
export const counterDamage = (attack: number, level: number) => Math.max(5, attack - level);
export function hitDamage(level: number, random: () => number = Math.random) {
  const critical = random() < 0.1;
  const damage = Math.round((18 + (level - 1) * 2) * (0.85 + random() * 0.3) * (critical ? 1.5 : 1));
  return { damage, critical };
}
function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function selectQuestions(pool: Question[], wrongIds: string[], random: () => number = Math.random): Question[] {
  const unique = [...new Map(pool.map(q => [q.id, q])).values()];
  const priority = shuffle(unique.filter(q => wrongIds.includes(q.id)), random).slice(0, 3);
  const rest = shuffle(unique.filter(q => !priority.some(p => p.id === q.id) && !wrongIds.includes(q.id)), random);
  const overflow = shuffle(unique.filter(q => wrongIds.includes(q.id) && !priority.some(p => p.id === q.id)), random);
  // 優先放入最多三題錯題；一般題不足時再補入其他錯題，維持十題不重複。
  return shuffle([...priority, ...rest, ...overflow].slice(0, 10), random);
}
export function victoryCoins(correct: number, total: number, firstClear: boolean) {
  return 50 + correct * 5 + (correct === total ? 30 : 0) + (firstClear ? 100 : 0);
}
export const isUnlocked = (unit: Unit, cleared: string[]) => !unit.unlockAfter || cleared.includes(unit.unlockAfter);
export const starCount = (correct: number, total: number) => correct === total ? 3 : correct / total >= 0.8 ? 2 : 1;
