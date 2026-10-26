import type { ContentPack, Question } from '../data/schemas';
import type { PlayerSave } from './save';
import { gradeAnswer, type AnswerResponse } from './answers';
export function unlockedEntries(player: PlayerSave, pack: ContentPack) {
  const allowed = new Set(pack.units.filter(unit => player.clearedUnitIds.includes(unit.id)).flatMap(unit => unit.encyclopediaIds));
  return pack.encyclopedia.filter(entry => allowed.has(entry.id));
}
export function reviewQuestions(player: PlayerSave, pack: ContentPack) {
  const ids = new Set(player.wrongQuestionIds);
  return pack.questions.filter(question => ids.has(question.id));
}
export function answerReview(player: PlayerSave, question: Question, choice: AnswerResponse) {
  if (!player.wrongQuestionIds.includes(question.id)) return null;
  const correct = gradeAnswer(question, choice); if (correct === null) return null;
  return { correct, coins: correct ? 2 : 0, player: { ...player, coins: player.coins + (correct ? 2 : 0), wrongQuestionIds: correct ? player.wrongQuestionIds.filter(id => id !== question.id) : player.wrongQuestionIds, stats: { ...player.stats, questionsAnswered: player.stats.questionsAnswered + 1, correct: player.stats.correct + Number(correct) } } };
}
export function obtainHints(itemId: string, pack: ContentPack) {
  const item = pack.items.find(item => item.id === itemId); if (!item) return [];
  const hints: string[] = [];
  if (item.obtainFrom.includes('starter')) hints.push('新遊戲贈送');
  if (item.obtainFrom.includes('shop')) hints.push(`森林商店 · ${item.price} 金幣`);
  for (const unit of pack.units) { const table = pack.dropTables.find(table => table.id === unit.dropTableId); if (table && [...table.common, ...table.rare, ...table.epic].includes(item.id)) hints.push(`${unit.name} · 冒險寶箱`); }
  for (const achievement of pack.achievements.filter(achievement => achievement.rewardItemId === item.id)) hints.push(`成就「${achievement.name}」`);
  return hints;
}
