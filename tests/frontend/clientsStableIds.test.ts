// @ts-nocheck
/* D-009: client-side stable ids dla PUT /api/clients (vm, pliki nietknięte).
 * Luka: serwer minci UUID per request dla wierszy bez id (clients.ts:
 * docId = c.id || randomUUID) — double-submit payloadu z id-less wierszami
 * tworzy duplikaty. Fix: FE mintuje stabilne id PRZED pierwszym PUT
 * (ensureClientIds w saveClientsDbData), retry niesie te same ids → upsert.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';

const ROOT = path.join(__dirname, '..', '..');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Serwer-mock wierny semantyce route: docId = c.id || randomUUID, upsert po id.
function createServer() {
    const store = new Map();
    const wireIds = [];
    const put = (rows) => {
        const ids = [];
        for (const c of rows) {
            const docId = c.id || crypto.randomUUID();
            ids.push(docId);
            store.set(docId, { ...(store.get(docId) || {}), ...c, id: docId });
        }
        wireIds.push(ids);
        return { ok: true, count: ids.length };
    };
    return {
        put,
        wireIds,
        size: () => store.size,
        get: (id) => store.get(id),
        ids: () => [...store.keys()]
    };
}

function loadClientManager(server) {
    const raw = fs.readFileSync(
        path.join(ROOT, 'public', 'js', 'shared', 'clientManager.js'),
        'utf8'
    );
    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        crypto,
        Math,
        Date,
        JSON,
        Object,
        Array,
        authHeaders: () => ({}),
        fetchWithTimeout: async () => {
            throw new Error('not used here');
        },
        logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        showToast: jest.fn(),
        appConfirm: async () => false,
        closeModal: jest.fn(),
        fetch: async (_url, options) => {
            const body = JSON.parse(options.body);
            server.put(body.data);
            return { ok: true, json: async () => ({ ok: true }) };
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(raw, sandbox, { filename: 'clientManager.js' });
    return sandbox;
}

describe('D-009 client-side stable ids (frontend)', () => {
    test('RED (luka): double-submit payloadu z id-less wierszem → 2 wiersze', async () => {
        const server = createServer();
        // Transportowy retry BEZ stabilnych id: ten sam payload wysłany 2x,
        // serwer minci świeży UUID per request (semantyka clients.ts:149).
        const payload = [{ name: 'ACME Sp. z o.o.', nip: '', address: '' }];
        server.put(JSON.parse(JSON.stringify(payload)));
        server.put(JSON.parse(JSON.stringify(payload)));
        expect(server.size()).toBe(2);
        const [a, b] = server.ids();
        expect(a).not.toBe(b);
    });

    test('ensureClientIds mintuje UUID raz; drugie wywołanie to no-op', () => {
        const server = createServer();
        const sb = loadClientManager(server);
        const rows = [{ name: 'A', nip: '' }, { id: 'c-stale', name: 'B' }, null, 'not-an-object'];
        sb.ensureClientIds(rows);
        expect(rows[0].id).toMatch(UUID_RE);
        expect(rows[1].id).toBe('c-stale');
        const minted = rows[0].id;
        sb.ensureClientIds(rows);
        expect(rows[0].id).toBe(minted);
        expect(sb.ensureClientIds('x')).toBe('x');
    });

    test('GREEN: retry przez saveClientsDbData niesie te same ids → 1 wiersz (upsert)', async () => {
        const server = createServer();
        const sb = loadClientManager(server);
        const rows = [{ name: 'ACME Sp. z o.o.', nip: '', address: '' }];
        expect(await sb.saveClientsDbData(rows)).toBe(true);
        expect(await sb.saveClientsDbData(rows)).toBe(true);
        expect(server.size()).toBe(1);
        // Oba PUTy niosły to samo id — retry idempotentny.
        expect(server.wireIds[0]).toEqual(server.wireIds[1]);
        expect(rows[0].id).toBe(server.wireIds[0][0]);
    });

    test('istniejące wiersze z id → update in place, bez duplikatów', async () => {
        const server = createServer();
        const sb = loadClientManager(server);
        const rows = [{ id: 'c-1', name: 'Stara nazwa' }];
        expect(await sb.saveClientsDbData(rows)).toBe(true);
        rows[0].name = 'Nowa nazwa';
        expect(await sb.saveClientsDbData(rows)).toBe(true);
        expect(server.size()).toBe(1);
        expect(server.get('c-1').name).toBe('Nowa nazwa');
        expect(server.wireIds[1]).toEqual(['c-1']);
    });
});
