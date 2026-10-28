// @ts-nocheck
/**
 * shared/pricelistVersions.js — draftHeaders: walidator warunkowego zapisu.
 * Szkic → If-Match (sha256 z /summary); brak szkicu → brak nagłówka
 * (starszy klient nie jest blokowany).
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

describe('draftHeaders — warunkowy zapis szkicu', () => {
    it('sha szkicu jako walidator If-Match', async () => {
        const sb = loadModule(async () => jsonResponse(summaryWithDraft));
        const headers = await sb.window.pricelistVersions.draftHeaders('rury');
        expect(headers).toEqual({ 'If-Match': '"sha-draft"' });
    });

    it('bez szkicu → brak If-Match (starszy klient nie blokowany)', async () => {
        const sb = loadModule(async () => jsonResponse(emptySummary));
        expect(await sb.window.pricelistVersions.draftHeaders('rury')).toEqual({});
    });
});
