async function exportStudnieToExcel() {
    const pv = window.pricelistVersions;
    if (!pv || typeof pv.transferVersion !== 'function') {
        showToast('Panel wersji nie jest gotowy — odśwież stronę', 'error');
        return;
    }
    // Eksport = wersja zaznaczona na osi (nie „to, co w siatce”) — popup to mówi.
    const v = await pv.transferVersion('studnie');
    if (!v) {
        showToast('Brak wersji cennika do eksportu', 'warning');
        return;
    }
    if (!(await pv.transferConfirm('export', 'studnie', v))) return;

    try {
        // Plik buduje serwer z wersji; PRECO ma osobny plik.
        const name = await pv.exportVersionXlsx('studnie', v);
        showToast('Wyeksportowano cennik ' + (v.version || '') + ' (' + name + ')', 'success');
        return;
    } catch (err) {
        logger.error('pricelistManager', 'Export error:', err);
        showToast('Błąd podczas eksportu do Excela', 'error');
    }
}

/**
 * Opcje normalizacji wierszy studni — jedno źródło dla importu XLSX i widoku
 * wersji w siatce (ta sama konwersja = ten sam wygląd tabeli).
 * @param {Array<any>} importIssues kolekcja błędów (pusta dla widoku wersji)
 */
function studnieImportOptions(importIssues) {
    return {
        headerToKey: HEADER_TO_KEY,
        numericFields: [
            'height',
            'weight',
            'area',
            'areaExt',
            'transport',
            'price',
            'doplataPEHD',
            'malowanieWewnetrzne',
            'malowanieZewnetrzne',
            'doplataZelbet',
            'doplataDrabNierdzewna',
            'magazynWL',
            'magazynKLB',
            'formaStandardowa',
            'formaStandardowaKLB',
            'active',
            'zapasDol',
            'zapasGora',
            'zapasDolMin',
            'zapasGoraMin',
            'dn',
            'hMin1',
            'hMax1',
            'cena1',
            'hMin2',
            'hMax2',
            'cena2',
            'hMin3',
            'hMax3',
            'cena3'
        ],
        emptyDefaults: {
            magazynWL: 1,
            magazynKLB: 1,
            formaStandardowa: 1,
            formaStandardowaKLB: 1
        },
        preValidate: (product, _raw, index) => {
            const flagPattern = /^(?:[01](?:[.,]0+)?|true|false|-|—)?$/i;
            const flags = [
                'magazynWL',
                'magazynKLB',
                'formaStandardowa',
                'formaStandardowaKLB',
                'active'
            ];
            for (const field of flags) {
                if (flagPattern.test(String(product[field] ?? '').trim())) continue;
                importIssues.push(
                    window.pricelistXlsx.importIssue(
                        index,
                        field,
                        'Flaga dostępności musi mieć wartość 0 lub 1',
                        HEADER_TO_KEY
                    )
                );
            }
        },
        onIssue: (index, field, reason) => {
            importIssues.push(
                window.pricelistXlsx.importIssue(index, field, reason, HEADER_TO_KEY)
            );
        },
        onSkip: (index, reason, product) => {
            if (reason === 'duplicate-id') {
                logger.warn(
                    'pricelistManager',
                    `[Import Studnie] Row ${index + 2} skipped: duplicate ID ${product.id}`
                );
            } else {
                logger.warn(
                    'pricelistManager',
                    `[Import Studnie] Row ${index + 2} skipped: missing ID or Name`
                );
            }
        },
        postCoerce: (product, raw) => {
            product.category = String(product.category || '').trim() || 'Inne';
            product.componentType = String(product.componentType || '').trim();
            if (product.category.startsWith('Kinety') && !product.componentType) {
                product.componentType = 'kineta';
            }

            const rawDn = raw.DN ?? raw.dn;
            if (product.dn !== null && typeof rawDn === 'string' && rawDn.includes('/')) {
                product.dn = rawDn;
            }

            // Brak kolumny w pliku = pozycja niedostepna (0) dla WSZYSTKICH flag.
            // Dawniej magazyn dostawal 0, a forma 1 - ten sam plik roznie
            // wlaczal pozycje i nikt o tym nie wiedzial.
            if (product.magazynWL == null) product.magazynWL = 0;
            if (product.magazynKLB == null) product.magazynKLB = 0;
            if (product.formaStandardowa == null) product.formaStandardowa = 0;
            if (product.formaStandardowaKLB == null) product.formaStandardowaKLB = 0;

            if (typeof renamePłyty === 'function') {
                renamePłyty(product);
            }
        }
    };
}

