import { create } from 'zustand';
import { loadBuiltinPack } from '../data/loader';
import type { ContentPack, Question, Unit } from '../data/schemas';
import { counterDamage, hitDamage, isUnlocked, levelFromXp, maxHp, selectQuestions, starCount, victoryCoins } from '../logic/battle';
import { LocalSaveRepository, newGame, type PlayerSave, type SaveRepository } from '../logic/save';
import { awardDrops, rollDrops, type DropReceipt } from '../logic/drops';
import { healWithPotion, purchase } from '../logic/shop';
import { placeFurniture, type PlacedFurniture } from '../logic/placement';
import { equipOutfit, normalizeOutfit } from '../logic/outfits';
import type { OutfitSlot } from '../data/schemas';
import { unlockAchievements, type AchievementAward } from '../logic/achievements';
import { answerReview, reviewQuestions, unlockedEntries } from '../logic/learning';

export type Screen = 'home' | 'map' | 'battle' | 'result' | 'shop' | 'decor' | 'wardrobe' | 'dex' | 'review' | 'achievements';
export interface ReviewState { questions: Question[]; index: number; correct: number; coins: number; done: boolean; feedback: { choice: number; correct: boolean } | null }
export interface Battle { unit: Unit; questions: Question[]; index: number; playerHp: number; playerMaxHp: number; bossHp: number; level: number; correct: number; feedback: { choice: number; correct: boolean; damage: number; critical: boolean } | null; outcome: 'won' | 'lost' | null }
export interface BattleResult { won: boolean; coins: number; dropCoins: number; drops: DropReceipt[]; xp: number; correct: number; answered: number; stars: number; firstClear: boolean; unitName: string }
interface GameState { pack: ContentPack; player: PlayerSave; screen: Screen; battle: Battle | null; result: BattleResult | null; review: ReviewState | null; achievementQueue: AchievementAward[]; warning: string | null; notice: string | null; saveStatus: 'saved' | 'pending' | 'error'; navigate(screen: Exclude<Screen, 'battle' | 'result' | 'review'>): void; startBattle(unitId: string): void; answer(choice: number): void; nextTurn(): void; startReview(): void; reviewAnswer(choice: number): void; nextReview(): void; readEntry(id: string): void; dismissAchievement(): void; buy(productId: string): void; usePotion(): void; equip(slot: OutfitSlot, itemId: string | null): void; place(placement: PlacedFurniture, movingIndex?: number | null): boolean; removeFurniture(index: number): void; dismissWarning(): void }

