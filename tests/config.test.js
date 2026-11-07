// App và extension dùng chung một project Supabase và cùng dữ liệu CEFR – hai bản phải khớp nhau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase.config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('extension/config.js trỏ cùng project Supabase với app (supabase.config.js)', () => {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(join(root, 'extension', 'config.js'), 'utf8'), sandbox);
  assert.equal(sandbox.VEL_CONFIG.supabaseUrl, SUPABASE_URL);
  assert.equal(sandbox.VEL_CONFIG.supabaseAnonKey, SUPABASE_ANON_KEY);
});

test('dữ liệu CEFR của extension và app giống nhau (npm run data:cefr ghi cả hai)', () => {
  for (const f of ['cefr-j.json', 'cefr-c1c2.json']) {
    assert.ok(
      readFileSync(join(root, 'extension', 'data', f)).equals(readFileSync(join(root, 'public', 'data', 'en', f))),
      `${f} khác nhau giữa extension/data và public/data/en`,
    );
  }
});
