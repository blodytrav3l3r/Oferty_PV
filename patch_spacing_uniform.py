import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace all margin-bottom:0.4rem; on cards with margin-bottom:0.5rem;
text = text.replace('style="margin-bottom:0.4rem;"', 'style="margin-bottom:0.5rem;"')

# Dane zlecenia grid
text = text.replace('grid-template-columns:1fr 1fr; gap:0.4rem; padding:0.2rem 0;', 'grid-template-columns:1fr 1fr; gap:0.5rem; padding:0.2rem 0;')

# Dane elementu + Przejscia grid wrapper
text = text.replace('gap:0.4rem; margin-bottom:0.4rem;', 'gap:0.5rem; margin-bottom:0.5rem;')

# Dane elementu inner flex gap
text = text.replace('flex-direction:column; gap:0.4rem; font-size:0.75rem;', 'flex-direction:column; gap:0.5rem; font-size:0.75rem;')

# Parametry studni grid gap
text = text.replace('grid-template-columns:1fr 1fr; gap:0.8rem; align-items:start;', 'grid-template-columns:1fr 1fr; gap:0.8rem; align-items:start;') # keep 0.8rem horizontal maybe? Wait, user wants ALL fields same. So gap:0.5rem
text = text.replace('gap:0.8rem; align-items:start;', 'gap:0.5rem; align-items:start;')

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(text)
