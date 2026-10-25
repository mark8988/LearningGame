import type { Question } from '../data/schemas';
import { usePreferences } from '../stores/preferences';
export function QuestionStem({ question }: { question: Question }) {
  const enabled = usePreferences(state => state.zhuyin);
  const syllables = question.zhuyin?.trim().split(/\s+/); let index = 0;
  if (!enabled || !syllables) return <>{question.stem}</>;
  return <>{Array.from(question.stem).map((char, key) => /\p{Script=Han}/u.test(char) ? <ruby key={key}>{char}<rp>（</rp><rt>{syllables[index++]}</rt><rp>）</rp></ruby> : char)}</>;
}
