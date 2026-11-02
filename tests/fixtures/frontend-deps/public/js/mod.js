import { bValue } from './b.js';

export function moduleFn() {
    return bValue;
}

window.moduleBridge = moduleFn;
