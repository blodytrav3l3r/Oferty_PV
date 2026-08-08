#!/usr/bin/env python3
"""
Walidator planu usprawnien modulu Excel (2026-08-08).
Sprawdza czy wszystkie zmiany z planu zostaly wdrozne.
Watchdog pattern: cicho gdy OK, raportuje tylko problemy.
"""
import os, re, sys

REPO = r'I:\GitHub\Oferty_PV'
STUDNIE = os.path.join(REPO, r'public\js\studnie')

errors = []

def read(path):
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def check_in(desc, filename, pattern, invert=False):
    content = read(os.path.join(STUDNIE, filename))
    if content is None:
        errors.append(f'[BRAK_PLIKU] {filename}')
        return
    found = bool(re.search(pattern, content, re.DOTALL))
    if invert and found:
        errors.append(f'[INWERSJA] {desc}')
    elif not invert and not found:
        errors.append(f'[BRAKUJE] {desc}')

# ===== F1: Ctrl+Enter fill =====
check_in('_excelBuildFillPlan zdefiniowana', 'excelCopyPaste.js', r'function _excelBuildFillPlan')
check_in('_excelHandleFillDown zdefiniowana', 'excelCopyPaste.js', r'function _excelHandleFillDown')
check_in('fill guard _excelPasteInProgress (jeden snapshot)', 'excelCopyPaste.js', r'_excelPasteInProgress = true')
check_in('fill pomija nazwe (colIdx 3)', 'excelCopyPaste.js', r'colIdx\s*[<>]=\s*3')
check_in('fill pomija wiersze ukryte filtrem', 'excelCopyPaste.js', r'display\s*!==\s*[\'"]none[\'"]')
check_in('galaz Ctrl+Enter w nawigacji', 'excelCellNavigation.js', r'_excelHandleFillDown')
check_in('guard !ctrlKey na Enter selecta', 'excelHelpers.js', r'!event\.ctrlKey')

# ===== F2: trwalosc szerokosci kolumn =====
check_in('_excelColWidths zdefiniowane', 'excelState.js', r'_excelColWidths\s*=\s*\{\}')
check_in('klucz localStorage szerokosci', 'excelState.js', r'_EXCEL_COL_WIDTHS_KEY\s*=')
check_in('_excelLoadColWidths zdefiniowana', 'excelState.js', r'function _excelLoadColWidths')
check_in('_excelSaveColWidths zdefiniowana', 'excelState.js', r'function _excelSaveColWidths')
check_in('zapis szerokosci po resize', 'excelTableManager.js', r'_excelSaveColWidths')

# ===== F3: Ctrl+D duplikacja studni =====
check_in('excelDuplicateWell zdefiniowana', 'excelWellActions.js', r'function excelDuplicateWell')
check_in('duplikacja undo snapshot', 'excelWellActions.js', r'excelDuplicateWell[\s\S]{0,500}?_excelSaveUndoSnapshot')
check_in('duplikacja czyści __resCache', 'excelWellActions.js', r'delete\s+copy\.__resCache')
check_in('galaz Ctrl+D (brak selekcji = duplikacja)', 'excelCellNavigation.js', r"_excelSelectedCells\.length === 0[\s\S]*?excelDuplicateWell\(dupWIdx\)")

# ===== F4: tla bledow konfiguracji =====
check_in('_excelGetRowStatus zdefiniowana', 'excelTableBody.js', r'function _excelGetRowStatus')
check_in('status w renderze wiersza', 'excelTableBody.js', r'_excelGetRowStatus')
check_in('sticky aktualizowane po zmianie tla', 'excelTableBody.js', r'_excelStickyCellBg')
check_in('configStatus w snapshotcie pollingowym', 'excelPolling.js', r'configStatus')

# ===== F5: wyszukiwarka =====
check_in('przycisk czyszczenia wyszukiwarki', 'excelModal.js', r'id="excel-search-clear"')
check_in('excelClearSearch zdefiniowana', 'excelHelpers.js', r'function excelClearSearch')
check_in('szerokosc wyszukiwarki 220px', 'excelModal.js', r'width:\s*220px')

# ===== RAPORT =====
if errors:
    print(f'\nZNAALEZIONO {len(errors)} PROBLEMOW:')
    for e in errors:
        print(f'  {e}')
    sys.exit(1)
else:
    print('OK')
    sys.exit(0)
