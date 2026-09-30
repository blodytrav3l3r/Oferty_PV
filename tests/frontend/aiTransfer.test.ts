/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * P7.8 — testy zakładki Transfer Center (public/js/admin/aiTransfer.js).
 * Wzorzec VM jak draftStore.test.ts; DOM z jsdom.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

function loadTransfer(overrides = {}) {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../public/js/admin/aiTransfer.js'),
        'utf8'
    );
    const fetchJson = jest.fn();
    const sandbox = {
        window: {
            escapeHtml: (s) =>
                String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
            escapeHtmlAttr: (s) => String(s).replace(/"/g, '&quot;'),
            aiMlEnabled: () => true,
            fetchJson: (...args) => fetchJson(...args),
            showToast: jest.fn(),
            aiUiConfirm: () => Promise.resolve(true),
            ...overrides
        },
        document,
        lucide: undefined,
        fetch: jest.fn(),
        FileReader: global.FileReader,
        URL,
        setTimeout
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'aiTransfer.js' });
    return { win: sandbox.window, sandbox, fetchJson };
}

function tick(ms = 20) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('aiTransfer', () => {
    let ctx;
    let host;

    beforeEach(() => {
        document.body.innerHTML = '';
        ctx = loadTransfer();
        host = document.createElement('div');
        document.body.appendChild(host);
    });

    it('eksponuje aiRenderTransfer i renderuje sekcje', async () => {
        ctx.fetchJson.mockResolvedValue({ models: [] });
        ctx.win.aiRenderTransfer(host);
        await tick();
        expect(host.querySelector('#ai-tr-model')).not.toBeNull();
        expect(host.querySelector('#ai-tr-file').getAttribute('accept')).toBe('.sokml');
        expect(host.querySelector('#ai-tr-import-btn').disabled).toBe(true);
        expect(host.textContent).toContain('Transfer Center');
    });

    it('escapuje złośliwą wersję modelu na liście', async () => {
        ctx.fetchJson.mockImplementation((url) => {
            if (url === '/api/telemetry/ai/models') {
                return Promise.resolve({
                    models: [{ id: '1', version: '<img src=x onerror=1>', state: 'PRODUCTION' }]
                });
            }
            return Promise.resolve({ data: [] });
        });
        ctx.win.aiRenderTransfer(host);
        await tick();
        const select = host.querySelector('#ai-tr-model');
        expect(select.innerHTML).not.toContain('<img');
        expect(select.innerHTML).toContain('&lt;img');
    });

    it('zablokowany dry-run nie odblokowuje importu', async () => {
        ctx.sandbox.fetch.mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ code: 'FEATURE_VERSION_MISMATCH' })
        });
        ctx.win.aiRenderTransfer(host);
        await tick();
        const fileInput = host.querySelector('#ai-tr-file');
        Object.defineProperty(fileInput, 'files', {
            value: [new File([new Uint8Array([1, 2, 3]).buffer], 'p.sokml')]
        });
        host.querySelector('#ai-tr-dryrun-btn').click();
        await tick(50);
        expect(host.querySelector('#ai-tr-import-btn').disabled).toBe(true);
        expect(host.textContent).toContain('FEATURE_VERSION_MISMATCH');
    });

    it('gate aiMlEnabled OFF renderuje blokadę zamiast panelu', () => {
        const off = loadTransfer({ aiMlEnabled: () => false });
        const h = document.createElement('div');
        off.win.aiRenderTransfer(h);
        expect(h.querySelector('#ai-tr-file')).toBeNull();
    });
});