export function createGameStore(pack: ContentPack, repository: SaveRepository, random: () => number = Math.random) {
  const loaded = repository.load();
  const wrongPack = loaded.save && loaded.save.contentPackId !== pack.manifest.id;
  const previous = !wrongPack && loaded.save ? loaded.save : newGame(pack);
  const normalizedOutfit = normalizeOutfit(previous, pack);
  const repairedOutfit = Object.keys(normalizedOutfit).length !== Object.keys(previous.equippedOutfit).length;
  const initial = { ...previous, equippedOutfit: normalizedOutfit };
  const initialAwards = unlockAchievements(initial, pack);
  if (initialAwards.awards.length > 0) initialAwards.player = { ...initialAwards.player, updatedAt: new Date().toISOString() };
  let writesEnabled = !wrongPack && !loaded.warning?.includes('原始存檔');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const store = create<GameState>((write, get) => {
    const set = (patch: Partial<GameState>) => {
      if (!patch.player) { write(patch); return; }
      const result = unlockAchievements(patch.player, pack);
      write({ ...patch, player: result.player, achievementQueue: [...get().achievementQueue, ...result.awards] });
    };
    return {
    pack, player: initialAwards.player, screen: 'home', battle: null, result: null, review: null, achievementQueue: initialAwards.awards, notice: null, warning: wrongPack ? '存檔屬於其他內容包，原始存檔已保留。' : loaded.warning ?? (repairedOutfit ? '部分裝扮無法使用，已還原預設外觀，收藏及其他進度仍保留。' : null), saveStatus: writesEnabled ? 'saved' : 'error',
    navigate: screen => set({ screen, battle: null, result: null, review: null, notice: null }),
    dismissWarning: () => set({ warning: null }),
    dismissAchievement: () => set({ achievementQueue: get().achievementQueue.slice(1) }),
    readEntry: id => {
      const { player, screen } = get();
      if (screen !== 'dex' || player.readEncyclopediaIds.includes(id) || !unlockedEntries(player, pack).some(entry => entry.id === id)) return;
      set({ player: { ...player, readEncyclopediaIds: [...player.readEncyclopediaIds, id], updatedAt: new Date().toISOString() } });
    },
    startReview: () => {
      if (get().screen === 'battle') return;
      const questions = reviewQuestions(get().player, pack);
      set({ screen: 'review', battle: null, result: null, notice: null, review: { questions, index: 0, correct: 0, coins: 0, done: questions.length === 0, feedback: null } });
    },
    reviewAnswer: choice => {
      const { review, player, screen } = get();
      if (screen !== 'review' || !review || review.done || review.feedback) return;
      const result = answerReview(player, review.questions[review.index], choice);
      if (!result) return;
      set({ review: { ...review, correct: review.correct + Number(result.correct), coins: review.coins + result.coins, feedback: { choice, correct: result.correct } }, player: { ...result.player, updatedAt: new Date().toISOString() } });
    },
    nextReview: () => {
      const { review, screen } = get(); if (screen !== 'review' || !review?.feedback || review.done) return;
      set({ review: { ...review, index: review.index + 1, feedback: null, done: review.index + 1 >= review.questions.length } });
    },
    equip: (slot, itemId) => {
      if (get().screen !== 'wardrobe') return;
      const result = equipOutfit(get().player, pack, slot, itemId);
      set(result.ok ? { player: { ...result.player, updatedAt: new Date().toISOString() }, notice: result.message } : { notice: result.message });
    },
    place: (placement, movingIndex = null) => {
      if (get().screen !== 'decor') return false;
      const result = placeFurniture(get().player, pack.items, placement, movingIndex);
      if (!result.ok) { set({ notice: result.message }); return false; }
      set({ player: { ...result.player, updatedAt: new Date().toISOString() }, notice: movingIndex === null ? '家具已擺好，小屋又溫暖了一點！' : '家具已移到新位置。' });
      return true;
    },
    removeFurniture: index => {
      const { player, screen } = get();
      if (screen !== 'decor' || !Number.isInteger(index) || !player.roomLayout[index]) return;
      set({ player: { ...player, roomLayout: player.roomLayout.filter((_, i) => i !== index), updatedAt: new Date().toISOString() }, notice: '家具已收回家具箱，隨時可以再擺出來。' });
    },
    buy: productId => {
      if (get().screen !== 'shop') return;
      const result = purchase(get().player, productId, pack);
      set(result.ok ? { player: { ...result.player, updatedAt: new Date().toISOString() }, notice: result.message } : { notice: result.message });
    },
    usePotion: () => {
      const { battle, player } = get();
      if (!battle || battle.outcome || battle.feedback) return;
      const healed = healWithPotion(battle.playerHp, battle.playerMaxHp, player.potions);
      if (!healed) { set({ notice: player.potions <= 0 ? '背包沒有藥水，出發前可以到商店補充。' : '生命已滿，先留著藥水吧！' }); return; }
      set({ battle: { ...battle, playerHp: healed.hp }, player: { ...player, potions: healed.potions, updatedAt: new Date().toISOString() }, notice: `恢復 ${healed.healed} HP，繼續探索吧！` });
    },
    startBattle: unitId => {
      const player = get().player;
      const unit = pack.units.find(u => u.id === unitId);
      if (!unit || !isUnlocked(unit, player.clearedUnitIds)) return;
      const level = levelFromXp(player.xp);
      set({ screen: 'battle', result: null, review: null, notice: null, battle: { unit, questions: selectQuestions(pack.questions.filter(q => unit.questionPool.includes(q.id)), player.wrongQuestionIds, random), index: 0, playerHp: maxHp(level), playerMaxHp: maxHp(level), bossHp: unit.boss.hp, level, correct: 0, feedback: null, outcome: null } });
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
      set({ notice: null, battle: { ...battle, bossHp, playerHp, correct: battle.correct + Number(correct), feedback: { choice, correct, ...hit }, outcome }, player: { ...player, xp: player.xp + (correct ? 10 : 0), wrongQuestionIds: correct ? player.wrongQuestionIds : [...new Set([...player.wrongQuestionIds, question.id])], stats: { ...player.stats, questionsAnswered: player.stats.questionsAnswered + 1, correct: player.stats.correct + Number(correct) }, updatedAt: new Date().toISOString() } });
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
      const table = pack.dropTables.find(t => t.id === battle.unit.dropTableId)!;
      const awarded = awardDrops(player, won ? rollDrops(table, random) : [], pack);
      set({ screen: 'result', battle: null, notice: null, result: { won, coins: coins + awarded.bonusCoins, dropCoins: awarded.bonusCoins, drops: awarded.receipts, xp: battle.correct * 10 + (won ? 50 : 0), correct: battle.correct, answered, stars, firstClear: won && firstClear, unitName: battle.unit.name }, player: { ...awarded.player, coins: awarded.player.coins + coins, xp: player.xp + (won ? 50 : 0), clearedUnitIds: won ? [...new Set([...player.clearedUnitIds, battle.unit.id])] : player.clearedUnitIds, unitStars: won ? { ...player.unitStars, [battle.unit.id]: Math.max(player.unitStars[battle.unit.id] ?? 0, stars) } : player.unitStars, stats: { ...player.stats, battlesWon: player.stats.battlesWon + Number(won) }, updatedAt: new Date().toISOString() } });
    },
    };
  });
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
  if (writesEnabled && (!loaded.save || initialAwards.awards.length > 0)) flush();
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
