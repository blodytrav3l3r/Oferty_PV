async function exportStudnieToExcel() {
    if (!studnieProducts || studnieProducts.length === 0) {
        showToast('Brak danych do eksportu', 'error');
        return;
    }

    try {
        await ensureXlsx();
        const wb = XLSX.utils.book_new();

        function getSheetName(p) {
            const c = (p.category || '').toLowerCase();
            const ct = (p.componentType || '').toLowerCase();

            if (
                c.includes('akcesoria') ||
                c.includes('chemia') ||
                c.includes('stopnie') ||
                c.includes('uszczelki') ||
                ct === 'wlaz' ||
                ct === 'osadnik'
            )
                return 'Akcesoria';
            if (
                c.includes('przejścia') ||
                c.includes('przejscia') ||
                c.includes('otwór') ||
                c.includes('otwor') ||
                ct === 'przejscie'
            )
                return 'Przejścia';
            if (c.includes('kinet') || ct === 'kineta') return 'Kinety';
            if (c.includes('dennic') || ct === 'dennica') return 'Dennicy';

            if (p.dn) {
                return 'DN' + p.dn;
            }

            return 'Inne';
        }

        const categories = {};
        studnieProducts.forEach((p) => {
            const cat = getSheetName(p);
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(p);
        });

        Object.keys(categories).forEach((cat) => {
            if (cat === 'Przejścia') {
                categories[cat] = [...categories[cat]].sort((a, b) => {
                    if (a.category !== b.category)
                        return (a.category || '').localeCompare(b.category || '');
                    const dnA = typeof a.dn === 'string' ? parseInt(a.dn) || 0 : a.dn || 0;
                    const dnB = typeof b.dn === 'string' ? parseInt(b.dn) || 0 : b.dn || 0;
                    return dnA - dnB;
                });
            }

            const rows = categories[cat].map((p) => {
                const row = {};
                EXPORT_COLUMNS.forEach((col) => {
                    row[col.header] = p[col.key] ?? '';
                });
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(rows);

            ws['!cols'] = EXPORT_COLUMNS.map((col) => ({
                wch: Math.max(col.header.length + 2, 15)
            }));

            const sheetName = cat.replace(/[[\]*/\\?:]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        if (precoPricing && Object.keys(precoPricing).length > 0) {
            const precoKinetyRows = [];
            const precoZakresyRows = [];
            const precoDodatkiRows = [];

            Object.keys(precoPricing).forEach((dn) => {
                const data = precoPricing[dn];
                if (!data) return;

                if (data.kinety) {
                    data.kinety.forEach((k) => {
                        precoKinetyRows.push({
                            'DN Studni': Number(dn),
                            'DN Rury': k.dn,
                            'Cena prosta (PLN)': k.prosta,
                            'Dod. wlot (PLN)': k.dodWlot
                        });
                    });
                }

                ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'].forEach((typ) => {
                    if (data[typ]) {
                        data[typ].forEach((row) => {
                            if (row.grupy) {
                                Object.keys(row.grupy).forEach((g) => {
                                    precoZakresyRows.push({
                                        Typ: typ,
                                        'DN Studni': Number(dn),
                                        Min: row.min,
                                        Max: row.max,
                                        'Grupa DN': g,
                                        'Cena (PLN)': row.grupy[g]
                                    });
                                });
                            }
                        });
                    }
                });

                precoDodatkiRows.push({
                    'DN Studni': Number(dn),
                    'Skrzynka włazowa': data.skrzynkaWlazowa || 0,
                    'Cena dna osadnika': data.cenaDnoOsadnika || 0,
                    'Cena pełna wys MB': data.cenaPelnaWysMB || 0
                });
            });

            if (precoKinetyRows.length > 0) {
                const ws = XLSX.utils.json_to_sheet(precoKinetyRows);
                ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
                XLSX.utils.book_append_sheet(wb, ws, 'PRECO_Kinety');
            }
            if (precoZakresyRows.length > 0) {
                const ws = XLSX.utils.json_to_sheet(precoZakresyRows);
                ws['!cols'] = [
                    { wch: 15 },
                    { wch: 12 },
                    { wch: 8 },
                    { wch: 8 },
                    { wch: 12 },
                    { wch: 15 }
                ];
                XLSX.utils.book_append_sheet(wb, ws, 'PRECO_Zakresy');
            }
            if (precoDodatkiRows.length > 0) {
                const ws = XLSX.utils.json_to_sheet(precoDodatkiRows);
                ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
                XLSX.utils.book_append_sheet(wb, ws, 'PRECO_Dodatki');
            }
        }

        XLSX.writeFile(wb, 'Cennik_Studni_Export.xlsx');
        showToast(
            'Wyeksportowano cennik do Excela (' +
                studnieProducts.length +
                ' pozycji w ' +
                Object.keys(categories).length +
                ' zakładkach)',
            'success'
        );
    } catch (err) {
        logger.error('pricelistManager', 'Export error:', err);
        showToast('Błąd podczas eksportu do Excela', 'error');
    }
}

async function importStudnieFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const btns = document.querySelectorAll('[onclick*="importStudnieFromExcel"]');
    btns.forEach((b) => b.setAttribute('disabled', 'true'));

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

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            await ensureXlsx();
            const data = new Uint8Array(/** @type {ArrayBuffer} */ (e.target.result));
            const workbook = XLSX.read(data, { type: 'array' });

            const parsed = pricelistXlsx.parseWorkbookToJson(XLSX, workbook, {
                includePreco: true
            });
            const allJson = parsed.rows;
            const precoDataMap = parsed.precoDataMap;

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
            const normalized = pricelistXlsx.normalizeRows(allJson, {
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

            const confirmImport = await appConfirm(
                `Zaimportować dane? Aktualny cennik zostanie zastąpiony.`,
                { title: 'Import cennika', type: 'warning' }
            );
            if (!confirmImport) return;

            if (normalized.length > 0) {
                window.studnieProducts = normalized;
                _studniePricelistDirty = true;
                updateStudnieSaveBtn();
            }

            if (hasPrecoData) {
                precoPricing = precoDataMap;
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
            btns.forEach((b) => b.removeAttribute('disabled'));
        }
        event.target.value = '';
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
