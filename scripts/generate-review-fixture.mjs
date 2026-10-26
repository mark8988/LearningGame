import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('.local/factory-fixtures'); await mkdir(directory, { recursive: true });
const pages = [
  { title: '國小三年級 自然科學', text: ['植物的生長與觀察', '自製產題測試教材', '本教材由開發測試自行撰寫，供檢查來源引用與審核流程。'] },
  { title: '目錄', text: ['第一單元 植物的生長與觀察 …… 3', '植物構造與功能 …… 3', '種子發芽與公平實驗 …… 4', '觀察工具與紀錄 …… 5'] },
  { title: '第一單元 植物的生長與觀察', text: ['根能吸收土壤中的水分與礦物質，並將植物固定在土壤中。根吸收的礦物質和葉片製造的養分並不相同，不能把土壤當作植物全部的食物來源。', '莖能支撐植物，並把根吸收的水分運送到葉片。葉片利用陽光、水和二氧化碳進行光合作用，製造植物生長所需的養分。葉片不是從土壤直接取得現成養分。', '花通常與植物的繁殖有關，經過授粉後，有些花會發育成果實。果實能保護種子，有些果實也能幫助種子傳播。植物的根、莖、葉各有功能，彼此配合才能維持生長。', '植物缺水時，葉片可能下垂萎軟。這是觀察缺水現象的線索，但不能只看到一片葉子就斷定所有生長問題都來自缺水，還要記錄環境與其他變化。'] },
  { title: '種子發芽與公平實驗', text: ['大多數種子發芽需要水分、空氣和適合的溫度。不同植物適合的溫度可能不同，種子是否發芽不能只根據有沒有陽光判斷。過多的水可能使種子缺少空氣，因此澆水越多不代表越容易發芽。', '蒲公英的果實有像降落傘的冠毛，容易隨風傳播。比較種子的傳播方式時，可以觀察外形特徵並記錄，不要只根據顏色或大小猜測。', '想比較澆水量對幼苗生長的影響，可以準備相同種類、大小相近的幼苗。兩組幼苗的土壤、光照、花盆與觀察天數都保持相同，只改變澆水量，才是公平的比較。', '實驗前先寫下想知道的問題，過程中固定時間觀察，並將日期、澆水量和植株高度記錄在表格中。結果與原先預想不同時，應保留實際紀錄，不能改動數字來配合原先想法。'] },
  { title: '觀察工具與紀錄', text: ['放大鏡能放大細部，適合觀察葉脈的形狀；溫度計用來測量溫度，不能代替放大鏡。使用工具前先確認它能測量或觀察什麼，再選擇合適的工具。', '比較兩片葉子時，可以記錄葉片形狀、邊緣和葉脈的特徵。拍照或畫圖能協助之後比對，單憑記憶容易忽略小差異。觀察時要避免任意折斷樹枝或拔起整株植物。', '測量植株高度時，應使用相同的起點、相同的工具和相同的單位。若今天從土面量到頂端，明天卻從花盆底部開始量，兩次數字就不能直接公平比較。', '完整的觀察紀錄可以包含日期、天氣、測量數字、圖片和文字說明。把實際看到的現象和自己的推測分開寫，能讓別人更清楚了解觀察結果，也比較容易找出還需要查證的問題。'] },
];
async function keep(name, data) { try { await writeFile(resolve(directory, name), data, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
await keep('generation-plant-source.txt', pages.map((p, i) => `第 ${i + 1} 頁\n${p.title}\n${p.text.join('\n')}`).join('\n\n'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); await page.setContent(`<style>@page{size:A4;margin:0}body{margin:0;font-family:'Microsoft JhengHei',sans-serif}section{padding:55px 62px;height:1123px;box-sizing:border-box;page-break-after:always}section:last-child{page-break-after:auto}h1{font-size:29px;line-height:1.6}p{font-size:20px;line-height:1.9;margin:14px 0}</style>` + pages.map(p => `<section><h1>${p.title}</h1>${p.text.map(t => `<p>${t}</p>`).join('')}</section>`).join(''));
  await keep('generation-plant.pdf', await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }));
  console.log('CF-B source fixture retained: .local/factory-fixtures/generation-plant.pdf');
} finally { await browser.close(); }
