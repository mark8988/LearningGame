import { expect, test, type Page } from '@playwright/test';
import items from '../content-packs/science-g3/items.json' with { type: 'json' };
import questions from '../content-packs/science-g3/questions.json' with { type: 'json' };
const slots = [['hair', '髮型'], ['top', '上衣'], ['bottom', '下身'], ['shoes', '鞋子'], ['hat', '帽子'], ['accessory', '配件'], ['handheld', '手持物']] as const;
async function seed(page: Page, ownAll: boolean) {
  await page.goto('/'); await expect(page.getByText('進度已儲存')).toBeVisible();
  const raw = await page.evaluate(() => localStorage.getItem('learning-adventure:save:v1')!);
  const save = JSON.parse(raw); save.coins = 500;
  if (ownAll) for (const item of items.filter(i => i.kind === 'outfit')) { save.inventory[item.id] = 1; save.ownedItemIds.push(item.id); }
  await page.addInitScript(data => { if (!sessionStorage.getItem('wardrobe-fixture')) { localStorage.setItem('learning-adventure:save:v1', data); sessionStorage.setItem('wardrobe-fixture', 'true'); } }, JSON.stringify(save));
  await page.reload();
}
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: '主要導覽' }).getByRole('button', { name, exact: true });
async function saved(page: Page) { await expect(page.getByText('進度已儲存')).toBeVisible(); return page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!)); }

test('七部位換裝、同部位替換還原、存檔與小屋／戰鬥／結算同步', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await seed(page, true); await nav(page, '我的衣櫃').click();
  await expect(page.getByRole('heading', { name: '穿上喜歡的自己' })).toBeVisible();
  for (const [slot, label] of slots) {
    const item = items.find(item => item.kind === 'outfit' && item.outfitSlot === slot)!;
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.getByRole('button', { name: `穿戴${item.name}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `穿戴${item.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('tab', { name: '帽子', exact: true }).click();
  await page.getByRole('button', { name: '穿戴樹靈葉冠', exact: true }).click();
  await expect(page.getByRole('button', { name: '穿戴探險小帽', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '還原預設帽子', exact: true }).click();
  expect((await saved(page)).equippedOutfit.hat).toBeUndefined();
  await page.getByRole('button', { name: '穿戴雲羽禮帽', exact: true }).click();
  const before = await saved(page); expect(Object.keys(before.equippedOutfit)).toHaveLength(7); expect(before.coins).toBe(500); expect(before.xp).toBe(0);
  const fingerprint = await page.getByTestId('avatar-outfit').getAttribute('data-items'); expect(fingerprint?.split('|')).toHaveLength(7);
  await page.screenshot({ path: `test-results/wardrobe-${test.info().project.name}.png`, fullPage: true });
  await page.reload(); await expect(page.getByTestId('avatar-outfit')).toHaveAttribute('data-items', fingerprint!);
  await page.screenshot({ path: `test-results/outfit-home-${test.info().project.name}.png`, fullPage: true });
  await nav(page, '冒險地圖').click(); await page.getByRole('button', { name: /植物構造與功能/ }).click();
  await expect(page.getByTestId('avatar-outfit')).toHaveAttribute('data-items', fingerprint!);
  await expect(page.getByRole('progressbar', { name: /探險家/ })).toHaveAttribute('value', '100');
  await page.screenshot({ path: `test-results/outfit-battle-${test.info().project.name}.png`, fullPage: true });
  let rounds = 0;
  while (await page.getByRole('region', { name: '答題挑戰' }).count()) {
    const stem = await page.locator('.question-card h2').innerText(); const q = questions.find(q => q.stem === stem)!;
    await page.locator('.answers button').nth(q.answerIndex).click(); await page.getByRole('button', { name: /繼續挑戰|看看冒險成果/ }).click(); expect(++rounds).toBeLessThanOrEqual(10);
  }
  await expect(page.getByRole('heading', { name: '挑戰成功！' })).toBeVisible();
  await expect(page.getByTestId('avatar-outfit')).toHaveAttribute('data-items', fingerprint!);
  await page.screenshot({ path: `test-results/outfit-result-${test.info().project.name}.png`, fullPage: true });
  expect((await saved(page)).equippedOutfit).toEqual(before.equippedOutfit);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('未購服裝試穿不扣款、不入庫、不儲存穿搭，購買後由衣櫃正式穿戴', async ({ page }) => {
  await seed(page, false); await nav(page, '森林商店').click(); await page.getByRole('tab', { name: '服裝', exact: true }).click();
  const before = await saved(page);
  await page.getByRole('button', { name: '試穿預覽', exact: true }).click();
  await expect(page.getByTestId('avatar-outfit')).toHaveAttribute('data-items', 'explorer-hat');
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: '結束試穿', exact: true }).click();
  await expect(page.getByTestId('avatar-outfit')).toHaveCount(0);
  await page.getByRole('button', { name: '試穿預覽', exact: true }).click();
  await page.screenshot({ path: `test-results/try-on-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '購買探險小帽', exact: true }).click(); await page.getByRole('button', { name: '確認購買', exact: true }).click();
  const purchased = await saved(page); expect(purchased.coins).toBe(440); expect(purchased.inventory['explorer-hat']).toBe(1); expect(purchased.equippedOutfit).toEqual({});
  await nav(page, '我的小屋').click(); await expect(page.getByTestId('avatar-outfit')).toHaveAttribute('data-items', '');
  await nav(page, '我的衣櫃').click(); await page.getByRole('button', { name: '穿戴探險小帽', exact: true }).click();
  await expect(page.getByTestId('avatar-outfit')).toHaveAttribute('data-items', 'explorer-hat'); expect((await saved(page)).equippedOutfit.hat).toBe('explorer-hat');
});

test('空衣櫃可還原預設並引導取得，七個部位皆可瀏覽', async ({ page }) => {
  await page.goto('/'); await nav(page, '我的衣櫃').click();
  for (const [, label] of slots) { await page.getByRole('tab', { name: label, exact: true }).click(); await expect(page.getByText('這個部位還沒有收藏')).toBeVisible(); }
  await expect(page.getByTestId('avatar-outfit')).toHaveAttribute('data-items', '');
});
