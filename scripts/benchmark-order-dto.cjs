// Jednorazowy benchmark P0.4: DTO before/after na 3000 studni.
// Uruchomienie: node scripts/benchmark-order-dto.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/js/studnie/orderDto.js'), 'utf8'),
    ctx
);
const { toOrderWellsDTO } = ctx.window;

function makeWell(i) {
    const config = [];
    for (let c = 0; c < 10; c++) {
        config.push({
            productId: `prod-${c}`,
            quantity: 1 + (c % 3),
            frozenPrice: 100 + c,
            frozenPriceBase: 100 + c,
            frozenName: `Elem ${c}`,
            _elemId: `el-${i}-${c}`,
            isPlaceholder: false
        });
    }
    return {
        id: `well-${i}`,
        name: `S${i}`,
        dn: '1000',
        rzednaDna: 100 + i * 0.01,
        rzednaWlazu: 103 + i * 0.01,
        magazyn: 'Kluczbork',
        psiaBuda: false,
        kineta: 'beton',
        spocznik: 'beton',
        spocznikH: '1/2',
        dennicaMaterial: 'betonowa',
        stopnie: 'drabinka',
        configSource: 'AUTO',
        autoLocked: true,
        config,
        przejscia: [
            { productId: 'prz-160', dn: '160', rzednaWlaczenia: 101, angle: 90, flowType: 'WLOT' },
            { productId: 'prz-200', dn: '200', rzednaWlaczenia: 102, angle: 0, flowType: 'WYLOT' }
        ],
        // runtime/cache jak w realnej sesji
        _lastAutoConfig: JSON.stringify(config),
        _lastAutoTelemetryId: `tel-${i}`,
        _aiRankInfo: { score: 0.5, ranked: [1, 2, 3] },
        _lastSolveInputHash: 'abcdef123456',
        __resCache: { stats: { price: 1000, weight: 2000 } },
        configErrors: [],
        configStatus: 'OK',
        solverCache: { matrix: Array(20).fill('x'.repeat(50)) }
    };
}

const N = 3000;
const wells = Array.from({ length: N }, (_, i) => makeWell(i));

function bytes(o) {
    return Buffer.byteLength(JSON.stringify(o), 'utf8');
}
function timeStr(fn) {
    const t0 = process.hrtime.bigint();
    const r = fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return { r, ms };
}

const beforeWells = bytes(wells);
const { r: dtoWells, ms: dtoMs } = timeStr(() => toOrderWellsDTO(JSON.parse(JSON.stringify(wells))));
const afterWells = bytes(dtoWells);

// Pełny payload zamówienia: wells + originalSnapshot.wells + wellsExport (jak orderCrud)
const snapWells = JSON.parse(JSON.stringify(wells));
const wellsExport = wells.map((w) => ({ ...w }));
const beforePayload = bytes({ wells, snapshot: { wells: snapWells }, wellsExport });
const dtoSnap = JSON.parse(JSON.stringify(dtoWells));
const dtoExport = dtoWells.map((w) => ({ ...w }));
const afterPayload = bytes({ wells: dtoWells, snapshot: { wells: dtoSnap }, wellsExport: dtoExport });
const { ms: strMs } = timeStr(() => JSON.stringify({ wells: dtoWells, snapshot: { wells: dtoSnap }, wellsExport: dtoExport }));

const mb = (b) => (b / 1024 / 1024).toFixed(2);
console.log(`wells: ${N}`);
console.log(`before DTO (wells): ${mb(beforeWells)} MB`);
console.log(`after DTO (wells): ${mb(afterWells)} MB`);
console.log(`reduction: ${(((beforeWells - afterWells) / beforeWells) * 100).toFixed(1)}%`);
console.log(`DTO build time: ${dtoMs.toFixed(0)} ms`);
console.log(`before payload (wells+snapshot+export): ${mb(beforePayload)} MB`);
console.log(`after payload (wells+snapshot+export): ${mb(afterPayload)} MB`);
console.log(`payload reduction: ${(((beforePayload - afterPayload) / beforePayload) * 100).toFixed(1)}%`);
console.log(`JSON.stringify time (after): ${strMs.toFixed(0)} ms`);
