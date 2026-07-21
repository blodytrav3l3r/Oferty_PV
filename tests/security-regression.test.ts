import express from 'express';
import request from 'supertest';
import { requireAdmin } from '../src/middleware/auth';
import { EXPORT_LIMITER, WRITE_LIMITER } from '../src/middleware/rateLimiters';
import fs from 'fs';
import path from 'path';

// ─── T5.2: Admin Guard ──────────────────────────────────────

describe('T5.2: requireAdmin middleware', () => {
    function adminApp(): express.Application {
        const app = express();
        app.use((req: any, _res: any, next: any) => {
            req.user = { id: 'admin-id', role: 'admin' };
            next();
        });
        app.get('/admin', requireAdmin, (_req, res) => res.json({ ok: true }));
        return app;
    }

    it('powinien przepuścić admina', async () => {
        const res = await request(adminApp()).get('/admin');
        expect(res.statusCode).toBe(200);
    });

    it('powinien zablokować zwykłego użytkownika z 403', async () => {
        const app = express();
        app.use((req: any, _res: any, next: any) => {
            req.user = { id: 'user-id', role: 'user' };
            next();
        });
        app.get('/admin', requireAdmin, (_req, res) => res.json({ ok: true }));
        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toContain('administrator');
    });

    it('powinien zablokować niezalogowanego z 403', async () => {
        const app = express();
        app.get('/admin', requireAdmin, (_req, res) => res.json({ ok: true }));
        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(403);
    });
});

// ─── T5.3: Rate Limiters ────────────────────────────────────

describe('T5.3: Predefiniowane rate limitery', () => {
    it('EXPORT_LIMITER powinien przepuszczać żądania w ramach limitu', async () => {
        const app = express();
        app.use(EXPORT_LIMITER);
        app.get('/export', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/export');
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('20');
    });

    it('WRITE_LIMITER powinien przepuszczać żądania w ramach limitu', async () => {
        const app = express();
        app.use(WRITE_LIMITER);
        app.post('/write', (_req, res) => res.json({ ok: true }));

        const res = await request(app).post('/write');
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('60');
    });

    it('EXPORT_LIMITER powinien blokować po przekroczeniu limitu', async () => {
        const app = express();
        app.use(EXPORT_LIMITER);
        app.get('/export', (_req, res) => res.json({ ok: true }));

        for (let i = 0; i < 20; i++) {
            await request(app).get('/export');
        }
        const res = await request(app).get('/export');
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toContain('Zbyt wiele');
    }, 10000);
});

// ─── T5.4: XSS Scan ─────────────────────────────────────────

describe('T5.4: XSS — obecność escapeHtml w krytycznych plikach', () => {
    const xssFiles = [
        { name: 'offerCrud.js', path: 'public/js/rury/offerCrud.js' },
        { name: 'offerSummaryUI.js', path: 'public/js/studnie/offerSummaryUI.js' },
        { name: 'orderManager.js', path: 'public/js/studnie/orderManager.js' }
    ];

    xssFiles.forEach(({ name, path: filePath }) => {
        it(`${name} powinien zawierać funkcję escapeHtml i używać jej przy dynamicznym innerHTML`, () => {
            const fullPath = path.resolve(__dirname, '..', filePath);
            expect(fs.existsSync(fullPath)).toBe(true);
            const content = fs.readFileSync(fullPath, 'utf-8');

            // escapeHtml musi być zdefiniowana lub zaimportowana
            expect(content).toContain('escapeHtml');

            // Znajdź linie innerHTML z interpolacją zmiennych bez escapeHtml
            const lines = content.split('\n');
            const suspicious = lines.filter((line) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
                if (!trimmed.includes('innerHTML')) return false;
                if (trimmed.includes('escapeHtml')) return false;
                // Sprawdź czy zawiera interpolację zmiennej (${} lub konkatenację +)
                const hasInterpolation = trimmed.includes('${') || /\b\w+\s*\+/.test(trimmed);
                return hasInterpolation;
            });
            expect(suspicious.length).toBe(0);
        });
    });
});

// ─── T5.6: userId change guard (static) ─────────────────────

describe('T5.6: Blokada zmiany opiekuna zamówienia', () => {
    it('ruryOrders.crud.ts powinien zawierać guard zmiany userId', () => {
        const content = fs.readFileSync(
            path.resolve(__dirname, '..', 'src/routes/orders/ruryOrders.crud.ts'),
            'utf-8'
        );
        expect(content).toContain('req.body.userId');
        expect(content).toContain('o.userId');
        expect(content).toContain("role !== 'admin'");
        expect(content).toContain('403');
        expect(content).toContain('Tylko administrator może zmienić opiekuna zamówienia');
    });
});

// ─── T5.8: Debounce export ──────────────────────────────────

describe('T5.8: Eksport window.debounce', () => {
    it('ui.js powinien eksportować debounce na window', () => {
        const content = fs.readFileSync(
            path.resolve(__dirname, '..', 'public/js/shared/ui.js'),
            'utf-8'
        );
        expect(content).toContain('window.debounce');
    });

    it('składnia ui.js jest poprawna', () => {
        const { execSync } = require('child_process');
        const result = execSync(
            `node -c "${path.resolve(__dirname, '..', 'public/js/shared/ui.js')}"`,
            { encoding: 'utf-8' }
        );
        expect(result).toBeDefined();
    });
});
