/// <reference lib="dom" />

import fs from 'node:fs';
import vm from 'node:vm';

const sources = [
    'public/js/shared/pricelistVersions.js',
    'public/js/studnie/uiHelpers.js',
    'public/js/studnie/pricelistSaveReset.js'
];

describe('zapis cennika studni', () => {
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
                            target: editDraft ? 'draft' : 'version',
                            versionId: target?.id,
                            ...(editDraft ? {} : { sha256: savedSha })
                        })
                    };
                }
                if (url === '/api/pricelist-versions/active/export') {
                    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
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
            XLSX: { read: () => versionRows },
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