/**
 * Kolumny flag, ktorych brak w pliku (wtedy postCoerce ustawia 0).
 * Zwraca czytelne nazwy naglowkow — import ostrzega, zamiast robic to cicho.
 * @param {Array<any>} rows surowe wiersze ze wszystkich arkuszy produktów
 */
function findMissingFlagColumns(rows) {
    const presentByRow = rows.map(
        (row) => new Set(Object.keys(row).map((header) => HEADER_TO_KEY[header] || header))
    );
    return [
        ['magazynWL', 'Mag WL'],
        ['magazynKLB', 'Mag KLB'],
        ['formaStandardowa', 'Forma std. WL'],
        ['formaStandardowaKLB', 'Forma std. KLB']
    ]
        .filter(([key]) => rows.length === 0 || presentByRow.some((present) => !present.has(key)))
        .map((pair) => pair[1]);
}

window.studnieImportOptions = studnieImportOptions;

async function importStudnieFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const btns = document.querySelectorAll('[data-csp-args*="pv-import-excel"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));

    const resetImportInput = () => {
        btns.forEach((b) => b.removeAttribute('disabled'));
        event.target.value = '';
    };

    if (_studniePricelistDirty) {
        const proceed = await appConfirm(
            'Masz niezapisane zmiany w cenniku studni. Czy kontynuować import? Niezapisane zmiany zostaną utracone.',
            { title: 'Niezapisane zmiany', type: 'warning' }
        );
        if (!proceed) {
            resetImportInput();
            return;
        }
    }

    // Import trafia do WERSJI wybranej na osi (nie do LIVE) — popup mówi do której.
    const pv = window.pricelistVersions;
    if (!pv || typeof pv.transferVersion !== 'function') {
        showToast('Panel wersji nie jest gotowy — odśwież stronę', 'error');
        resetImportInput();
        return;
    }
    const targetVersion = await pv.transferVersion('studnie');
    if (!targetVersion) {
        showToast('Brak wersji cennika — najpierw ją utwórz', 'warning');
        resetImportInput();
        return;
    }
    if (!(await pv.transferConfirm('import', 'studnie', targetVersion))) {
        resetImportInput();
        return;
    }
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            await ensureXlsx();
            const data = new Uint8Array(/** @type {ArrayBuffer} */ (e.target.result));
            const workbook = XLSX.read(data, { type: 'array' });
            // Tylko elementy studni; PRECO ma osobny plik i osobny import.
            const parsed = window.pricelistXlsx.parseWorkbookToJson(XLSX, workbook, {
                includePreco: false
            });
            const allJson = parsed.rows;

            if (allJson.length === 0) {
                showToast('Skoroszyt jest pusty lub ma zły format', 'error');
                return;
            }

            const importIssues = [];
            let normalized = window.pricelistXlsx.normalizeRows(
                allJson,
                studnieImportOptions(importIssues)
            );

            if (importIssues.length > 0) {
                window.pricelistXlsx.openImportErrorsModal({ issues: importIssues });
                return;
            }

            if (normalized.length === 0) {
                showToast('Brak prawidłowych wierszy do importu (sprawdź Indeks i Nazwę)', 'error');
                return;
            }

            const needsActive = (row) => row.componentType === 'przejscie' && row.active == null;
            if (normalized.some(needsActive)) {
                // Starszy eksport nie miał DOST. Zachowaj wartości wybranej wersji po indeksie.
                const targetRows = await pv.readVersionRows('studnie', targetVersion.id);
                const targetById = new Map(targetRows.map((row) => [row.id, row]));
                normalized = normalized.map((row) => {
                    if (!needsActive(row)) return row;
                    const previous = targetById.get(row.id);
                    if (previous && previous.active !== 0 && previous.active !== 1) {
                        throw new Error('Brak poprawnej flagi DOST. dla przejścia ' + row.id);
                    }
                    return { ...row, active: previous?.active ?? 0 };
                });
            }

            if (!pv.enterVersionEditForImport('studnie', targetVersion)) {
                showToast('Otwórz edytor cennika studni, aby zaimportować plik', 'error');
                return;
            }

            const missingFlagColumns = findMissingFlagColumns(allJson);
            if (missingFlagColumns.length > 0) {
                showToast(
                    'Brak kolumn w arkuszach: ' +
                        missingFlagColumns.join(', ') +
                        ' — pozycje bez tych kolumn dostaną 0 (niedostępne w magazynie/formie)',
                    'warning'
                );
            }

            const precoSheets = (workbook.SheetNames || []).filter(
                (name) => name.indexOf('PRECO_') === 0
            ).length;
            if (precoSheets > 0) {
                showToast(
                    'Arkusze PRECO pominięte — PRECO importuj osobnym przyciskiem',
                    'warning'
                );
            }

            // Wersja jest już otwarta do edycji → „Zapisz” podmieni jej ceny.
            window.studnieProducts = normalized;
            _studniePricelistDirty = true;
            updateStudnieSaveBtn();
            renderStudniePriceList();
            renderTiles();
            showToast(
                'Zaimportowano ' +
                    normalized.length +
                    ' pozycji do ' +
                    (targetVersion.version || 'wersji') +
                    ' — kliknij Zapisz, aby podmienić ceny tej wersji',
                'success'
            );
        } catch (err) {
            logger.error('pricelistManager', 'Import error:', err);
            showToast('Błąd podczas importu pliku Excel', 'error');
        } finally {
            resetImportInput();
        }
    };
    reader.onerror = () => {
        resetImportInput();
        showToast('Błąd odczytu pliku', 'error');
    };
    reader.readAsArrayBuffer(file);
}

