// Mở Chrome headless (dùng Chrome có sẵn trên máy / runner CI) và server tĩnh giống Vercel.
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
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

const contentType = (file) => TYPES[path.extname(file)] || 'application/octet-stream';

// Áp dụng rewrites + headers trong extension/vercel.json như Vercel
function vercelRules() {
  const config = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'vercel.json'), 'utf8'));
  const toRe = (source) => new RegExp('^' + source.replace(/[.]/g, '\\.').replace('(.*)', '(.*)') + '$');
  return {
    rewrite: (p) => config.rewrites.find((r) => toRe(r.source).test(p))?.destination || p,
    headers: (p) =>
      Object.assign({}, ...config.headers.filter((h) => toRe(h.source).test(p)).flatMap((h) => h.headers.map((x) => ({ [x.key]: x.value }))))
  };
}

function startStaticServer() {
  const rules = vercelRules();
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(EXT_DIR, rules.rewrite(urlPath));
    if (!file.startsWith(EXT_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': contentType(file), ...rules.headers(urlPath) });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }))
  );
}

const readExtensionFile = (name) => fs.readFileSync(path.join(EXT_DIR, name));

module.exports = { chromePath, launch, startStaticServer, readExtensionFile, contentType };
