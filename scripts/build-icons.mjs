// Tạo icon app (SVG + PNG) từ linh vật trong src/components/mascot.js. Cần Chrome (dùng puppeteer-core).
//   node scripts/build-icons.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { MASCOT_SVG } from '../src/components/mascot.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const BG = '#fff6ee';
const svg = (bg, inset) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${bg}<g transform="translate(${inset} ${inset}) scale(${(128 - 2 * inset) / 64})">${MASCOT_SVG}</g></svg>\n`;
const icon = svg(`<rect x="4" y="4" width="120" height="120" rx="30" fill="${BG}"/>`, 14);
const maskable = svg(`<rect width="128" height="128" fill="${BG}"/>`, 24);
writeFileSync(join(dir, 'icon.svg'), icon);
writeFileSync(join(dir, 'icon-maskable.svg'), maskable);

const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
for (const [src, out, size, transparent] of [
  [icon, 'icon-192.png', 192, true],
  [icon, 'icon-512.png', 512, true],
  [svg(`<rect width="128" height="128" fill="${BG}"/>`, 14), 'apple-touch-icon.png', 180, false],
  [maskable, 'icon-maskable-512.png', 512, false],
]) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: join(dir, out), omitBackground: transparent });
}
await browser.close();
console.log('Đã tạo icon trong public/icons');
