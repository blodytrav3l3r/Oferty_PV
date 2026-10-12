// @ts-nocheck
/* Mrożenie cen edycji ofert studni + nietykalność unitPrice rur + PUT pieczątki.
 * vm: renderOfferItems nie rusza unitPrice; freezeWellPrices snapshotuje live.
 * static: guardy isFrozenPriceCtx, flaga isOfferEditFrozen, recalc czyści
 * freeze, PUT (rury + studnie) nie niesie pricelistVersionId w update. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel) => fs.readFileSync(path.join(ROOT, 'public', rel), 'utf8');

describe('frontend vm: rury renderOfferItems nie rusza unitPrice edycji', () => {
    function loadRendering(items) {
        const ctxDir = path.join(ROOT, 'public/js/rury');
        const tbody = { innerHTML: '' };
        const colgroup = { innerHTML: '' };
        const sandbox = {
            window: {},
            console,
            document: {
                getElementById: (id) =>
                    id === 'offer-items-body' ? tbody : id === 'offer-colgroup' ? colgroup : null,
                addEventListener: () => {}
            },
            getActiveItemsArray: () => items,
            getRuryProductById: () => ({ price: 150, weight: 100, transport: 5 }),
            getProductLength: () => 2500,
            getPipeInnerArea: () => 0,
            getProductDiameter: () => 300,
            isOneMetrePipe: () => false,
            getSortedRuryItems: (list) => ({
                flat: [
                    {
                        cat: 'Rury Betonowe',
                        dk: 'DN 300',
                        entries: list.map((item, originalIndex) => ({ item, originalIndex }))
                    }
                ]
            }),
            calculateTransportDistribution: () => ({}),
            buildRuryColgroup: () => '',
            getConfigKey: (it) => it.productId,
            escapeHtml: (s) => String(s ?? ''),
            escapeHtmlAttr: (s) => String(s ?? ''),
            fmt: (v) => String(v),
            updateOfferSummary: () => {}
        };
        vm.createContext(sandbox);
        vm.runInContext(fs.readFileSync(path.join(ctxDir, 'offerRendering.js'), 'utf-8'), sandbox, {
            filename: 'offerRendering.js'
        });
        return { sandbox, tbody };
    }

    test('zapisany unitPrice stoi mimo zmiany live; brak unitPrice = live', () => {
        const items = [
            { productId: 'P1', name: 'Rura', unitPrice: 100, quantity: 2, discount: 0 },
            { productId: 'P1', name: 'Rura', quantity: 1, discount: 0 }
        ];
        const { sandbox } = loadRendering(items);
        vm.runInContext('renderOfferItems()', sandbox);
        expect(items[0].unitPrice).toBe(100);
        expect(items[1].unitPrice).toBe(150);
    });
});

describe('frontend vm: freezeWellPrices snapshotuje live (reuse w edycji)', () => {
    function loadHelpers() {
        const sandbox = {
            window: {},
            console,
            wellDiscounts: {},
            getStudnieProductById: (id) => ({ id, price: 100, name: 'Krąg' }),
            getItemAssessedPrice: (well, p, apply) => (apply ? 90 : 100),
            getTransitionHostPct: () => 10
        };
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/studnie/orderHelpers.js'), sandbox, {
            filename: 'orderHelpers.js'
        });
        return sandbox;
    }

    test('frozen* z live; preserveExisting nie nadpisuje', () => {
        const sb = loadHelpers();
        sb.wells = [
            {
                dn: '1000',
                kineta: 'brak',
                config: [{ productId: 'K1', quantity: 2 }],
                przejscia: []
            }
        ];
        vm.runInContext('freezeWellPrices(wells)', sb);
        const item = sb.wells[0].config[0];
        expect(item.frozenPrice).toBe(90);
        expect(item.frozenPriceBase).toBe(100);
        expect(item.frozenName).toBe('Krąg');
        item.frozenPrice = 50;
        vm.runInContext('freezeWellPrices(wells, true)', sb);
        expect(item.frozenPrice).toBe(50);
    });

    test('isFrozenPriceCtx: preview albo edycja oferty', () => {
        const sb = loadHelpers();
        sb.window.isPreviewMode = false;
        sb.window.isOfferEditFrozen = false;
        expect(vm.runInContext('isFrozenPriceCtx()', sb)).toBe(false);
        sb.window.isOfferEditFrozen = true;
        expect(vm.runInContext('isFrozenPriceCtx()', sb)).toBe(true);
        sb.window.isOfferEditFrozen = false;
        sb.window.isPreviewMode = true;
        expect(vm.runInContext('isFrozenPriceCtx()', sb)).toBe(true);
    });
});

describe('frontend vm: zmiana rabatu w edycji oferty odświeża frozen* (refreeze)', () => {
    const products = [
        {
            id: 'DDD-1000-300',
            componentType: 'dennica',
            dn: '1000',
            height: 300,
            price: 740,
            name: 'Dennica DN1000'
        },
        {
            id: 'PRZ-400',
            componentType: 'przejscie',
            dn: '400',
            price: 200,
            name: 'Przejście PVC SN8 400'
        }
    ];

    function loadCtx() {
        const sandbox = {
            window: {},
            console,
            studnieProducts: products,
            wellDiscounts: {},
            precoPricing: {},
            FLOW_TYPES: { WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' },
            calcPrecoPricingPure: () => ({ suma: 0, error: null }),
            showToast: () => {},
            isWellOrdered: () => false,
            getOrderForWellId: () => null,
            resolveEffectiveProduct: (_well: any, productId: string) =>
                products.find((pr) => pr.id === productId),
            getStudnieProductById: (id: string) => products.find((pr) => pr.id === id),
            findAssignedElement: () => ({ entry: { componentType: 'dennica' } }),
            buildConfigMap: () => [{}],
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            renderDiscountPanel: () => {},
            updateSummary: () => {},
            renderOfferSummary: () => {},
            renderWellConfig: () => {}
        };
        sandbox.window.isPreviewMode = false;
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/studnie/globals.js'), sandbox, { filename: 'globals.js' });
        sandbox.window.studnieProducts = products;
        vm.runInContext(readPub('js/studnie/actionsWellPainting.js'), sandbox, {
            filename: 'actionsWellPainting.js'
        });
        vm.runInContext(readPub('js/studnie/actionsWellPricing.js'), sandbox, {
            filename: 'actionsWellPricing.js'
        });
        vm.runInContext(readPub('js/studnie/orderHelpers.js'), sandbox, {
            filename: 'orderHelpers.js'
        });
        vm.runInContext(readPub('js/studnie/actionsWellDiscounts.js'), sandbox, {
            filename: 'actionsWellDiscounts.js'
        });
        return sandbox;
    }

    function seedOfferAt40(sb: any) {
        // wells/wellDiscounts przez runInContext (let-bindings z globals.js).
        vm.runInContext(
            `wells = ${JSON.stringify([
                {
                    dn: '1000',
                    klasaNosnosci_korpus: 'D400',
                    dennicaMaterial: 'zelbetowa',
                    config: [{ productId: 'DDD-1000-300', quantity: 1 }],
                    przejscia: [
                        { productId: 'PRZ-400', quantity: 1, rzednaWlaczenia: '1', dn: '400' }
                    ]
                }
            ])}`,
            sb
        );
        vm.runInContext(
            `wellDiscounts = ${JSON.stringify({ 1000: { dennica: 40, nadbudowa: 40 } })}`,
            sb
        );
        vm.runInContext('freezeWellPrices(wells)', sb);
        return vm.runInContext('wells[0]', sb);
    }

    test('freeze przy 40% → zmiana na 50% w edycji oferty przemraża przejście i pozycję', () => {
        const sb = loadCtx();
        const w = seedOfferAt40(sb);
        expect(w.przejscia[0].frozenTransitionPrice).toBe(120); // 200 × 0.6, host dennica
        // Sesja edycji oferty + zmiana rabatu na żywo.
        vm.runInContext('isOfferEditFrozen = true', sb);
        vm.runInContext(`applyDiscount('1000', 'dennica', 50)`, sb);
        const wAfter = vm.runInContext('wells[0]', sb);
        expect(wAfter.przejscia[0].frozenTransitionPrice).toBe(100); // 200 × 0.5
        expect(wAfter.config[0].frozenPrice).toBe(370); // 740 × 0.5
        // Badge z mrożonego stosunku pokazuje nowy rabat, nie stare 40%.
        const pr = wAfter.przejscia[0];
        expect((1 - pr.frozenPrice / pr.frozenPriceBase) * 100).toBe(50);
    });

    test('poza edycją oferty i zamówieniem zmiana rabatu nie tyka frozen*', () => {
        const sb = loadCtx();
        const w = seedOfferAt40(sb);
        vm.runInContext(`applyDiscount('1000', 'dennica', 50)`, sb);
        const wAfter = vm.runInContext('wells[0]', sb);
        expect(wAfter.przejscia[0].frozenTransitionPrice).toBe(120);
        expect(wAfter.config[0].frozenPrice).toBe(444); // 740 × 0.6 stoi
        expect(w).toBe(wAfter);
    });
});

describe('frontend vm: freeze przejść studni zamówionej piecze snapshot (nie live)', () => {
    const products = [
        {
            id: 'DDD-1000-300',
            componentType: 'dennica',
            dn: '1000',
            height: 300,
            price: 740,
            name: 'Dennica DN1000'
        },
        {
            id: 'PRZ-400',
            componentType: 'przejscie',
            dn: '400',
            price: 200,
            name: 'Przejście PVC SN8 400'
        }
    ];

    function loadCtx(snapshotDisc: Record<string, unknown>) {
        const sandbox = {
            window: {},
            console,
            studnieProducts: products,
            wellDiscounts: {},
            precoPricing: {},
            FLOW_TYPES: { WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' },
            calcPrecoPricingPure: () => ({ suma: 0, error: null }),
            showToast: () => {},
            resolveEffectiveProduct: (_well: any, productId: string) =>
                products.find((pr) => pr.id === productId),
            getStudnieProductById: (id: string) => products.find((pr) => pr.id === id),
            findAssignedElement: () => ({ entry: { componentType: 'dennica' } }),
            buildConfigMap: () => [{}],
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v))
        };
        sandbox.window.isPreviewMode = false;
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/studnie/globals.js'), sandbox, { filename: 'globals.js' });
        sandbox.window.studnieProducts = products;
        vm.runInContext(readPub('js/studnie/actionsWellPainting.js'), sandbox, {
            filename: 'actionsWellPainting.js'
        });
        vm.runInContext(readPub('js/studnie/actionsWellPricing.js'), sandbox, {
            filename: 'actionsWellPricing.js'
        });
        vm.runInContext(readPub('js/studnie/orderHelpers.js'), sandbox, {
            filename: 'orderHelpers.js'
        });
        // orderHelpers definiuje własne isWellOrdered/getOrderForWellId —
        // podpinamy stuby PO wczytaniu plików (studnia zamówiona ze snapshotem).
        // editingOfferIdStudnie jak w edycji oferty (bez niego snapshot nieczytany).
        vm.runInContext('isWellOrdered = () => true', sandbox);
        vm.runInContext(`editingOfferIdStudnie = 'offer1'`, sandbox);
        // Snapshot trzyma mapę {DN: rabaty} jak globalny wellDiscounts.
        vm.runInContext(
            `getOrderForWellId = () => ({ originalSnapshot: { wellDiscounts: { 1000: ${JSON.stringify(snapshotDisc)} } } })`,
            sandbox
        );
        return sandbox;
    }

    function seedOrdered(sb: any, korpus: string, liveDisc: Record<string, unknown>) {
        vm.runInContext(
            `wells = ${JSON.stringify([
                {
                    id: 'w1',
                    dn: '1000',
                    klasaNosnosci_korpus: korpus,
                    dennicaMaterial: 'zelbetowa',
                    config: [{ productId: 'DDD-1000-300', quantity: 1 }],
                    przejscia: [
                        { productId: 'PRZ-400', quantity: 1, rzednaWlaczenia: '1', dn: '400' }
                    ]
                }
            ])}`,
            sb
        );
        vm.runInContext(`wellDiscounts = ${JSON.stringify({ 1000: liveDisc })}`, sb);
        vm.runInContext('freezeWellPrices(wells)', sb);
        return vm.runInContext('wells[0]', sb);
    }

    test('D400 zamówiona: live 30, snapshot 40 → przejście i pozycja ze snapshotu', () => {
        const sb = loadCtx({ dennica: 40, nadbudowa: 40 });
        const w = seedOrdered(sb, 'D400', { dennica: 30, nadbudowa: 30 });
        // Przejście w dennicy: 200 × 0.6 (snapshot), nie 200 × 0.7 (live).
        expect(w.przejscia[0].frozenTransitionPrice).toBe(120);
        expect(w.przejscia[0].frozenPrice).toBe(120);
        // Pozycja tak samo (jak dotąd): 740 × 0.6.
        expect(w.config[0].frozenPrice).toBe(444);
    });

    test('E600 zamówiona: live dennicaE600=30, snapshot 40 → przejście ze snapshotu', () => {
        const sb = loadCtx({ dennicaE600: 40, nadbudowaE600: 40 });
        const w = seedOrdered(sb, 'E600', { dennicaE600: 30, nadbudowaE600: 30 });
        expect(w.przejscia[0].frozenTransitionPrice).toBe(120);
        expect(w.config[0].frozenPrice).toBe(444);
    });
});

describe('frontend static: mrożenie studni end-to-end w źródle', () => {
    const pricing = readPub('js/studnie/actionsWellPricing.js');
    const calc = readPub('js/studnie/offerPricingCalc.js');
    const render = readPub('js/studnie/actionsConfigRender.js');
    const comps = readPub('js/studnie/offerWellComponents.js');
    const helpers = readPub('js/studnie/orderHelpers.js');
    const globals = readPub('js/studnie/globals.js');
    const mgr = readPub('js/studnie/offerManager.js');

    test('SSoT isFrozenPriceCtx zdefiniowany i wystawiony', () => {
        expect(helpers).toContain('function isFrozenPriceCtx()');
        expect(helpers).toContain('window.isFrozenPriceCtx = isFrozenPriceCtx');
        expect(helpers).toContain('window.isOfferEditFrozen');
    });
    test('wszystkie guardy frozen idą przez isFrozenPriceCtx (6×)', () => {
        for (const src of [pricing, calc, render, comps]) {
            expect(src).not.toMatch(/frozenPrice != null && window\.isPreviewMode/);
            expect(src).not.toMatch(/isPreviewMode && well\.frozenPrecoSuma/);
        }
        const hits = [pricing, calc, render, comps].join('\n').match(/isFrozenPriceCtx\(\)/g) || [];
        expect(hits.length).toBeGreaterThanOrEqual(6);
    });
    test('flaga isOfferEditFrozen w globals (let + binding)', () => {
        expect(globals).toContain('let isOfferEditFrozen = false');
        expect(globals).toContain('isOfferEditFrozen: () => isOfferEditFrozen');
        expect(globals).toContain('isOfferEditFrozen: (v) =>');
    });
    test('load wczytuje freeze (flaga + snapshot), clear gasi', () => {
        expect(mgr).toContain('isOfferEditFrozen = true');
        expect(mgr).toContain('freezeWellPrices(wells)');
        expect(mgr).toContain('isOfferEditFrozen = false');
    });
    test('recalcStudnieToActive czyści frozen* i przelicza', () => {
        expect(mgr).toContain('function recalcStudnieToActive(activeId)');
        for (const f of [
            'delete it.frozenPrice',
            'delete it.frozenPriceBase',
            'delete it.frozenTransitionPrice',
            'delete it.frozenDrillingPrice',
            'delete w.frozenPrecoSuma'
        ])
            expect(mgr).toContain(f);
        expect(mgr).toContain('refreshAll()');
        expect(mgr).toContain('window.recalcStudnieToActive = recalcStudnieToActive');
    });
    test('rury: recalc z live, zero zmian logiki render/zapis', () => {
        const crud = readPub('js/rury/offerCrud.js');
        const rendering = readPub('js/rury/offerRendering.js');
        expect(crud).toContain('function recalcRuryToActive(activeId)');
        expect(crud).toContain('item.unitPrice = product.price');
        expect(crud).toContain('window.recalcRuryToActive = recalcRuryToActive');
        // Logika mrożenia rur nietknięta: unitPrice tylko gdy undefined.
        expect(rendering).toContain(
            'if (item.unitPrice === undefined) item.unitPrice = product.price'
        );
    });
});

describe('frontend vm: recalc zapisuje pendingStampId (pieczątka do zapisu)', () => {
    test('rury: recalcRuryToActive(activeId) stempluje pending + przelicza ceny', () => {
        const sandbox = {
            window: {},
            console,
            currentOfferItems: [{ productId: 'P1', quantity: 1, discount: 0 }],
            getRuryProductById: () => ({ price: 150 }),
            renderOfferItems: () => {}
        };
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/rury/offerCrud.js'), sandbox, {
            filename: 'offerCrud.js'
        });
        vm.runInContext('recalcRuryToActive("v9")', sandbox);
        expect(vm.runInContext('pendingRuryStampId', sandbox)).toBe('v9');
        expect(sandbox.currentOfferItems[0].unitPrice).toBe(150);
        // Bez argumentu (stare wołanie) — pending nietknięte, ceny przeliczone.
        vm.runInContext('pendingRuryStampId = null', sandbox);
        vm.runInContext('recalcRuryToActive()', sandbox);
        expect(vm.runInContext('pendingRuryStampId', sandbox)).toBeNull();
    });

    test('studnie: recalcStudnieToActive(activeId) stempluje pending + czyści frozen', () => {
        const sandbox = {
            window: {},
            console,
            wells: [
                {
                    config: [{ productId: 'K1', frozenPrice: 90, frozenName: 'Krąg' }],
                    przejscia: []
                }
            ],
            refreshAll: () => {},
            renderOfferSummary: () => {}
        };
        vm.createContext(sandbox);
        vm.runInContext(readPub('js/studnie/offerManager.js'), sandbox, {
            filename: 'offerManager.js'
        });
        vm.runInContext('recalcStudnieToActive("v9")', sandbox);
        expect(sandbox.window.pendingStudnieStampId).toBe('v9');
        expect(sandbox.wells[0].config[0].frozenPrice).toBeUndefined();
    });
});

describe('frontend static: pieczątka doklejana tylko przy pending', () => {
    test('rury: saveOffer dokleja/czyści pending, clearOfferForm resetuje', () => {
        const crud = readPub('js/rury/offerCrud.js');
        expect(crud).toContain('let pendingRuryStampId = null');
        expect(crud).toContain('function recalcRuryToActive(activeId)');
        expect(crud).toContain(
            'if (pendingRuryStampId) offerDoc.pricelistVersionId = pendingRuryStampId'
        );
        const saves = crud.indexOf('storageService.saveOffer(offerDoc)');
        expect(crud.slice(saves, saves + 200)).toContain('pendingRuryStampId = null');
    });
    test('studnie: saveOfferStudnie dokleja/czyści pending, clearOfferForm resetuje', () => {
        const save = readPub('js/studnie/offerSave.js');
        expect(save).toContain('if (window.pendingStudnieStampId)');
        expect(save).toContain('offerDoc.pricelistVersionId = window.pendingStudnieStampId');
        const at = save.indexOf('storageService.saveOffer(offerDoc)');
        expect(save.slice(at, at + 200)).toContain('window.pendingStudnieStampId = null');
        const mgr = readPub('js/studnie/offerManager.js');
        expect(mgr).toContain('function recalcStudnieToActive(activeId)');
        expect(mgr).toContain('window.pendingStudnieStampId = null');
    });
});

describe('backend static: pieczątka w update tylko za zgodnym stampem', () => {
    test('rury: POST-upsert i PUT weryfikują stamp z ACTIVE (409 STALE_PRICELIST)', () => {
        const src = fs.readFileSync(path.join(ROOT, 'src/routes/offers/ruryCrud.ts'), 'utf8');
        expect(src).toContain("resolveActive('rury')");
        expect(src).toContain("code: 'STALE_PRICELIST'");
        // POST: warunkowy awans w updateData, create ze stemplem jak dziś.
        expect(src).toContain('w.advanceStamp');
        expect(src).toContain('pricelistVersionId: w.pricelistVersionId');
        expect(src).toContain('F3 freeze (tylko create — updateData bez zmian)');
        // PUT: warunkowy awans w updateData.
        expect(src).toContain('...(w.stamp ? { pricelistVersionId: w.stamp } : {})');
        // Pieczątka poza blobem (kolumna źródłem prawdy).
        expect(src).toContain('pricelistVersionId: stampReq');
    });
    test('studnie: POST i PUT weryfikują stamp z ACTIVE (409 STALE_PRICELIST)', () => {
        const src = fs.readFileSync(path.join(ROOT, 'src/routes/offers/studnieCrud.ts'), 'utf8');
        expect(src).toContain("resolveActive('studnie')");
        expect(src).toContain("code: 'STALE_PRICELIST'");
        expect(src).toContain('...(requestedStamp ? { pricelistVersionId: requestedStamp } : {})');
        expect(src).toContain(
            '...(requestedPutStamp ? { pricelistVersionId: requestedPutStamp } : {})'
        );
        expect(src).toContain('pricelistVersionId: frozenStudnieVersionId');
        expect(src).toContain('F3 freeze: nowy dokument = aktywna wersja');
    });
});
