import re, json, collections
html = open('data-src/tangce_outline.html', encoding='utf-8').read()
out = {}
for m in re.finditer(r'<div name="level_(\d)" class="level_\d level_out">(.*?)</div>\s*(?=<div name="level_|</div>)', html, re.S):
    lvl = int(m.group(1))
    words = [w.strip() for w in re.findall(r'<div>(.*?)</div>', m.group(2) + '</div>', re.S)]
    out[lvl] = [w for w in words if w]
for k,v in sorted(out.items()):
    dup = [w for w,c in collections.Counter(v).items() if c>1]
    print(k, len(v), v[:5], v[-3:], 'dups:', dup)
json.dump(out, open('data-src/levels_raw.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)
