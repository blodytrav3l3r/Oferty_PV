// @ts-check
/* ===== ZLECENIA PRODUKCYJNE — STAN GLOBALNY ===== */
let productionOrders = [];
let zleceniaElementsList = [];
let zleceniaSelectedIdx = -1;
let zleceniaActiveFilter = 'all';
let wellsSnapshotBeforeZlecenia = null;

Object.defineProperty(window, 'productionOrders', {
    configurable: true,
    get: () => productionOrders,
    set: (v) => {
        productionOrders = v;
    }
});
Object.defineProperty(window, 'zleceniaElementsList', {
    configurable: true,
    get: () => zleceniaElementsList,
    set: (v) => {
        zleceniaElementsList = v;
    }
});
Object.defineProperty(window, 'zleceniaSelectedIdx', {
    configurable: true,
    get: () => zleceniaSelectedIdx,
    set: (v) => {
        zleceniaSelectedIdx = v;
    }
});
Object.defineProperty(window, 'zleceniaActiveFilter', {
    configurable: true,
    get: () => zleceniaActiveFilter,
    set: (v) => {
        zleceniaActiveFilter = v;
    }
});
Object.defineProperty(window, 'wellsSnapshotBeforeZlecenia', {
    configurable: true,
    get: () => wellsSnapshotBeforeZlecenia,
    set: (v) => {
        wellsSnapshotBeforeZlecenia = v;
    }
});
