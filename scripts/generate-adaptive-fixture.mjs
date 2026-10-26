import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('.local/factory-fixtures'); await mkdir(directory, { recursive: true });
const pages = [
  ['國中八年級 理化', '自編測量講義：動態題量測試', '比較簡短基礎單元與包含計算、比較及推論的單元；測試後保留教材。'],
  ['目錄', '第一單元 基本測量 …… 3', '第二單元 密度與比較 …… 4'],
  ['第一單元 基本測量', '金屬的質量可以用天平測量，常用單位為公克。', '液體的體積可以使用量筒測量，常用單位為毫升。'],
  ['第二單元 密度與比較', '密度等於質量除以體積，計算時必須注意單位一致。', '若比較同種物質的不同樣本，應控制測量的條件，才能推論密度是否相同。'],
];
async function keep(name, data) { try { await writeFile(resolve(directory, name), data, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
await keep('adaptive-junior-source.txt', pages.map((p, i) => `第 ${i + 1} 頁\n${p.join('\n')}`).join('\n\n'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); await page.setContent(`<style>@page{size:A4;margin:0}body{margin:0;font-family:'Microsoft JhengHei',sans-serif}section{padding:60px;height:1123px;box-sizing:border-box;page-break-after:always}section:last-child{page-break-after:auto}h1{font-size:28px}p{font-size:22px;line-height:2}</style>` + pages.map(([title, ...text]) => `<section><h1>${title}</h1>${text.map(t => `<p>${t}</p>`).join('')}</section>`).join(''));
  await keep('adaptive-junior.pdf', await page.pdf({ format: 'A4', preferCSSPageSize: true }));
  console.log('Retained: .local/factory-fixtures/adaptive-junior.pdf (two units with different complexity)');
} finally { await browser.close(); }
