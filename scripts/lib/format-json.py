"""Định dạng file JSON nội dung (ngữ pháp, từ vựng) cho dễ đọc và dễ xem diff:
mảng chỉ gồm chuỗi / số (ví dụ, công thức, một từ vựng) nằm trên một dòng, còn lại xuống dòng thụt 2.
  python scripts/lib/format-json.py <file.json> …"""
import json, sys

def dump(o, ind=0):
    pad, pad2 = '  ' * ind, '  ' * (ind + 1)
    if isinstance(o, dict):
        if not o: return '{}'
        items = [f'{pad2}{json.dumps(k, ensure_ascii=False)}: {dump(v, ind + 1)}' for k, v in o.items()]
        return '{\n' + ',\n'.join(items) + '\n' + pad + '}'
    if isinstance(o, list):
        if not o: return '[]'
        if all(not isinstance(x, (dict, list)) or (isinstance(x, dict) and len(json.dumps(x)) < 60) for x in o):
            return json.dumps(o, ensure_ascii=False, separators=(', ', ': '))
        return '[\n' + ',\n'.join(pad2 + dump(x, ind + 1) for x in o) + '\n' + pad + ']'
    return json.dumps(o, ensure_ascii=False)

for path in sys.argv[1:]:
    data = json.load(open(path, encoding='utf-8'))
    open(path, 'w', encoding='utf-8', newline='\n').write(dump(data) + '\n')
