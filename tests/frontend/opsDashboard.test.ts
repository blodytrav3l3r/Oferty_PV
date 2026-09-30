/**
 * @jest-environment jsdom
 */
// @ts-nocheck
/**
 * P6: dashboard operacyjny (prawdziwy public/js/admin/opsDashboard.js).
 * - zdrowy backend -> sekcje Aplikacja/Zdrowie/API/ML z pillami OK
 * - metrics 401 (null) -> UNKNOWN, nie ERROR
 * - wszystko pada -> ekran błędu z retry
 * - nie-admin -> wymaga roli admin
 * - a11y: aria-live, przyciski type=button, brak inline onclick
 */
import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'public/js/admin/opsDashboard.js');

function resp(body: any, headers: Record<string, string> = {}) {
    return {
        ok: true,
        headers: { get: (k: string) => headers[k.toLowerCase()] || null },
        json: async () => body
    };
}

function loadDom() {
    document.body.innerHTML =
        '<div id="admin-panel"><div id="ops-container" aria-live="polite"><p class="text-muted">Ładowanie…</p></div></div>';
}

function evalFile() {
    (0, eval)(fs.readFileSync(FILE, 'utf8'));
}

const healthy: Record<string, any> = {
    '/api/version': resp({ version: '1.31.0' }, { 'content-security-policy': "script-src 'self'" }),
    '/api/admin/system-info': resp({
        version: '1.31.0',
        environment: 'test',
        commitHash: 'abc123def456',
        uptime: 9000,
        memory: { rss: 100 * 1024 * 1024 }
    }),
    '/health': resp({ status: 'ok' }),
    '/health/ready': resp({ status: 'ready', db: 'ok' }),
    '/metrics': resp({
        endpoints: { 'GET /api/a': { n: 10, errors: 0 } },
        db: { queries: 5, busy: 0 },
        audit: { failures: 0 },
        storage: {
            dbBytes: 1024,
            walBytes: 0,
            backups: 2,
            lastBackupAt: '2026-09-27T10:00:00.000Z'
        }
    }),
    '/api/telemetry/ai/ml-status': resp({
        mlOnline: true,
        modelVersion: 'v1',
        aiInfluencePct: 50,
        activeModelAuc: 0.8,
        baselineAccuracy: 0.6,
        trainingRows: 100,
        lastTrainingRun: { id: 'run123456' },
        lastDatasetFingerprint: 'abcdef1234567890'
    })
};

describe('P6 ops dashboard', () => {
    beforeEach(() => {
        jest.resetModules();
        (window as any).currentUser = { id: 'a1', role: 'admin' };
        (window as any).lucide = undefined;
    });

    test('zdrowy backend -> 4 sekcje z OK', async () => {
        (global as any).fetch = jest.fn(
            async (url: string) => healthy[url] || Promise.reject(new Error('404'))
        );
        loadDom();
        evalFile();
        await new Promise((r) => setTimeout(r, 50));
        const html = document.getElementById('ops-container')!.innerHTML;
        expect(html).toContain('Aplikacja');
        expect(html).toContain('Zdrowie');
        expect(html).toContain('>API<');
        expect(html).toContain('>ML<');
        expect(html).toContain('ops-ok');
        expect(html).toContain('1.31.0');
        expect(html).toContain('abcdef123456'.slice(0, 12));
    });

    test('metrics niedostępne -> UNKNOWN (nie ERROR)', async () => {
        (global as any).fetch = jest.fn(async (url: string) => {
            if (url === '/metrics' || url === '/api/admin/system-info')
                return Promise.reject(new Error('HTTP 401'));
            return healthy[url];
        });
        loadDom();
        evalFile();
        await new Promise((r) => setTimeout(r, 50));
        const html = document.getElementById('ops-container')!.innerHTML;
        expect(html).toContain('ops-unknown');
        expect(html).not.toContain('Spróbuj ponownie');
    });

    test('wszystko pada -> ekran błędu z retry', async () => {
        (global as any).fetch = jest.fn(async () => Promise.reject(new Error('down')));
        loadDom();
        evalFile();
        await new Promise((r) => setTimeout(r, 50));
        const html = document.getElementById('ops-container')!.innerHTML;
        expect(html).toContain('Spróbuj ponownie');
        expect(document.getElementById('ops-retry')!.getAttribute('type')).toBe('button');
    });

    test('nie-admin -> wymaga roli admin', async () => {
        (window as any).currentUser = { id: 'u1', role: 'user' };
        (global as any).fetch = jest.fn(async () => {
            throw new Error('nie powinno być wołane');
        });
        loadDom();
        evalFile();
        await new Promise((r) => setTimeout(r, 20));
        expect(document.getElementById('ops-container')!.textContent).toContain(
            'wymaga roli admin'
        );
    });

    test('wyścig sesji: pusty currentUser przy starcie, karty po sok:user-ready', async () => {
        (window as any).currentUser = undefined;
        (global as any).fetch = jest.fn(async (url: string) => healthy[url]);
        loadDom();
        evalFile();
        await new Promise((r) => setTimeout(r, 20));
        expect(document.getElementById('ops-container')!.textContent).toContain(
            'wymaga roli admin'
        );
        // Sesja rozwiązana później (async /me -> showLoggedIn -> event).
        (window as any).currentUser = { id: 'a1', role: 'admin' };
        document.dispatchEvent(new CustomEvent('sok:user-ready', { detail: { role: 'admin' } }));
        await new Promise((r) => setTimeout(r, 50));
        const html = document.getElementById('ops-container')!.innerHTML;
        expect(html).toContain('Aplikacja');
        expect(html).toContain('Zdrowie');
    });

    test('a11y i higiena: brak inline onclick, aria-live na kontenerze', async () => {
        (global as any).fetch = jest.fn(async (url: string) => healthy[url]);
        loadDom();
        evalFile();
        await new Promise((r) => setTimeout(r, 50));
        const el = document.getElementById('ops-container')!;
        expect(el.getAttribute('aria-live')).toBe('polite');
        expect(el.innerHTML).not.toContain('onclick');
    });
});
