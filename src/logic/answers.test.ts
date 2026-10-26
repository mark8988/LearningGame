import { describe, expect, it } from 'vitest';
import { questionSchema } from '../data/schemas';
import { loadBuiltinPack } from '../data/loader';
import { gradeAnswer } from './answers';
import { answerReview } from './learning';
import { newGame, type SaveRepository } from './save';
import { createGameStore } from '../stores/gameStore';
import { exportPack, importPack } from './transfers';

const question = questionSchema.parse({ id: 'blank', unitId: 'u1', type: 'fillBlank', stem: '水的化學式是 ___。', acceptedAnswers: ['H₂O', '水'], explanation: '水由氫與氧組成，化學式為 H₂O。', difficulty: 1 });
describe('填空題與國中題庫', () => {
  it('只接受明確答案與別名，正規化全形、大小寫及前後空白', () => {
    expect(gradeAnswer(question, '  ｈ２ｏ ')).toBe(true); expect(gradeAnswer(question, '水')).toBe(true);
    expect(gradeAnswer(question, '氧氣')).toBe(false); expect(gradeAnswer(question, 'H 2 O')).toBe(false);
    expect(gradeAnswer(question, '')).toBeNull(); expect(gradeAnswer(question, '   ')).toBeNull(); expect(gradeAnswer(question, 0)).toBeNull();
  });
  it('選擇題保留舊格式，不把文字誤當選項序號', () => { const q = loadBuiltinPack().questions[0]; expect(gradeAnswer(q, q.answerIndex)).toBe(true); expect(gradeAnswer(q, String(q.answerIndex))).toBeNull(); });
  it('拒絕沒有空格、沒有答案、或只有三個選項的題目', () => {
    expect(questionSchema.safeParse({ ...question, stem: '水的化學式是什麼？' }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, acceptedAnswers: [] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, type: 'choice', options: ['甲', '乙', '丙'] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...question, type: 'choice', options: ['甲', '乙', '丙', '丁'], answerIndex: undefined }).success).toBe(false);
  });
  it('七至九年級混合題庫可匯出匯入，保留填空答案', () => {
    for (const grade of [7, 8, 9]) { const pack = structuredClone(loadBuiltinPack()); pack.manifest.grade = grade; pack.questions[0] = { ...question, id: pack.questions[0].id, unitId: pack.questions[0].unitId }; expect(importPack(exportPack(pack)).questions[0].acceptedAnswers).toEqual(['H₂O', '水']); }
  });
  it('空白提交不扣血、不計次，答錯進錯題池，答對複習移除且只獎勵一次', () => {
    const pack = structuredClone(loadBuiltinPack()); pack.questions = pack.questions.map(q => ({ ...question, id: q.id, unitId: q.unitId }));
    const repository: SaveRepository = { load: () => ({ save: null }), save: () => {} };
    const game = createGameStore(pack, repository, () => 0.5); game.store.getState().startBattle(pack.units[0].id);
    const before = game.store.getState().battle!; game.store.getState().answer('  '); expect(game.store.getState().battle).toBe(before);
    game.store.getState().answer('氧氣'); game.store.getState().answer('水'); const player = game.store.getState().player;
    expect(player.stats.questionsAnswered).toBe(1); expect(game.store.getState().battle!.playerHp).toBeLessThan(before.playerHp);
    const q = before.questions[0]; expect(player.wrongQuestionIds).toContain(q.id); game.store.getState().navigate('map'); game.store.getState().startReview();
    game.store.getState().reviewAnswer('水'); game.store.getState().reviewAnswer('水'); expect(game.store.getState().player.wrongQuestionIds).not.toContain(q.id); expect(game.store.getState().player.coins).toBe(player.coins + 2); game.dispose();
  });
  it('不在錯題池的填空題無法重複領取複習獎勵', () => { expect(answerReview(newGame(loadBuiltinPack()), question, '水')).toBeNull(); });
});
