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
  it('未通過家長驗證不可進入或還原，離開後上鎖', () => { const game = setup(); const save = newGame(pack); game.store.getState().navigate('parent'); expect(game.store.getState().screen).toBe('home'); expect(() => game.store.getState().replaceProgress(save)).toThrow('家長驗證'); game.store.getState().authorizeParent(); expect(game.store.getState().screen).toBe('parent'); game.store.getState().navigate('home'); expect(game.store.getState().parentUnlocked).toBe(false); game.dispose(); });
  it('還原先驗證再保存並清除舊戰鬥，未完成的 debounce 不會蓋回舊進度', () => { vi.useFakeTimers(); const game = setup(); game.store.getState().startBattle(pack.units[0].id); const q = game.store.getState().battle!.questions[0]; game.store.getState().answer(q.answerIndex); const save = newGame(pack); save.coins = 123; game.store.getState().authorizeParent(); game.store.getState().replaceProgress(save); expect(game.store.getState().battle).toBeNull(); vi.advanceTimersByTime(1000); expect(game.saved()?.coins).toBe(123); expect(game.store.getState().player.xp).toBe(0); game.dispose(); });
  it('還原儲存失敗保留記憶體進度，不發布成功訊息', () => { const game = setup(); game.store.getState().authorizeParent(); const before = game.store.getState().player; vi.mocked(game.repository.save).mockImplementationOnce(() => { throw new Error('QuotaExceeded'); }); const save = newGame(pack); save.coins = 900; expect(() => game.store.getState().replaceProgress(save)).toThrow('QuotaExceeded'); expect(game.store.getState().player).toBe(before); game.dispose(); });
  it('不能進入未解鎖關卡', () => { const game = setup(); game.store.getState().startBattle(pack.units[1].id); expect(game.store.getState().battle).toBeNull(); game.dispose(); });
  it('答錯顯示解析資料、紀錄錯題，重複點擊不重複計算', () => {
    const game = setup(); game.store.getState().startBattle(pack.units[0].id); const battle = game.store.getState().battle!; const q = battle.questions[0];
    game.store.getState().answer((q.answerIndex + 1) % 4); game.store.getState().answer(q.answerIndex);
    expect(game.store.getState().player.wrongQuestionIds).toContain(q.id); expect(game.store.getState().player.stats.questionsAnswered).toBe(1); expect(game.store.getState().battle!.playerHp).toBe(79); expect(game.store.getState().battle!.feedback?.correct).toBe(false); game.dispose();
  });
  it('通關結算只發一次，解鎖下一關並持久保存', () => {
    const game = setup(); game.store.getState().startBattle(pack.units[0].id);
    while (game.store.getState().battle) { const b = game.store.getState().battle!; game.store.getState().answer(b.questions[b.index].answerIndex); game.store.getState().nextTurn(); }
    const state = game.store.getState(); expect(state.result?.won).toBe(true); expect(state.result?.coins).toBe(225); expect(state.player.coins).toBe(235); expect(state.player.unlockedAchievementIds).toContain('first-adventure'); expect(state.player.xp).toBe(140); expect(state.player.unitStars[pack.units[0].id]).toBe(3); expect(state.player.clearedUnitIds).toContain(pack.units[0].id);
    state.nextTurn(); expect(game.store.getState().player.coins).toBe(235); game.flush(); expect(game.saved()?.coins).toBe(235); game.dispose();
  });
  it('失敗不扣已有獎勵，下次戰鬥恢復生命', () => {
    const initial = newGame(pack); initial.coins = 200; const game = setup(initial); game.store.getState().startBattle(pack.units[0].id);
    while (game.store.getState().battle) { const b = game.store.getState().battle!; game.store.getState().answer((b.questions[b.index].answerIndex + 1) % 4); game.store.getState().nextTurn(); }
    expect(game.store.getState().result?.won).toBe(false); expect(game.store.getState().player.coins).toBe(200); expect(game.store.getState().player.clearedUnitIds).toHaveLength(0);
    game.store.getState().startBattle(pack.units[0].id); expect(game.store.getState().battle!.playerHp).toBe(100); game.dispose();
  });
  it('存檔使用 500ms debounce', () => { vi.useFakeTimers(); const game = setup(); const mock = vi.mocked(game.repository.save); mock.mockClear(); game.store.getState().startBattle(pack.units[0].id); const b = game.store.getState().battle!; game.store.getState().answer(b.questions[0].answerIndex); vi.advanceTimersByTime(499); expect(mock).not.toHaveBeenCalled(); vi.advanceTimersByTime(1); expect(mock).toHaveBeenCalledTimes(1); game.dispose(); });
  it('未知版本存檔不得被自動覆寫', () => { const save = vi.fn(); const game = createGameStore(pack, { load: () => ({ save: null, warning: '原始存檔已保留' }), save }); game.store.getState().startBattle(pack.units[0].id); game.store.getState().answer(0); game.flush(); expect(save).not.toHaveBeenCalled(); game.dispose(); });
  it('購買入庫並存檔，不能從戰鬥狀態購買', () => {
    const initial = newGame(pack); initial.coins = 150; const game = setup(initial);
    game.store.getState().buy('explorer-hat'); expect(game.store.getState().player.coins).toBe(150);
    game.store.getState().navigate('shop'); game.store.getState().buy('explorer-hat'); game.store.getState().buy('explorer-hat');
    expect(game.store.getState().player.inventory['explorer-hat']).toBe(1); expect(game.store.getState().player.coins).toBe(90); expect(game.store.getState().notice).toContain('已經擁有');
    game.flush(); expect(game.saved()?.inventory['explorer-hat']).toBe(1); game.dispose();
  });
  it('藥水不消耗回合，滿血、答題解析中或戰鬥結束時不能使用', () => {
    const initial = newGame(pack); initial.potions = 2; const game = setup(initial); game.store.getState().startBattle(pack.units[0].id);
    game.store.getState().usePotion(); expect(game.store.getState().player.potions).toBe(2);
    let b = game.store.getState().battle!; game.store.getState().answer((b.questions[0].answerIndex + 1) % 4); game.store.getState().usePotion(); expect(game.store.getState().player.potions).toBe(2);
    game.store.getState().nextTurn(); const index = game.store.getState().battle!.index; game.store.getState().usePotion();
    b = game.store.getState().battle!; expect(b.playerHp).toBe(100); expect(b.index).toBe(index); expect(game.store.getState().player.potions).toBe(1);
    game.store.getState().navigate('home'); game.store.getState().usePotion(); expect(game.store.getState().player.potions).toBe(1); game.dispose();
  });
  it('通關立即入庫，離開結算不丟獎勵且不得重複領取', () => {
    const game = setup(); game.store.getState().startBattle(pack.units[0].id);
    while (game.store.getState().battle) { const b = game.store.getState().battle!; game.store.getState().answer(b.questions[b.index].answerIndex); game.store.getState().nextTurn(); }
    const result = game.store.getState().result!; expect(result.drops).toHaveLength(1); const id = result.drops[0].itemId;
    const expectedQuantity = (newGame(pack).inventory[id] ?? 0) + 1;
    expect(game.store.getState().player.inventory[id]).toBe(expectedQuantity); game.store.getState().nextTurn(); expect(game.store.getState().player.inventory[id]).toBe(expectedQuantity);
    game.store.getState().navigate('home'); game.flush(); expect(game.saved()?.inventory[id]).toBe(expectedQuantity); game.dispose();
  });
  it('只在佈置模式修改位置，擺放／移動／收回不消耗庫存或金幣', () => {
    const game = setup(); const position = { itemId: 'desk', x: 2, y: 2, rotation: 0 as const };
    expect(game.store.getState().place(position)).toBe(false);
    game.store.getState().navigate('decor'); expect(game.store.getState().place(position)).toBe(true);
    expect(game.store.getState().place({ ...position, x: 4 }, 0)).toBe(true);
    game.flush(); expect(game.saved()?.roomLayout).toEqual([{ ...position, x: 4 }]);
    game.store.getState().removeFurniture(0); expect(game.store.getState().player.roomLayout).toHaveLength(0);
    expect(game.store.getState().player.inventory.desk).toBe(1); expect(game.store.getState().player.coins).toBe(0); game.dispose();
  });
  it('拒絕擺放不寫入存檔，不合法收回不影響其他家具', () => {
    const game = setup(); game.store.getState().navigate('decor');
    expect(game.store.getState().place({ itemId: 'desk', x: 11, y: 7, rotation: 0 })).toBe(false);
    expect(game.store.getState().notice).toContain('邊界'); expect(game.store.getState().player.roomLayout).toHaveLength(0);
    game.store.getState().removeFurniture(-1); expect(game.store.getState().player.roomLayout).toHaveLength(0); game.dispose();
  });
  it('衣櫃換裝自動保存，戰鬥中不得換裝或改變戰鬥數值', () => {
    const initial = newGame(pack); initial.inventory['explorer-hat'] = 1; initial.ownedItemIds.push('explorer-hat'); const game = setup(initial);
    game.store.getState().navigate('wardrobe'); game.store.getState().equip('hat', 'explorer-hat'); game.flush(); expect(game.saved()?.equippedOutfit.hat).toBe('explorer-hat');
    game.store.getState().startBattle(pack.units[0].id); const hp = game.store.getState().battle!.playerHp; game.store.getState().equip('hat', null);
    expect(game.store.getState().player.equippedOutfit.hat).toBe('explorer-hat'); expect(game.store.getState().battle!.playerHp).toBe(hp); expect(hp).toBe(100); game.dispose();
  });
  it('無效舊裝扮還原預設並提示，金幣與佈置保留', () => {
    const initial = newGame(pack); initial.coins = 350; initial.equippedOutfit.hat = 'missing'; initial.roomLayout = [{ itemId: 'desk', x: 2, y: 2, rotation: 0 }]; const game = setup(initial);
    expect(game.store.getState().player.equippedOutfit).toEqual({}); expect(game.store.getState().warning).toContain('預設外觀'); expect(game.store.getState().player.coins).toBe(350); expect(game.store.getState().player.roomLayout).toEqual(initial.roomLayout); game.dispose();
  });
  it('知識閱讀受通關限制，已讀紀錄不重複且能保存', () => {
    const initial = newGame(pack); initial.clearedUnitIds = [pack.units[0].id]; const game = setup(initial); game.store.getState().navigate('dex');
    game.store.getState().readEntry(pack.units[1].encyclopediaIds[0]); expect(game.store.getState().player.readEncyclopediaIds).toEqual([]);
    const id = pack.units[0].encyclopediaIds[0]; game.store.getState().readEntry(id); game.store.getState().readEntry(id); game.flush(); expect(game.saved()?.readEncyclopediaIds).toEqual([id]); game.dispose();
  });
  it('複習防連點、答對移除後不能重刷，100 題成就同時入庫並保存', () => {
    const initial = newGame(pack); initial.stats = { ...initial.stats, correct: 99, questionsAnswered: 99 }; initial.wrongQuestionIds = [pack.questions[0].id]; initial.xp = 345; const game = setup(initial);
    game.store.getState().startReview(); game.store.getState().reviewAnswer(pack.questions[0].answerIndex); game.store.getState().reviewAnswer(pack.questions[0].answerIndex);
    expect(game.store.getState().player.coins).toBe(2); expect(game.store.getState().player.xp).toBe(345); expect(game.store.getState().player.inventory['knowledge-trophy']).toBe(1); expect(game.store.getState().player.stats.correct).toBe(100);
    game.store.getState().nextReview(); expect(game.store.getState().review?.done).toBe(true); game.store.getState().startReview(); expect(game.store.getState().review?.questions).toEqual([]); game.flush();
    const restored = setup(game.saved()); expect(restored.store.getState().achievementQueue).toEqual([]); expect(restored.store.getState().player.inventory['knowledge-trophy']).toBe(1); restored.dispose(); game.dispose();
  });
  it('舊存檔補發已達成成就，刷新後不重複給金幣或獎品', () => {
    const initial = newGame(pack); initial.stats.correct = 100; initial.stats.questionsAnswered = 100; initial.stats.battlesWon = 1; initial.coins = 25; initial.updatedAt = '2000-01-01T00:00:00.000Z'; const game = setup(initial);
    expect(game.store.getState().player.coins).toBe(35); expect(game.store.getState().player.inventory['knowledge-trophy']).toBe(1); expect(game.saved()?.unlockedAchievementIds).toContain('curious-100'); expect(game.saved()?.updatedAt).not.toBe(initial.updatedAt);
    const restored = setup(game.saved()); expect(restored.store.getState().player.coins).toBe(35); expect(restored.store.getState().achievementQueue).toEqual([]); restored.dispose(); game.dispose();
  });
});
