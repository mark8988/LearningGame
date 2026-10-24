import { expect, test, type Locator, type Page } from '@playwright/test';

const cell = (page: Page, x: number, y: number) => page.getByRole('button', { name: `第 ${x + 1} 欄第 ${y + 1} 列`, exact: true });
async function editor(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: '佈置小屋', exact: true }).click();
  await expect(page.getByRole('heading', { name: '佈置我的小屋' })).toBeVisible();
  await expect(cell(page, 0, 0)).toBeAttached();
  await page.locator('.decor-canvas').evaluate(element => { window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 175); });
}
async function center(locator: Locator) {
  const box = await locator.boundingBox(); if (!box) throw new Error('Missing drag target');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function mouseDrag(page: Page, source: Locator, target: Locator, beforeRelease?: () => Promise<void>) {
  const from = await center(source); const to = await center(target);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 12 });
  await beforeRelease?.(); await page.mouse.up();
}
async function layout(page: Page) {
  await expect(page.getByText('進度已儲存')).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!).roomLayout);
}

test('滑鼠拖放、碰撞與出界拒絕、移動及收回', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await editor(page);
  await mouseDrag(page, page.getByRole('button', { name: '從家具箱選擇木書桌', exact: true }), cell(page, 2, 2), async () => {
    await expect(page.locator('.placement-outline.valid')).toBeVisible();
  });
  await expect(page.getByTestId('placed-count')).toHaveText('1');
  expect(await layout(page)).toEqual([{ itemId: 'desk', x: 2, y: 2, rotation: 0 }]);
  await expect(page.getByRole('button', { name: '從家具箱選擇木書桌', exact: true })).toBeDisabled();
  await mouseDrag(page, page.getByRole('button', { name: '從家具箱選擇小木椅', exact: true }), cell(page, 2, 2), async () => {
    await expect(page.locator('.placement-outline.invalid')).toBeVisible();
  });
  await expect(page.locator('.decor-feedback')).toContainText('同層');
  expect(await layout(page)).toHaveLength(1);
  await mouseDrag(page, page.getByRole('button', { name: '從家具箱選擇森林小床', exact: true }), cell(page, 11, 7), async () => {
    await expect(page.locator('.placement-outline.invalid')).toBeVisible();
    await page.screenshot({ path: `test-results/decor-invalid-${test.info().project.name}.png`, fullPage: true });
  });
  await expect(page.locator('.decor-feedback')).toContainText('邊界');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.locator('.decor-canvas').evaluate(element => { window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 175); });
  await mouseDrag(page, cell(page, 2, 2), cell(page, 5, 4));
  expect(await layout(page)).toEqual([{ itemId: 'desk', x: 5, y: 4, rotation: 0 }]);
  await page.getByRole('button', { name: '收回木書桌 1', exact: true }).click();
  expect(await layout(page)).toEqual([]);
  await expect(page.getByRole('button', { name: '從家具箱選擇木書桌', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('真實 touch 事件拖入桌子，重開後位置一致且主畫面呈現家具', async ({ page, context }) => {
  await editor(page);
  const source = page.getByRole('button', { name: '從家具箱選擇木書桌', exact: true });
  const from = await center(source); const to = await center(cell(page, 4, 3));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10, id: 1 }] });
  await expect(page.locator('.placement-outline.valid')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  expect(await layout(page)).toEqual([{ itemId: 'desk', x: 4, y: 3, rotation: 0 }]);
  await page.screenshot({ path: `test-results/decor-${test.info().project.name}.png`, fullPage: true });
  await page.reload();
  await expect(page.locator('.home-collection')).toContainText('已擺放 1 件');
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: `test-results/home-decorated-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '佈置小屋', exact: true }).click();
  await expect(page.getByRole('button', { name: '移動木書桌 1', exact: true })).toContainText('第 5 欄 · 第 4 列');
  expect(await layout(page)).toEqual([{ itemId: 'desk', x: 4, y: 3, rotation: 0 }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('鍵盤選格、旋轉及取消，地毯可放在桌子下', async ({ page }) => {
  await editor(page);
  const choose = page.getByRole('button', { name: '從家具箱選擇木書桌', exact: true });
  await choose.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '旋轉', exact: true }).click();
  await cell(page, 0, 0).focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  expect(await layout(page)).toEqual([{ itemId: 'desk', x: 1, y: 1, rotation: 1 }]);
  const rug = page.getByRole('button', { name: '從家具箱選擇葉子地毯', exact: true });
  await rug.focus(); await page.keyboard.press('Enter'); await cell(page, 1, 1).focus(); await page.keyboard.press('Enter');
  expect(await layout(page)).toHaveLength(2);
  await page.getByRole('button', { name: '移動木書桌 1', exact: true }).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  expect(await layout(page)).toEqual([{ itemId: 'desk', x: 1, y: 1, rotation: 1 }, { itemId: 'rug', x: 1, y: 1, rotation: 0 }]);
});
