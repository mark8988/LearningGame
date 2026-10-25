import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); const directory = new URL('../public/icons/', import.meta.url); await mkdir(directory, { recursive: true });
  for (const size of [192, 512]) {
    const data = await page.evaluate(async size => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#315b43"/><path d="M250 364V228M250 294C172 294 147 261 145 218C212 211 251 241 250 294M251 251C252 171 294 143 355 146C355 206 320 247 251 251" stroke="#f4edce" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M190 368h125" stroke="#d6b76d" stroke-width="15" stroke-linecap="round"/></svg>`;
      const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; canvas.getContext('2d').drawImage(image, 0, 0, size, size); return canvas.toDataURL('image/png').split(',')[1];
    }, size);
    await writeFile(new URL(`icon-${size}.png`, directory), Buffer.from(data, 'base64'));
  }
} finally { await browser.close(); }
