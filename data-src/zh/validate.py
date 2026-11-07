"""Validate authored content files: content/hsk{L}*.txt
Line format: 词|pinyin|hán việt|nghĩa VI|meaning EN|例句|câu dịch VI|sentence EN|tag
"""
import json, re, sys, glob, unicodedata, collections

ref = json.load(open('ref.json', encoding='utf-8'))
levels = json.load(open('levels_raw.json', encoding='utf-8'))
tags = json.load(open('tags.json', encoding='utf-8'))
HAN = re.compile(r'[一-鿿]')

def norm_py(p, tones=True):
    p = unicodedata.normalize('NFC', p.lower())
    p = re.sub(r"[\s'’·\-…]", '', p)
    if not tones:
        p = ''.join(c for c in unicodedata.normalize('NFD', p) if unicodedata.category(c) != 'Mn')
        p = p.replace('u:', 'u')
    return p

TONE_MARKS = '̣̀́̃̉'
def hv_key(x):
    d = unicodedata.normalize('NFD', x.lower())
    tone = ''.join(c for c in d if c in TONE_MARKS)
    base = ''.join(c for c in d if c not in TONE_MARKS)
    base = unicodedata.normalize('NFC', base)
    base = re.sub(r'y$', 'i', base) if not base.endswith(('uy', 'ay', 'ây')) else base
    return base, tone

def hv_ok(word, hv):
    syl = hv.lower().split()
    chars = [c for c in word if HAN.match(c)]
    if len(syl) != len(chars): return f'HV count {len(syl)}≠{len(chars)}'
    bad = []
    for c, s in zip(chars, syl):
        known = ref.get(word, {}).get('hv', {}).get(c, [])
        if known and hv_key(s) not in {hv_key(k) for k in known}: bad.append(f'{c}:{s}∉{"/".join(known)}')
    return '; '.join(bad)

# Cách đọc chuẩn theo 现代汉语词典 mà CC-CEDICT ghi khác.
PY_EXTRA = {'下载': ['xiàzài'], '小气': ['xiǎoqi'], '恶心': ['ěxin'], '拽': ['zhuài']}

def trad_only_chars():
    trad, simp = set(), set()
    for line in open('cedict_ts.u8', encoding='utf-8'):
        if line.startswith('#'): continue
        t, sm = line.split(' ', 2)[:2]
        simp.update(sm)
        if len(t) == len(sm): trad.update(a for a, b in zip(t, sm) if a != b)
    return trad - simp
TRAD = trad_only_chars()

def allowed_chars(L):
    s = set()
    for l in range(1, L + 1):
        for w in levels[str(l)]: s.update(c for c in w if HAN.match(c))
    return s

def contains(word, sent):
    parts = [p for p in word.split('……') if p]
    if all(p in sent for p in parts): return True
    # separable words (离合词): chars appear in order
    pos = 0
    for c in word.replace('……', ''):
        pos = sent.find(c, pos)
        if pos < 0: return False
        pos += 1
    return True

def check(L, verbose=True):
    files = sorted(glob.glob(f'content/hsk{L}*.txt'))
    rows = []
    for f in files:
        for n, line in enumerate(open(f, encoding='utf-8'), 1):
            line = line.strip()
            if not line or line.startswith('#'): continue
            rows.append((f, n, line.split('|')))
    allowed = allowed_chars(L)
    issues, tagc, outlvl = [], collections.Counter(), 0
    got = collections.Counter()
    for f, n, p in rows:
        loc = f'{f.split("/")[-1].split(chr(92))[-1]}:{n}'
        if len(p) != 9:
            issues.append(f'{loc} FIELDS={len(p)}'); continue
        w, py, hv, vi, en, zh, svi, sen, tag = [x.strip() for x in p]
        got[w] += 1
        if w not in ref: issues.append(f'{loc} {w} NOT IN LEVEL LIST')
        if tag not in tags: issues.append(f'{loc} {w} BAD TAG {tag}')
        tagc[tag] += 1
        if not contains(w, zh): issues.append(f'{loc} {w} not in sentence')
        if not all([vi, en, zh, svi, sen]): issues.append(f'{loc} {w} empty field')
        if not zh.endswith(('。', '？', '！', '”')): issues.append(f'{loc} {w} sentence end punct')
        cands = [e['py'] for e in ref.get(w, {}).get('cedict', [])] + PY_EXTRA.get(w, [])
        if cands:
            if norm_py(py) not in {norm_py(c) for c in cands}:
                kind = 'TONE' if norm_py(py, False) in {norm_py(c, False) for c in cands} else 'PINYIN'
                issues.append(f'{loc} {w} {kind} {py} vs {"/".join(dict.fromkeys(cands))}')
        h = hv_ok(w, hv)
        if h and (verbose == 'hv' or 'count' in h): issues.append(f'{loc} {w} HV {h}')
        trad = sorted({c for c in w + zh if c in TRAD})
        if trad: issues.append(f'{loc} {w} PHỒN THỂ: {"".join(trad)}')
        extra = sorted({c for c in zh if HAN.match(c) and c not in allowed})
        if extra: outlvl += 1
        if extra and verbose == 'lvl': issues.append(f'{loc} {w} above-level chars: {"".join(extra)}')
    exp = collections.Counter(w for w in levels[str(L)])
    exp['丢三落四'] = min(exp['丢三落四'], 1)
    missing = [w for w in exp if got[w] < exp[w]]
    dup = [w for w in got if got[w] > exp.get(w, 0)]
    print(f'HSK{L}: {len(rows)} rows / expected {sum(exp.values())}; missing {len(missing)}; extra/dup {dup}')
    print(f'  sentences with above-level chars: {outlvl}/{len(rows)}')
    top = tagc.most_common()
    print('  tags:', ', '.join(f'{t}:{c}' for t, c in top))
    if rows: print(f'  top tag share: {top[0][1]/len(rows):.0%}; distinct tags: {len(tagc)}')
    for i in issues: print('  !', i)
    return missing

if __name__ == '__main__':
    L = int(sys.argv[1]); mode = sys.argv[2] if len(sys.argv) > 2 else True
    m = check(L, mode)
    if len(sys.argv) > 2 and sys.argv[2] == 'missing': print('MISSING:', ' '.join(m))
