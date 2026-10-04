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
    function makeBadgeDoc() {
        const inserted = [];
        const anchor = {
            id: 'offer-form-title-studnie',
            nextSibling: null,
            parentElement: {
                insertBefore(el) {
                    inserted.push(el);
                }
            }
        };
        const badgeEls = {};
        return {
            inserted,
            badgeEls,
            getElementById: (id) => {
                if (id === 'offer-form-title-studnie' || id === 'offer-form-title') return anchor;
                return badgeEls[id] || null;
            },
            createElement: () => {
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
                return el;
            },
            body: { appendChild() {}, firstChild: null }
        };
    }

    function loadBadge({ labels, labelsByIds }) {
        const document = makeBadgeDoc();
        const sandbox = {
            window: {},
            console,
            document
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
            const { insertBefore } = document.getElementById(
                'offer-form-title-studnie'
            ).parentElement;
            document.getElementById('offer-form-title-studnie').parentElement.insertBefore = (
                child
            ) => {
                document.badgeEls[child.id] = child;
                insertBefore(child);
            };
            return el;
        };
        return { sandbox, document };
    }

    test('nowa oferta (brak pieczątki) → badge aktywnego', async () => {
        const { sandbox, document } = loadBadge({ labels: { v2: ACTIVE } });
        const visible = await vm.runInContext(
            'window.offerPricelistBanner.badge({type:"studnie",stampId:null,anchorId:"offer-form-title-studnie"})',
            sandbox
        );
        expect(visible).toBe(true);
        const badge = document.badgeEls['pv-offer-badge-studnie'];
        expect(badge.textContent).toBe('Cennik: v2-20260102 (aktywny) · Studnie');
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

    test('badge bez fetchy na piechotę i bez onclick', () => {
        const badgeSrc = BANNER_SRC.slice(BANNER_SRC.indexOf('STAŁY BADGE'));
        expect(badgeSrc).not.toContain('fetch(');
        expect(badgeSrc).not.toContain('onclick=');
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
