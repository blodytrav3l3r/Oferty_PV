import os

def fix_encoding(filepath):
    try:
        # Próba odczytu jako UTF-8 (może mieć BOM)
        with open(filepath, 'rb') as f:
            content = f.read()
        
        # Jeśli ma BOM, usuwamy go
        if content.startswith(b'\xef\xbb\xbf'):
            content = content[3:]
            
        text = content.decode('utf-8')
        
        # Mapa naprawy znanych uszkodzeń (UTF-8 interpretowane jako Latin-1)
        fixes = {
            'wysokoĹ›ci': 'wysokości',
            'najniĹĽszej': 'najniższej',
            'najwyĹĽszej': 'najwyższej',
            'pĹ‚yta': 'płyta',
            'pierĹ›cieĹ„': 'pierścień',
            'odciÄ…ĹĽajÄ…cej': 'odciążającej',
            'redukcjÄ™': 'redukcję',
            'Ĺ›rednicy': 'średnicy',
            'rÄ™czne': 'ręczne',
            'ukĹ‚adanie': 'układanie',
            'elementĂłw': 'elementów',
            'UĹĽytkownika': 'Użytkownika',
            'drabinÄ™': 'drabinę',
            'nierdzewnÄ…': 'nierdzewną',
            'dopĹ‚atÄ…': 'dopłatą',
            'jeĹ›li': 'jeśli',
            'ĹĽeby': 'żeby',
            'pĹ‚yty': 'płyty',
            'pĹ‚ytÄ™': 'płytę',
            'odciÄ…ĹĽajÄ…cy': 'odciążający',
            'pĂłĹşniej': 'później',
            'wyĹ›wietlania': 'wyświetlania',
            'krÄ™gĂłw': 'kręgów',
            'bÄ™dÄ…': 'będą',
            'wyĹ›wietlane': 'wyświetlane',
            'najniĹĽszego': 'najniższego',
            'najwyĹĽszego': 'najwyższego',
            'uĹ‚atwia': 'ułatwia',
            'rozwiÄ…zuje': 'rozwiązuje',
            'problemu': 'problemu',
            'duplikatĂłw': 'duplikatów',
            'osieroconych': 'osieroconych',
            'podglÄ…dzie': 'podglądzie',
            'wizualnym': 'wizualnym',
            'Ĺ›cisĹ‚Ä…': 'ścisłą',
            'zasadÄ™': 'zasadę',
            'kompletĂłw': 'kompletów',
            'uĹĽyciu': 'użyciu',
            'WdroĹĽono': 'Wdrożono',
            'nowÄ…': 'nową',
            'zasadÄ™': 'zasadę',
            'ustalonym': 'ustalonym',
            'wspĂłĹ‚pracÄ™': 'współpracę'
        }
        
        for wrong, right in fixes.items():
            text = text.replace(wrong, right)
            
        # Zapisz jako czyste UTF-8 bez BOM
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)
            
        print(f"Naprawiono: {filepath}")
    except Exception as e:
        print(f"Błąd przy naprawie {filepath}: {e}")

# Lista plików do naprawy
files_to_fix = [
    r'public\js\studnie\wellActions.js',
    r'public\js\studnie\wellConfigRules.js',
    r'public\js\studnie\wellDiagram.js'
]

for f in files_to_fix:
    full_path = os.path.join(os.getcwd(), f)
    if os.path.exists(full_path):
        fix_encoding(full_path)
    else:
        print(f"Nie znaleziono pliku: {f}")
