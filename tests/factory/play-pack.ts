import { expect, type Browser, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
export async function playFactoryPack(browser: Browser, file: string, info: TestInfo) {
  const raw = await readFile(file); const pack = JSON.parse(raw.toString('utf8')).files; const manifest = pack['pack.json']; const questions = pack['questions.json'];
  const context = await browser.newContext({ viewport: info.project.name === 'phone' ? { width: 390, height: 844 } : { width: 1180, height: 820 }, hasTouch: true, isMobile: info.project.name === 'phone' });
  try {
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4175/'); await page.getByRole('button', { name: '家長模式', exact: true }).click();
    const hold = page.getByRole('button', { name: '長按 1.2 秒進入' }); await hold.focus(); await page.keyboard.down('Space'); await page.waitForTimeout(1300); await page.keyboard.up('Space');
    const digits = (await page.locator('label[for="parent-answer"]').innerText()).match(/\d+/g)!.map(Number); await page.getByRole('spinbutton').fill(String(digits[0] + digits[1])); await page.getByRole('button', { name: '確認答案' }).click();
    await page.getByLabel('匯入題庫', { exact: true }).setInputFiles({ name: 'factory-package.json', mimeType: 'application/json', buffer: raw }); await page.getByRole('button', { name: '確認加入', exact: true }).click();
    await page.getByRole('button', { name: `切換題庫：${manifest.name}`, exact: true }).click(); await page.getByRole('button', { name: '保存並切換', exact: true }).click();
    await expect(page.getByText('離線遊玩已就緒')).toBeVisible({ timeout: 15000 }); await context.setOffline(true); await page.reload(); await expect(page.getByText('離線中 · 冒險照常')).toBeVisible();
    await page.getByRole('button', { name: '開始冒險', exact: true }).click(); await page.getByRole('button', { name: new RegExp(pack['units.json'][0].name) }).click(); await expect(page.getByRole('region', { name: '答題挑戰' })).toBeVisible(); await expect(page.locator('canvas')).toBeVisible();
    let rounds = 0;
    while (await page.getByRole('region', { name: '答題挑戰' }).count()) {
      const stem = await page.locator('.question-card h2').getAttribute('data-stem'); const q = questions.find((q: { stem: string }) => q.stem === stem); expect(q).toBeTruthy();
      if (q.type === 'fillBlank') { await page.getByRole('textbox', { name: '填空答案' }).fill(rounds === 0 ? '測試答錯' : q.acceptedAnswers[0]); await page.getByRole('button', { name: '提交答案' }).click(); }
      else await page.locator('.answers button').nth(rounds === 0 ? (q.answerIndex + 1) % 4 : q.answerIndex).click();
      await page.getByRole('button', { name: /繼續挑戰|看看冒險成果/ }).click(); expect(++rounds).toBeLessThanOrEqual(10);
    }
    await expect(page.getByRole('heading', { name: '挑戰成功！' })).toBeVisible(); await page.getByRole('navigation', { name: '學習導覽' }).getByRole('button', { name: '複習小徑', exact: true }).click();
    const stem = await page.locator('.question-card h2').getAttribute('data-stem'); const q = questions.find((q: { stem: string }) => q.stem === stem);
    if (q.type === 'fillBlank') { await page.getByRole('textbox', { name: '填空答案' }).fill(q.acceptedAnswers[0]); await page.getByRole('button', { name: '提交答案' }).click(); } else await page.locator('.answers button').nth(q.answerIndex).click();
    await expect(page.locator('.feedback')).toContainText('已移出錯題池'); await page.getByRole('button', { name: '完成這次複習', exact: true }).click(); await expect(page.locator('.review-complete')).toContainText('還有 0 題'); await expect(page.getByText('進度已儲存')).toBeVisible();
    const state = await page.evaluate(id => JSON.parse(localStorage.getItem('learning-adventure:save:v1:pack:' + encodeURIComponent(id))!), manifest.id); expect(state.contentPackId).toBe(manifest.id); expect(state.clearedUnitIds).toContain(pack['units.json'][0].id); expect(state.wrongQuestionIds).toEqual([]);
    await page.reload(); await expect(page.locator('canvas')).toBeVisible(); await expect(page.getByText('離線中 · 冒險照常')).toBeVisible(); expect(errors).toEqual([]);
    await page.screenshot({ path: `.local/cfc-offline-game-${info.project.name}-${Date.now()}.png`, fullPage: true });
  } finally { await context.close(); }
}
