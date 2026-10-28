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
    const dnColKey = HEADER_TO_KEY['dn'] || 'dn';
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

            const rawDn = raw[dnColKey];
            if (product.dn !== null && typeof rawDn === 'string' && rawDn.includes('/')) {
                product.dn = rawDn;
            }

            if (product.magazynWL == null) product.magazynWL = 0;
            if (product.magazynKLB == null) product.magazynKLB = 0;
            if (product.formaStandardowa == null) product.formaStandardowa = 1;
            if (product.formaStandardowaKLB == null) product.formaStandardowaKLB = 1;

            if (typeof renamePłyty === 'function') {
                renamePłyty(product);
            }
        }
    };
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
    if (!pv.enterVersionEditForImport('studnie', targetVersion)) {
        showToast('Otwórz edytor cennika studni, aby zaimportować plik', 'error');
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
            const normalized = window.pricelistXlsx.normalizeRows(
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

/**
 * Automatycznie naprawia brakujące metadane w produktach (np. dodanych wcześniej ręcznie)
 */
async function fixIncompleteProducts() {
    let changed = false;
    studnieProducts.forEach((p) => {
        if (p.magazynKLB === undefined) {
            p.magazynKLB = 1;
            changed = true;
        }
        if (p.magazynWL === undefined) {
            p.magazynWL = 1;
            changed = true;
        }
        if (p.active === undefined) {
            p.active = 1;
            changed = true;
        }

        const n = (p.name || '').toUpperCase();
        const cat = (p.category || '').toUpperCase();

        if (!p.componentType || p.componentType === 'krag') {
            let newType = p.componentType || 'krag';
            if (n.includes('REDUKCYJNA')) newType = 'plyta_redukcyjna';
            else if (n.includes('DENNICA')) newType = 'dennica';
            else if (n.includes('KONUS') || n.includes('STOŻEK')) newType = 'konus';
            else if (n.includes('PŁYTA DIN') || n.includes('NAKR')) newType = 'plyta_din';
            else if (n.includes('NAJAZDOWA')) newType = 'plyta_najazdowa';
            else if (n.includes('ZAMYKAJĄCA')) newType = 'plyta_zamykajaca';
            else if (n.includes('ODCIĄŻAJĄCY')) newType = 'pierscien_odciazajacy';
            else if (n.includes('USZCZELKA')) newType = 'uszczelka';
            else if (n.includes('WŁAZ')) newType = 'wlaz';
            else if (n.includes('AVR')) newType = 'avr';

            if (newType !== p.componentType) {
                p.componentType = newType;
                changed = true;
            }
        }

        if (!p.dn || p.dn === null) {
            const dnMatch = (cat + ' ' + n).match(/DN(\d+)/i);
            if (dnMatch) {
                p.dn = parseInt(dnMatch[1]);
                changed = true;
            } else if (n.includes('STYCZNA')) {
                p.dn = 'styczna';
                changed = true;
            }
        }
    });

    if (changed) {
        await saveStudnieProducts(studnieProducts);
        logger.info(
            'pricelistManager',
            'Zastosowano automatyczne poprawki metadanych do produktów studni'
        );
    }
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

if (typeof studnieProducts !== 'undefined' && !window.__STUDNIE_APP_ORCHESTRATOR__) {
    setTimeout(fixIncompleteProducts, 1000);
}
