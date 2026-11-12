import re
with open('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', 'r') as f:
    for i, line in enumerate(f):
        if 'async' in line:
            if not re.search(r'async\s+function', line) and not re.search(r'async\s*\(', line) and not re.search(r'async\s+[a-zA-Z_]\w*\s*=>', line):
                print(f"{i+1}: {line.strip()}")
