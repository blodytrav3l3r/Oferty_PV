// @ts-nocheck
/* Banner wersji cennika w edytorze oferty (rury + studnie):
 * widoczny przy rozjeździe pieczątka≠ACTIVE, cisza przy zgodności,
 * braku pieczątki i braku ACTIVE; recalc: confirm → onRecalc → toast.
 * Wzorzec vm/fetch-mock: pricelistImportTarget.test.ts. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const BANNER_SRC = fs.readFileSync(
    path.join(ROOT, 'public/js/shared/offerPricelistBanner.js'),
    'utf8'
);

function makeButton() {
    return {
        _listeners: {},
        addEventListener(ev, fn) {
            this._listeners[ev] = fn;
        }
    };
}

function makeEl(id, button) {
    return {
        id,
        innerHTML: '',
        style: {},
        children: [],
        removed: false,
        firstChild: null,
        setAttribute() {},
        remove() {
            this.removed = true;
        },
        insertBefore(child) {
            this.children.unshift(child);
        },
        querySelector() {
            return button;
        },
        closest() {
            return null;
        },
        parentElement: null,
        addEventListener() {}
    };
}

/* anchor z hostem (closest → karta edytora), reszta id → zwykły element */
function makeDoc(button) {
    const els = {};
    const created = [];
    const host = makeEl('host', button);
    const anchor = makeEl('offer-form-title-studnie', button);
    anchor.closest = () => host;
    els['offer-form-title-studnie'] = anchor;
    els['offer-form-title'] = anchor;
    return {
        els,
        host,
        getElementById: (id) => els[id] || created.find((e) => e.id === id) || null,
        createElement: () => {
            const el = makeEl('new', button);
            created.push(el);
            return el;
        },
        body: { insertBefore() {}, firstChild: null }
    };
}

function loadBanner({ labels, labelsByIds, doc }) {
    const button = makeButton();
    const document = doc || makeDoc(button);
    const sandbox = {
        window: {},
        console,
        document
    };
    sandbox.window.escapeHtml = (s) => String(s ?? '');
    sandbox.window.appConfirm = jest.fn(async () => true);
    sandbox.window.showToast = jest.fn();
    sandbox.window.lucide = { createIcons: jest.fn() };
    sandbox.window.pricelistVersions = {
        fetchLabels: jest.fn(async () => labels),
        fetchLabelsByIds: jest.fn(async () => labelsByIds || {})
    };
    vm.createContext(sandbox);
    vm.runInContext(BANNER_SRC, sandbox, { filename: 'offerPricelistBanner.js' });
    return { sandbox, button, document };
}

const ACTIVE = { id: 'v2', version: 'v2-20260102', seq: 2 };
const STAMP = { id: 'v1', version: 'v1-20260101', seq: 1 };

