import re, os
for root, _, files in os.walk('/home/ubuntu/agro-open/web/src'):
    for file in files:
        if file.endswith('.jsx') or file.endswith('.js'):
            with open(os.path.join(root, file), 'r') as f:
                try:
                    for i, line in enumerate(f):
                        if 'async' in line:
                            if not re.search(r'async\s+function', line) and not re.search(r'async\s*\(', line) and not re.search(r'async\s+[a-zA-Z_]\w*\s*=>', line) and not re.search(r'async\s*run', line) and not re.search(r'decoding="async"', line):
                                print(f"{file}:{i+1}: {line.strip()}")
                except: pass
