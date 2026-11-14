// Mở Chrome headless (dùng Chrome có sẵn trên máy / runner CI) và server tĩnh cho trang Kho từ của extension.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { EXT_DIR } = require('./env');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p)) || null;

async function launch() {
  const puppeteer = require('puppeteer-core');
  return puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: process.env.CI ? ['--no-sandbox'] : []
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const contentType = (file) => TYPES[path.extname(file)] || 'application/octet-stream';

// CSP mặc định của trang extension Manifest V3 (bắt script nội tuyến / nguồn ngoài như khi chạy thật),
// thêm style-src 'self' để giữ quy ước của trang Kho từ: không dùng style nội tuyến.
const EXTENSION_CSP = "script-src 'self'; object-src 'self'; style-src 'self'";

// Server tĩnh phục vụ thư mục extension/ (trang Kho từ chạy như trang web thường, kèm pageShim()).
function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(EXT_DIR, urlPath === '/' ? 'review.html' : urlPath);
    if (!file.startsWith(EXT_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': contentType(file), 'content-security-policy': EXTENSION_CSP });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }))
  );
}

// Mã giả lập chrome.* cho trang Kho từ – nạp bằng page.evaluateOnNewDocument(pageShim())
const pageShim = () => fs.readFileSync(path.join(__dirname, 'page-shim.js'), 'utf8');

const readExtensionFile = (name) => fs.readFileSync(path.join(EXT_DIR, name));

module.exports = { chromePath, launch, startStaticServer, pageShim, readExtensionFile, contentType };
