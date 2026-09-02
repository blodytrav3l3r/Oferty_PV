#!/usr/bin/env node
// Benchmark prod — tmRefreshWellData z rzeczywistym calcWellStats (po P0-1 hoist)
// STEP 0 MEASURED: 10/100/1k wells, T=2 avg, real studnieProducts + pricing
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '../public/js/studnie');
const seedPath = path.join(__dirname, '../data/seed_studnie.json');

const studnieProducts = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

function createCtx() {
    const ctx = {
        wells: [],
        currentWellIndex: 0,
        wellDiscounts: {},
        orderEditMode: null,
        studnieProducts,
        productionOrders: [],
        precoPricing: {},
        FLOW_TYPES: { WLOT: 'wlot', WYLOT: 'wylot' },
        console,
        performance,
        document: {
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {} }),
            addEventListener: () => {}
        },
        window: null,
        localStorage: { getItem: () => null },
        location: { search: '' },
        navigator: {},
        escapeHtml: (s) => String(s),
        escapeHtmlAttr: (s) => String(s),
        fmtInt: (n) => String(n),
        fmt: (n) => String(n),
        isWellLocked: () => false,
        showModal: () => ({ innerHTML: '' }),
        showToast: () => {},
        lucide: { createIcons: () => {} },
        getComputedStyle: () => ({ overflowY: 'auto' }),
        requestAnimationFrame: (cb) => {
            cb();
            return 1;
        },
        cancelAnimationFrame: () => {},
        logger: { warn() {}, error() {}, info() {} }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const f of [
        'globals.js',
        'wellUIHelpers.js',
        'actionsWellPricing.js',
        'popupsTransitionManager.js'
    ]) {
        const p = path.join(base, f);
        if (!fs.existsSync(p)) continue;
        const code = fs.readFileSync(p, 'utf8');
        try {
            vm.runInContext(code, ctx);
        } catch (e) {
            /* ignore parse quirks */
        }
    }
    return ctx;
}

function mkWell(i, t = 2) {
    const przejscia = [];
    for (let j = 0; j < t; j++) {
        przejscia.push({
            productId: 'PRZ-DN400-K2',
            angle: 10,
            rzednaWlaczenia: 100 + j * 0.5,
            flowType: 'wlot'
        });
    }
    // real prod id: pick przejscie product
    const przProd = studnieProducts.find((p) => p.componentType === 'przejscie');
    if (przProd) przejscia.forEach((tr) => (tr.productId = przProd.id));
    return {
        id: 'well-' + i,
        name: 'Ss' + i,
        dn: i % 2 ? '1200' : '1000',
        rzednaDna: 100,
        rzednaWlazu: 103,
        przejscia,
        config: [
            {
                productId: studnieProducts.find((p) => p.componentType === 'krag')?.id || 'K-1',
                quantity: 1
            }
        ]
    };
}

console.log('STEP 0 MEASURED — tmRefreshWellData prod (real calcWellStats, hoisted 1x)');
console.log(
    `studnieProducts: ${studnieProducts.length} (Wiercenie: ${studnieProducts.filter((p) => p.category === 'Wiercenie').length})`
);
for (const N of [10, 100, 1000]) {
    const ctx = createCtx();
    ctx.wells = [];
    for (let i = 0; i < N; i++) ctx.wells.push(mkWell(i, 2));
    if (ctx._rebuildWellsById) ctx._rebuildWellsById();

    let calcCalls = 0;
    const orig = ctx.calculateOfferTotals;
    ctx.calculateOfferTotals = function () {
        calcCalls++;
        return orig.call(ctx);
    };

    const t0 = performance.now();
    ctx.tmRefreshWellData();
    const dt = performance.now() - t0;
    ctx.calculateOfferTotals = orig;

    const ok = calcCalls === 1 ? 'OK' : `FAIL(${calcCalls})`;
    const longtask = dt > 50 ? 'longtask>50ms' : 'ok';
    const ttrGate = dt > 200 ? 'TTR>200 P0-2 NEEDED' : 'TTR<200 skip P0-2';
    console.log(
        `N=${String(N).padStart(4)} T=${String(N * 2).padStart(4)}  tmRefresh=${dt.toFixed(2)}ms  calcCalls=${calcCalls} ${ok}  ${longtask}  ${ttrGate}`
    );
}
