#!/usr/bin/env python3
"""
Walidator planu napraw Excel Table Manager.
Sprawdza czy wszystkie zmiany z planu zostały wdrożone.
Watchdog pattern: cicho gdy OK, raportuje tylko problemy.
"""
import os, re, sys

REPO = r'I:\GitHub\Oferty_PV'
JS = os.path.join(REPO, r'public\js\studnie\excelTableManager.js')
CSS = os.path.join(REPO, r'public\css\studnie.css')

errors = []

def check(desc, path, pattern, invert=False):
    if not os.path.exists(path):
        errors.append(f'[BRAK_PLIKU] {path}')
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    found = bool(re.search(pattern, content, re.DOTALL))
    if invert and found:
        errors.append(f'[INWERSJA] {desc}')
    elif not invert and not found:
        errors.append(f'[BRAKUJE] {desc}')

def check_in_block(desc, path, block_start, keys):
    if not os.path.exists(path):
        errors.append(f'[BRAK_PLIKU] {path}')
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    idx = content.find(block_start)
    if idx < 0:
        errors.append(f'[BRAK_BLOKU] {block_start}')
        return
    end = content.find('\n}', idx)
    if end < 0: end = idx + 800
    block = content[idx:end]
    for k in keys:
        if k not in block:
            errors.append(f'[BRAKUJE_W_BLOKU] {desc}: {k}')

def check_overlay_clean(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    m = re.search(r"overlay\.addEventListener\('keydown',\s*\(e\)\s*=>\s*\{([^}]+)\}", content, re.DOTALL)
    if m:
        body = m.group(1)
        for bad in ["'Tab'", '_excelHandleTab', '_excelHandleArrow']:
            if bad in body:
                errors.append(f'[OVERLAY] Zawiera "{bad}" - powinno byc usuniete')

# ===== ETAP 1 =====
check('getHasReduction z 2500', JS, r'2500.*includes\(String')
check('hasReduction render z 2500', JS, r"hasReduction = \['1000',\s*'1200',\s*'1500',\s*'2000',\s*'2500'\]")
check('stycznaNadbudowa1200 w _excelGetComponentsForDn', JS, r'stycznaNadbudowa1200 \? 1200 : 1000')
check('redukcjaTargetDN w hash config', JS, r'redukcjaTargetDN')
check('spocznikH w hash config', JS, r"spocznikH \|\| ''")
check('wkladkaOsadnikPreco w hash config', JS, r"wkladkaOsadnikPreco \|\| ''")
check('stycznaNadbudowa1200 w hash config', JS, r"stycznaNadbudowa1200 \? '1' : '0'")
check_in_block('Hash struktury', JS, 'function _excelGetColumnStructureHash',
               ['kineta', 'wkladkaZwienczenie', 'wkladkaOsadnikPreco', 'stycznaNadbudowa1200'])
check('_excelColWidths zdefiniowane', JS, r'_excelColWidths\s*=\s*\{\}')
check('Zapis szerokosci w resize', JS, r'_excelColWidths\[_excelActiveTab')
check('Aplikacja szerokosci po renderze', JS, r'_excelColWidths.*minWidth')

# ===== ETAP 2 =====
check('well.magazyn zamiast wells[0]', JS, r'well && well\.magazyn \? well\.magazyn')
check_overlay_clean(JS)
check('Brak inline onclick w TR', JS, r'onclick="excelSelectRow', invert=True)
check('Delegowany click na container', JS, r"container\.addEventListener\('click'.*tr\[data-widx\]")
check('_excelGetResolution zdefiniowana', JS, r'function _excelGetResolution')
check('_excelGetResolution uzywana', JS, r'_excelGetResolution\(well,\s*item\)')
check('_excelAddingReliefPair zdefiniowane', JS, r'_excelAddingReliefPair = false')
check('Blokada ensureReliefRingPair', JS, r'!_excelAddingReliefPair.*ensureReliefRingPair')
check('renderWellConfig w excelDeleteWell', JS, r'renderWellConfig')

# ===== ETAP 3 =====
check('CSS .excel-th-h3', CSS, r'\.excel-th-h3')
check('CSS .excel-th-h1', CSS, r'\.excel-th-h1')
check('CSS .excel-th-h2', CSS, r'\.excel-th-h2')
check('Placeholder auto (', JS, r'auto \(')
check('offerDefaultWlazH', JS, r'offerDefaultWlazH')

# ===== RAPORT =====
if errors:
    print(f'\nZNAALEZIONO {len(errors)} PROBLEMOW:')
    for e in errors:
        print(f'  {e}')
    sys.exit(1)
else:
    print('OK')
    sys.exit(0)
