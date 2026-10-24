import { expect, test } from '@playwright/test';
import questions from '../content-packs/science-g3/questions.json' with { type: 'json' };

test('3D 小屋 → 地圖 → 答錯解析 → 通關 → 重新整理保留進度', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '我的森林小屋' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return !!(canvas?.getContext('webgl2') || canvas?.getContext('webgl'));
  });
  await expect(page.getByText('進度已儲存')).toBeVisible();
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '開始冒險' }).click();
  await expect(page.getByRole('button', { name: /動物分類/ })).toBeDisabled();
  await page.getByRole('button', { name: /植物構造與功能/ }).click();
  await expect(page.getByRole('region', { name: '答題挑戰' })).toBeVisible();
  let rounds = 0;
  while (await page.getByRole('region', { name: '答題挑戰' }).count()) {
    const stem = await page.locator('.question-card h2').innerText();
    const q = questions.find(question => question.stem === stem)!;
    const choice = rounds === 0 ? (q.answerIndex + 1) % 4 : q.answerIndex;
    await page.locator('.answers button').nth(choice).click();
    await expect(page.getByRole('status')).toContainText(q.explanation);
    if (rounds === 0) {
      await expect(page.getByText('沒關係，一起學起來！')).toBeVisible();
      await page.screenshot({ path: `test-results/battle-${test.info().project.name}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: /繼續挑戰|看看冒險成果/ }).click();
    rounds++;
    expect(rounds).toBeLessThanOrEqual(10);
  }
  await expect(page.getByRole('heading', { name: '挑戰成功！' })).toBeVisible();
  await page.getByRole('button', { name: /開啟森林寶箱/ }).click();
  await expect(page.getByLabel('寶箱獎勵')).toBeVisible();
  expect(await page.locator('.loot-item').count()).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: `test-results/loot-${test.info().project.name}.png`, fullPage: true });
  await expect(page.getByTestId('coins')).not.toHaveText('0');
  const coins = await page.getByTestId('coins').innerText();
  await expect(page.getByText('進度已儲存')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '我的森林小屋' })).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText(coins);
  await page.getByRole('button', { name: '開始冒險' }).click();
  await expect(page.getByRole('button', { name: /動物分類/ })).toBeEnabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!));
  expect(saved.wrongQuestionIds).toHaveLength(1);
  expect(saved.clearedUnitIds).toContain('sci-g3-u1');
  expect(saved.unitStars['sci-g3-u1']).toBeGreaterThan(0);
  expect(Object.values(saved.inventory).reduce((sum: number, value) => sum + Number(value), 0)).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('失敗不扣獎勵，重開戰鬥恢復生命', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '開始冒險' }).click();
  await page.getByRole('button', { name: /植物構造與功能/ }).click();
  for (let round = 0; round < 5; round++) {
    const stem = await page.locator('.question-card h2').innerText();
    const q = questions.find(question => question.stem === stem)!;
    await page.locator('.answers button').nth((q.answerIndex + 1) % 4).click();
    await page.getByRole('button', { name: /繼續挑戰|看看冒險成果/ }).click();
  }
  await expect(page.getByRole('heading', { name: '休息一下，再出發' })).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText('0');
  await page.getByRole('button', { name: '回到冒險地圖' }).click();
  await page.getByRole('button', { name: /植物構造與功能/ }).click();
  await expect(page.getByRole('progressbar', { name: /探險家/ })).toHaveAttribute('value', '100');
});
