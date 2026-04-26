import os

def fix_mojibake(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Spróbujmy zamienić całą treść
        # Jeśli napotkamy błąd, znaczy to, że plik nie jest w 100% zepsuty w ten sposób
        try:
            fixed_content = content.encode('cp1250').decode('utf-8')
            with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
                f.write(fixed_content)
            print(f"Naprawiono pomyślnie (pełna konwersja cp1250->utf8): {filepath}")
            return
        except Exception as e:
            print(f"Nie można wykonać pełnej konwersji dla {filepath}: {e}")
            
        # Fallback: Ręczna mapa najczęstszych zepsutych znaków
        # (na wypadek gdyby plik był częściowo uszkodzony, co jest możliwe po moich ręcznych edycjach)
        fixes = {
            'Ä…': 'ą', 'Ä‡': 'ć', 'Ä™': 'ę', 'Ĺ‚': 'ł', 'Ĺ„': 'ń', 'Ăł': 'ó', 'Ĺ›': 'ś', 'Ĺş': 'ź', 'ĹĽ': 'ż',
            'Ä„': 'Ą', 'Ä†': 'Ć', 'Ä': 'Ę', 'Ĺ': 'Ł', 'Ĺƒ': 'Ń', 'Ă“': 'Ó', 'Ĺš': 'Ś', 'Ĺą': 'Ź', 'Ĺť': 'Ż',
            'Ăł': 'ó', 'WĹ‚azy': 'Włazy', 'zakoĹ„czenie': 'zakończenie', 'gĂłrÄ™': 'górę', 'gĂłrÄ™': 'górę',
            'krÄ…g': 'krąg', 'duplikatĂłw': 'duplikatów', 'bĹ‚Ä™dy': 'błędy', 'WĹ‚Ä…czono': 'Włączono',
            'rÄ™czny': 'ręczny', 'ZASADA': 'ZASADA', 'Wybrano': 'Wybrano', 'iloĹ›ci': 'ilości',
            'elementĂłw': 'elementów', 'funkcjÄ™': 'funkcję', 'Zastosuj': 'Zastosuj', 'filtrowanie': 'filtrowanie',
            'sekcji': 'sekcji', 'redukcji': 'redukcji', 'usuniÄ™cia': 'usunięcia', 'PierĹ›cienie': 'Pierścienie',
            'StoĹĽek': 'Stożek', 'nakrywajÄ…ce': 'nakrywające', 'PĹ‚yty': 'Płyty', 'pĹ‚yty': 'płyty',
            'stycznÄ…': 'styczną', 'powyĹĽej': 'powyżej', 'kolejnoĹ›ci': 'kolejności', 'dĂłĹ‚': 'dół',
            'PĹ‚yta': 'Płyta', 'PierĹ›cieĹ„': 'Pierścień', 'DopĹ‚ata': 'Dopłata', 'wliczona': 'wliczona',
            'dennicy': 'dennicy', 'stycznej': 'stycznej', 'podlega': 'podlega', 'rabatowi': 'rabatowi',
            'UsuĹ„': 'Usuń', 'przesuniÄ™ciu': 'przesunięciu', 'ZAKOĹƒCZENIE': 'ZAKOŃCZENIE', 'WYBĂ“R': 'WYBÓR',
            'ZAMKNIÄ˜CIA': 'ZAMKNIĘCIA', 'GĂ“RNEGO': 'GÓRNEGO', 'domyĹ›lne': 'domyślne', 'oferty': 'oferty',
            'nowych': 'nowych', 'studni': 'studni', 'Aktualizuj': 'Aktualizuj', 'etykietÄ™': 'etykietę',
            'przycisk': 'przycisk', 'pokazaÄ‡': 'pokazać', 'bieĹĽÄ…cy': 'bieżący', 'wybĂłr': 'wybór',
            'ZakoĹ„czenie': 'Zakończenie', 'WĹ Ä„CZONA': 'WŁĄCZONA', 'WYĹ Ä„CZONA': 'WYŁĄCZONA',
            'nadpisanego': 'nadpisanego', 'bĹ‚Ä™dem': 'błędem', 'Zakoczenia': 'Zakończenia', 'rury': 'rury',
            'samej': 'samej'
        }
        
        for wrong, right in fixes.items():
            content = content.replace(wrong, right)
            
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
            
        print(f"Naprawiono (fallback map) dla: {filepath}")
    except Exception as e:
        print(f"Błąd przy naprawie {filepath}: {e}")

files_to_fix = [
    r'public\js\studnie\wellActions.js',
    r'public\js\studnie\wellConfigRules.js',
    r'public\js\studnie\wellDiagram.js',
    r'public\js\studnie\wellSolver.js'
]

for f in files_to_fix:
    full_path = os.path.join(os.getcwd(), f)
    if os.path.exists(full_path):
        fix_mojibake(full_path)
