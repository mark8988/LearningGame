import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('勾選不同模型並排預覽、查看出處並人工選用模型', async ({ page }, info) => {
  const models = [{ provider: 'llamaCpp', model: 'test-model-a', label: '測試模型甲' }, { provider: 'ollama', model: 'test-model-b', label: '測試模型乙' }];
  const previews: object[] = []; let formalStarts = 0;
  page.on('request', request => { if (/\/batches$/.test(request.url()) && request.method() === 'POST') formalStarts++; });
  await page.route('**/api/generation/models', route => route.fulfill({ json: { models, localOnly: true } }));
  await page.route('**/api/documents/*/model-previews*', async route => {
    if (route.request().method() === 'GET') { await route.fulfill({ json: previews }); return; }
    const input = route.request().postDataJSON(); const label = models.find(m => m.model === input.model.model)!.label;
    const sourceRef = { documentId: 'test-document', pageNumber: 3, quote: '質量可使用天平測量，常用單位為公克。' };
    const batch = { id: input.model.model, unitIndex: 0, unitName: '測量', model: input.model, isPreview: true, generationStartedAt: '2026-10-27T00:00:00Z', generationCompletedAt: '2026-10-27T00:00:03Z', status: 'review', message: '模型預覽已完成，請人工對照判斷', sourceError: null, error: null, skippedQuestions: [], plan: { targets: [{ slot: 0, pointIndex: 0, intent: '理解核心概念' }, { slot: 1, pointIndex: 1, intent: '原文重點回想' }] }, questions: [
      { id: 'choice', slot: 0, errors: [], content: { type: 'choice', stem: `${label}：測量質量應使用哪一種器材？`, options: ['天平', '量筒', '溫度計', '直尺'], answerIndex: 0, explanation: `${label}的解析：天平可測量質量。`, sourceRef } },
      { id: 'blank', slot: 1, errors: [], content: { type: 'fillBlank', stem: `${label}：液體體積可使用 ___ 測量。`, options: [], answerIndex: 0, acceptedAnswers: ['量筒'], explanation: '量筒可用於測量液體的體積。', sourceRef } },
    ] };
    previews.unshift(batch); await route.fulfill({ status: 202, json: batch });
  });
  await page.goto('/'); await page.getByLabel('選擇教材檔案').setInputFiles(resolve('.local/factory-fixtures/course-junior.pdf')); await page.getByLabel('教材名稱').fill(`多模型介面-${info.project.name}-${Date.now()}`); await page.getByRole('button', { name: '上傳並開始整理' }).click();
  await expect(page.locator('.factory-document')).toContainText('擷取與歸類完成', { timeout: 30000 });
  const panel = page.getByRole('region', { name: '不同模型試題預覽' }); await expect(panel.getByRole('checkbox', { name: /測試模型甲/ })).toBeChecked(); await panel.getByRole('checkbox', { name: /測試模型乙/ }).check();
  await panel.getByRole('button', { name: '產生所選模型預覽（各 2 題）' }).click();
  const a = panel.getByRole('article', { name: '模型預覽：測試模型甲' }); const b = panel.getByRole('article', { name: '模型預覽：測試模型乙' });
  await expect(a).toContainText('測試模型甲的解析'); await expect(b).toContainText('測試模型乙的解析'); await expect(a).toContainText('候選知識點 1'); await expect(b).toContainText('本次運算 3.0 秒');
  await b.getByRole('button', { name: '選用此模型產生題庫' }).click(); await expect(page.getByLabel('產題模型')).toHaveValue('1'); expect(formalStarts).toBe(0);
  await b.locator('summary').first().click(); await b.getByRole('button', { name: '對照教材頁面' }).first().click(); await expect(page.getByLabel('查看教材頁面')).toHaveValue('3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `.local/model-preview-${info.project.name}.png`, fullPage: true });
});
