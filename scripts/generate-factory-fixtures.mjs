import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';
const output = resolve('.local/factory-fixtures'); await mkdir(output, { recursive: true });
async function saveFixture(name, data) { try { await writeFile(resolve(output, name), data, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
const epub = {
  mimetype: strToU8('application/epub+zip'),
  'META-INF/container.xml': strToU8('<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
  'OPS/book.opf': strToU8('<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">learninggame-test</dc:identifier><dc:title>國小三年級 自然 康軒 測試教材</dc:title><dc:language>zh-Hant</dc:language><dc:publisher>康軒</dc:publisher></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>'),
  'OPS/nav.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>目錄</title></head><body><nav><p>目錄</p><ol><li>第一單元 植物的祕密</li><li>第二單元 動物觀察</li></ol></nav></body></html>'),
  'OPS/a.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>植物</title></head><body><h1>第一單元 植物的祕密</h1><p>根吸收水分，葉片製造養分。</p></body></html>'),
  'OPS/b.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>動物</title></head><body><h1>第二單元 動物觀察</h1><p>觀察鳥類的羽毛與昆蟲的腳。</p></body></html>'),
};
await saveFixture('demo.epub', zipSync(epub, { level: 0 }));
const cases = [
  { title: '國小一年級 國語 翰林', school: '國小', grade: 1, subject: '國語文' },
  { title: '國小二年級 數學 南一', school: '國小', grade: 2, subject: '數學' },
  { title: '國小三年級 自然 康軒', school: '國小', grade: 3, subject: '自然科學' },
  { title: '國小四年級 社會 翰林', school: '國小', grade: 4, subject: '社會' },
  { title: '國小五年級 英語 南一', school: '國小', grade: 5, subject: '英語文' },
  { title: '國小六年級 健康與體育 康軒', school: '國小', grade: 6, subject: '健康與體育' },
  { title: '國中一年級 數學 南一', school: '國中', grade: 7, subject: '數學' },
  { title: '國中二年級 自然科學 康軒', school: '國中', grade: 8, subject: '自然科學' },
  { title: '高中一年級 歷史 三民', school: '高中', grade: 10, subject: '歷史' },
  { title: '高中二年級 化學 龍騰', school: '高中', grade: 11, subject: '化學' },
];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  const style = `<style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:white;color:black;font-family:'Microsoft JhengHei',sans-serif}section{width:794px;height:1123px;padding:95px 65px;page-break-after:always}section:last-child{page-break-after:auto}h1{font-size:44px;line-height:1.9;font-weight:500;margin:0 0 70px}h2{font-size:40px;line-height:1.8;font-weight:500}p{font-size:32px;line-height:2.2}small{font-size:22px}</style>`;
  for (let index = 0; index < cases.length; index++) {
    const entry = cases[index]; const prefix = `case-${index + 1}`;
    const sections = [
      `<h1>${entry.title.replaceAll(' ', '<br>')}</h1><p>自主學習教材<br>觀察與發現</p><small>自行撰寫的軟體測試素材，非出版教材。</small>`,
      `<h1>目錄</h1><p>第一單元 觀察與發現</p><p>學習活動與紀錄</p><p>第三頁</p>`,
      `<h2>第一單元 觀察與發現</h2><p>仔細閱讀內容，記錄自己的觀察。</p><p>把發現整理成文字，並和家人分享。</p><p>比較不同的結果，說出你的想法。</p>`,
    ];
    await page.setContent(style + sections.map(s => `<section>${s}</section>`).join('')); await saveFixture(`${prefix}-text.pdf`, await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }));
    const images = [];
    for (let i = 0; i < sections.length; i++) { await page.setContent(style + `<section>${sections[i]}</section>`); const png = await page.screenshot(); await saveFixture(`${prefix}-page-${i + 1}.png`, png); images.push(png.toString('base64')); }
    await page.setContent(`<style>@page{size:A4;margin:0}body{margin:0}img{display:block;width:210mm;height:297mm;page-break-after:always}img:last-child{page-break-after:auto}</style>` + images.map(data => `<img src="data:image/png;base64,${data}">`).join('')); await saveFixture(`${prefix}-scan.pdf`, await page.pdf({ format: 'A4', preferCSSPageSize: true }));
    entry.textPdf = `${prefix}-text.pdf`; entry.scanPdf = `${prefix}-scan.pdf`;
  }
  await page.setContent(style + ['<h1>家庭學習講義</h1><p>觀察與探索手冊</p>', '<h1>閱讀指引</h1><p>觀察、紀錄與分享</p>', '<p>看一看植物的葉子，再比較不同的形狀。</p><p>把觀察結果寫下來，與家人討論。</p>'].map(s => `<section>${s}</section>`).join('')); await saveFixture('ambiguous.pdf', await page.pdf({ format: 'A4', preferCSSPageSize: true }));
  await page.setContent(style + '<section></section>'); await saveFixture('blank.png', await page.screenshot());
  const cover = await readFile(resolve(output, 'case-3-page-1.png'));
  await page.setContent(`<style>@page{size:A4;margin:0}body{margin:0}img,.blank{display:block;width:210mm;height:297mm;page-break-after:always}</style><div class="blank"></div><img src="data:image/png;base64,${(await readFile(resolve(output, 'case-3-page-2.png'))).toString('base64')}"><img src="data:image/png;base64,${(await readFile(resolve(output, 'case-3-page-3.png'))).toString('base64')}">`); await saveFixture('missing-cover.pdf', await page.pdf({ format: 'A4', preferCSSPageSize: true }));
  await saveFixture('replacement-cover.png', cover);
  await saveFixture('cases.json', JSON.stringify(cases, null, 2));
  console.log(`Factory fixtures generated: ${cases.length} text PDFs, ${cases.length} scanned PDFs, page images and ambiguity/replacement cases in .local/factory-fixtures`);
} finally { await browser.close(); }
