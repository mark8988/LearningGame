import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Question } from '../data/schemas';
import type { AnswerResponse } from '../logic/answers';

export function QuestionAnswers({ question, feedback, onAnswer }: { question: Question; feedback: { choice: AnswerResponse; correct: boolean } | null; onAnswer(value: AnswerResponse): void }) {
  const [value, setValue] = useState('');
  if (question.type === 'fillBlank') return <form className="blank-answer" onSubmit={event => { event.preventDefault(); if (!feedback && value.trim()) onAnswer(value); }}>
    <label>填空答案<input aria-label="填空答案" autoComplete="off" maxLength={120} value={value} disabled={!!feedback} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} onChange={event => setValue(event.target.value)} /></label>
    <button className="primary" type="submit" disabled={!!feedback || !value.trim()}>提交答案</button>
    {feedback && <p role="status">你的答案：{feedback.choice}；參考答案：<b>{question.acceptedAnswers?.[0]}</b></p>}
  </form>;
  return <div className="answers">{question.options.map((answer, index) => <button key={index} disabled={!!feedback} className={feedback ? index === question.answerIndex ? 'correct' : index === feedback.choice ? 'incorrect' : '' : ''} onClick={() => onAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{answer}{feedback && index === question.answerIndex && <Check size={18} />}</button>)}</div>;
}
