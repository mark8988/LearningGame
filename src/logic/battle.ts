import type { Question, Unit } from '../data/schemas';
export const CHALLENGE_QUESTION_LIMIT = 10;
export const WRONG_QUESTION_RATIO = 0.3;
export const challengeBossHp = (hp: number, count: number, level = 1) => count >= CHALLENGE_QUESTION_LIMIT ? hp : Math.max(1, Math.min(Math.round(hp * count / CHALLENGE_QUESTION_LIMIT), count * Math.round((18 + (level - 1) * 2) * 0.85)));
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
  const size = Math.min(CHALLENGE_QUESTION_LIMIT, unique.length); const wrong = new Set(wrongIds);
  const quota = Math.max(1, Math.floor(size * WRONG_QUESTION_RATIO));
  const priority = shuffle(unique.filter(q => wrong.has(q.id)), random).slice(0, quota);
  const selected = new Set(priority.map(q => q.id));
  const rest = shuffle(unique.filter(q => !wrong.has(q.id)), random);
  const overflow = shuffle(unique.filter(q => wrong.has(q.id) && !selected.has(q.id)), random);
  // 題庫與單次挑戰分開；普通題不足時才補其他錯題，全程不重複。
  return shuffle([...priority, ...rest, ...overflow].slice(0, size), random);
}
export function victoryCoins(correct: number, total: number, firstClear: boolean) {
  return 50 + correct * 5 + (correct === total ? 30 : 0) + (firstClear ? 100 : 0);
}
export const isUnlocked = (unit: Unit, cleared: string[]) => !unit.unlockAfter || cleared.includes(unit.unlockAfter);
export const starCount = (correct: number, total: number) => correct === total ? 3 : correct / total >= 0.8 ? 2 : 1;
