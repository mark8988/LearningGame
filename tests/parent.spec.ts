import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import questions from '../content-packs/science-g3/questions.json' with { type: 'json' };
const saved = async (page: Page) => { await expect(page.getByText('進度已儲存')).toBeVisible(); return page.evaluate(() => JSON.parse(localStorage.getItem('learning-adventure:save:v1')!)); };
export async function unlock(page: Page) {
  await page.getByRole('button', { name: '家長模式', exact: true }).click();
  const hold = page.getByRole('button', { name: '長按 1.2 秒進入' }); await hold.focus(); await page.keyboard.down('Space'); await page.waitForTimeout(1300); await page.keyboard.up('Space');
  const label = await page.locator('label[for="parent-answer"]').innerText(); const digits = label.match(/\d+/g)!.map(Number);
  await page.getByRole('spinbutton').fill(String(digits[0] + digits[1])); await page.getByRole('button', { name: '確認答案' }).click();
  await expect(page.getByRole('region', { name: '學習報表' })).toBeVisible();
}
test('家長長按取消、算術驗證、備份往返、取消還原與重置保護', async ({ page, context }) => {
  await page.goto('/'); const initial = await saved(page);
  await page.getByRole('button', { name: '家長模式', exact: true }).click(); const hold = page.getByRole('button', { name: '長按 1.2 秒進入' });
  await hold.focus(); await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space'); await page.waitForTimeout(1250); await expect(hold).toBeVisible(); await expect(page.getByRole('spinbutton')).toHaveCount(0);
  const touch = await context.newCDPSession(page); const bounds = (await hold.boundingBox())!; const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }); await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: bounds.y - 10 }] }); await page.waitForTimeout(1300); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }); await page.waitForTimeout(1300); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.getByRole('spinbutton').fill('999'); await page.getByRole('button', { name: '確認答案' }).click(); await expect(page.getByRole('alert')).toContainText('答案不太對');
  const numbers = (await page.locator('label[for="parent-answer"]').innerText()).match(/\d+/g)!.map(Number); await page.getByRole('spinbutton').fill(String(numbers[0] + numbers[1])); await page.getByRole('button', { name: '確認答案' }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '匯出存檔', exact: true }).click(); const file = await download; const raw = await readFile((await file.path())!, 'utf8'); expect(JSON.parse(raw)).toEqual(initial);
  const upload = (data: unknown) => page.getByLabel('匯入存檔', { exact: true }).setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await upload({ ...initial, contentPackId: 'wrong-pack' }); await expect(page.getByRole('alert')).toContainText('其他內容包'); expect((await saved(page)).coins).toBe(0);
  const progress = { ...initial, coins: 187, xp: 30, wrongQuestionIds: [questions[0].id], stats: { battlesWon: 0, questionsAnswered: 4, correct: 3 } };
  await upload(progress); await page.getByRole('button', { name: '取消', exact: true }).click(); expect((await saved(page)).coins).toBe(0);
  await upload(progress); await page.getByRole('button', { name: '還原並取代進度' }).click(); await expect(page.getByRole('region', { name: '學習報表' })).toContainText('75%'); await expect(page.getByTestId('coins')).toHaveText('187');
  await page.locator('summary').click(); await expect(page.locator('.wrong-record')).toContainText(questions[0].stem);
  await page.screenshot({ path: `test-results/parent-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '重置目前進度' }).click(); await expect(page.getByRole('button', { name: '確認重置', exact: true })).toBeDisabled(); await page.getByLabel('重置確認文字').fill('重新開始'); await page.getByRole('button', { name: '取消', exact: true }).click(); expect((await saved(page)).coins).toBe(187);
  await page.getByRole('button', { name: '重置目前進度' }).click(); await page.getByLabel('重置確認文字').fill('重新開始'); await page.getByRole('button', { name: '確認重置', exact: true }).click(); await expect(page.getByTestId('coins')).toHaveText('0'); expect((await saved(page)).wrongQuestionIds).toEqual([]);
  await page.getByRole('button', { name: '離開並上鎖' }).click(); await page.getByRole('button', { name: '家長模式', exact: true }).click(); await expect(hold).toBeVisible();
});
test('閱讀設定保存、真實 ruby 題幹與放大字體', async ({ page }) => {
  await page.goto('/'); const state = await saved(page); state.wrongQuestionIds = [questions[0].id]; await page.addInitScript(save => { if (!sessionStorage.getItem('reading-fixture')) { localStorage.setItem('learning-adventure:save:v1', JSON.stringify(save)); sessionStorage.setItem('reading-fixture', 'true'); } }, state); await page.reload();
  await page.getByRole('navigation', { name: '學習導覽' }).getByRole('button', { name: '複習小徑', exact: true }).click(); await expect(page.locator('.question-card ruby')).toHaveCount(13); await page.screenshot({ path: `test-results/zhuyin-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '閱讀與音效' }).click(); await page.getByRole('checkbox', { name: /放大閱讀文字/ }).check(); await page.getByRole('checkbox', { name: /顯示題幹注音/ }).uncheck(); await page.getByRole('checkbox', { name: /開啟音效/ }).check(); await page.getByRole('button', { name: '完成設定' }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/large-text/); await expect(page.locator('.question-card ruby')).toHaveCount(0); await expect(page.locator('.question-card h2')).toHaveCSS('font-size', test.info().project.name === 'phone' ? '25px' : '28px');
  await page.screenshot({ path: `test-results/large-text-${test.info().project.name}.png`, fullPage: true });
  await page.reload(); await page.getByRole('button', { name: '閱讀與音效' }).click(); await expect(page.getByRole('checkbox', { name: /放大閱讀文字/ })).toBeChecked(); await expect(page.getByRole('checkbox', { name: /顯示題幹注音/ })).not.toBeChecked(); await expect(page.getByRole('checkbox', { name: /開啟音效/ })).toBeChecked();
});
test('題庫匯出後跨瀏覽器匯入開打，切換時各自保存進度', async ({ page, browser }) => {
  await page.goto('/'); await unlock(page); const wait = page.waitForEvent('download'); await page.getByRole('button', { name: '匯出目前題庫' }).click(); const raw = await readFile((await (await wait).path())!, 'utf8'); const custom = JSON.parse(raw); custom.files['pack.json'].id = 'family-science'; custom.files['pack.json'].name = '家庭自然題庫';
  const input = page.getByLabel('匯入題庫', { exact: true }); await input.setInputFiles({ name: 'pack.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(custom)) }); await page.getByRole('button', { name: '確認加入', exact: true }).click();
  await page.getByRole('button', { name: '切換題庫：家庭自然題庫' }).click(); await page.getByRole('button', { name: '保存並切換' }).click(); await expect(page.locator('footer')).toContainText('示範內容包'); await expect(page.getByTestId('coins')).toHaveText('0');
  await unlock(page); const save = await saved(page); save.contentPackId = 'family-science'; save.coins = 77; await page.getByLabel('匯入存檔', { exact: true }).setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) }); await page.getByRole('button', { name: '還原並取代進度' }).click();
  const exported = page.waitForEvent('download'); await page.getByRole('button', { name: '匯出目前題庫' }).click(); const packRaw = await readFile((await (await exported).path())!, 'utf8');
  await page.getByRole('button', { name: '切換題庫：國小三年級・自然探險' }).click(); await page.getByRole('button', { name: '保存並切換' }).click(); await expect(page.getByTestId('coins')).toHaveText('0'); await unlock(page); await page.getByRole('button', { name: '切換題庫：家庭自然題庫' }).click(); await page.getByRole('button', { name: '保存並切換' }).click(); await expect(page.getByTestId('coins')).toHaveText('77');
  const isolated = await browser.newContext(); const second = await isolated.newPage(); try { await second.goto('http://127.0.0.1:4173/'); await unlock(second); await second.getByLabel('匯入題庫', { exact: true }).setInputFiles({ name: 'exported.json', mimeType: 'application/json', buffer: Buffer.from(packRaw) }); await second.getByRole('button', { name: '確認加入', exact: true }).click(); await second.getByRole('button', { name: '切換題庫：家庭自然題庫' }).click(); await second.getByRole('button', { name: '保存並切換' }).click(); await second.getByRole('button', { name: '開始冒險' }).click(); await second.getByRole('button', { name: /植物構造與功能/ }).click(); await expect(second.getByRole('region', { name: '答題挑戰' })).toBeVisible(); await expect(second.locator('canvas')).toBeVisible(); await expect(second.getByTestId('coins')).toHaveText('0'); } finally { await isolated.close(); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
