// @ts-check
/* ===== Stan globalny dla przejść ===== */

let editPrzejscieIdx = -1;
let editPrzejscieState = {
    type: null,
    dnId: null,
    rzedna: '',
    angle: 0,
    spadekKineta: '',
    spadekMufa: ''
};

const inlinePrzejsciaState = { type: null, dnId: null };
let visiblePrzejsciaTypes = new Set(); // Domyslnie wszystkie typy sa ukryte
let draggedPrzIndex = null;

Object.defineProperty(window, 'editPrzejscieIdx', {
    configurable: true,
    get: () => editPrzejscieIdx,
    set: (v) => {
        editPrzejscieIdx = v;
    }
});
Object.defineProperty(window, 'editPrzejscieState', {
    configurable: true,
    get: () => editPrzejscieState,
    set: (v) => {
        editPrzejscieState = v;
    }
});
Object.defineProperty(window, 'inlinePrzejsciaState', {
    configurable: true,
    get: () => inlinePrzejsciaState
});
Object.defineProperty(window, 'visiblePrzejsciaTypes', {
    configurable: true,
    get: () => visiblePrzejsciaTypes,
    set: (v) => {
        visiblePrzejsciaTypes = v;
    }
});
Object.defineProperty(window, 'draggedPrzIndex', {
    configurable: true,
    get: () => draggedPrzIndex,
    set: (v) => {
        draggedPrzIndex = v;
    }
});
