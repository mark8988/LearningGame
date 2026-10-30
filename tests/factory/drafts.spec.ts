import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { playFactoryPack } from './play-pack';

test('國中教材產生混合草稿、人工審核、版本及來源失效', async ({ page, browser }, info) => {
  test.setTimeout(900000);
  const models = await page.request.get('/api/generation/models').then(r => r.json());
  test.skip(!models.models.some((m: { label: string }) => m.label.includes('Qwen')), '需啟動本機 Qwen；教材不會傳至雲端。');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const title = `國中理化混合題型-${info.project.name}-${Date.now()}`;
  await page.goto('/'); await page.getByLabel('選擇教材檔案').setInputFiles(resolve('.local/factory-fixtures/course-junior.pdf')); await page.getByLabel('教材名稱').fill(title); await page.getByRole('button', { name: '上傳並開始整理' }).click();
  await expect(page.locator('.factory-document')).toContainText('擷取與歸類完成', { timeout: 30000 });
  await expect(page.getByLabel('年級', { exact: true })).toHaveValue('8'); await expect(page.getByLabel('科目', { exact: true })).toHaveValue('自然科學');
  await expect(page.locator('.generation-plan')).toContainText('候選知識點');
  const docs = await page.request.get('/api/documents').then(r => r.json()); const docId = docs.find((d: { title: string }) => d.title === title).id;
  const shortPlan = await page.request.get(`/api/documents/${docId}/question-plan?unitIndex=0`).then(r => r.json());
  const complexPlan = await page.request.get(`/api/documents/${docId}/question-plan?unitIndex=1`).then(r => r.json());
  expect(shortPlan.canGenerate).toBe(false); expect(shortPlan.targetQuestionCount).toBe(20);
  await expect(page.getByRole('button', { name: '產生新批次草稿' })).toBeDisabled();
  // The endpoint also rejects unsupported minimums when the caller bypasses the UI.
  const source = await page.request.get(`/api/documents/${docId}`).then(r => r.json());
  const rejectedCurrent = await page.request.post(`/api/documents/${docId}/batches`, { data: { revision: source.revision, unitIndex: 0, model: models.models[0] } }); expect(rejectedCurrent.status()).toBe(400); expect((await rejectedCurrent.json()).error).toContain('至少 20 題');
  const largerPlan = await page.request.get(`/api/documents/${docId}/question-plan?unitIndex=2`).then(r => r.json());
  expect(largerPlan.questionCount).toBeGreaterThan(complexPlan.questionCount); expect(complexPlan.questionCount).toBeGreaterThanOrEqual(20);
  await page.getByLabel('產題單元').selectOption('1'); await expect(page.locator('.generation-plan')).toContainText(`預估 ${complexPlan.questionCount} 題`);
  await expect(page.getByRole('button', { name: '產生新批次草稿' })).toBeEnabled(); await page.getByRole('button', { name: '產生新批次草稿' }).click();
  const documents = await page.request.get('/api/documents').then(r => r.json()); const document = documents.find((d: { title: string }) => d.title === title);
  const batches = await page.request.get(`/api/documents/${document.id}/batches`).then(r => r.json()); const id = batches[0].id;
  const get = () => page.request.get(`/api/batches/${id}`).then(r => r.json());
  await expect.poll(async () => ['review', 'failed', 'stale', 'cancelled'].includes((await get()).status), { timeout: 600000 }).toBe(true);
  let batch = await get();
  for (let retry = 0; retry < 2 && batch.status === 'failed' && !batch.sourceError; retry++) {
    info.annotations.push({ type: 'model-retry', description: batch.error });
    await expect.poll(async () => (await page.request.post(`/api/batches/${id}/retry`, { data: {} })).status(), { timeout: 5000 }).toBe(202);
    await expect.poll(async () => ['review', 'failed', 'stale', 'cancelled'].includes((await get()).status), { timeout: 600000 }).toBe(true); batch = await get();
  }
  expect(batch.status, batch.error ?? '').toBe('review'); expect(batch.plan.questionCount).toBe(complexPlan.questionCount); expect(batch.questions.length + batch.skippedQuestions.length).toBe(complexPlan.questionCount); expect(batch.questions.length).toBeGreaterThanOrEqual(20); expect(batch.questions.filter((q: { content: { type: string } }) => q.content.type === 'fillBlank').length).toBeGreaterThan(0); expect(batch.entries).toHaveLength(batch.plan.entryCount); expect(batch.canRelease).toBe(false);
  expect((await page.request.get(`/api/batches/${id}/approved`)).status()).toBe(400);
  const blank = batch.questions.find((q: { content: { type: string } }) => q.content.type === 'fillBlank');
  await page.getByRole('tab', { name: `第 ${blank.slot + 1} 題`, exact: false }).click(); await expect(page.getByLabel('草稿可接受答案')).toBeVisible(); await expect(page.getByLabel('草稿來源摘錄')).not.toBeEmpty();
  await page.getByRole('button', { name: '核准這題', exact: true }).click(); await expect(page.locator('.draft-editor-heading')).toContainText('已核准');
  const explanation = page.getByLabel('草稿解析'); await explanation.fill((await explanation.inputValue()) + '請對照教材確認。'); await page.getByRole('button', { name: '保存修改並改回待審' }).click(); await expect(page.locator('.draft-editor-heading')).toContainText('待審核');
  await page.getByLabel('審核意見').fill('補充可接受答案'); await page.getByRole('button', { name: '退回並保留原因' }).click(); await expect(page.locator('.draft-editor-heading')).toContainText('已退回');
  // API performs the same revision-checked review actions for the remaining items.
  const approve = async (kind: string, item: { id: string; revision: number }) => { const response = await page.request.post(`/api/batches/${id}/${kind}/${item.id}/review`, { data: { revision: item.revision, action: 'approve' } }); expect(response.ok()).toBe(true); };
  batch = await get(); for (const q of batch.questions) await approve('questions', q); for (const e of batch.entries.slice(0, 2)) await approve('entries', e);
  batch = await get(); expect(batch.canRelease).toBe(true); const exported = await page.request.get(`/api/batches/${id}/approved`).then(r => r.json()); expect(exported.format).toBe('learning-adventure:approved-drafts'); expect(exported.questions).toHaveLength(batch.questions.length); expect(exported.entries).toHaveLength(2);
  const packaging = page.getByRole('region', { name: '正式題庫打包' });
  await expect(packaging.getByRole('checkbox').first()).toBeEnabled(); await packaging.getByRole('checkbox').first().check();
  await packaging.getByLabel('正式題庫名稱').fill(`CF-C測量題庫-${info.project.name}-${Date.now()}`);
  await packaging.getByRole('button', { name: '打包所選單元', exact: true }).click(); await expect(packaging.getByRole('status')).toContainText('遊戲題庫已建立');
  const record = (await page.request.get(`/api/documents/${document.id}/packages`).then(r => r.json()))[0];
  const downloadPromise = page.waitForEvent('download'); await packaging.getByRole('button', { name: '下載遊戲題庫 JSON', exact: true }).first().click(); const download = await downloadPromise;
  const packageFile = resolve(`.local/cfc-game-${info.project.name}-${Date.now()}.json`); await download.saveAs(packageFile);
  await playFactoryPack(browser, packageFile, info);
  const target = batch.questions.find((q: { id: string }) => q.id === blank.id); const other = batch.questions.find((q: { id: string }) => q.id !== target.id);
  const regeneration = await page.request.post(`/api/batches/${id}/questions/${target.id}/regenerate`, { data: { revision: target.revision, instruction: '保留填空題型，以教材原文重新命題' } }); expect(regeneration.status()).toBe(202);
  await expect.poll(async () => (await get()).status, { timeout: 360000 }).toBe('review'); batch = await get();
  expect(batch.questions.find((q: { id: string }) => q.id === target.id).status).toBe('draft'); expect(batch.questions.find((q: { id: string }) => q.id === target.id).versions).toBeGreaterThan(3); expect(batch.questions.find((q: { id: string }) => q.id === other.id).status).toBe('approved'); expect((await page.request.get(`/api/batches/${id}/approved`)).status()).toBe(400);
  expect((await page.request.get(`/api/packages/${record.id}/download`)).status()).toBe(400);
  await page.screenshot({ path: `.local/cfc-draft-review-${info.project.name}-${Date.now()}.png`, fullPage: true });
  const doc = await page.request.get(`/api/documents/${document.id}`).then(r => r.json());
  const response = await page.request.post(`/api/documents/${document.id}/confirm`, { data: { revision: doc.revision, metadata: { school: '國中', grade: 9, subject: '自然科學', publisher: '自編', units: doc.units } } }); expect(response.ok()).toBe(true);
  batch = await get(); expect(batch.sourceError).toContain('已變更'); expect((await page.request.post(`/api/batches/${id}/questions/${target.id}/review`, { data: { revision: target.revision, action: 'approve' } })).status()).toBe(400);
  expect(errors).toEqual([]);
});
