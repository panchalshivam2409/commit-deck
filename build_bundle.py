"""
Simple zero-dependency bundler that concatenates modules into js/bundle.js
stripping import/export statements so that CommitDeck works out-of-the-box
both via file:/// (direct double-click on Windows) and via http:// (web server).
"""
import re

files_order = [
    'js/state.js',
    'js/audio.js',
    'js/timer.js',
    'js/heatmap.js',
    'js/tasks.js',
    'js/app.js'
]

combined = ['(() => {', '"use strict";\n']

for filepath in files_order:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Strip import statements
    content = re.sub(r'^\s*import\s+[^;]+;\s*$', '', content, flags=re.MULTILINE)
    # Strip 'export const ', 'export function ', 'export class ', 'export default '
    content = re.sub(r'^\s*export\s+(const|let|var|function|class)\s+', r'\1 ', content, flags=re.MULTILINE)
    # Strip standalone 'export { ... };'
    content = re.sub(r'^\s*export\s*\{[^}]*\}\s*;?\s*$', '', content, flags=re.MULTILINE)
    
    combined.append(f'// >>> START: {filepath} >>>')
    combined.append(content)
    combined.append(f'// <<< END: {filepath} <<<\n')

combined.append('})();')

bundle_code = '\n'.join(combined)

with open('js/bundle.js', 'w', encoding='utf-8') as f:
    f.write(bundle_code)

print("Successfully generated js/bundle.js (size: {} bytes)".format(len(bundle_code)))
