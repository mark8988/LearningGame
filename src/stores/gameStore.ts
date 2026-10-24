import { create } from 'zustand';
import { loadBuiltinPack } from '../data/loader';
import type { ContentPack, Question, Unit } from '../data/schemas';
import { counterDamage, hitDamage, isUnlocked, levelFromXp, maxHp, selectQuestions, starCount, victoryCoins } from '../logic/battle';
import { LocalSaveRepository, newGame, type PlayerSave, type SaveRepository } from '../logic/save';

export type Screen = 'home' | 'map' | 'battle' | 'result';
export interface Battle { unit: Unit; questions: Question[]; index: number; playerHp: number; playerMaxHp: number; bossHp: number; level: number; correct: number; feedback: { choice: number; correct: boolean; damage: number; critical: boolean } | null; outcome: 'won' | 'lost' | null }
export interface BattleResult { won: boolean; coins: number; xp: number; correct: number; answered: number; stars: number; firstClear: boolean; unitName: string }
interface GameState { pack: ContentPack; player: PlayerSave; screen: Screen; battle: Battle | null; result: BattleResult | null; warning: string | null; saveStatus: 'saved' | 'pending' | 'error'; navigate(screen: 'home' | 'map'): void; startBattle(unitId: string): void; answer(choice: number): void; nextTurn(): void; dismissWarning(): void }

export function createGameStore(pack: ContentPack, repository: SaveRepository, random: () => number = Math.random) {
  const loaded = repository.load();
  const wrongPack = loaded.save && loaded.save.contentPackId !== pack.manifest.id;
  const initial = !wrongPack && loaded.save ? loaded.save : newGame(pack);
  let writesEnabled = !wrongPack && !loaded.warning?.includes('原始存檔');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const store = create<GameState>((set, get) => ({
    pack, player: initial, screen: 'home', battle: null, result: null, warning: wrongPack ? '存檔屬於其他內容包，原始存檔已保留。' : loaded.warning ?? null, saveStatus: writesEnabled ? 'saved' : 'error',
    navigate: screen => set({ screen, battle: null, result: null }),
    dismissWarning: () => set({ warning: null }),
    startBattle: unitId => {
      const player = get().player;
      const unit = pack.units.find(u => u.id === unitId);
      if (!unit || !isUnlocked(unit, player.clearedUnitIds)) return;
      const level = levelFromXp(player.xp);
      set({ screen: 'battle', result: null, battle: { unit, questions: selectQuestions(pack.questions.filter(q => unit.questionPool.includes(q.id)), player.wrongQuestionIds, random), index: 0, playerHp: maxHp(level), playerMaxHp: maxHp(level), bossHp: unit.boss.hp, level, correct: 0, feedback: null, outcome: null } });
    },
    answer: choice => {
      const { battle, player } = get();
      if (!battle || battle.feedback || battle.outcome || !Number.isInteger(choice) || choice < 0 || choice > 3) return;
      const question = battle.questions[battle.index];
      const correct = question.answerIndex === choice;
      const hit = correct ? hitDamage(battle.level, random) : { damage: counterDamage(battle.unit.boss.attack, battle.level), critical: false };
      const bossHp = correct ? Math.max(0, battle.bossHp - hit.damage) : battle.bossHp;
      const playerHp = correct ? battle.playerHp : Math.max(0, battle.playerHp - hit.damage);
      const outcome = bossHp === 0 ? 'won' : playerHp === 0 || battle.index + 1 === battle.questions.length ? 'lost' : null;
      set({ battle: { ...battle, bossHp, playerHp, correct: battle.correct + Number(correct), feedback: { choice, correct, ...hit }, outcome }, player: { ...player, xp: player.xp + (correct ? 10 : 0), wrongQuestionIds: correct ? player.wrongQuestionIds : [...new Set([...player.wrongQuestionIds, question.id])], stats: { ...player.stats, questionsAnswered: player.stats.questionsAnswered + 1, correct: player.stats.correct + Number(correct) }, updatedAt: new Date().toISOString() } });
    },
    nextTurn: () => {
      const { battle, player } = get();
      if (!battle?.feedback) return;
      if (!battle.outcome) { set({ battle: { ...battle, index: battle.index + 1, feedback: null } }); return; }
      const won = battle.outcome === 'won';
      const firstClear = !player.clearedUnitIds.includes(battle.unit.id);
      const answered = battle.index + 1;
      const coins = won ? victoryCoins(battle.correct, answered, firstClear) : 0;
      const stars = won ? starCount(battle.correct, answered) : 0;
      set({ screen: 'result', battle: null, result: { won, coins, xp: battle.correct * 10 + (won ? 50 : 0), correct: battle.correct, answered, stars, firstClear: won && firstClear, unitName: battle.unit.name }, player: { ...player, coins: player.coins + coins, xp: player.xp + (won ? 50 : 0), clearedUnitIds: won ? [...new Set([...player.clearedUnitIds, battle.unit.id])] : player.clearedUnitIds, unitStars: won ? { ...player.unitStars, [battle.unit.id]: Math.max(player.unitStars[battle.unit.id] ?? 0, stars) } : player.unitStars, stats: { ...player.stats, battlesWon: player.stats.battlesWon + Number(won) }, updatedAt: new Date().toISOString() } });
    },
  }));
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!writesEnabled) return;
    try { repository.save(store.getState().player); store.setState({ saveStatus: 'saved' }); }
    catch { store.setState({ warning: '本機存檔失敗，請勿關閉頁面，並確認瀏覽器允許儲存資料。', saveStatus: 'error' }); }
  };
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.player === previous.player || !writesEnabled) return;
    store.setState({ saveStatus: 'pending' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 500);
  });
  if (!loaded.save && writesEnabled) flush();
  return { store, flush, dispose: () => { flush(); unsubscribe(); writesEnabled = false; } };
}

let boot: ReturnType<typeof createGameStore> | null = null;
let bootError: string | null = null;
try {
  boot = createGameStore(loadBuiltinPack(), new LocalSaveRepository({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) }));
  window.addEventListener('pagehide', boot.flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') boot?.flush(); });
} catch (error) { bootError = error instanceof Error ? error.message : String(error); }
export { boot, bootError };
