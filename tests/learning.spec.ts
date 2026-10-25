import { expect, test, type Page } from '@playwright/test';
import questions from '../content-packs/science-g3/questions.json' with { type: 'json' };
import entries from '../content-packs/science-g3/encyclopedia.json' with { type: 'json' };
import items from '../content-packs/science-g3/items.json' with { type: 'json' };
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: '學習導覽' }).getByRole('button', { name, exact: true });
const mainNav = (page: Page, name: string) => page.getByRole('navigation', { name: '主要導覽' }).getByRole('button', { name, exact: true });
async function saved(page: Page) { await expect(page.getByText('進度已儲存')).toBeVisible(); return page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!)); }
async function fixture(page: Page, mode: 'review' | 'old' | 'decor') {
  await page.goto('/'); const save = await saved(page);
  if (mode === 'review') { save.coins = 50; save.xp = 345; save.stats = { correct: 99, questionsAnswered: 99, battlesWon: 1 }; save.clearedUnitIds = ['sci-g3-u1']; save.unlockedAchievementIds = ['first-adventure']; save.wrongQuestionIds = [questions[0].id, questions[1].id]; }
  if (mode === 'old') { save.coins = 40; save.stats = { correct: 100, questionsAnswered: 100, battlesWon: 5 }; for (const item of items.filter(i => !i.obtainFrom.includes('achievement'))) { save.inventory[item.id] = 1; if (!save.ownedItemIds.includes(item.id)) save.ownedItemIds.push(item.id); } }
  if (mode === 'decor') { save.coins = 20; save.inventory.chair = 9; save.roomLayout = Array.from({ length: 9 }, (_, x) => ({ itemId: 'chair', x, y: 0, rotation: 0 })); }
  await page.addInitScript(raw => { if (!sessionStorage.getItem('learning-fixture')) { localStorage.setItem('learning-adventure:save:v1', raw); sessionStorage.setItem('learning-fixture', 'true'); } }, JSON.stringify(save));
  await page.reload();
}

