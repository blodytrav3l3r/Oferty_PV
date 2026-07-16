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
