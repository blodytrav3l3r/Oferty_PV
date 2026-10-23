// @ts-nocheck
/**
 * shared/pricelistVersions.js — saveDraftRows/draftHeaders:
 * jeden szkic na typ → brak szkicu = POST /:type/drafts,
 * istniejący szkic = PUT /:id + If-Match (sha256 z /summary).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(
    path.join(ROOT, 'public', 'js', 'shared', 'pricelistVersions.js'),
    'utf8'
);

function loadModule(fetchImpl) {
    const window = {};
    window.authHeaders = () => ({ Authorization: 'Bearer t' });
    const sandbox = {
        window,
        console,
        Promise,
        JSON,
        Date,
        fetch: jest.fn(fetchImpl),
        authHeaders: window.authHeaders,
        escapeHtml: (s) => String(s),
        escapeHtmlAttr: (s) => String(s),
        escapeJsStr: (s) => String(s),
        document: { addEventListener: () => {}, getElementById: () => null },
        showToast: jest.fn(),
        setTimeout
    };
    window.window = window;
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'pricelistVersions.js' });
    return sandbox;
}

const jsonResponse = (body, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });

const emptySummary = { generatedAt: '2026-10-23T00:00:00.000Z', types: {} };
const summaryWithDraft = {
    generatedAt: '2026-10-23T00:00:00.000Z',
    types: {
        rury: {
            active: { id: 'a1', version: 'Rv1-20260901', sha256: 'sha-active' },
            nextScheduled: null,
            draft: { id: 'd1', version: 'Rv2-20261001', sha256: 'sha-draft' },
            draftCount: 1,
            approvedCount: 1,
            archivedCount: 0,
            collisionCount: 0
        }
    }
};

describe('saveDraftRows — jeden szkic na typ', () => {
    it('brak szkicu → POST /:type/drafts z rows i notą', async () => {
        const sb = loadModule(async (url) => {
            if (url.endsWith('/summary')) return jsonResponse(emptySummary);
            return jsonResponse({ version: { id: 'd-new', version: 'Rv1-20261023' } });
        });
        const out = await sb.window.pricelistVersions.saveDraftRows(
            'rury',
            [{ id: 'r1' }],
            ' xls '
        );

        const calls = sb.fetch.mock.calls;
        const draftCall = calls.find((c) => c[0] === '/api/pricelist-versions/rury/drafts');
        expect(draftCall).toBeTruthy();
        expect(draftCall[1].method).toBe('POST');
        expect(JSON.parse(draftCall[1].body)).toEqual({ rows: [{ id: 'r1' }], note: 'xls' });
        expect(out.version.id).toBe('d-new');
    });

    it('istniejący szkic → PUT /:id z If-Match i bez tworzenia drugiego', async () => {
        const sb = loadModule(async (url) => {
            if (url.endsWith('/summary')) return jsonResponse(summaryWithDraft);
            return jsonResponse({ version: { id: 'd1', version: 'Rv2-20261001' } });
        });
        const out = await sb.window.pricelistVersions.saveDraftRows('rury', [{ id: 'r9' }]);

        const urls = sb.fetch.mock.calls.map((c) => c[0]);
        expect(urls).toContain('/api/pricelist-versions/d1');
        expect(urls).not.toContain('/api/pricelist-versions/rury/drafts');
        const put = sb.fetch.mock.calls.find((c) => c[0] === '/api/pricelist-versions/d1');
        expect(put[1].method).toBe('PUT');
        expect(put[1].headers['If-Match']).toBe('"sha-draft"');
        expect(JSON.parse(put[1].body)).toEqual({ rows: [{ id: 'r9' }] });
        expect(out.version.id).toBe('d1');
    });

    it('draftHeaders: sha szkicu jako walidator If-Match', async () => {
        const sb = loadModule(async () => jsonResponse(summaryWithDraft));
        const headers = await sb.window.pricelistVersions.draftHeaders('rury');
        expect(headers).toEqual({ 'If-Match': '"sha-draft"' });
    });

    it('draftHeaders bez szkicu → brak If-Match (starszy klient nie blokowany)', async () => {
        const sb = loadModule(async () => jsonResponse(emptySummary));
        expect(await sb.window.pricelistVersions.draftHeaders('rury')).toEqual({});
    });
});
