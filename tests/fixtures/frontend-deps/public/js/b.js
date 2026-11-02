import { moduleFn } from './mod.js';

export const bValue = 2;

window.bBridge = function () {
    return moduleFn();
};
