import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace block margins
content = content.replace('style="margin-bottom:0.6rem;"', 'style="margin-bottom:0.4rem;"')

# Replace specific grid gap and margin
content = content.replace('style="display:grid; grid-template-columns:0.8fr 1.8fr; gap:0.6rem; margin-bottom:0.6rem;"', 'style="display:grid; grid-template-columns:0.8fr 1.8fr; gap:0.4rem; margin-bottom:0.4rem;"')

# Replace inner gap in the grid of Dane Zlecenia
content = content.replace('style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; padding:0.2rem 0;"', 'style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; padding:0.2rem 0;"')

# Params Grid gap
content = content.replace('style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; align-items:start;"', 'style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; align-items:start;"')

# Params columns internal gaps
content = content.replace('style="display:flex; flex-direction:column; gap:0.8rem;"', 'style="display:flex; flex-direction:column; gap:0.5rem;"')

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(content)
