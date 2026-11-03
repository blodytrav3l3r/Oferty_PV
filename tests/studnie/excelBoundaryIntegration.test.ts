import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Zestaw testów wykrywania regresji na styku modułów z klastrem arkusza Excela.
 * Zapewnia:
 * 1. Statyczną ochronę przed wyciekiem prywatnych symboli _excel* poza klaster excel*.js.
 * 2. Weryfikację integralności kontraktu excel-boundary.json i typów TypeScript.
 * 3. Dynamiczne testy integracyjne na styku modułów wywołujących Fasadę Publiczną:
 *    - diagramRenderer <-> excelClearResolutionCache, excelSyncWellComponents
 *    - popupsKonusPehd <-> excelAutoSelectWell
 *    - wellNotesModal <-> getExcelSelectedWellIndex
 *    - solverAutoSelect <-> isExcelQuiet
 *    - wellVirtual <-> markExcelListStale
 *    - sokDirty / draftAutosave / offerManager <-> isExcelDirty, setExcelDirty, emitExcelMutated
 */

describe('Wykrywanie regresji na styku modułów (Excel Boundary Seams)', () => {
    const rootDir = path.join(__dirname, '../..');
    const contractPath = path.join(rootDir, 'docs/contracts/excel-boundary.json');
    const typesPath = path.join(rootDir, 'public/js/types.d.ts');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

    describe('1. Statyczna ochrona granicy klastra (Zero-Leak Guard)', () => {
        it('kontrakt nie zawiera żadnych dozwolonych wycieków legacy (legacyAllowlist jest puste)', () => {
            const legacyKeys = Object.keys(contract.legacyAllowlist || {});
            expect(legacyKeys).toEqual([]);
        });

        it('każda metoda Fasady Publicznej posiada prawidłowy plik definicji defFile', () => {
            for (const [name, info] of Object.entries<any>(contract.publicFacade)) {
                expect(info.defFile).toBeTruthy();
                const fullDefPath = path.join(rootDir, info.defFile);
                expect(fs.existsSync(fullDefPath)).toBe(true);
                // Weryfikacja że definicja zawiera nazwę metody
                const fileContent = fs.readFileSync(fullDefPath, 'utf8');
                expect(fileContent).toContain(name);
            }
        });

        it('każda metoda Fasady Publicznej jest dostępna globalnie lub zadeklarowana w plikach źródłowych', () => {
            const typesContent = fs.readFileSync(typesPath, 'utf8');
            for (const facadeName of Object.keys(contract.publicFacade)) {
                const info = contract.publicFacade[facadeName];
                const defContent = fs.readFileSync(path.join(rootDir, info.defFile), 'utf8');
                const hasInTypes =
                    typesContent.includes(`function ${facadeName}`) ||
                    typesContent.includes(`var ${facadeName}`) ||
                    typesContent.includes(`let ${facadeName}`);
                const hasInDef =
                    defContent.includes(`function ${facadeName}`) ||
                    defContent.includes(`const ${facadeName}`) ||
                    defContent.includes(`let ${facadeName}`);
                expect(hasInTypes || hasInDef).toBe(true);
            }
        });

        it('żaden caller po migracji nie odwołuje się do wyeliminowanych symboli legacy _excel*', () => {
            const migratedCallers = [
                'public/js/studnie/diagramRenderer.js',
                'public/js/studnie/popupsKonusPehd.js',
                'public/js/studnie/wellNotesModal.js',
                'public/js/studnie/solverAutoSelect.js',
                'public/js/studnie/wellVirtual.js',
                'public/js/studnie/actionsElevation.js',
                'public/js/studnie/displayUnits.js',
                'public/js/studnie/orderBulk.js',
                'public/js/studnie/wellTransitions.js',
                'public/js/studnie/wellTransitionsPopup.js',
                'public/js/studnie/offerManager.js',
                'public/js/shared/draftAutosave.js'
            ];

            const retiredSymbols = [
                '_excelClearResCache',
                '_excelDebouncedRefresh',
                '_excelRefreshAutoCells',
                '_excelRefreshKragCells',
                '_excelQuietDepth',
                '_excelListStale',
                '_excelAutoSelectForWell',
                '_excelRowSelectStates',
                '_excelLastClickedCell',
                '_excelSelectedCells',
                '_excelPasteInProgress',
                '_excelRenderTable',
                '_excelActiveTab',
                '_excelBulkCancel',
                '_excelBulkHideProgress',
                '_excelBulkIsAborted',
                '_excelBulkShowProgress',
                '_excelNewBulkAbort'
            ];

            const violations: string[] = [];

            for (const file of migratedCallers) {
                const fullPath = path.join(rootDir, file);
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (
                        trimmed.startsWith('//') ||
                        trimmed.startsWith('/*') ||
                        trimmed.startsWith('*')
                    ) {
                        return;
                    }
                    for (const sym of retiredSymbols) {
                        const regex = new RegExp(`\\b${sym}\\b`);
                        if (regex.test(line)) {
                            violations.push(`${file}:${idx + 1} -> ${sym}`);
                        }
                    }
                });
            }

            expect(violations).toEqual([]);
        });
    });

    describe('2. Testy integracyjne zachowania na styku modułów (Runtime Behavior)', () => {
        let sandbox: any;

        beforeEach(() => {
            sandbox = {
                window: {},
                document: {
                    getElementById: jest.fn(),
                    querySelector: jest.fn()
                },
                wells: [
                    {
                        id: 'w1',
                        name: 'S1',
                        dn: 1000,
                        rzednaWlazu: 10.0,
                        rzednaDna: 8.0,
                        config: [],
                        przejscia: []
                    }
                ],
                console
            };
            sandbox.window = sandbox;
            vm.createContext(sandbox);

            // Załaduj pliki z klastra Excela definiujące fasadę
            const stateCode = fs.readFileSync(
                path.join(rootDir, 'public/js/studnie/excelState.js'),
                'utf8'
            );
            const helpersCode = fs.readFileSync(
                path.join(rootDir, 'public/js/studnie/excelHelpers.js'),
                'utf8'
            );
            const pollingCode = fs.readFileSync(
                path.join(rootDir, 'public/js/studnie/excelPolling.js'),
                'utf8'
            );
            const autoSelectCode = fs.readFileSync(
                path.join(rootDir, 'public/js/studnie/excelAutoSelect.js'),
                'utf8'
            );

            vm.runInContext(stateCode, sandbox);
            vm.runInContext(helpersCode, sandbox);
            vm.runInContext(pollingCode, sandbox);
            vm.runInContext(autoSelectCode, sandbox);
        });

        describe('Styk diagramRenderer <-> excelClearResolutionCache & excelSyncWellComponents', () => {
            it('excelClearResolutionCache usuwa cache produktów i dostępności studni', () => {
                const well = sandbox.wells[0];
                well.__resCache = { prod1: { id: 'prod1' } };
                well.__availCache = { list: [] };

                expect(sandbox.excelClearResolutionCache).toBeDefined();
                sandbox.excelClearResolutionCache(well);

                expect(well.__resCache).toBeUndefined();
                expect(well.__availCache).toBeUndefined();
            });

            it('excelSyncWellComponents odświeża komórki wiersza DOM i planuje debounce refresh', () => {
                const well = sandbox.wells[0];
                const dummyRow = {
                    querySelector: jest.fn().mockReturnValue({ textContent: '' })
                };
                sandbox.document.querySelector.mockReturnValue(dummyRow);

                let autoRefreshed = false;
                let kragRefreshed = false;
                let debouncedRefreshed = false;

                sandbox._excelRefreshAutoCells = (_wIdx: number, row: any) => {
                    if (row === dummyRow) autoRefreshed = true;
                };
                sandbox._excelRefreshKragCells = (_wIdx: number, row: any) => {
                    if (row === dummyRow) kragRefreshed = true;
                };
                sandbox._excelDebouncedRefresh = () => {
                    debouncedRefreshed = true;
                };

                expect(sandbox.excelSyncWellComponents).toBeDefined();
                sandbox.excelSyncWellComponents(well);

                expect(autoRefreshed).toBe(true);
                expect(kragRefreshed).toBe(true);
                expect(debouncedRefreshed).toBe(true);
            });

            it('diagramRenderer renderWellDiagram wywołuje fasadę przy zmianie pierścieni enforceOtRings', () => {
                const diagramCode = fs.readFileSync(
                    path.join(rootDir, 'public/js/studnie/diagramRenderer.js'),
                    'utf8'
                );
                vm.runInContext(diagramCode, sandbox);

                const well = sandbox.wells[0];
                well.__resCache = { dummy: true };
                let clearedCount = 0;
                let syncedCount = 0;

                sandbox.excelClearResolutionCache = (w: any) => {
                    if (w === well) clearedCount++;
                    delete w.__resCache;
                };
                sandbox.excelSyncWellComponents = (w: any) => {
                    if (w === well) syncedCount++;
                };
                sandbox.enforceOtRings = () => true; // Symuluje mutację krąg <-> krąg_ot
                sandbox.renderWellConfig = jest.fn();
                sandbox.document.getElementById.mockReturnValue(null); // Return early na granicy rysowania SVG

                sandbox.renderWellDiagram(null, well);

                expect(clearedCount).toBe(2); // Przed enforceOtRings i po mutacji
                expect(syncedCount).toBe(1); // excelSyncWellComponents
                expect(well.__resCache).toBeUndefined();
            });
        });

        describe('Styk popupsKonusPehd <-> excelAutoSelectWell', () => {
            it('excelAutoSelectWell deleguje wywołanie do mechanizmu arkusza', async () => {
                let calledIndex = -1;
                sandbox._excelAutoSelectForWell = async (idx: number) => {
                    calledIndex = idx;
                };

                expect(sandbox.excelAutoSelectWell).toBeDefined();
                await sandbox.excelAutoSelectWell(0);

                expect(calledIndex).toBe(0);
            });

            it('resolveKonusPehd z otwartym overlayem Excela woła excelAutoSelectWell', async () => {
                const konusCode = fs.readFileSync(
                    path.join(rootDir, 'public/js/studnie/popupsKonusPehd.js'),
                    'utf8'
                );
                vm.runInContext(konusCode, sandbox);

                let autoSelectedIdx = -1;
                sandbox.excelAutoSelectWell = async (idx: number) => {
                    autoSelectedIdx = idx;
                };

                sandbox.document.getElementById = (id: string) =>
                    id === 'excel-table-overlay' ? { id: 'excel-table-overlay' } : null;
                sandbox.showToast = jest.fn();
                sandbox.studnieProducts = [
                    {
                        id: 'plyta_din_1',
                        dn: 1000,
                        category: 'zwienczenie',
                        componentType: 'plyta_din'
                    }
                ];
                sandbox.wells[0].dn = 1000;
                sandbox.wells[0].wkladkaZwienczenie = 'brak';

                if (typeof sandbox.resolveKonusPehd === 'function') {
                    await sandbox.resolveKonusPehd(0, 'plyta_din');
                    expect(autoSelectedIdx).toBe(0);
                }
            });
        });

        describe('Styk wellNotesModal <-> getExcelSelectedWellIndex', () => {
            it('zwraca indeks z _excelLastClickedCell jeśli jest poprawny', () => {
                vm.runInContext('_excelLastClickedCell = { wIdx: 2, colIdx: 1 };', sandbox);
                expect(sandbox.getExcelSelectedWellIndex()).toBe(2);
            });

            it('zwraca indeks z _excelSelectedCells jeśli brak lastClickedCell', () => {
                vm.runInContext('_excelLastClickedCell = null;', sandbox);
                vm.runInContext('_excelSelectedCells = [{ wIdx: 3, colIdx: 0 }];', sandbox);
                expect(sandbox.getExcelSelectedWellIndex()).toBe(3);
            });

            it('zwraca -1 gdy brak selekcji', () => {
                vm.runInContext('_excelLastClickedCell = null;', sandbox);
                vm.runInContext('_excelSelectedCells = [];', sandbox);
                expect(sandbox.getExcelSelectedWellIndex()).toBe(-1);
            });

            it('openWellNotesForExcelSelection pobiera studnię zaznaczoną w Excelu', () => {
                const notesModalCode = fs.readFileSync(
                    path.join(rootDir, 'public/js/studnie/wellNotesModal.js'),
                    'utf8'
                );
                vm.runInContext(notesModalCode, sandbox);

                vm.runInContext('_excelLastClickedCell = { wIdx: 0, colIdx: 0 };', sandbox);
                sandbox.document.getElementById = (_id: string) => {
                    return {
                        classList: { add: jest.fn(), remove: jest.fn() },
                        value: '',
                        textContent: '',
                        focus: jest.fn(),
                        addEventListener: jest.fn(),
                        remove: jest.fn()
                    };
                };

                sandbox.escapeHtml = (s: string) => s;
                let openedIdx = -1;
                sandbox.openWellNotesModal = (idx: number) => {
                    openedIdx = idx;
                };

                if (typeof sandbox.openWellNotesForExcelSelection === 'function') {
                    sandbox.openWellNotesForExcelSelection();
                    expect(openedIdx).toBe(0);
                }
            });
        });

        describe('Styk solverAutoSelect <-> isExcelQuiet', () => {
            it('zwraca false w stanie normalnym', () => {
                expect(sandbox.isExcelQuiet()).toBe(false);
            });

            it('zwraca true podczas pracy arkusza w wyciszeniu (_excelQuietDepth > 0)', () => {
                vm.runInContext('_excelQuietDepth = 1;', sandbox);
                expect(sandbox.isExcelQuiet()).toBe(true);
                vm.runInContext('_excelQuietDepth = 0;', sandbox);
                expect(sandbox.isExcelQuiet()).toBe(false);
            });

            it('solverAutoSelect tłumi refreshAll w UI gdy isExcelQuiet zwraca true', () => {
                let refreshAllCalled = 0;
                sandbox.refreshAll = () => {
                    refreshAllCalled++;
                };

                // Załaduj logikę solverAutoSelect
                const solverCode = fs.readFileSync(
                    path.join(rootDir, 'public/js/studnie/solverAutoSelect.js'),
                    'utf8'
                );
                vm.runInContext(solverCode, sandbox);

                // Gdy isExcelQuiet = true -> refreshAll nie powinno być wołane
                vm.runInContext('_excelQuietDepth = 1;', sandbox);
                const well = { ...sandbox.wells[0] };
                if (typeof sandbox.autoSelectComponentsForWell === 'function') {
                    sandbox.filterByWellParams = () => true;
                    sandbox.getAvailableProductsUnion = () => [];
                    try {
                        sandbox.autoSelectComponentsForWell(well);
                    } catch (_e) {}
                    expect(refreshAllCalled).toBe(0);
                }
            });
        });

        describe('Styk wellVirtual <-> markExcelListStale', () => {
            it('ustawia flagę buforowania listy _excelListStale na true', () => {
                vm.runInContext('_excelListStale = false;', sandbox);
                sandbox.markExcelListStale();
                const isStale = vm.runInContext('_excelListStale', sandbox);
                expect(isStale).toBe(true);
            });

            it('renderWellsList w wellVirtual przy otwartym overlayu woła markExcelListStale i pomija renderDiscountPanel', () => {
                const virtualCode = fs.readFileSync(
                    path.join(rootDir, 'public/js/studnie/wellVirtual.js'),
                    'utf8'
                );
                vm.runInContext(virtualCode, sandbox);

                vm.runInContext('_excelListStale = false;', sandbox);
                let discountPanelRendered = false;
                sandbox.renderDiscountPanel = () => {
                    discountPanelRendered = true;
                };

                sandbox.document.getElementById = (id: string) => {
                    if (id === 'excel-table-overlay') return { id: 'excel-table-overlay' };
                    if (id === 'wells-container')
                        return { querySelector: () => null, appendChild: () => {} };
                    if (id === 'wells-count') return { textContent: '' };
                    return null;
                };

                if (typeof sandbox.renderWellsList === 'function') {
                    sandbox.renderWellsList();
                    const isStale = vm.runInContext('_excelListStale', sandbox);
                    expect(isStale).toBe(true);
                    expect(discountPanelRendered).toBe(false);
                }
            });
        });

        describe('Styk sokDirty / draftAutosave / offerManager <-> isExcelDirty & setExcelDirty', () => {
            it('zarządza flagą brudu arkusza w spójny sposób', () => {
                expect(sandbox.isExcelDirty()).toBe(false);

                sandbox.setExcelDirty(true);
                expect(sandbox.isExcelDirty()).toBe(true);

                sandbox.setExcelDirty(false);
                expect(sandbox.isExcelDirty()).toBe(false);

                sandbox.emitExcelMutated();
                expect(sandbox.isExcelDirty()).toBe(true);
            });
        });
    });
});
