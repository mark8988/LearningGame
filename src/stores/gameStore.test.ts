import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBuiltinPack } from '../data/loader';
import { newGame, type PlayerSave, type SaveRepository } from '../logic/save';
import { createGameStore } from './gameStore';
const pack = loadBuiltinPack();
function setup(initial: PlayerSave | null = null) {
  let saved = initial;
  const repository: SaveRepository = { load: () => ({ save: saved }), save: vi.fn(value => { saved = structuredClone(value); }) };
  const game = createGameStore(pack, repository, () => 0.5);
  return { ...game, repository, saved: () => saved };
}
afterEach(() => vi.useRealTimers());
describe('冒險狀態與結算', () => {
  it('不能進入未解鎖關卡', () => { const game = setup(); game.store.getState().startBattle(pack.units[1].id); expect(game.store.getState().battle).toBeNull(); game.dispose(); });
  it('答錯顯示解析資料、紀錄錯題，重複點擊不重複計算', () => {
    const game = setup(); game.store.getState().startBattle(pack.units[0].id); const battle = game.store.getState().battle!; const q = battle.questions[0];
    game.store.getState().answer((q.answerIndex + 1) % 4); game.store.getState().answer(q.answerIndex);
    expect(game.store.getState().player.wrongQuestionIds).toContain(q.id); expect(game.store.getState().player.stats.questionsAnswered).toBe(1); expect(game.store.getState().battle!.playerHp).toBe(79); expect(game.store.getState().battle!.feedback?.correct).toBe(false); game.dispose();
  });
  it('通關結算只發一次，解鎖下一關並持久保存', () => {
    const game = setup(); game.store.getState().startBattle(pack.units[0].id);
    while (game.store.getState().battle) { const b = game.store.getState().battle!; game.store.getState().answer(b.questions[b.index].answerIndex); game.store.getState().nextTurn(); }
    const state = game.store.getState(); expect(state.result?.won).toBe(true); expect(state.player.coins).toBe(225); expect(state.player.xp).toBe(140); expect(state.player.unitStars[pack.units[0].id]).toBe(3); expect(state.player.clearedUnitIds).toContain(pack.units[0].id);
    state.nextTurn(); expect(game.store.getState().player.coins).toBe(225); game.flush(); expect(game.saved()?.coins).toBe(225); game.dispose();
  });
  it('失敗不扣已有獎勵，下次戰鬥恢復生命', () => {
    const initial = newGame(pack); initial.coins = 200; const game = setup(initial); game.store.getState().startBattle(pack.units[0].id);
    while (game.store.getState().battle) { const b = game.store.getState().battle!; game.store.getState().answer((b.questions[b.index].answerIndex + 1) % 4); game.store.getState().nextTurn(); }
    expect(game.store.getState().result?.won).toBe(false); expect(game.store.getState().player.coins).toBe(200); expect(game.store.getState().player.clearedUnitIds).toHaveLength(0);
    game.store.getState().startBattle(pack.units[0].id); expect(game.store.getState().battle!.playerHp).toBe(100); game.dispose();
  });
  it('存檔使用 500ms debounce', () => { vi.useFakeTimers(); const game = setup(); const mock = vi.mocked(game.repository.save); mock.mockClear(); game.store.getState().startBattle(pack.units[0].id); const b = game.store.getState().battle!; game.store.getState().answer(b.questions[0].answerIndex); vi.advanceTimersByTime(499); expect(mock).not.toHaveBeenCalled(); vi.advanceTimersByTime(1); expect(mock).toHaveBeenCalledTimes(1); game.dispose(); });
  it('未知版本存檔不得被自動覆寫', () => { const save = vi.fn(); const game = createGameStore(pack, { load: () => ({ save: null, warning: '原始存檔已保留' }), save }); game.store.getState().startBattle(pack.units[0].id); game.store.getState().answer(0); game.flush(); expect(save).not.toHaveBeenCalled(); game.dispose(); });
});
