/// <reference lib="dom" />

import fs from 'node:fs';
import vm from 'node:vm';

const version = {
    id: 'active',
    version: 'Sv2-20261106',
    seq: 2,
    status: 'APPROVED',
    state: 'ACTIVE',
    sha256: 'before',
    effectiveFrom: '2026-11-06T22:37:00.000Z'
};
const older = { ...version, id: 'older', version: 'Sv1-20261106', seq: 1, state: 'ARCHIVED' };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it('podgląd zapisanej wersji zachowuje roboczą flagę i cel zapisu po powrocie', async () => {
    document.body.innerHTML =
        '<div id="section-pricelist"><span id="pv-title-version"></span>' +
        '<div id="studnie-pricelist-body"></div><div id="pv-grid-actions">' +
        '<div id="pv-editor-actions"><div id="pv-mode-actions"></div>' +
        '<button id="btn-save-studnie-pricelist">Zapisz</button></div></div></div>';
    const saved = [{ id: 'GRP-150', active: 0, price: 230 }];
    let delayOlder = false;
    let releaseOlder: (() => void) | undefined;
    let releaseOffer: (() => void) | undefined;
    const sandbox = vm.createContext({
        document,
        location: { search: '?host=cennik', hash: '#/cennik' },
        setTimeout,
        clearTimeout,
        MutationObserver,
        studnieProducts: saved,
        _studniePricelistDirty: false,
        fetch: async (url: string) => {
            if (url.endsWith('/rows')) {
                await new Promise<void>((resolve) => {
                    releaseOffer = resolve;
                });
                return {
                    ok: true,
                    json: async () => ({ sheets: { Przejścia: [{ id: 'GRP-150', active: 1 }] } })
                };
            }
            if (url.endsWith('/export')) {
                if (delayOlder && url.includes('/older/')) {
                    await new Promise<void>((resolve) => {
                        releaseOlder = resolve;
                    });
                }
                return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
            }
            const data = url.includes('summary')
                ? { types: { studnie: { active: version, draft: null } } }
                : { versions: [version, older] };
            return { ok: true, json: async () => data };
        },
        authHeaders: () => ({}),
        XLSX: { read: () => saved },
        pricelistXlsx: {
            parseWorkbookToJson: (_xlsx: unknown, workbook: unknown) => workbook,
            splitStudnieImport: (products: unknown) => ({ products }),
            normalizeRows: (products: unknown) => products
        },
        studnieImportOptions: () => ({}),
        escapeHtml: (s: string) => s,
        escapeHtmlAttr: (s: string) => s,
        escapeJsStr: (s: string) => s,
        showToast: jest.fn(),
        renderStudniePriceList: jest.fn(),
        updateStudnieSaveBtn: jest.fn(),
        lucide: { createIcons: jest.fn() }
    });
    sandbox.window = sandbox;
    vm.runInContext(fs.readFileSync('public/js/shared/pricelistVersions.js', 'utf8'), sandbox);
    const pv = sandbox.pricelistVersions;
    pv.enterVersionEditForImport('studnie', version);
    sandbox.studnieProducts = [{ ...saved[0], active: 1 }];
    sandbox._studniePricelistDirty = true;
    await pv.openVersionsPanel('studnie');
    await flush();

    (document.querySelector('[data-pv-select="active"]') as HTMLElement).click();
    await flush();
    expect(sandbox.studnieProducts[0].active).toBe(0);
    expect(pv.isEditing('studnie')).toBe(false);

    await pv.noteVersionSaved(
        'studnie',
        { target: 'version', versionId: 'active', sha256: 'after' },
        null
    );
    await pv.noteVersionSaved(
        'studnie',
        { target: 'version', versionId: 'active', sha256: 'after' },
        [{ ...saved[0], active: 1 }]
    );

    document.getElementById('pv-version-bar-back')?.click();
    expect(sandbox.studnieProducts[0].active).toBe(1);
    expect(pv.isEditing('studnie')).toBe(true);
    expect(pv.versionEditLabel('studnie')).toBe(version.version);
    expect(await pv.draftHeaders('studnie')).toMatchObject({ 'If-Match': '"after"' });
    expect(sandbox._studniePricelistDirty).toBe(true);

    delayOlder = true;
    (document.querySelector('[data-pv-select="older"]') as HTMLElement).click();
    (document.querySelector('[data-pv-select="active"]') as HTMLElement).click();
    await flush();
    releaseOlder?.();
    await flush();
    expect(sandbox.studnieProducts[0].active).toBe(0);
    document.getElementById('pv-version-bar-back')?.click();
    expect(sandbox.studnieProducts[0].active).toBe(1);

    delayOlder = false;
    const pendingOffer = pv.applyOfferPricelist('studnie', 'active');
    (document.querySelector('[data-pv-select="older"]') as HTMLElement).click();
    await flush();
    releaseOffer?.();
    await pendingOffer;
    expect(sandbox.studnieProducts[0].active).toBe(0);
});
