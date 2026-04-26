import os

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    fixes = {
        'â€”': '—',
        'â€˘': '•',
        'â†’': '→',
        'â‰Ą': '≥',
        'â¬›': '⬛',
        'WŁ ĄCZONA': 'WŁĄCZONA',
        'WYŁ ĄCZONA': 'WYŁĄCZONA',
        'WŁ ĄCZONY': 'WŁĄCZONY',
        'WYŁ ĄCZONY': 'WYŁĄCZONY'
    }

    for wrong, right in fixes.items():
        content = content.replace(wrong, right)

    with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

fix_file('public/js/studnie/wellActions.js')
print('Fixed mojibake symbols.')
