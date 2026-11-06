/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Panel cenników — publikacja przez kanoniczny `POST /:id/approve` (M1):
 * kontrola `GET /:id/checks` przed publikacją, `checksCheckedAt` w body,
 * korekta wsteczna z opcjonalną notą, brak aliasów deprecated w FE.
 */

import fs from 'fs';
import path from 'path';

const code = fs.readFileSync(
    path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
    'utf-8'
);

type Call = { url: string; method: string; body?: Record<string, unknown> };

function mount(responses: Record<string, unknown>): { calls: Call[] } {
    const calls: Call[] = [];
    document.body.innerHTML = '';
    Object.assign(window, {
        escapeHtml: (v: unknown) => String(v ?? ''),
        escapeHtmlAttr: (v: unknown) => String(v ?? '')
    });
    window.showToast = jest.fn();
    window.showModal = jest.fn(({ id, html }: { id: string; html: string }) => {
        const modal = document.createElement('div');
        modal.id = id;
        modal.innerHTML = html;
        document.body.appendChild(modal);
    });
    window.closeModal = jest.fn();
    window.appConfirm = jest.fn().mockResolvedValue(true);
    window.authHeaders = () => ({});
    const fakeFetch = jest.fn(async (url: string, opts?: { method?: string; body?: string }) => {
        const method = opts?.method || 'GET';
        calls.push({
            url: String(url),
            method,
            body: opts?.body ? JSON.parse(opts.body) : undefined
        });
        const payload = responses[`${method} ${String(url)}`] ?? {};
        return {
            ok: true,
            status: 200,
            json: async () => payload,
            headers: { get: () => null }
        };
    });
    (global as unknown as { fetch: unknown }).fetch = fakeFetch;
    (window as unknown as { fetch: unknown }).fetch = fakeFetch;
    new Function('window', 'document', code)(window, document);
    return { calls };
}

function pv(): any {
    return (window as any).pricelistVersions;
}

describe('frontend: publikacja cennika przez approve', () => {
    it('najpierw kontrola checks, potem POST /:id/approve (bez aliasów)', async () => {
        const { calls } = mount({
            'GET /api/pricelist-versions/v1/checks': {
                checkedAt: '2026-10-21T10:00:00.000Z',
                advisory: true
            },
            'POST /api/pricelist-versions/v1/approve': {
                version: { id: 'v1', version: 'v1' },
                checksStale: false
            }
        });

        const json = await pv().approveVersion('v1');

        expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
            'GET /api/pricelist-versions/v1/checks',
            'POST /api/pricelist-versions/v1/approve'
        ]);
        expect(calls[1].body).toEqual({ checksCheckedAt: '2026-10-21T10:00:00.000Z' });
        expect(json.checksStale).toBe(false);
    });

    it('nota korekty wstecznej idzie w body approve, checksStale wraca do UI', async () => {
        const { calls } = mount({
            'POST /api/pricelist-versions/v1/approve': {
                version: { id: 'v1', version: 'v1' },
                checksStale: true
            }
        });

        const json = await pv().approveVersion('v1', 'uzasadnienie korekty wstecznej');

        expect(calls[1].url).toBe('/api/pricelist-versions/v1/approve');
        expect(calls[1].body).toEqual({ note: 'uzasadnienie korekty wstecznej' });
        expect(json.checksStale).toBe(true);
    });

    it('publikuje datę wsteczną bez notatki', async () => {
        const { calls } = mount({
            'GET /api/pricelist-versions?type=studnie': {
                versions: [
                    {
                        id: 'draft-1',
                        version: 'Sv2-20261106',
                        seq: 2,
                        status: 'DRAFT',
                        effectiveFrom: '2099-01-01T00:00:00.000Z'
                    }
                ]
            },
            'GET /api/pricelist-versions/draft-1/checks': { checkedAt: '2026-11-06T00:00:00.000Z' },
            'POST /api/pricelist-versions/draft-1/approve': {
                version: { id: 'draft-1', version: 'Sv2-20261106' }
            }
        });

        await pv().openPublishDialog('studnie', 'draft-1');
        (document.getElementById('pv-publish-date') as HTMLInputElement).value = '2020-01-01T00:00';
        (document.getElementById('pv-publish-ok') as HTMLButtonElement).click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const approveCall = calls.find((call) => call.url.endsWith('/approve'));
        expect(calls.map((call) => `${call.method} ${call.url}`)).toContain(
            'POST /api/pricelist-versions/draft-1/approve'
        );
        expect(approveCall?.body).toMatchObject({ effectiveFrom: expect.any(String) });
        expect(approveCall?.body).not.toHaveProperty('note');
    });

    it('isPastDate: data przeszła = korekta wsteczna', () => {
        mount({});
        const isPast = pv().isPastDate;
        expect(isPast(new Date(Date.now() - 86400000).toISOString())).toBe(true);
        expect(isPast(new Date(Date.now() + 86400000).toISOString())).toBe(false);
        expect(isPast('')).toBe(false);
        expect(isPast('nie-data')).toBe(false);
    });

    it('brak martwych ścieżek aktywacji (aliasy deprecated, canActivate/canBackdate usunięte)', () => {
        mount({});
        expect(pv().canActivate).toBeUndefined();
        expect(pv().canBackdate).toBeUndefined();
    });

    it('etykiety stanów: 4 widoczne + legacy osobno (nie w STATUS_LABELS)', () => {
        mount({});
        const state = pv().stateOf({ state: 'SCHEDULED' });
        expect(pv().displayStatus({ state })).toBe('Do wdrożenia');
        expect(pv().displayStatus({ state: 'DRAFT' })).toBe('W przygotowaniu');
        expect(pv().displayStatus({ state: 'ACTIVE' })).toBe('Obowiązuje');
        expect(pv().displayStatus({ state: 'ARCHIVED' })).toBe('Historyczny');
        // Legacy (baza przed migracją) — czytelne, ale nie stan bieżący.
        expect(pv().displayStatus({ state: 'BACKDATE_REQUESTED' })).toBe('Szkic (korekta)');
    });
});
