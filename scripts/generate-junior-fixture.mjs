import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('.local/factory-fixtures'); await mkdir(directory, { recursive: true });
const pages = [
  ['國中八年級 理化', '物質的測量與科學探究', '自編測試教材，供檢查國中教材歸類、選擇題及填空題生成。'],
  ['目錄', '第一單元 物質的測量與科學探究 …… 3', '質量、體積與密度 …… 3', '溫度與熱的傳遞 …… 4', '實驗設計與測量紀錄 …… 5'],
  ['第一單元 物質的測量與科學探究', '質量是物體所含物質的量，實驗室可用天平測量質量，常用單位為公克。體積是物體所佔的空間，液體體積可用量筒測量，常用單位為毫升。一毫升等於一立方公分。', '密度是單位體積的質量，計算式為密度＝質量÷體積。例如質量五十四公克、體積二十立方公分的物體，密度為每立方公分二點七公克。比較密度時，質量及體積的單位必須一致。', '同種均勻物質在相同條件下，取樣大小不同，密度仍相同。把一塊均勻金屬切成兩半，質量和體積都變成原來的一半，密度不會因此減半。不能只憑物體重就判斷密度較大。', '不溶於水且能完全浸沒的不規則固體，可利用排水法測量體積。放入前量筒水量三十毫升，完全浸沒後為四十二毫升，固體體積就是十二立方公分。若物體溶解或吸水，就不適合直接使用這個方法。'],
  ['溫度與熱的傳遞', '溫度表示物體冷熱的程度，可用溫度計測量。熱是因溫度差而傳遞的能量，熱量與溫度是不同的量，不能把攝氏度當作熱量的單位。', '熱會自發地由高溫處傳向低溫處，直到達到熱平衡。把熱水與冷水接觸，能量由熱水傳向冷水；達到相同溫度後，兩者不再因溫度差而有淨熱傳遞。', '熱傳遞的方式有傳導、對流與輻射。金屬湯匙的一端接觸熱湯後，另一端逐漸變熱，主要是傳導。水受熱時，流體移動造成熱的傳遞，屬於對流。太陽的能量能通過太空抵達地球，屬於輻射。', '多數物質受熱會膨脹，冷卻會收縮。測量溫度時，溫度計應與待測物充分接觸並等待讀值穩定，不能只把手感當成準確的溫度測量。'],
  ['實驗設計與測量紀錄', '想研究水量是否影響加熱後的溫度變化，操縱變因是水量，應變變因是溫度變化。水的初溫、容器材質、加熱功率及加熱時間應保持相同，這些屬於控制變因。一次改變多項條件，就難以判斷結果由哪個因素造成。', '讀取量筒水面時，眼睛應與凹液面的最低處等高，避免視差。測量之前應確認器材的單位與最小刻度，紀錄時須附上單位，不能只寫一個沒有意義的數字。', '同一條件下重複測量，可以了解測量結果的穩定程度。若數值明顯異常，應保留原始紀錄，檢查操作及器材，再說明是否需要重測，不能為了配合預想而偷偷更改數字。', '繪製實驗結果圖時，橫軸通常放操縱變因，縱軸放應變變因，並標示名稱、單位及適當刻度。結論應依據實際資料，清楚區分觀察到的事實與仍待查證的推論。'],
];
async function keep(name, data) { try { await writeFile(resolve(directory, name), data, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
await keep('generation-junior-source.txt', pages.map((p, i) => `第 ${i + 1} 頁\n${p.join('\n')}`).join('\n\n'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); await page.setContent(`<style>@page{size:A4;margin:0}body{margin:0;font-family:'Microsoft JhengHei',sans-serif}section{padding:50px 60px;height:1123px;box-sizing:border-box;page-break-after:always}section:last-child{page-break-after:auto}h1{font-size:28px;line-height:1.6}p{font-size:19px;line-height:1.85;margin:14px 0}</style>` + pages.map(([title, ...text]) => `<section><h1>${title}</h1>${text.map(t => `<p>${t}</p>`).join('')}</section>`).join(''));
  await keep('generation-junior.pdf', await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }));
  console.log('Retained junior-high fixture: .local/factory-fixtures/generation-junior.pdf');
} finally { await browser.close(); }
