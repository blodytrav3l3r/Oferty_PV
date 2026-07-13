/* ===== IMPORT / EKSPORT EXCEL ===== */

const EXPORT_COLUMNS = [
    { key: 'id', header: 'Indeks' },
    { key: 'name', header: 'Nazwa' },
    { key: 'category', header: 'Kategoria' },
    { key: 'componentType', header: 'Typ komponentu' },
    { key: 'dn', header: 'DN' },
    { key: 'height', header: 'Wysokość mm' },
    { key: 'weight', header: 'Waga kg' },
    { key: 'area', header: 'Pow. wewn. m²' },
    { key: 'areaExt', header: 'Pow. zewn. m²' },
    { key: 'transport', header: 'Ilość/transport' },
    { key: 'price', header: 'Cena PLN' },
    { key: 'doplataPEHD', header: 'Dopłata PEHD' },
    { key: 'malowanieWewnetrzne', header: 'Malow. wewn.' },
    { key: 'malowanieZewnetrzne', header: 'Malow. zewn.' },
    { key: 'doplataZelbet', header: 'Dopłata Żelbet' },
    { key: 'doplataDrabNierdzewna', header: 'Drab. Nierdzewna' },
    { key: 'magazynWL', header: 'Mag WL' },
    { key: 'magazynKLB', header: 'Mag KLB' },
    { key: 'formaStandardowa', header: 'Forma std. WL' },
    { key: 'formaStandardowaKLB', header: 'Forma std. KLB' },
    { key: 'zapasDol', header: 'Zapas dół mm' },
    { key: 'zapasGora', header: 'Zapas góra mm' },
    { key: 'zapasDolMin', header: 'Zapas dół min mm' },
    { key: 'zapasGoraMin', header: 'Zapas góra min mm' },
    { key: 'spocznikH', header: 'Wys. spocznika' },
    { key: 'hMin1', header: 'Hmin 1 mm' },
    { key: 'hMax1', header: 'Hmax 1 mm' },
    { key: 'cena1', header: 'Cena 1 PLN' },
    { key: 'hMin2', header: 'Hmin 2 mm' },
    { key: 'hMax2', header: 'Hmax 2 mm' },
    { key: 'cena2', header: 'Cena 2 PLN' },
    { key: 'hMin3', header: 'Hmin 3 mm' },
    { key: 'hMax3', header: 'Hmax 3 mm' },
    { key: 'cena3', header: 'Cena 3 PLN' }
];

const HEADER_TO_KEY = {};
EXPORT_COLUMNS.forEach((c) => {
    HEADER_TO_KEY[c.header] = c.key;
    HEADER_TO_KEY[c.key] = c.key;
});
HEADER_TO_KEY['Forma std.'] = 'formaStandardowa';