describe('frontend vm: offerPricelistBanner.refresh', () => {
    test('rozjazd: pasek z wersjami i przyciskiem (pieczątka archiwalna via ?ids=)', async () => {
        const { sandbox, document } = loadBanner({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP, v2: ACTIVE }
        });
        const onRecalc = jest.fn(async () => true);
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"studnie",stampId:"v1",anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        expect(sandbox.window.pricelistVersions.fetchLabelsByIds).toHaveBeenCalledWith('studnie', [
            'v1'
        ]);
        expect(visible).toBe(true);
        const box = document.els['pv-offer-banner-studnie'] || document.host.children[0];
        expect(box.innerHTML).toContain('Oferta na cenniku v1-20260101');
        expect(box.innerHTML).toContain('aktywny v2-20260102');
        expect(box.innerHTML).toContain('Ceny zamrożone');
        expect(box.innerHTML).toContain('Przelicz do aktywnego');
        // onRecalc podpięty — wołamy dla pokrycia (klik testowany niżej)
        expect(typeof onRecalc).toBe('function');
    });

    test('zgodność pieczątki z ACTIVE: cisza (false, brak paska)', async () => {
        const { sandbox, document } = loadBanner({ labels: { v2: ACTIVE } });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"rury",stampId:"v2",anchorId:"offer-form-title"})',
            sandbox
        );
        expect(visible).toBe(false);
        expect(sandbox.window.pricelistVersions.fetchLabelsByIds).not.toHaveBeenCalled();
        expect(document.els['pv-offer-banner-rury'] || null).toBeNull();
    });

    test('brak pieczątki: cisza bez fetcha ?ids=', async () => {
        const { sandbox } = loadBanner({ labels: { v2: ACTIVE } });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"studnie",stampId:null})',
            sandbox
        );
        expect(visible).toBe(false);
        expect(sandbox.window.pricelistVersions.fetchLabelsByIds).not.toHaveBeenCalled();
    });

    test('brak ACTIVE: cisza', async () => {
        const { sandbox } = loadBanner({ labels: {} });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"rury",stampId:"v1"})',
            sandbox
        );
        expect(visible).toBe(false);
    });

    test('nieznana pieczątka: cisza (nie fałszywe legacy)', async () => {
        const { sandbox } = loadBanner({ labels: { v2: ACTIVE }, labelsByIds: {} });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"studnie",stampId:"vX"})',
            sandbox
        );
        expect(visible).toBe(false);
    });

    test('klik: appConfirm warning → onRecalc → toast success + pasek znika', async () => {
        const { sandbox, button, document } = loadBanner({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP, v2: ACTIVE }
        });
        const onRecalc = jest.fn(async () => true);
        sandbox.onRecalcHook = onRecalc;
        await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"studnie",stampId:"v1",anchorId:"offer-form-title-studnie",onRecalc:function(){return onRecalcHook();}})',
            sandbox
        );
        await button._listeners.click();
        expect(sandbox.window.appConfirm).toHaveBeenCalledTimes(1);
        expect(sandbox.window.appConfirm.mock.calls[0][1]).toMatchObject({
            title: 'Przelicz do aktywnego',
            type: 'warning',
            okText: 'Przelicz'
        });
        expect(onRecalc).toHaveBeenCalledTimes(1);
        expect(sandbox.window.showToast).toHaveBeenCalledWith(
            'Przeliczono do aktywnego cennika',
            'success'
        );
        const box = document.els['pv-offer-banner-studnie'] || document.host.children[0];
        expect(box.removed).toBe(true);
    });

    test('anulowanie confirma: brak recalc i toasta', async () => {
        const { sandbox, button } = loadBanner({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP, v2: ACTIVE }
        });
        sandbox.window.appConfirm = jest.fn(async () => false);
        const onRecalc = jest.fn(async () => true);
        sandbox.onRecalcHook = onRecalc;
        await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"rury",stampId:"v1",onRecalc:function(){return onRecalcHook();}})',
            sandbox
        );
        await button._listeners.click();
        expect(onRecalc).not.toHaveBeenCalled();
        expect(sandbox.window.showToast).not.toHaveBeenCalled();
    });

    test('onRecalc dostaje active.id (pieczątka do zapisu)', async () => {
        const { sandbox, button } = loadBanner({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP, v2: ACTIVE }
        });
        const onRecalc = jest.fn(async () => true);
        sandbox.onRecalcHook = onRecalc;
        await vm.runInContext(
            'window.offerPricelistBanner.refresh({type:"rury",stampId:"v1",onRecalc:function(id){return onRecalcHook(id);}})',
            sandbox
        );
        await button._listeners.click();
        expect(onRecalc).toHaveBeenCalledTimes(1);
        expect(onRecalc).toHaveBeenCalledWith('v2');
    });
});

