import json, sys
ref = json.load(open('ref.json', encoding='utf-8'))
levels = json.load(open('levels_raw.json', encoding='utf-8'))
lvl, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
seen = set()
for i, w in enumerate(levels[lvl][a:b], a):
    if w in seen: continue
    seen.add(w)
    es = [e for e in ref[w]['cedict'] if not e['py'][:1].isupper()] or ref[w]['cedict']
    s = ' || '.join(f"{e['py']}: {e['en'][:45]}" for e in es[:3])
    print(f"{i}\t{w}\t{s}")
