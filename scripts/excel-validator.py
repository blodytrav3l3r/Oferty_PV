#!/usr/bin/env python3
"""
Walidator struktury Excel Table Manager (po spliście).
Sprawdza czy wszystkie komponenty z Planu Naprawy istnieją
w plikach katalogu excel/ lub w excelTableManager.js.
Watchdog pattern: cicho gdy OK, raportuje tylko problemy.
"""
import os, re, sys, glob

REPO = r'I:\GitHub\Oferty_PV'
EXCEL_DIR = os.path.join(REPO, 'public', 'js', 'studnie', 'excel')
CSS = os.path.join(REPO, 'public', 'css', 'studnie.css')

errors = []

def load_all_js():
    content = ''
    for f in sorted(glob.glob(os.path.join(EXCEL_DIR, '*.js'))):
        with open(f, 'r', encoding='utf-8') as fp:
            content += '\n' + fp.read()
    mgr = os.path.join(REPO, 'public', 'js', 'studnie', 'excelTableManager.js')
    if os.path.exists(mgr):
        with open(mgr, 'r', encoding='utf-8') as fp:
            content += '\n' + fp.read()
    return content

def check(desc, pattern, invert=False):
    content = load_all_js()
    found = bool(re.search(pattern, content, re.DOTALL))
    if invert and found:
        errors.append(f'[INWERSJA] {desc}')
    elif not invert and not found:
        errors.append(f'[BRAKUJE] {desc}')

def check_css(desc, pattern):
    if not os.path.exists(CSS):
        errors.append(f'[BRAK_PLIKU] {CSS}')
        return
    with open(CSS, 'r', encoding='utf-8') as f:
        content = f.read()
    if not re.search(pattern, content):
        errors.append(f'[BRAKUJE_CSS] {desc}')

# ===== ETAP 1 =====
check('getHasReduction z 2500', r'2500.*includes\(String')
check('hasReduction render z 2500 i styczne',
      r"hasReduction = \['1200',\s*'1500',\s*'2000',\s*'2500',\s*'styczne'\]")
check('stycznaNadbudowa1200: effDn = 1200', r'stycznaNadbudowa1200 \? 1200 : 1000')
check('redukcjaTargetDN w hash config', r'redukcjaTargetDN')
check('spocznikH w hash config', r"spocznikH \|\| ''")
check('wkladkaOsadnikPreco w hash config', r"wkladkaOsadnikPreco \|\| ''")
check('stycznaNadbudowa1200 w hash config', r"stycznaNadbudowa1200 \? '1' : '0'")
check('_excelColWidths zdefiniowane', r'_excelColWidths\s*=\s*\{')
check('Zapis szerokosci w resize', r'_excelColWidths\[_excelActiveTab')
check('Aplikacja szerokosci po renderze', r'_excelColWidths.*minWidth')

# ===== ETAP 2 =====
check('well.magazyn w excelHelpers', r'well\s*&&\s*well\.magazyn\s*\?\s*well\.magazyn')
check('Brak inline onclick w TR', r'onclick="excelSelectRow', invert=True)
check('_excelGetResolution zdefiniowana', r'function _excelGetResolution')
check('_excelGetResolution uzywana', r'_excelGetResolution\(well,\s*item\)')
check('_excelAddingReliefPair zdefiniowane', r'_excelAddingReliefPair\s*=\s*(false|true)')
check('Blokada ensureReliefRingPair', r'_excelAddingReliefPair.*ensureReliefRingPair')
check('renderWellConfig w excelDeleteWell i Handlers', r'renderWellConfig')

# ===== ETAP 3 =====
check_css('CSS .excel-th-h1', r'\.excel-th-h1')
check_css('CSS .excel-th-h2', r'\.excel-th-h2')
check_css('CSS .excel-th-h3', r'\.excel-th-h3')
check('offerDefaultWlazH', r'offerDefaultWlazH')

# ===== RAPORT =====
if errors:
    print(f'\nZnaleziono {len(errors)} problem(ów):')
    for e in errors:
        print(f'  {e}')
    sys.exit(1)
else:
    print('OK')
    sys.exit(0)
