import fs from 'fs';
import path from 'path';
import vm from 'vm';

const RENDERER = path.join(process.cwd(), 'public/js/studnie/transitionRenderer.js');

describe('wysokość przejścia względem elementu', () => {
    test('używa elementu przypisanego przy dokładnej górnej granicy', () => {
        const window: any = { __trDelegated: true };
        const context = { window, document: {} };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(RENDERER, 'utf8'), context);

        const heightMm = window.computeHeightFromElement(3000, [
            { index: 4, start: 2000, end: 3000 }
        ]);

        expect(heightMm).toBe(1000);
    });
});