function exportStudnieToExcel() {
    if (!studnieProducts || studnieProducts.length === 0) {
        showToast('Brak danych do eksportu', 'error');
        return;
    }

    try {
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

            let sheetName = cat.replace(/[\[\]\*\/\\\?\:]/g, '_').substring(0, 31);
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

function importStudnieFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(/** @type {ArrayBuffer} */ (e.target.result));
            const workbook = XLSX.read(data, { type: 'array' });

            let allJson = [];
            let precoDataMap = {};

            workbook.SheetNames.forEach((sheetName) => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                if (sheetJson && sheetJson.length > 0) {
                    if (sheetName.startsWith('PRECO_')) {
                        sheetJson.forEach((row) => {
                            const dn = row['DN Studni'];
                            if (dn) {
                                if (!precoDataMap[dn]) {
                                    precoDataMap[dn] = {
                                        kinety: [],
                                        spadekKineta: [],
                                        spadekMufa: [],
                                        uniesienie: [],
                                        redukcja: [],
                                        skrzynkaWlazowa: null,
                                        cenaPelnaWysMB: 0,
                                        cenaDnoOsadnika: 0
                                    };
                                }

                                if (sheetName === 'PRECO_Kinety') {
                                    precoDataMap[dn].kinety.push({
                                        dn: row['DN Rury'] || 0,
                                        prosta: row['Cena prosta (PLN)'] || 0,
                                        dodWlot: row['Dod. wlot (PLN)'] || 0
                                    });
                                } else if (sheetName === 'PRECO_Dodatki') {
                                    precoDataMap[dn].skrzynkaWlazowa = row['Skrzynka włazowa'] || 0;
                                    precoDataMap[dn].cenaPelnaWysMB = row['Cena pełna wys MB'] || 0;
                                    precoDataMap[dn].cenaDnoOsadnika =
                                        row['Cena dna osadnika'] || 0;
                                } else if (sheetName === 'PRECO_Zakresy') {
                                    const typ = row['Typ'];
                                    if (typ && precoDataMap[dn][typ]) {
                                        const min = row['Min'] || 0;
                                        const max = row['Max'] || 0;
                                        const g = row['Grupa DN'];
                                        const cena = row['Cena (PLN)'] || 0;

                                        let table = precoDataMap[dn][typ];
                                        let existingRow = table.find(
                                            (r) => r.min === min && r.max === max
                                        );
                                        if (!existingRow) {
                                            existingRow = { min, max, grupy: {} };
                                            table.push(existingRow);
                                        }
                                        if (g) existingRow.grupy[g] = cena;
                                    }
                                }
                            }
                        });
                    } else {
                        allJson = allJson.concat(sheetJson);
                    }
                }
            });

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

            const seenIds = new Set();
            const normalized = allJson
                .map((raw, index) => {
                    const product = {};

                    Object.keys(raw).forEach((col) => {
                        const key = HEADER_TO_KEY[col] || col;
                        product[key] = raw[col];
                    });

                    product.id = String(product.id || '').trim();
                    product.name = String(product.name || '').trim();

                    if (!product.id || !product.name) {
                        logger.warn(
                            'pricelistManager',
                            `[Import Studnie] Row ${index + 2} skipped: missing ID or Name`
                        );
                        return null;
                    }

                    if (seenIds.has(product.id)) {
                        logger.warn(
                            'pricelistManager',
                            `[Import Studnie] Row ${index + 2} skipped: duplicate ID ${product.id}`
                        );
                        return null;
                    }
                    seenIds.add(product.id);

                    product.category = String(product.category || '').trim() || 'Inne';
                    product.componentType = String(product.componentType || '').trim();
                    if (product.category.startsWith('Kinety') && !product.componentType) {
                        product.componentType = 'kineta';
                    }

                    numericFields.forEach((f) => {
                        let valValue = product[f];
                        if (
                            valValue === '' ||
                            valValue === undefined ||
                            valValue === null ||
                            valValue === '—' ||
                            valValue === '-'
                        ) {
                            if (
                                [
                                    'magazynWL',
                                    'magazynKLB',
                                    'formaStandardowa',
                                    'formaStandardowaKLB'
                                ].includes(f)
                            ) {
                                product[f] = 1;
                            } else {
                                product[f] = null;
                            }
                        } else if (typeof valValue === 'string') {
                            product[f] = valValue !== '' ? parseDecimal(valValue) : null;
                        } else if (typeof valValue === 'number') {
                            product[f] = Number.isFinite(valValue) ? valValue : null;
                        }
                    });

                    const rawDn = raw[HEADER_TO_KEY['dn'] || 'dn'];
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

                    return product;
                })
                .filter((p) => p !== null);

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
                studnieProducts = normalized;
                recalculatePEHDInternal(pehdPricePerM2);
                _studniePricelistDirty = true;
                updateStudnieSaveBtn();
            }

            if (hasPrecoData) {
                precoPricing = precoDataMap;
                savePrecoPricing(precoPricing);
            }

            renderStudniePriceList();
            renderTiles();
            showToast(`Pomyślnie zaimportowano cennik z Excela`, 'success');
        } catch (err) {
            logger.error('pricelistManager', 'Import error:', err);
            showToast('Błąd podczas importu pliku Excel', 'error');
        }
        event.target.value = '';
    };
    reader.onerror = () => showToast('Błąd odczytu pliku', 'error');
    reader.readAsArrayBuffer(file);
}