window.exportStudnieToExcel = exportStudnieToExcel;
window.importStudnieFromExcel = importStudnieFromExcel;
// Alias pod przycisk panelu: import studni zawsze pomija arkusze PRECO.
window.importStudnieProductsFromExcel = importStudnieFromExcel;

/**
 * Osobny import cennika PRECO (plik z /api/preco-pricing/export.xlsx).
 * Czyta wyłącznie arkusze PRECO_* i zapisuje LIVE albo draft osi PRECO.
 */
async function importPrecoFromExcel(event) {
    const input = /** @type {HTMLInputElement} */ (event.target);
    const file = input.files[0];
    if (!file) return;

    const btns = document.querySelectorAll('[data-csp-args*="pv-import-preco"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));
    const resetImportInput = () => {
        btns.forEach((b) => b.removeAttribute('disabled'));
        input.value = '';
    };

    if (typeof _precoDirty !== 'undefined' && _precoDirty) {
        const proceed = await appConfirm(
            'Masz niezapisane zmiany w cenniku PRECO. Czy kontynuować import? Niezapisane zmiany zostaną utracone.',
            { title: 'Niezapisane zmiany', type: 'warning' }
        );
        if (!proceed) {
            resetImportInput();
            return;
        }
    }

    // Import trafia do WERSJI wybranej na osi PRECO — popup mówi do której.
    const pv = window.pricelistVersions;
    if (!pv || typeof pv.transferVersion !== 'function') {
        showToast('Panel wersji nie jest gotowy — odśwież stronę', 'error');
        resetImportInput();
        return;
    }
    const targetVersion = await pv.transferVersion('preco');
    if (!targetVersion) {
        showToast('Brak wersji cennika PRECO — najpierw ją utwórz', 'warning');
        resetImportInput();
        return;
    }
    if (!(await pv.transferConfirm('import', 'preco', targetVersion))) {
        resetImportInput();
        return;
    }
    if (!pv.enterVersionEditForImport('preco', targetVersion)) {
        showToast('Otwórz edytor cennika PRECO, aby zaimportować plik', 'error');
        resetImportInput();
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            await ensureXlsx();
            const data = new Uint8Array(/** @type {ArrayBuffer} */ (e.target.result));
            const workbook = XLSX.read(data, { type: 'array' });
            const parsed = window.pricelistXlsx.parseWorkbookToJson(XLSX, workbook, {
                includePreco: true
            });
            const precoDataMap = parsed.precoDataMap || {};
            if (Object.keys(precoDataMap).length === 0) {
                showToast(
                    'Plik nie zawiera arkuszy PRECO_* (użyj eksportu cennika PRECO)',
                    'error'
                );
                return;
            }

            // Wersja jest już otwarta do edycji → „Zapisz” podmieni jej ceny.
            precoPricing = precoDataMap;
            _precoDirty = true;
            updatePrecoSaveBtn();
            renderPrecoPriceList();
            showToast(
                'Zaimportowano PRECO do ' +
                    (targetVersion.version || 'wersji') +
                    ' — kliknij Zapisz, aby podmienić ceny tej wersji',
                'success'
            );
        } catch (err) {
            logger.error('pricelistManager', 'PRECO import error:', err);
            const issues = window.pricelistXlsx.issuesFromDetails(err.details);
            if (issues.length > 0) {
                window.pricelistXlsx.openImportErrorsModal({ issues });
            } else {
                showToast('Błąd importu PRECO: ' + err.message, 'error');
            }
        } finally {
            resetImportInput();
        }
    };
    reader.onerror = () => {
        resetImportInput();
        showToast('Błąd odczytu pliku', 'error');
    };
    reader.readAsArrayBuffer(file);
}

window.importPrecoFromExcel = importPrecoFromExcel;
