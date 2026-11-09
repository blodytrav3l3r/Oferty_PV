/// <reference lib="dom" />

import fs from 'node:fs';
import vm from 'node:vm';

const sources = [
    'public/js/shared/pricelistVersions.js',
    'public/js/studnie/uiHelpers.js',
    'public/js/studnie/pricelistSaveReset.js'
];

describe('zapis cennika studni', () => {
    it('zachowuje zaznaczenia i stan zmian, gdy odczyt po zapisie zwraca stare flagi', async () => {
        const changedRow = { id: 'GRP-RESET', name: 'GRP', price: 230, active: 1 };
        const sandbox = vm.createContext({
            document,
            studnieProducts: [changedRow],
            _studniePricelistDirty: true,
            authHeaders: () => ({}),
            fetch: async () => ({
                ok: true,
                json: async () => ({ ok: true, target: 'version', versionId: 'v1', sha256: 'new' })
            }),
            pricelistVersions: {
                isEditing: () => true,
                versionEditLabel: () => 'Sv2',
                draftHeaders: async () => ({ 'X-Pricelist-Version-Id': 'v1' }),
                readVersionRows: async () => [{ ...changedRow, active: 0 }],
                noteVersionSaved: jest.fn(),
                refreshStatusStrip: jest.fn()
            },
            showToast: jest.fn(),
            updateStudnieSaveBtn: jest.fn(),
            logger: { error: jest.fn(), warn: jest.fn() }
        });
        sandbox.window = sandbox;
        for (const file of sources.slice(1))
            vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);

        await sandbox.saveStudniePriceList();

        expect(sandbox.studnieProducts).toEqual([changedRow]);
        expect(sandbox._studniePricelistDirty).toBe(true);
        expect(sandbox.showToast).toHaveBeenCalledWith(
            'Nie potwierdzono zapisu cennika studni: Odczyt po zapisie różni się od zaznaczeń w siatce',
            'error'
        );
    });

    it('loguje szczegóły różnicy flag, gdy kontrola odczytu zawiedzie', async () => {
        const submitted = [
            { id: 'GRP-1', name: 'GRP', price: 100, active: 1, magazynWL: 1 },
            { id: 'GRP-2', name: 'GRP 2', price: 100, active: 0 }
        ];
        const sandbox = vm.createContext({
            document,
            authHeaders: () => ({}),
            fetch: async () => ({
                ok: true,
                json: async () => ({
                    ok: true,
                    target: 'version',
                    versionId: 'v1',
                    sha256: 'sha-after'
                })
            }),
            pricelistVersions: {
                draftHeaders: async () => ({ 'X-Pricelist-Version-Id': 'v1' }),
                readVersionRows: async () => [{ ...submitted[0], magazynWL: 0 }, submitted[1]],
                noteVersionSaved: jest.fn()
            },
            showToast: jest.fn(),
            logger: { error: jest.fn(), warn: jest.fn() }
        });
        sandbox.window = sandbox;
        vm.runInContext(fs.readFileSync(sources[1], 'utf8'), sandbox);

        const result = await sandbox.saveStudnieProducts(submitted);

        expect(result.error).toBe('Odczyt po zapisie różni się od zaznaczeń w siatce');
        const warnCall = sandbox.logger.warn.mock.calls.find((call: unknown[]) => call[2]);
        expect(warnCall?.[2]).toMatchObject({
            ok: false,
            countDiff: 0,
            missingIds: [],
            extraIds: [],
            flagDiffs: [{ id: 'GRP-1', field: 'magazynWL', submitted: 1, saved: 0 }]
        });
    });

    it.each([
        ['obowiązująca obok szkicu', true, false],
        ['obowiązująca bez szkicu', false, false],
        ['import do szkicu', true, true]
    ])('dwa zapisy i wyjście z edycji (%s)', async (_label, hasDraft, editDraft) => {
        document.body.innerHTML = '<div id="studnie-pricelist-body"></div>';
        const published = {
            id: 'active',
            version: 'Sv2-20261106',
            status: 'APPROVED',
            state: 'ACTIVE',
            sha256: 'before'
        };
        const draft = hasDraft
            ? { id: 'draft', version: 'Sv3-20261106', status: 'DRAFT', sha256: 'draft-sha' }
            : null;
        const savedRow = { id: 'GRP-150', price: 101.01, active: 1, magazynWL: 0, magazynKLB: 1 };
        const draftRow = { ...savedRow, price: 200, active: 0, magazynKLB: 0 };
        const originalRow = hasDraft ? draftRow : { ...savedRow, price: 99 };
        const target = editDraft ? draft : published;
        let editorRows = [originalRow];
        let versionRows = [originalRow];
        let exportRows = [originalRow];
        let savedSha = editDraft ? 'draft-sha' : 'before';
        const requests: RequestInit[] = [];
        const sandbox = vm.createContext({
            document,
            location: { search: '?host=cennik' },
            studnieProducts: [originalRow],
            _studniePricelistDirty: false,
            authHeaders: () => ({}),
            fetch: async (url: string, options: RequestInit) => {
                if (options.method === 'PUT') {
                    requests.push(options);
                    savedSha = 'after';
                    versionRows = JSON.parse(String(options.body)).data.map(
                        (row: typeof savedRow) => ({ ...row, price: savedRow.price })
                    );
                    if (editDraft) editorRows = versionRows;
                    return {
                        ok: true,
                        json: async () => ({
                            ok: true,
                            target: editDraft ? 'draft' : 'version',
                            versionId: target?.id,
                            ...(editDraft ? {} : { sha256: savedSha })
                        })
                    };
                }
                if (url === '/api/pricelist-versions/active/export') {
                    exportRows = options.cache === 'no-store' ? versionRows : [originalRow];
                    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
                }
                if (url === '/api/products-studnie') {
                    return { ok: true, json: async () => ({ data: editorRows }) };
                }
                return {
                    ok: true,
                    json: async () => ({
                        types: {
                            studnie: {
                                active: published,
                                draft: editDraft ? { ...draft, sha256: savedSha } : draft
                            }
                        }
                    })
                };
            },
            fetchWithTimeout: async () => ({
                ok: true,
                json: async () => ({ data: editorRows })
            }),
            XLSX: { read: () => exportRows },
            pricelistXlsx: {
                parseWorkbookToJson: (_xlsx: unknown, workbook: unknown) => workbook,
                splitStudnieImport: (products: unknown) => ({ products }),
                normalizeRows: (products: unknown) => products
            },
            studnieImportOptions: () => ({}),
            showToast: jest.fn(),
            renderStudniePriceList: jest.fn(),
            renderTiles: jest.fn(),
            updateStudnieSaveBtn: jest.fn(),
            logger: { error: jest.fn(), warn: jest.fn() }
        });
        sandbox.window = sandbox;
        for (const file of sources) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);

        sandbox.pricelistVersions.enterVersionEditForImport('studnie', target);
        sandbox.studnieProducts = [{ ...savedRow, price: 101.005 }];
        sandbox._studniePricelistDirty = true;
        await sandbox.saveStudniePriceList();

        sandbox.studnieProducts = [{ ...sandbox.studnieProducts[0], magazynWL: 1 }];
        sandbox._studniePricelistDirty = true;
        await sandbox.saveStudniePriceList();

        expect(requests).toHaveLength(2);
        expect(requests[1].headers).toMatchObject({ 'If-Match': '"after"' });
        if (editDraft) expect(requests[1].headers).not.toHaveProperty('X-Pricelist-Version-Id');
        else expect(requests[1].headers).toHaveProperty('X-Pricelist-Version-Id', 'active');
        expect(JSON.parse(String(requests[1].body))).toEqual({
            data: [{ ...savedRow, magazynWL: 1 }]
        });
        document.getElementById('pv-version-bar-back')?.click();
        expect(sandbox.studnieProducts).toEqual([
            hasDraft && !editDraft ? draftRow : { ...savedRow, magazynWL: 1 }
        ]);
    });
});
