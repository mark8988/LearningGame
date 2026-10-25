import { expect, test } from '@playwright/test';
import questions from '../content-packs/science-g3/questions.json' with { type: 'json' };
test('正式 PWA 完整快取後斷網，通關、購買、擺放與重開仍可遊玩', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./'); await expect(page.locator('.version')).toContainText('0.6'); await expect(page.getByText('離線遊玩已就緒', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const manifest = await page.evaluate(async () => { const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!; return (await fetch(link.href)).json(); }); expect(manifest.display).toBe('standalone'); expect(manifest.start_url).toBe('./');
  await context.setOffline(true); await page.reload(); await expect(page.getByText('離線中 · 冒險照常')).toBeVisible(); await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '開始冒險' }).click(); await page.getByRole('button', { name: /植物構造與功能/ }).click(); let rounds = 0;
  while (await page.getByRole('region', { name: '答題挑戰' }).count()) {
    const stem = await page.locator('.question-card h2').getAttribute('data-stem'); const question = questions.find(q => q.stem === stem)!;
    await page.locator('.answers button').nth(question.answerIndex).click(); await page.getByRole('button', { name: /繼續挑戰|看看冒險成果/ }).click(); expect(++rounds).toBeLessThanOrEqual(10);
  }
  await expect(page.getByRole('heading', { name: '挑戰成功！' })).toBeVisible();
  const nav = (name: string) => page.getByRole('navigation', { name: '主要導覽' }).getByRole('button', { name, exact: true });
  await nav('森林商店').click(); await page.getByRole('button', { name: /木書桌.*50 金幣/ }).click(); await page.getByRole('button', { name: '購買木書桌' }).click(); await page.getByRole('button', { name: '確認購買' }).click();
  await nav('小屋佈置').click(); const desk = page.getByRole('button', { name: '從家具箱選擇木書桌', exact: true }); await desk.focus(); await page.keyboard.press('Enter'); const cell = page.getByRole('button', { name: '第 3 欄第 3 列', exact: true }); await cell.focus(); await page.keyboard.press('Enter'); await expect(page.getByTestId('placed-count')).toHaveText('1');
  await expect(page.getByText('進度已儲存')).toBeVisible(); const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!)); expect(saved.clearedUnitIds).toContain('sci-g3-u1'); expect(saved.inventory.desk).toBe(2);
  await page.screenshot({ path: `test-results/offline-${test.info().project.name}.png`, fullPage: true });
  await page.reload(); await expect(page.locator('canvas')).toBeVisible(); const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!)); expect(restored).toEqual(saved); expect(errors).toEqual([]);
});
