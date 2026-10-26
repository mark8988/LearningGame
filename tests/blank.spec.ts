import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('國中填空題庫可進行3D戰鬥、保存錯題及填空複習', async ({ page }, info) => {
  const read = async (name: string) => JSON.parse(await readFile(resolve('content-packs/science-g3', name + '.json'), 'utf8'));
  const pack = { manifest: await read('pack'), questions: await read('questions'), units: await read('units'), items: await read('items'), outfitModels: await read('outfit-models'), dropTables: await read('drops'), encyclopedia: await read('encyclopedia'), achievements: await read('achievements') };
  pack.manifest = { ...pack.manifest, id: 'junior-blank-test', grade: 8, name: '國中八年級自然填空測試' };
  pack.questions = pack.questions.map((q: { id: string; unitId: string }) => ({ id: q.id, unitId: q.unitId, type: 'fillBlank', stem: '水的化學式是 ___。', options: [], answerIndex: 0, acceptedAnswers: ['H₂O', '水'], explanation: '水由氫與氧組成，化學式為 H₂O。', difficulty: 1 }));
  const raw = JSON.stringify({ format: 'learning-adventure:pack', version: 1, files: { 'pack.json': pack.manifest, 'questions.json': pack.questions, 'units.json': pack.units, 'items.json': pack.items, 'outfit-models.json': pack.outfitModels, 'drops.json': pack.dropTables, 'encyclopedia.json': pack.encyclopedia, 'achievements.json': pack.achievements } });
  await page.addInitScript(({ raw, id }) => {
    if (localStorage.getItem('blank-test-seeded')) return;
    localStorage.setItem('learning-adventure:library:v1', JSON.stringify([raw])); localStorage.setItem('learning-adventure:active-pack:v1', id); localStorage.setItem('blank-test-seeded', 'yes');
  }, { raw, id: pack.manifest.id });
  await page.goto('/'); await page.getByRole('button', { name: '開始冒險', exact: true }).click(); await page.getByRole('button', { name: /植物構造與功能/ }).click();
  const input = page.getByRole('textbox', { name: '填空答案' }); await expect(input).toBeVisible(); await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: '提交答案' })).toBeDisabled(); await input.fill('氧氣'); await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.locator('.blank-answer')).toContainText('參考答案：H₂O'); await expect(input).toBeDisabled(); await expect(page.getByText('進度已儲存')).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '複習小徑', exact: true }).click();
  await expect(input).toBeVisible(); await input.fill('ｈ２ｏ'); await page.getByRole('button', { name: '提交答案' }).click(); await expect(page.locator('.feedback')).toContainText('已移出錯題池');
  await page.getByRole('button', { name: '完成這次複習' }).click(); await expect(page.locator('.review-complete')).toContainText('還有 0 題');
  await page.screenshot({ path: `.local/blank-review-${info.project.name}.png`, fullPage: true });
});
