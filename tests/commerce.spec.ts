import { expect, test } from '@playwright/test';
import questions from '../content-packs/science-g3/questions.json' with { type: 'json' };

test('舊存檔相容、商店三分頁、購買確認、藥水補血與持久化', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('進度已儲存')).toBeVisible();
  const legacy = await page.evaluate(() => { const old = JSON.parse(localStorage.getItem('learning-adventure:save:v1')!); old.coins = 250; delete old.potions; return JSON.stringify(old); });
  await page.addInitScript(raw => { if (!sessionStorage.getItem('commerce-fixture')) { localStorage.setItem('learning-adventure:save:v1', raw); sessionStorage.setItem('commerce-fixture', 'true'); } }, legacy);
  await page.reload();
  await page.getByRole('button', { name: '森林商店', exact: true }).click();
  await expect(page.getByRole('heading', { name: '森林裡的小商店' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: /木書桌.*50 金幣/ }).click();
  await page.getByRole('button', { name: '購買木書桌' }).click();
  await page.getByRole('button', { name: '再看看' }).click();
  await expect(page.getByTestId('coins')).toHaveText('250');
  await page.getByRole('button', { name: '購買木書桌' }).click();
  await page.getByRole('button', { name: '確認購買' }).click();
  await expect(page.getByTestId('coins')).toHaveText('200');
  await expect(page.getByRole('button', { name: /木書桌.*已擁有 2/ })).toBeVisible();
  await page.getByRole('tab', { name: '服裝' }).click();
  await page.getByRole('button', { name: '購買探險小帽' }).click();
  await page.getByRole('button', { name: '確認購買' }).click();
  await expect(page.getByRole('button', { name: '購買探險小帽' })).toBeDisabled();
  await expect(page.getByText('你已經擁有這件裝扮囉！')).toBeVisible();
  await page.getByRole('tab', { name: '藥水' }).click();
  for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: '購買森林 HP 藥水' }).click(); await page.getByRole('button', { name: '確認購買' }).click(); }
  await expect(page.getByTestId('coins')).toHaveText('90');
  await page.screenshot({ path: `test-results/shop-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '冒險地圖', exact: true }).click();
  await page.getByRole('button', { name: /植物構造與功能/ }).click();
  await expect(page.getByRole('button', { name: /使用藥水/ })).toBeDisabled();
  for (let i = 0; i < 3; i++) {
    const stem = await page.locator('.question-card h2').getAttribute('data-stem');
    const q = questions.find(q => q.stem === stem)!;
    await page.locator('.answers button').nth((q.answerIndex + 1) % 4).click();
    await expect(page.getByRole('button', { name: /使用藥水/ })).toBeDisabled();
    await page.getByRole('button', { name: '繼續挑戰' }).click();
  }
  const hp = page.getByRole('progressbar', { name: /探險家/ });
  await expect(hp).toHaveAttribute('value', '37');
  const stem = await page.locator('.question-card h2').getAttribute('data-stem');
  await page.getByRole('button', { name: /使用藥水（2 瓶）/ }).click();
  await expect(hp).toHaveAttribute('value', '87');
  await expect(page.locator('.question-card h2')).toHaveAttribute('data-stem', stem!);
  await page.getByRole('button', { name: /使用藥水（1 瓶）/ }).click();
  await expect(hp).toHaveAttribute('value', '100');
  await expect(page.getByRole('button', { name: /使用藥水（0 瓶）/ })).toBeDisabled();
  await expect(page.getByText('進度已儲存')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '森林商店', exact: true }).click();
  await expect(page.getByTestId('coins')).toHaveText('90');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!));
  expect(saved.inventory.desk).toBe(2); expect(saved.inventory['explorer-hat']).toBe(1); expect(saved.potions).toBe(0);
  expect(saved.wrongQuestionIds).toHaveLength(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('零金幣顯示不足提示，不允許購買', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '森林商店', exact: true }).click();
  await expect(page.getByRole('button', { name: '購買森林小床' })).toBeDisabled();
  await expect(page.getByText('金幣不足，完成冒險就能獲得更多金幣！')).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText('0');
});
