import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
const fixture = (name: string) => resolve('.local/factory-fixtures', name);
async function upload(page: Page, title: string, file: string) {
  await page.goto('/'); await page.getByLabel('選擇教材檔案').setInputFiles(fixture(file)); await page.getByLabel('教材名稱').fill(title); await page.getByRole('button', { name: '上傳並開始整理' }).click();
  await expect(page.locator('.factory-document')).toContainText(title, { timeout: 15000 });
  await expect(page.locator('.factory-document')).toContainText(/擷取與歸類完成|待家長確認|需要補頁|處理未完成/, { timeout: 120000 });
}
test('電子 PDF 文字、頁碼、歸類確認及重新開啟保留', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const title = `自然電子教材-${info.project.name}-${Date.now()}`; await upload(page, title, 'case-3-text.pdf');
  await expect(page.locator('.factory-document')).toContainText('擷取與歸類完成'); await expect(page.getByLabel('學制', { exact: true })).toHaveValue('國小'); await expect(page.getByLabel('年級', { exact: true })).toHaveValue('3'); await expect(page.getByLabel('科目', { exact: true })).toHaveValue('自然科學');
  await page.getByLabel('查看教材頁面').selectOption('3'); await expect(page.locator('.factory-page-text')).toContainText('第一單元'); await expect(page.locator('.factory-page-info')).toContainText('PDF 文字層');
  await page.getByRole('button', { name: '確認歸類與單元' }).click(); await expect(page.getByText('家長已確認', { exact: true })).toBeVisible();
  await page.screenshot({ path: `.local/factory-text-${info.project.name}.png`, fullPage: true });
  await page.reload(); await page.getByRole('navigation', { name: '教材清單' }).getByRole('button').filter({ hasText: title }).click(); await expect(page.getByText('家長已確認', { exact: true })).toBeVisible();
  await page.getByLabel('查看教材頁面').selectOption('3'); await page.getByLabel('補傳第 3 頁圖片').setInputFiles(fixture('case-3-page-3.png'));
  await expect(page.locator('.factory-document')).toContainText('需要補頁'); await expect(page.getByText('家長已確認', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});
test('缺少課程單元時停在家長確認，修正後才能完成', async ({ page }, info) => {
  await upload(page, `家庭觀察講義-${info.project.name}-${Date.now()}`, 'ambiguous.pdf');
  await expect(page.locator('.factory-document')).toContainText('待家長確認'); await expect(page.getByLabel('單元 1 名稱')).toHaveValue('待確認單元 1');
  await page.getByLabel('學制', { exact: true }).selectOption('國小'); await page.getByLabel('年級', { exact: true }).selectOption('3'); await page.getByLabel('科目', { exact: true }).selectOption('自然科學');
  await page.getByLabel('單元 1 名稱').fill('植物的日常觀察'); await page.getByRole('button', { name: '確認歸類與單元' }).click(); await expect(page.locator('.factory-document')).toContainText('家長已確認歸類與單元頁碼');
  await page.screenshot({ path: `.local/factory-review-${info.project.name}.png`, fullPage: true }); expect((await page.request.post('/api/generate')).status()).toBe(404);
});
test('掃描 PDF 封面失敗必須補頁，再以真實本機 OCR 處理', async ({ page }, info) => {
  await upload(page, `掃描補頁教材-${info.project.name}-${Date.now()}`, 'missing-cover.pdf');
  await expect(page.locator('.factory-document')).toContainText('需要補頁'); await expect(page.getByLabel('學制', { exact: true })).toHaveCount(0); await expect(page.locator('.factory-page-text')).toContainText('尚未擷取到可讀文字');
  await page.getByLabel('補傳第 1 頁圖片').setInputFiles(fixture('replacement-cover.png')); await expect(page.locator('.factory-document')).toContainText('補傳已保存');
  await page.getByRole('button', { name: '重新擷取與歸類' }).click(); await expect(page.locator('.factory-document')).toContainText('待家長確認', { timeout: 120000 });
  await expect(page.locator('.factory-page-text')).toContainText('年級'); await expect(page.getByLabel('科目', { exact: true })).toHaveValue('自然科學');
  await page.getByLabel('查看教材頁面').selectOption('3'); await expect(page.locator('.factory-page-info')).toContainText('OCR');
  await page.screenshot({ path: `.local/factory-scan-${info.project.name}.png`, fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('拒絕副檔名偽裝與跨網站寫入', async ({ page }, info) => {
  await page.goto('/'); await page.getByLabel('選擇教材檔案').setInputFiles({ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') }); await page.getByLabel('教材名稱').fill(`偽裝-${info.project.name}`); await page.getByRole('button', { name: '上傳並開始整理' }).click(); await expect(page.getByRole('alert')).toContainText('副檔名不符');
  const response = await page.request.post('/api/documents', { headers: { Origin: 'https://external.invalid' }, multipart: { title: 'external', coverPage: '1', tocPage: '2', files: { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('fake') } } }); expect(response.status()).toBe(403);
});
test('EPUB 依 spine 保留閱讀順序、書籍資訊與兩個單元', async ({ page }, info) => {
  await upload(page, `EPUB 教材-${info.project.name}-${Date.now()}`, 'demo.epub'); await expect(page.locator('.factory-document')).toContainText('擷取與歸類完成');
  await expect(page.getByLabel('年級', { exact: true })).toHaveValue('3'); await expect(page.getByLabel('單元 1 名稱')).toHaveValue('第一單元植物的祕密'); await expect(page.getByLabel('單元 2 名稱')).toHaveValue('第二單元動物觀察');
  await page.getByLabel('查看教材頁面').selectOption('3'); await expect(page.locator('.factory-page-text')).toContainText('根吸收水分'); await expect(page.locator('.factory-page-info')).toContainText('OPS/a.xhtml');
  await page.getByLabel('查看教材頁面').selectOption('4'); await expect(page.locator('.factory-page-text')).toContainText('鳥類');
});