describe('frontend vm: offerPricelistBanner.badge (stały badge w nagłówku)', () => {
    function makeBadgeDoc({ noWizard = false, hiddenTitle = false } = {}) {
        const inserted = [];
        const wizard = {
            id: 'wizard-indicator',
            children: [],
            appendChild(c) {
                this.children.push(c);
            },
            getAttribute: () => ''
        };
        const anchor = {
            id: 'offer-form-title-studnie',
            nextSibling: null,
            getAttribute: (k) => (k === 'style' && hiddenTitle ? 'display: none' : ''),
            parentElement: {
                insertBefore(el) {
                    inserted.push(el);
                }
            },
            after() {}
        };
        const badgeEls = {};
        let created = 0;
        return {
            inserted,
            badgeEls,
            createdCount: () => created,
            addWizard: () => {},
            getElementById: (id) => {
                if (id === 'wizard-indicator') return noWizard ? null : wizard;
                if (id === 'offer-form-title-studnie' || id === 'offer-form-title') return anchor;
                return badgeEls[id] || null;
            },
            createElement: () => {
                created += 1;
                let html = '';
                const el = {
                    id: '',
                    className: '',
                    textContent: '',
                    attrs: {},
                    removed: false,
                    setAttribute(k, v) {
                        this.attrs[k] = v;
                    },
                    remove() {
                        this.removed = true;
                    }
                };
                Object.defineProperty(el, 'innerHTML', {
                    get: () => html,
                    set: (v) => {
                        html = String(v);
                        el.textContent = html.replace(/<[^>]*>/g, '');
                    }
                });
                return el;
            },
            body: { appendChild: jest.fn(), firstChild: null }
        };
    }

    function loadBadge({ labels, labelsByIds, docOpts }) {
        const document = makeBadgeDoc(docOpts);
        const sandbox = {
            window: {},
            console,
            document,
            setTimeout: (fn: (...a: unknown[]) => void, ms?: number) =>
                setTimeout(() => fn(), ms ?? 0)
        };
        sandbox.window.escapeHtml = (s) => String(s ?? '');
        sandbox.window.lucide = { createIcons: jest.fn() };
        sandbox.window.pricelistVersions = {
            fetchLabels: jest.fn(async () => labels),
            fetchLabelsByIds: jest.fn(async () => labelsByIds || {})
        };
        vm.createContext(sandbox);
        vm.runInContext(BANNER_SRC, sandbox, { filename: 'offerPricelistBanner.js' });
        // createElement rejestruje badge w dokumencie
        const origCreate = document.createElement.bind(document);
        document.createElement = (...a) => {
            const el = origCreate(...a);
            const origRemove = el.remove.bind(el);
            el.remove = () => {
                el.removed = true;
                delete document.badgeEls[el.id];
                origRemove();
            };
            const host =
                document.getElementById('wizard-indicator') ||
                document.getElementById('offer-form-title-studnie');
            const sink = host.appendChild
                ? { push: (c) => host.appendChild(c) }
                : { push: (c) => host.parentElement.insertBefore(c) };
            const origPush = sink.push.bind(sink);
            if (host.appendChild) {
                const origAppend = host.appendChild.bind(host);
                host.appendChild = (c) => {
                    document.badgeEls[c.id] = c;
                    return origAppend(c);
                };
            } else {
                const pe = host.parentElement;
                const origInsert = pe.insertBefore.bind(pe);
                pe.insertBefore = (c, r) => {
                    document.badgeEls[c.id] = c;
                    return origInsert(c, r);
                };
            }
            void origPush;
            return el;
        };
        return { sandbox, document };
    }

    test('nowa oferta (brak pieczątki) → badge aktywnego w wizard-indicator', async () => {
        const { sandbox, document } = loadBadge({ labels: { v2: ACTIVE } });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:null,anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        expect(visible).toBe(true);
        const badge = document.badgeEls['pv-offer-badge-studnie'];
        expect(badge.textContent).toBe('Cennik: v2-20260102 (aktywny) · Studnie');
        const wizard = document.getElementById('wizard-indicator');
        expect(wizard.children).toContain(badge);
        expect(document.inserted).toHaveLength(0);
    });

    test('wczytana oferta z pieczątką → badge wersji oferty', async () => {
        const { sandbox, document } = loadBadge({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP }
        });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:"v1",anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        expect(visible).toBe(true);
        expect(document.badgeEls['pv-offer-badge-studnie'].textContent).toBe(
            'Cennik: v1-20260101 · Studnie'
        );
    });

    test('ukryty tytuł kroku → wizard, nie ślepa kotwica', async () => {
        const { sandbox, document } = loadBadge({
            labels: { v2: ACTIVE },
            docOpts: { hiddenTitle: true }
        });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:null,anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        expect(visible).toBe(true);
        const wizard = document.getElementById('wizard-indicator');
        expect(wizard.children).toHaveLength(1);
        expect(document.inserted).toHaveLength(0);
    });

    test('nieznana pieczątka → badge legacy (nie cisza)', async () => {
        const { sandbox, document } = loadBadge({ labels: { v2: ACTIVE }, labelsByIds: {} });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"rury",stampId:"vX",anchorId:"offer-form-title"})',
            sandbox
        );
        expect(visible).toBe(true);
        expect(document.badgeEls['pv-offer-badge-rury'].textContent).toBe('Cennik: legacy · Rury');
    });

    test('brak ACTIVE i brak pieczątki → cisza', async () => {
        const { sandbox, document } = loadBadge({ labels: {} });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"rury",stampId:null})',
            sandbox
        );
        expect(visible).toBe(false);
        expect(document.badgeEls['pv-offer-badge-rury'] || null).toBeNull();
    });

    test('brak kotwicy wcale → false, nic nie tworzone, brak body-append', async () => {
        const { sandbox, document } = loadBadge({
            labels: { v2: ACTIVE },
            docOpts: { noWizard: true, hiddenTitle: true }
        });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"rury",stampId:null,waitTries:0})',
            sandbox
        );
        expect(visible).toBe(false);
        expect(document.createdCount()).toBe(0);
        expect(document.body.appendChild).not.toHaveBeenCalled();
    });

    test('async partial: kotwica dokładana po chwili → retry maluje', async () => {
        const { sandbox, document } = loadBadge({
            labels: { v2: ACTIVE },
            docOpts: { noWizard: true, hiddenTitle: true }
        });
        const anchor = document.getElementById('offer-form-title');
        setTimeout(() => {
            const wiz = {
                id: 'wizard-indicator',
                children: [],
                appendChild(c) {
                    this.children.push(c);
                },
                getAttribute: () => ''
            };
            const orig = document.getElementById.bind(document);
            document.getElementById = (id) => (id === 'wizard-indicator' ? wiz : orig(id));
            (document as any).lateWizard = wiz;
            void anchor;
        }, 30);
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:null,waitDelayMs:20})',
            sandbox
        );
        expect(visible).toBe(true);
        expect((document as any).lateWizard.children).toHaveLength(1);
    });

    test('badge wygląda jak kafel projektu: klasa, ikona tag, prawo', async () => {
        const { sandbox, document } = loadBadge({ labels: { v2: ACTIVE } });
        await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:null,anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        const badge = document.badgeEls['pv-offer-badge-studnie'];
        expect(badge.className).toContain('pv-offer-badge');
        expect(badge.className).toContain('badge-info');
        const html = (badge as any).innerHTML as string;
        expect(html).toContain('data-lucide="tag"');
        expect(html).toContain('Cennik: v2-20260102 (aktywny)');
        expect(sandbox.window.lucide.createIcons).toHaveBeenCalled();
        // CSS: kafel + margin-left:auto (prawo), tokeny projektu
        const css = fs.readFileSync(path.join(ROOT, 'public/css/style.utilities.css'), 'utf8');
        const badgeCss = css.slice(css.indexOf('.pv-offer-badge'));
        for (const prop of [
            'inline-flex',
            'margin-left: auto',
            'var(--radius-sm)',
            'var(--fs-sm)',
            'var(--fw-medium)'
        ])
            expect(badgeCss).toContain(prop);
        // W stepperze badge absolutnie do prawej — kropki zostają wyśrodkowane
        expect(badgeCss).toContain('.wizard-indicator > .pv-offer-badge');
        expect(badgeCss).toContain('position: absolute');
        expect(badgeCss).toContain('right: 0.5rem');
        // ikona tag w iconsSlim (test kontraktu ikon wyżej sprawdza resztę)
        const slim = fs.readFileSync(path.join(ROOT, 'public/js/shared/iconsSlim.js'), 'utf8');
        expect(slim).toMatch(/['"]?tag['"]?\s*:/);
    });

    test('hide() gasi tylko pasek ostrzeżenia — badge trwały zostaje', async () => {
        const { sandbox, document } = loadBadge({ labels: { v2: ACTIVE } });
        await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:null})',
            sandbox
        );
        expect(document.badgeEls['pv-offer-badge-studnie']).toBeDefined();
        await vm.runInContext(`window.offerPricelistBanner.hide('studnie')`, sandbox);
        expect(document.badgeEls['pv-offer-badge-studnie'].removed).toBe(false);
    });

    test('drugie badge() aktualizuje tekst, nie duplikuje elementu', async () => {
        const { sandbox, document } = loadBadge({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP }
        });
        await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:null})',
            sandbox
        );
        const before = document.createdCount();
        await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:"v1"})',
            sandbox
        );
        expect(document.createdCount()).toBe(before);
        expect(document.badgeEls['pv-offer-badge-studnie'].textContent).toBe(
            'Cennik: v1-20260101 · Studnie'
        );
    });

    test('badge wraca do wizard-indicator po wejściu w builder (relokacja)', async () => {
        const { sandbox, document } = loadBadge({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP },
            docOpts: { noWizard: true }
        });
        await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:"v1",anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        const badge = document.badgeEls['pv-offer-badge-studnie'];
        expect(document.inserted).toContain(badge);
        // Builder wstaje (partial async): wizard-indicator dokładany później.
        const wiz = {
            id: 'wizard-indicator',
            children: [],
            appendChild(c) {
                if (!this.children.includes(c)) this.children.push(c);
            },
            getAttribute: () => ''
        };
        const orig = document.getElementById.bind(document);
        document.getElementById = (id) => (id === 'wizard-indicator' ? wiz : orig(id));
        await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:"v1",anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        expect(wiz.children).toContain(badge);
        expect(badge.textContent).toBe('Cennik: v1-20260101 · Studnie');
    });

    test('reattach() przemalowuje badge na ostatniej pieczątce (nawigacja kroków)', async () => {
        const { sandbox, document } = loadBadge({
            labels: { v2: ACTIVE },
            labelsByIds: { v1: STAMP }
        });
        expect(typeof sandbox.window.offerPricelistBanner.reattach).toBe('function');
        await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:"v1"})',
            sandbox
        );
        const calls = sandbox.window.pricelistVersions.fetchLabels.mock.calls.length;
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.reattach("studnie")',
            sandbox
        );
        expect(visible).toBe(true);
        expect(sandbox.window.pricelistVersions.fetchLabels.mock.calls.length).toBeGreaterThan(
            calls
        );
        expect(document.badgeEls['pv-offer-badge-studnie'].textContent).toBe(
            'Cennik: v1-20260101 · Studnie'
        );
    });

    test('reattach() bez historii → badge aktywnego (nowa oferta w builderze)', async () => {
        const { sandbox, document } = loadBadge({ labels: { v2: ACTIVE } });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.reattach("rury")',
            sandbox
        );
        expect(visible).toBe(true);
        expect(document.badgeEls['pv-offer-badge-rury'].textContent).toBe(
            'Cennik: v2-20260102 (aktywny) · Rury'
        );
    });

    test('badge bez fetchy na piechotę, bez onclick i bez body-append', () => {
        const badgeSrc = BANNER_SRC.slice(BANNER_SRC.indexOf('STAŁY BADGE'));
        expect(badgeSrc).not.toContain('fetch(');
        expect(badgeSrc).not.toContain('onclick=');
        expect(badgeSrc).not.toContain('document.body.appendChild');
    });
});