test('通關解鎖三篇知識、已讀保存、道具剪影與實際取得線索', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await nav(page, '自然圖鑑').click();
  await expect(page.getByRole('button', { name: `閱讀${entries[0].title}`, exact: true })).toBeDisabled();
  await mainNav(page, '冒險地圖').click(); await page.getByRole('button', { name: /植物構造與功能/ }).click();
  let rounds = 0;
  while (await page.getByRole('region', { name: '答題挑戰' }).count()) {
    const stem = await page.locator('.question-card h2').getAttribute('data-stem'); const q = questions.find(q => q.stem === stem)!;
    await page.locator('.answers button').nth(rounds === 0 ? (q.answerIndex + 1) % 4 : q.answerIndex).click(); await page.getByRole('button', { name: /繼續挑戰|看看冒險成果/ }).click(); expect(++rounds).toBeLessThanOrEqual(10);
  }
  await expect(page.getByRole('heading', { name: '挑戰成功！' })).toBeVisible(); await expect(page.getByRole('region', { name: '成就通知' })).toContainText('第一場自然冒險');
  await nav(page, '自然圖鑑').click(); await expect(page.getByText('已解鎖 3 / 15 篇')).toBeVisible();
  await page.getByRole('button', { name: `閱讀${entries[0].title}`, exact: true }).click(); await expect(page.locator('.knowledge-detail')).toContainText(entries[0].text); expect((await saved(page)).readEncyclopediaIds).toEqual([entries[0].id]);
  await page.screenshot({ path: `test-results/knowledge-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('tab', { name: '道具圖鑑', exact: true }).click(); await page.getByRole('button', { name: '查看道具百題知識獎盃', exact: true }).click();
  await expect(page.locator('.catalog-detail')).toContainText('成就「答對 100 題」'); await expect(page.getByText('尚未收藏・道具剪影')).toBeVisible();
  await page.screenshot({ path: `test-results/catalog-${test.info().project.name}.png`, fullPage: true });
  const before = await saved(page); await page.reload(); await nav(page, '自然圖鑑').click(); await expect(page.getByRole('button', { name: `閱讀${entries[0].title}`, exact: true })).toContainText('已讀');
  expect((await saved(page)).coins).toBe(before.coins); await expect(page.getByRole('region', { name: '成就通知' })).toHaveCount(0); expect(errors).toEqual([]);
});

test('複習答對移除與二金幣、100 題獎盃只發一次、答錯可重練至清空', async ({ page }) => {
  await fixture(page, 'review'); await nav(page, '複習小徑').click(); await expect(page.getByRole('region', { name: '錯題複習' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /探險家/ })).toHaveCount(0);
  await page.locator('.answers button').nth(questions[0].answerIndex).click(); await expect(page.getByRole('status')).toContainText('已移出錯題池'); await expect(page.getByRole('region', { name: '成就通知' })).toContainText('答對 100 題');
  let state = await saved(page); expect(state.coins).toBe(52); expect(state.inventory['knowledge-trophy']).toBe(1); expect(state.xp).toBe(345); expect(state.wrongQuestionIds).toEqual([questions[1].id]);
  await page.screenshot({ path: `test-results/review-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '下一題', exact: true }).click(); await page.locator('.answers button').nth((questions[1].answerIndex + 1) % 4).click(); await page.getByRole('button', { name: '完成這次複習', exact: true }).click();
  await page.getByRole('button', { name: '再走一次複習小徑', exact: true }).click(); await page.locator('.answers button').nth(questions[1].answerIndex).click(); await page.getByRole('button', { name: '完成這次複習', exact: true }).click();
  state = await saved(page); expect(state.coins).toBe(54); expect(state.wrongQuestionIds).toEqual([]); expect(state.inventory['knowledge-trophy']).toBe(1); expect(state.unlockedAchievementIds.filter((id: string) => id === 'curious-100')).toHaveLength(1);
  await nav(page, '複習小徑').click(); await expect(page.getByRole('heading', { name: '今天的錯題都複習好了！' })).toBeVisible();
  await page.reload(); await nav(page, '探險成就').click(); await expect(page.getByRole('region', { name: '答對 100 題', exact: true })).toContainText('獎勵已入帳'); expect((await saved(page)).inventory['knowledge-trophy']).toBe(1);
  await page.screenshot({ path: `test-results/achievements-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('舊進度補發四項成就，刷新與反覆瀏覽不會重複發獎', async ({ page }) => {
  await fixture(page, 'old'); let state = await saved(page); expect(state.coins).toBe(230); expect(state.inventory['knowledge-trophy']).toBe(1); expect(state.unlockedAchievementIds).toHaveLength(4);
  await nav(page, '探險成就').click(); await expect(page.getByText('已達成 4 / 5 項')).toBeVisible();
  await page.reload(); state = await saved(page); expect(state.coins).toBe(230); expect(state.inventory['knowledge-trophy']).toBe(1); await expect(page.getByRole('region', { name: '成就通知' })).toHaveCount(0);
});

test('佈置十件給限定旗，收回再放與重開都不會重複給獎', async ({ page }) => {
  await fixture(page, 'decor'); await page.getByRole('button', { name: '佈置小屋', exact: true }).click();
  const desk = page.getByRole('button', { name: '從家具箱選擇木書桌', exact: true }); const target = page.getByRole('button', { name: '第 3 欄第 3 列', exact: true });
  await desk.focus(); await page.keyboard.press('Enter'); await target.focus(); await page.keyboard.press('Enter'); await expect(page.getByTestId('placed-count')).toHaveText('10');
  await expect(page.getByRole('region', { name: '成就通知' })).toContainText('佈置 10 件家具'); let state = await saved(page); expect(state.inventory['decor-banner']).toBe(1); expect(state.coins).toBe(20);
  await page.getByRole('button', { name: '收回木書桌 10', exact: true }).click(); await desk.focus(); await page.keyboard.press('Enter'); await target.focus(); await page.keyboard.press('Enter');
  state = await saved(page); expect(state.inventory['decor-banner']).toBe(1); expect(state.roomLayout).toHaveLength(10); await page.reload(); expect((await saved(page)).inventory['decor-banner']).toBe(1);
});
