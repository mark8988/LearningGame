import type { Question } from '../data/schemas';

export type AnswerResponse = number | string;
export function normalizeAnswer(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}
/** null means no valid submission; explicit aliases are the only accepted alternatives. */
export function gradeAnswer(question: Question, response: AnswerResponse): boolean | null {
  if (question.type === 'fillBlank') {
    if (typeof response !== 'string' || !normalizeAnswer(response) || response.length > 120) return null;
    return (question.acceptedAnswers ?? []).some(answer => normalizeAnswer(answer) === normalizeAnswer(response));
  }
  if (typeof response !== 'number' || !Number.isInteger(response) || response < 0 || response > 3) return null;
  return response === question.answerIndex;
}