describe('frontend static: wpięcie badge w edytory', () => {
    test('badge() w clear + load (rury + studnie)', () => {
        const ruryCrud = fs.readFileSync(path.join(ROOT, 'public/js/rury/offerCrud.js'), 'utf8');
        const studnieMgr = fs.readFileSync(
            path.join(ROOT, 'public/js/studnie/offerManager.js'),
            'utf8'
        );
        for (const src of [ruryCrud, studnieMgr]) {
            expect(src).toContain('offerPricelistBanner.badge');
            expect(src).toContain('stampId: normalized.pricelistVersionId || null');
            expect(src).toContain('stampId: null');
        }
    });
    test('badge przemalowany po recalc i po zapisie (nie kłamie do reloadu)', () => {
        const ruryCrud = fs.readFileSync(path.join(ROOT, 'public/js/rury/offerCrud.js'), 'utf8');
        const studnieMgr = fs.readFileSync(
            path.join(ROOT, 'public/js/studnie/offerManager.js'),
            'utf8'
        );
        const studnieSave = fs.readFileSync(
            path.join(ROOT, 'public/js/studnie/offerSave.js'),
            'utf8'
        );
        expect(ruryCrud).toContain('stampId: pendingRuryStampId || null');
        expect(ruryCrud).toContain('stampId: offerDoc.pricelistVersionId || null');
        expect(studnieMgr).toContain('stampId: window.pendingStudnieStampId || null');
        expect(studnieSave).toContain('stampId: offerDoc.pricelistVersionId || null');
        expect(studnieSave).toContain('stampId: fresh.pricelistVersionId || null');
    });
    test('reattach w nawigacji wizarda (rury + studnie, kroki 1-5)', () => {
        const ruryWizard = fs.readFileSync(path.join(ROOT, 'public/js/rury/wizard.js'), 'utf8');
        const studnieNav = fs.readFileSync(
            path.join(ROOT, 'public/js/studnie/uiHelpers.js'),
            'utf8'
        );
        expect(ruryWizard).toContain("offerPricelistBanner.reattach('rury')");
        expect(studnieNav).toContain("offerPricelistBanner.reattach('studnie')");
    });
    test('badge w edytorach zamówień (rury + studnie)', () => {
        const ruryOrder = fs.readFileSync(
            path.join(ROOT, 'public/js/rury/orderEditMode.js'),
            'utf8'
        );
        const studnieOrder = fs.readFileSync(
            path.join(ROOT, 'public/js/studnie/orderCrud.js'),
            'utf8'
        );
        expect(ruryOrder).toContain('offerPricelistBanner.badge');
        expect(ruryOrder).toContain('stampId: orderData.pricelistVersionId || null');
        expect(studnieOrder).toContain('offerPricelistBanner.badge');
        expect(studnieOrder).toContain('stampId: order.pricelistVersionId || null');
    });
});
describe('frontend static: kontrakt bannera', () => {
    test('tylko ikony z iconsSlim (alert-triangle, refresh-cw)', () => {
        const slim = fs.readFileSync(path.join(ROOT, 'public/js/shared/iconsSlim.js'), 'utf8');
        const icons = [...BANNER_SRC.matchAll(/data-lucide="([a-z0-9-]+)"/g)].map((m) => m[1]);
        expect(icons.length).toBeGreaterThan(0);
        for (const n of icons) expect(slim).toMatch(new RegExp('[\'"]?' + n + '[\'"]?\\s*:'));
    });
    test('polski UI, brak inline onclick, brak fetchy na piechotę', () => {
        expect(BANNER_SRC).toContain('Ceny zamrożone');
        expect(BANNER_SRC).toContain('Przelicz do aktywnego');
        expect(BANNER_SRC).not.toContain('onclick=');
        expect(BANNER_SRC).not.toContain('fetch(');
        expect(BANNER_SRC).toContain('addEventListener');
    });
    test('wpięcie w nagłówki edytorów (rury + studnie)', () => {
        const ruryCrud = fs.readFileSync(path.join(ROOT, 'public/js/rury/offerCrud.js'), 'utf8');
        const studnieMgr = fs.readFileSync(
            path.join(ROOT, 'public/js/studnie/offerManager.js'),
            'utf8'
        );
        expect(ruryCrud).toContain("anchorId: 'offer-form-title'");
        expect(studnieMgr).toContain("anchorId: 'offer-form-title-studnie'");
        expect(ruryCrud).toContain('offerPricelistBanner.refresh');
        expect(studnieMgr).toContain('offerPricelistBanner.refresh');
    });
    test('skrypty podpięte w rury.html i studnie.html', () => {
        for (const f of ['public/rury.html', 'public/studnie.html']) {
            expect(fs.readFileSync(path.join(ROOT, f), 'utf8')).toContain(
                'js/shared/offerPricelistBanner.js'
            );
        }
    });
});
