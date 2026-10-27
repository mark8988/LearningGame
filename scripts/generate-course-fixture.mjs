import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('.local/factory-fixtures'); await mkdir(directory, { recursive: true });
const pages = [
  ['國中八年級 理化', '自編課程測試：測量與科學探究', '本教材供產題流程驗證，非出版課本，測試後保留。'],
  ['目錄', '第一單元 簡短測量摘要 …… 3', '第二單元 測量基礎 …… 4', '第三單元 密度與實驗探究 …… 6'],
  ['第一單元 簡短測量摘要', '質量可使用天平測量，常用單位為公克。', '體積可使用量筒測量，常用單位為毫升。'],
  ['第二單元 測量基礎', '質量表示物體所含物質的量，常用單位為公克。', '天平用來測量物體的質量，讀取數值時應註明單位。', '體積表示物體占有的空間，常用單位為立方公分。', '量筒用來測量液體體積，常用的容積單位為毫升。', '一毫升的體積等於一立方公分，兩種單位可互相換算。'],
  ['測量基礎：觀察與紀錄', '量筒裝水時會形成凹液面，讀數以凹液面最低處為準。', '讀取量筒刻度時，眼睛應與液面最低處等高，以避免視差。', '溫度表示物體冷熱的程度，可使用溫度計測量。', '在台灣，溫度常以攝氏度表示，刻度符號為°C。', '完整的測量紀錄應寫出測量數值、單位及使用的器材。'],
  ['第三單元 密度與實驗探究', '密度等於質量除以體積，計算時必須注意單位一致。', '若比較同種物質的不同樣本，應控制測量的條件，才能推論密度是否相同。', '若使用排水法測量固體體積，應先確認固體不溶於水，再比較放入前後的水位。', '設計水量與溫度變化的實驗時，應控制水的初溫及加熱時間，因此才能比較水量的影響。', '若要比較不同材料傳熱的快慢，應使用長度相同的材料進行實驗，控制加熱方式及時間。'],
  ['實驗探究：變因與資料', '計算密度時，若質量與體積各增為兩倍，其比值仍相同，因此密度不會隨取樣大小而增加。', '若實驗同時改變水量與加熱功率，就無法推論溫度變化由哪項變因造成，因此應分開控制。', '若重複實驗出現差異，應比較操作條件與原始紀錄，不能修改數據來配合預想。', '分析實驗資料時，應先比較測量條件，再依觀察到的數據提出推論，並說明限制。', '若要驗證預測，應設計可重複的實驗並保留測量紀錄，因此其他人才能比較結果。'],
];
async function keep(name, data) { try { await writeFile(resolve(directory, name), data, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
await keep('course-junior-source.txt', pages.map((p, i) => `第 ${i + 1} 頁\n${p.join('\n')}`).join('\n\n'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); await page.setContent(`<style>@page{size:A4;margin:0}body{margin:0;font-family:'Microsoft JhengHei',sans-serif}section{padding:55px 60px;height:1123px;box-sizing:border-box;page-break-after:always}section:last-child{page-break-after:auto}h1{font-size:28px}p{font-size:21px;line-height:1.9;margin:18px 0}</style>` + pages.map(([title, ...text]) => `<section><h1>${title}</h1>${text.map(t => `<p>${t}</p>`).join('')}</section>`).join(''));
  await keep('course-junior.pdf', await page.pdf({ format: 'A4', preferCSSPageSize: true })); console.log('Retained: .local/factory-fixtures/course-junior.pdf');
} finally { await browser.close(); }
