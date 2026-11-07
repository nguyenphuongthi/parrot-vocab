"""Build reference data: CC-CEDICT readings/English + Unihan Hán Việt per char."""
import json, re, unicodedata

TONES = {'a':'āáǎàa','e':'ēéěèe','i':'īíǐìi','o':'ōóǒòo','u':'ūúǔùu','ü':'ǖǘǚǜü'}
def syl_mark(s):
    m = re.fullmatch(r"([a-zü:]+?)([1-5])", s, re.I)
    if not m: return s
    base, t = m.group(1).replace('u:', 'ü').replace('v', 'ü'), int(m.group(2))
    low = base.lower()
    if 'a' in low: i = low.index('a')
    elif 'e' in low: i = low.index('e')
    elif 'ou' in low: i = low.index('o')
    else:
        idx = [k for k, c in enumerate(low) if c in 'aeiouü']
        if not idx: return base
        i = idx[-1]
    v = low[i]
    out = TONES[v][t-1]
    if base[i].isupper(): out = out.upper()
    return base[:i] + out + base[i+1:]
def mark(py):
    return ''.join(syl_mark(s) if re.search(r'\d', s) else s for s in py.split())

cedict = {}
for line in open('cedict_ts.u8', encoding='utf-8'):
    if line.startswith('#'): continue
    m = re.match(r'(\S+) (\S+) \[(.*?)\] /(.*)/', line)
    if not m: continue
    trad, simp, py, en = m.groups()
    cedict.setdefault(simp, []).append({'py': mark(py), 'raw': py, 'en': en, 'trad': trad})

def U(cp): return chr(int(cp[2:], 16))
viet, tradv = {}, {}
for line in open('Unihan_Readings.txt', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) == 3 and p[1] == 'kVietnamese':
        viet[U(p[0])] = p[2].split()
for line in open('Unihan_Variants.txt', encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) == 3 and p[1] == 'kTraditionalVariant':
        tradv[U(p[0])] = [U(x) for x in p[2].split()]

def hv_char(c):
    r = list(viet.get(c, []))
    for t in tradv.get(c, []):
        for x in viet.get(t, []):
            if x not in r: r.append(x)
    return r

levels = json.load(open('levels_raw.json', encoding='utf-8'))
ref = {}
for lvl, words in levels.items():
    for w in words:
        key = w.replace('……', '')
        ref[w] = {
            'cedict': cedict.get(w, []),
            'hv': {c: hv_char(c) for c in key if '一' <= c <= '鿿'},
        }
json.dump(ref, open('ref.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump({c: hv_char(c) for w in ref for c in w if '一' <= c <= '鿿'},
          open('hv_chars.json', 'w', encoding='utf-8'), ensure_ascii=False)
missing = [w for w in ref if not ref[w]['cedict']]
nohv = sorted({c for w in ref for c, v in ref[w]['hv'].items() if not v})
print('words', len(ref), 'no cedict:', len(missing), missing[:40])
print('chars w/o HV:', len(nohv), ''.join(nohv))
