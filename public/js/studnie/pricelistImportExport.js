async function exportStudnieToExcel() {
    if (!studnieProducts || studnieProducts.length === 0) {
        showToast('Brak danych do eksportu', 'error');
        return;
    }

    try {
        // Etap C: plik buduje serwer — pobranie zamiast budowania SheetJS (import dalej używa XLSX).
        const exportRes = await fetch('/api/products-studnie/export.xlsx?source=live', {
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        if (!exportRes.ok) throw new Error('Błąd HTTP ' + exportRes.status);
        const exportBlob = await exportRes.blob();
        const exportLink = document.createElement('a');
        exportLink.href = URL.createObjectURL(exportBlob);
        exportLink.download = 'Cennik_Studni_Export.xlsx';
        document.body.appendChild(exportLink);
        exportLink.click();
        setTimeout(() => {
            URL.revokeObjectURL(exportLink.href);
            exportLink.remove();
        }, 1000);
        showToast(
            'Wyeksportowano cennik do Excela (' + studnieProducts.length + ' pozycji)',
            'success'
        );
        return;
    } catch (err) {
        logger.error('pricelistManager', 'Export error:', err);
        showToast('Błąd podczas eksportu do Excela', 'error');
    }
}

async function importStudnieFromExcel(event, opts) {
    const file = event.target.files[0];
    if (!file) return;
    // Etap D: cel importu — 'live' (default, zachowanie jak dziś) albo 'draft'
    // (POST /api/pricelist-versions/studnie/drafts dla produktów + POST
    // /api/pricelist-versions/preco/drafts dla arkuszy PRECO_* po konwersji
    // window.pricelistXlsx.precoNestedToFlat 1:1 z flattenAndSave).
    // Etap E: bez jawnego opts.target cel wybiera użytkownik w modalu po parsowaniu.
    const explicitTarget = (opts && opts.target) || null;
    const explicitNote = (opts && opts.note) || '';

    const btns = document.querySelectorAll('[onclick*="importStudnieFromExcel"]');
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
            btns.forEach((b) => b.removeAttribute('disabled'));
            event.target.value = '';
            return;
        }
    }

    let modalShown = false;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            await ensureXlsx();
            const data = new Uint8Array(/** @type {ArrayBuffer} */ (e.target.result));
            const workbook = XLSX.read(data, { type: 'array' });

            const parsed = window.pricelistXlsx.parseWorkbookToJson(XLSX, workbook, {
                includePreco: true
            });
            const { products: allJson, precoDataMap } =
                window.pricelistXlsx.splitStudnieImport(parsed);

            const hasPrecoData = Object.keys(precoDataMap).length > 0;

            if (allJson.length === 0 && !hasPrecoData) {
                showToast('Skoroszyt jest pusty lub ma zły format', 'error');
                return;
            }

            const numericFields = [
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
            ];

            const dnColKey = HEADER_TO_KEY['dn'] || 'dn';
            const normalized = window.pricelistXlsx.normalizeRows(allJson, {
                headerToKey: HEADER_TO_KEY,
                numericFields,
                emptyDefaults: {
                    magazynWL: 1,
                    magazynKLB: 1,
                    formaStandardowa: 1,
                    formaStandardowaKLB: 1
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
            });

            if (normalized.length === 0 && !hasPrecoData) {
                showToast('Brak prawidłowych wierszy do importu (sprawdź Indeks i Nazwę)', 'error');
                return;
            }

            // Etap E: kontynuacja po parsowaniu — cel z modala (UI) albo jawny opts.
            const finishImport = async (data, target, note) => {
                try {
                    const confirmImport = await appConfirm(
                        target === 'draft'
                            ? `Zapisać dane jako wersję roboczą? Cennik na żywo nie zmieni się.`
                            : `Zaimportować dane? Aktualny cennik zostanie zastąpiony.`,
                        { title: 'Import cennika', type: 'warning' }
                    );
                    if (!confirmImport) return;

                    if (target === 'draft') {
                        try {
                            const payload = window.pricelistXlsx.buildDraftPayload(
                                data.normalized,
                                note
                            );
                            const draftHeaders = Object.assign(
                                {},
                                typeof authHeaders === 'function' ? authHeaders() : {},
                                { 'Content-Type': 'application/json' }
                            );
                            const draftRes = await fetch('/api/pricelist-versions/studnie/drafts', {
                                method: 'POST',
                                headers: draftHeaders,
                                body: JSON.stringify(payload)
                            });
                            let draftBody = null;
                            try {
                                draftBody = await draftRes.json();
                            } catch (_e) {
                                draftBody = null;
                            }
                            if (!draftRes.ok)
                                throw new Error(
                                    (draftBody && draftBody.error) || 'Błąd HTTP ' + draftRes.status
                                );
                            const v = (draftBody && draftBody.version) || {};
                            showToast(
                                'Wersja robocza zapisana' +
                                    (v.version ? ' (' + v.version + ')' : ''),
                                'success'
                            );
                            if (
                                data.hasPrecoData &&
                                data.precoDataMap &&
                                Object.keys(data.precoDataMap).length > 0
                            ) {
                                try {
                                    const flat = window.pricelistXlsx.precoNestedToFlat(
                                        data.precoDataMap
                                    );
                                    const precoPayload = window.pricelistXlsx.buildDraftPayload(
                                        flat,
                                        note
                                    );
                                    const precoRes = await fetch(
                                        '/api/pricelist-versions/preco/drafts',
                                        {
                                            method: 'POST',
                                            headers: draftHeaders,
                                            body: JSON.stringify(precoPayload)
                                        }
                                    );
                                    let precoBody = null;
                                    try {
                                        precoBody = await precoRes.json();
                                    } catch (_e) {
                                        precoBody = null;
                                    }
                                    if (!precoRes.ok)
                                        throw new Error(
                                            (precoBody && precoBody.error) ||
                                                'Błąd HTTP ' + precoRes.status
                                        );
                                    const pv = (precoBody && precoBody.version) || {};
                                    showToast(
                                        'Draft PRECO zapisany' +
                                            (pv.version ? ' (' + pv.version + ')' : ''),
                                        'success'
                                    );
                                } catch (precoErr) {
                                    logger.error(
                                        'pricelistManager',
                                        'Preco draft import error:',
                                        precoErr
                                    );
                                    showToast(
                                        'Błąd zapisu draftu PRECO: ' + precoErr.message,
                                        'error'
                                    );
                                }
                            }
                        } catch (err) {
                            logger.error('pricelistManager', 'Draft import error:', err);
                            showToast('Błąd zapisu wersji roboczej: ' + err.message, 'error');
                        }
                        return;
                    }

                    if (data.normalized.length > 0) {
                        window.studnieProducts = data.normalized;
                        _studniePricelistDirty = true;
                        updateStudnieSaveBtn();
                    }

                    if (data.hasPrecoData) {
                        precoPricing = data.precoDataMap;
                        _precoDirty = true;
                        updatePrecoSaveBtn();
                    }

                    renderStudniePriceList();
                    renderTiles();
                    showToast(`Pomyślnie zaimportowano cennik z Excela`, 'success');
                } catch (err) {
                    logger.error('pricelistManager', 'Import error:', err);
                    showToast('Błąd podczas importu pliku Excel', 'error');
                } finally {
                    resetImportInput();
                }
            };

            if (explicitTarget) {
                await finishImport(
                    { normalized, hasPrecoData, precoDataMap },
                    explicitTarget,
                    explicitNote
                );
                return;
            }
            modalShown = true;
            window.pricelistXlsx.openImportTargetModal({
                onPick: (target, note) =>
                    finishImport({ normalized, hasPrecoData, precoDataMap }, target, note),
                onCancel: resetImportInput
            });
        } catch (err) {
            logger.error('pricelistManager', 'Import error:', err);
            showToast('Błąd podczas importu pliku Excel', 'error');
        } finally {
            if (!modalShown) resetImportInput();
        }
    };
    reader.onerror = () => {
        btns.forEach((b) => b.removeAttribute('disabled'));
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

if (typeof studnieProducts !== 'undefined' && !window.__STUDNIE_APP_ORCHESTRATOR__) {
    setTimeout(fixIncompleteProducts, 1000);
}
