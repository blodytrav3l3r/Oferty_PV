/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/* Fail-closed sync katalogu kontaktów: zapis po failed-load NIE wysyła PUT.
 * Luka: edytor po nieudanym GET pokazuje mirror legacy; Zapisz syncował
 * widoczne wiersze (albo []) → BE kasował niewidziane kontakty
 * (toDelete = brak na liście). Fix jak C1 (requireClientsLoaded):
 * saveEditedClientInDb wymaga świeżego cache; brak → jeden re-fetch;
 * dalej brak → blokada + toast, zero PUT /contacts/sync.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';

const ROOT = path.join(__dirname, '..', '..');

function loadCM(contactsGet) {
    const raw = fs.readFileSync(
        path.join(ROOT, 'public', 'js', 'shared', 'clientManager.js'),
        'utf8'
    );
    const syncCalls = [];
    const fetchMock = async (url, options = {}) => {
        const u = String(url);
        if (u.endsWith('/contacts/sync')) {
            syncCalls.push(JSON.parse(options.body));
            return {
                ok: true,
                status: 200,
                json: async () => ({ ok: true, updatedAt: '2026-10-13T00:00:00.000Z' })
            };
        }
        if (/\/contacts(\?|$)/.test(u)) return contactsGet();
        return { ok: true, status: 200, json: async () => ({}) };
    };
    const toasts = [];
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
        document,
        authHeaders: () => ({}),
        fetch: fetchMock,
        fetchWithTimeout: fetchMock,
        logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        showToast: (msg, type) => {
            toasts.push({ msg: String(msg), type });
        },
        appConfirm: async () => false,
        closeModal: jest.fn(),
        escapeHtml: (s) => String(s ?? ''),
        escapeHtmlAttr: (s) => String(s ?? ''),
        clientsDb: [
            {
                id: 'c-1',
                name: 'ACME',
                nip: '',
                address: '',
                contact: '',
                phone: '',
                email: '',
                clientNumber: '',
                updatedAt: '2026-01-01T00:00:00.000Z'
            }
        ]
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(raw, sandbox, { filename: 'clientManager.js' });
    return { sb: sandbox, syncCalls, toasts };
}

function editorDom() {
    document.body.innerHTML =
        '<input id="edit-client-name" value="ACME">' +
        '<input id="edit-client-nip" value="">' +
        '<input id="edit-client-address" value="">' +
        '<input id="edit-client-clientNumber" value="">' +
        '<div id="edit-client-contacts"></div>';
}

const failGet = async () => ({ ok: false, status: 500, json: async () => ({}) });

const CATALOG_TWO = [
    { id: 'k-1', name: 'Jan', phone: '600', email: '', position: '', isPrimary: true },
    { id: 'k-2', name: 'Ewa', phone: '700', email: '', position: '', isPrimary: false }
];

function loadCMOffer({ catalogGet, offerRows }) {
    const raw = fs.readFileSync(
        path.join(ROOT, 'public', 'js', 'shared', 'clientManager.js'),
        'utf8'
    );
    const syncCalls = [];
    const fetchMock = async (url, options = {}) => {
        const u = String(url);
        if (u.endsWith('/contacts/sync')) {
            syncCalls.push(JSON.parse(options.body));
            return {
                ok: true,
                status: 200,
                json: async () => ({ ok: true, updatedAt: '2026-10-13T00:00:00.000Z' })
            };
        }
        if (/\/contacts(\?|$)/.test(u)) return catalogGet();
        if (u.endsWith('/api/clients')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ ok: true, updatedAt: '2026-10-13T00:00:00.000Z' })
            };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    };
    const toasts = [];
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
        document,
        authHeaders: () => ({}),
        fetch: fetchMock,
        fetchWithTimeout: fetchMock,
        logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        showToast: (msg, type) => {
            toasts.push({ msg: String(msg), type });
        },
        appConfirm: async () => true,
        closeModal: jest.fn(),
        escapeHtml: (s) => String(s ?? ''),
        escapeHtmlAttr: (s) => String(s ?? ''),
        clientsDb: [
            {
                id: 'c-9',
                name: 'ACME',
                nip: '',
                address: '',
                contact: 'Jan',
                phone: '600',
                email: '',
                clientNumber: '',
                updatedAt: '2026-01-01T00:00:00.000Z'
            }
        ]
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.ClientContacts = { collectContacts: () => offerRows };
    vm.createContext(sandbox);
    vm.runInContext(raw, sandbox, { filename: 'clientManager.js' });
    return { sb: sandbox, syncCalls, toasts };
}

function offerDom() {
    document.body.innerHTML =
        '<input id="client-name" value="ACME">' +
        '<input id="client-nip" value="">' +
        '<input id="client-address" value="">' +
        '<input id="client-contact" value="Jan">' +
        '<input id="client-number" value="">' +
        '<div id="client-contacts"></div>';
}

const flush = async () => {
    await new Promise((r) => setTimeout(r, 30));
    await new Promise((r) => setTimeout(r, 30));
};

describe('clientContacts offer→katalog: doklejanie zamiast replace', () => {
    test('oferta z 1 osobą NIE kasuje pozostałych z katalogu', async () => {
        const { sb, syncCalls } = loadCMOffer({
            catalogGet: async () => ({
                ok: true,
                status: 200,
                json: async () => ({ ok: true, items: CATALOG_TWO })
            }),
            offerRows: [{ name: 'Jan', phone: '600', email: '' }]
        });
        offerDom();
        await sb.loadClientsDb();
        await sb.saveClientToDb();
        await flush();
        // Jan już w katalogu → brak zmian → zero PUT (delete niemożliwy).
        expect(syncCalls).toHaveLength(0);
    });

    test('nowa osoba z oferty dopisywana, istniejące nietknięte', async () => {
        const { sb, syncCalls } = loadCMOffer({
            catalogGet: async () => ({
                ok: true,
                status: 200,
                json: async () => ({ ok: true, items: CATALOG_TWO })
            }),
            offerRows: [{ name: 'Zbigniew', phone: '111', email: '' }]
        });
        offerDom();
        await sb.loadClientsDb();
        await sb.saveClientToDb();
        await flush();
        expect(syncCalls).toHaveLength(1);
        const ids = syncCalls[0].contacts.map((c) => c.id);
        expect(ids).toContain('k-1');
        expect(ids).toContain('k-2');
        expect(syncCalls[0].contacts).toHaveLength(3);
        const zb = syncCalls[0].contacts.find((c) => c.name === 'Zbigniew');
        expect(zb.isPrimary).toBe(false);
    });

    test('fetch fail katalogu → brak PUT, tylko toast (fail-closed)', async () => {
        const { sb, syncCalls, toasts } = loadCMOffer({
            catalogGet: failGet,
            offerRows: [{ name: 'Jan', phone: '600', email: '' }]
        });
        offerDom();
        await sb.loadClientsDb();
        await sb.saveClientToDb();
        await flush();
        expect(syncCalls).toHaveLength(0);
        expect(toasts.some((t) => t.type === 'warning' && /katalog/i.test(t.msg))).toBe(true);
    });
});

describe('clientContacts fail-closed (frontend)', () => {
    test('failed-load katalogu → Zapisz zablokowany, zero PUT /contacts/sync', async () => {
        const { sb, syncCalls, toasts } = loadCM(failGet);
        editorDom();
        await sb.loadClientsDb();
        await sb.saveEditedClientInDb('c-1');
        expect(syncCalls).toHaveLength(0);
        expect(toasts.some((t) => t.type === 'error' && /katalog/i.test(t.msg))).toBe(true);
    });

    test('niepobrany katalog → re-fetch + re-render edytora, zapis dopiero po weryfikacji', async () => {
        const items = [
            { id: 'k-1', name: 'Jan', phone: '600', email: '', position: '', isPrimary: true },
            { id: 'k-2', name: 'Ewa', phone: '', email: 'e@x.pl', position: '', isPrimary: false }
        ];
        const { sb, syncCalls, toasts } = loadCM(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, items })
        }));
        editorDom();
        await sb.loadClientsDb();
        await sb.saveEditedClientInDb('c-1');
        // Bez weryfikacji świeżych wierszy: zero PUT.
        expect(syncCalls).toHaveLength(0);
        expect(document.querySelectorAll('#edit-client-contacts .ccc-row').length).toBe(2);
        expect(toasts.some((t) => /sprawdź i zapisz ponownie/i.test(t.msg))).toBe(true);
    });
});
