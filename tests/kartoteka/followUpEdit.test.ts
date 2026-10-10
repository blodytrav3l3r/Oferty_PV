import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Edycja/usuwanie historii + modal--lg + sekcja klienta w modalu Opieki.
describe('kartotekaFollowUp — edycja, usuwanie, rozmiar, klient', () => {
    let mixin: any;

    const stripEsm = (code: string) =>
        code
            .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
            .replace(/export default \{/, 'module.exports = {');

    const ccStub = () => ({
        legacyToContacts: (b: any) => {
            const arr = Array.isArray(b?.clientContacts) ? b.clientContacts : [];
            if (arr.length > 0) return arr;
            const s = (v: unknown) => String(v ?? '');
            if (!s(b?.contactPerson) && !s(b?.clientPhone) && !s(b?.clientEmail)) return [];
            return [
                { name: s(b?.contactPerson), phone: s(b?.clientPhone), email: s(b?.clientEmail) }
            ];
        },
        normalizeContacts: (raw: any) =>
            (Array.isArray(raw) ? raw : []).filter((r: any) => r && (r.name || r.phone || r.email)),
        renderEditor: (box: any, list: any[]) => {
            if (box) box.innerHTML = `edytor:${list.length}`;
        },
        collectContacts: () => [],
        bindEditor: () => {}
    });

    const load = () => {
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaFollowUp.js');
        const code = stripEsm(fs.readFileSync(file, 'utf8'));
        const esc = (s: unknown) =>
            String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        const cc = ccStub();
        const context: any = {
            console,
            module: { exports: {} },
            fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
            authHeaders: () => ({ 'Content-Type': 'application/json' }),
            logger: { info() {}, warn() {}, error() {} },
            legacyToContacts: cc.legacyToContacts,
            normalizeContacts: cc.normalizeContacts,
            renderEditor: cc.renderEditor,
            collectContacts: cc.collectContacts,
            bindEditor: cc.bindEditor,
            window: {
                escapeHtml: esc,
                escapeHtmlAttr: (s: unknown) => String(s ?? '').replace(/"/g, '&quot;'),
                showToast() {},
                closeModal() {},
                offerTypeForApi: () => 'rury',
                lucide: null
            }
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        mixin = context.module.exports;
    };

    beforeEach(load);

    test('timeline renderuje przyciski Edytuj/Usuń z data-fu-id', () => {
        const html = mixin.renderFollowUpTimeline([
            {
                id: 'fu-1',
                contactedAt: '2026-10-08T09:55:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                durationMin: 4,
                note: 'x',
                nextContactAt: null,
                outcome: 'OPEN'
            }
        ]);
        expect(html).toContain('data-fu-act="edit"');
        expect(html).toContain('data-fu-act="del"');
        expect(html).toContain('data-fu-id="fu-1"');
    });

    test('timeline escapuje id i notatkę (XSS)', () => {
        const html = mixin.renderFollowUpTimeline([
            {
                id: 'fu-" onmouseover="alert(1)',
                contactedAt: '2026-10-08T09:55:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                durationMin: null,
                note: '<script>alert(1)</script>',
                nextContactAt: null,
                outcome: 'OPEN'
            }
        ]);
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).not.toContain('onmouseover="alert(1)');
    });

    test('modal używa klasy modal--lg i ma sekcję klienta', async () => {
        let captured = '';
        const items = [
            {
                id: 'fu-1',
                contactedAt: '2026-10-08T09:55:00.000Z',
                channel: 'PHONE',
                result: 'CONTACTED',
                durationMin: null,
                note: '',
                nextContactAt: null,
                outcome: 'OPEN'
            }
        ];
        const fetchMock = async (url: string) => {
            if (String(url).includes('/followups')) {
                return { ok: true, json: async () => ({ items }) };
            }
            return {
                ok: true,
                json: async () => ({
                    data: {
                        contactPerson: 'Jan Kowalski',
                        clientPhone: '600000000',
                        clientEmail: 'jan@firma.pl'
                    }
                })
            };
        };
        const overlayStub: any = {
            querySelector: () => null,
            querySelectorAll: () => []
        };
        const cc = ccStub();
        const ctx: any = {
            fetch: fetchMock,
            authHeaders: () => ({}),
            logger: { info() {}, warn() {}, error() {} },
            legacyToContacts: cc.legacyToContacts,
            normalizeContacts: cc.normalizeContacts,
            renderEditor: cc.renderEditor,
            collectContacts: cc.collectContacts,
            bindEditor: cc.bindEditor,
            window: {
                escapeHtml: (s: unknown) => String(s ?? ''),
                escapeHtmlAttr: (s: unknown) => String(s ?? ''),
                offerTypeForApi: () => 'rury',
                showModal: (opts: any) => {
                    captured = opts.html;
                    return overlayStub;
                },
                lucide: null
            },
            document: { createElement: () => ({}) },
            Event: function () {},
            console,
            module: { exports: {} }
        };
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaFollowUp.js');
        const code = stripEsm(fs.readFileSync(file, 'utf8'));
        vm.createContext(ctx);
        vm.runInContext(code, ctx);
        const m = ctx.module.exports;
        const ui = Object.assign(
            { searchResults: { items: [] }, loadLocalOffers: async () => {} },
            m
        );
        // Overlay stub musi obsłużyć listenery formularza.
        overlayStub.querySelector = (sel: string) => {
            if (sel === '#fu-timeline') return { addEventListener() {}, innerHTML: '' };
            return { addEventListener() {}, hidden: false };
        };
        await m.openFollowUpModal.call(ui, 'o-1', 'offer');
        expect(captured).toContain('modal modal--lg');
        expect(captured).toContain('fu-cc-list');
        expect(captured).toContain('Zapisz kontakt do klienta');
    });

    test('startFollowUpEdit wypełnia formularz i przełącza przycisk', () => {
        const vals: Record<string, any> = {};
        const overlay = {
            querySelector: (sel: string) => {
                if (sel === '#fu-outcome')
                    return { value: 'OPEN', dispatchEvent() {}, addEventListener() {} };
                if (sel === '#fu-submit-btn') return { textContent: 'Zapisz kontakt' };
                if (sel === '#fu-cancel-edit') return { hidden: true };
                if (sel === '#fu-reopen') return null;
                if (sel === '#fu-contact-form') return {};
                if (!vals[sel]) vals[sel] = { value: '' };
                return vals[sel];
            }
        };
        const ctx = Object.assign(
            {
                _fuItems: [
                    {
                        id: 'fu-1',
                        channel: 'EMAIL',
                        result: 'NO_ANSWER',
                        contactedAt: '2026-10-08T10:00:00.000Z',
                        durationMin: 7,
                        note: 'n',
                        nextContactAt: '2026-10-12T00:00:00.000Z',
                        outcome: 'OPEN',
                        loseReason: null,
                        competitor: null
                    }
                ],
                _fuEditingId: null
            },
            mixin
        );
        mixin.startFollowUpEdit.call(ctx, 'fu-1', overlay);
        expect(ctx._fuEditingId).toBe('fu-1');
        expect(vals['#fu-channel'].value).toBe('EMAIL');
        expect(vals['#fu-duration'].value).toBe('7');
        mixin.cancelFollowUpEdit.call(ctx, overlay);
        expect(ctx._fuEditingId).toBe(null);
    });

    test('extractOfferContacts: koperta studni (blob w data.data)', () => {
        expect(
            mixin.extractOfferContacts({
                data: {
                    id: 'offer_studnie_1',
                    data: { clientContacts: [{ name: 'Jan', phone: '600', email: '' }] }
                }
            })
        ).toEqual([{ name: 'Jan', phone: '600', email: '' }]);
    });

    test('extractOfferContacts: spread rur (blob na wierzchu)', () => {
        expect(
            mixin.extractOfferContacts({
                data: { id: 'offer_1', clientContacts: [{ name: 'A', phone: '1', email: '' }] }
            })
        ).toEqual([{ name: 'A', phone: '1', email: '' }]);
    });

    test('extractOfferContacts: fallback klucze legacy + pusto', () => {
        expect(
            mixin.extractOfferContacts({
                data: { data: { contactPerson: 'Jan', clientPhone: '600', clientEmail: '' } }
            })
        ).toEqual([{ name: 'Jan', phone: '600', email: '' }]);
        expect(mixin.extractOfferContacts({ data: {} })).toEqual([]);
        expect(mixin.extractOfferContacts(null)).toEqual([]);
    });
});
