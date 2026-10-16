"""Writes THIRD_PARTY_NOTICES.txt: licence text of every production dependency (run from the repo root)."""
import json, os, subprocess, sys

out_path = sys.argv[1] if len(sys.argv) > 1 else 'THIRD_PARTY_NOTICES.txt'
tree = json.loads(subprocess.run(['npm', 'ls', '--omit=dev', '--all', '--json'], capture_output=True, text=True).stdout)
own = {'@openpm-lens/core', '@openpm-lens/registry', '@openpm-lens/web'}
found = {}
def walk(node):
    for name, dep in (node.get('dependencies') or {}).items():
        found[name] = dep.get('version')
        walk(dep)
walk(tree)
parts = ['Third-party software included in openpm-lens\n', 'Each package below is used under its own licence, reproduced here.\n']
for name in sorted(found):
    if name in own: continue
    d = os.path.join('node_modules', name)
    meta = json.load(open(os.path.join(d, 'package.json')))
    text = ''
    for f in sorted(os.listdir(d)):
        if f.upper().startswith(('LICENSE', 'LICENCE', 'COPYING')) and os.path.isfile(os.path.join(d, f)):
            text = open(os.path.join(d, f), encoding='utf-8', errors='replace').read().strip(); break
    parts.append('\n' + '=' * 72 + f"\n{name} {meta['version']} ({meta.get('license', 'unknown')})\n" + '=' * 72 + '\n')
    parts.append(text if text else '(No licence file in the package; it declares the licence named above.)')
    parts.append('\n')
open(out_path, 'w', encoding='utf-8').write(''.join(parts))
print(f'{len(found) - len(own & set(found))} packages written to {out_path}')
