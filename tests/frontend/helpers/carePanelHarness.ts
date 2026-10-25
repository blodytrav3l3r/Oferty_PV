import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Wspólny harness vm dla suit carePanel (wydzielony z carePanel.test.ts, 2026-10-25).
export const load = (opts: {
    fetchMock: (url: string, _init?: any) => any;
    role?: string;
    calls?: string[];
    timers?: number[];
    fuStub?: any;
}) => {
    const file = path.join(__dirname, '../../../public/js/care/carePanel.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(
        "import { escapeHtml } from '../shared/escapeHtml.js';",
        'const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");'
    );
    code = code.replace(
        "import followUpMixin from '../kartoteka/kartotekaFollowUp.js';",
        'const followUpMixin = __fuStub;'
    );
    // Harness vm = classic script: rozbrojenie składni ESM.
    code = code.replace(/^export\s+/gm, '');
    const els: Record<string, any> = {};
    const mkEl = (id: string) => {
        const self: any = {
            id,
            innerHTML: '',
            value: '',
            hidden: true,
            disabled: false,
            style: {},
            dataset: {},
            attrs: {} as Record<string, string>,
            className: '',
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute(name: string, value: string) {
                self.attrs[name] = String(value);
                if (name.startsWith('data-')) {
                    const key = name
                        .slice(5)
                        .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
                    self.dataset[key] = value;
                }
            },
            getAttribute(name: string) {
                return self.attrs[name] ?? null;
            },
            appendChild(c: any) {
                self.children = [...(self.children || []), c];
                return c;
            },
            append(...cs: any[]) {
                self.children = [...(self.children || []), ...cs];
            },
            addEventListener(_t: string, fn: any) {
                self.handlers = [...(self.handlers || []), fn];
            },
            remove() {
                self.removed = true;
            },
            querySelector: (sel: string): any => {
                for (const c of self.children || []) {
                    if (sel === '[data-care-actions]' && c.dataset && 'careActions' in c.dataset)
                        return c;
                    const hit = c.querySelector ? c.querySelector(sel) : null;
                    if (hit) return hit;
                }
                return null;
            },
            querySelectorAll: (sel: string): any[] => {
                const out: any[] = [];
                const walkQ = (n: any): void => {
                    for (const c of n.children || []) {
                        if (sel === 'button' && c.tag === 'button') out.push(c);
                        walkQ(c);
                    }
                };
                walkQ(self);
                return out;
            },
            contains: (_other: any) => false
        };
        // Jak prawdziwy DOM: textContent='' czyści dzieci.
        let text = '';
        Object.defineProperty(self, 'textContent', {
            get: () => text,
            set: (v: string) => {
                text = String(v ?? '');
                if (text === '') self.children = [];
            }
        });
        return self;
    };
    const el = (id: string) => (els[id] = els[id] || mkEl(id));
    // Kontenery istniejące w index.html.
    for (const id of [
        'followup-panel',
        'care-rep',
        'care-notif-count',
        'care-notif-list',
        'care-notif-clear',
        'care-buckets',
        'care-buckets-total',
        'care-buckets-top',
        'care-buckets-share',
        'care-queue-list',
        'care-sync-text',
        'care-sla-box',
        'care-sla-first',
        'care-sla-stale',
        'care-sla-esc',
        'care-sla-save',
        'fu-stat-needs',
        'fu-stat-progress',
        'fu-stat-won',
        'fu-stat-lost',
        'fu-kpi-won-value',
        'fu-kpi-open-value',
        'fu-kpi-total-value',
        'fu-kpi-orders-value'
    ])
        el(id);
    const listeners: Record<string, any[]> = {};
    const context: any = {
        __fuStub: opts.fuStub ?? { openFollowUpModal: async () => {} },
        console,
        setTimeout: (..._a: any[]) => {
            opts.timers?.push(1);
            return 0 as unknown as NodeJS.Timeout;
        },
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        fetch: async (url: string, init?: any) => {
            opts.calls?.push(`${init?.method || 'GET'} ${url}`);
            return opts.fetchMock(url, init);
        },
        document: {
            getElementById: (id: string) => els[id] || null,
            querySelectorAll: () => [],
            createElement: (tag: string) => {
                const e: any = mkEl('dyn-' + tag);
                e.tag = tag;
                return e;
            },
            createTextNode: (t: string) => {
                const e: any = mkEl('dyn-text');
                e.tag = '#text';
                e.textContent = String(t ?? '');
                return e;
            },
            addEventListener: (t: string, fn: any) => {
                listeners[t] = [...(listeners[t] || []), fn];
            },
            hidden: false
        },
        window: { currentUser: { role: opts.role ?? 'user' } }
    };
    context.window.window = context.window;
    vm.createContext(context);
    vm.runInContext(
        code +
            '\nthis.__careTest = { loadCarePanel, careOpenContact, setQueueSort, setQueueView, setQueueRange, setQueueSearch, normalizeCareSearch, matchCareSearch, findOfferInQueue, renderNotifications };',
        context
    );
    return { els, listeners, context };
};
export const okJson = (body: any) => ({ ok: true, json: async () => body });
