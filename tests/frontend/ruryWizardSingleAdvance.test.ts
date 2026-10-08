// @ts-nocheck
/**
 * Regresja: klik "Dalej" w kroku 2 kreatora rur przechodzi do kroku 3 (nie 4).
 * Przyczyna: zdublowany handler click na #wizard-nav-next (onclick z goToPhase
 * + addEventListener z initWizard) wywolywal phaseNext() dwukrotnie: 2->3->4.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const WIZARD_FILE = path.join(process.cwd(), 'public/js/rury/wizard.js');

function makeEl() {
    const handlers = {};
    return {
        handlers,
        classList: {
            add() {},
            remove() {},
            toggle() {},
            contains: () => false
        },
        style: {},
        disabled: false,
        innerHTML: '',
        textContent: '',
        value: '',
        dataset: {},
        addEventListener(type, fn) {
            (handlers[type] = handlers[type] || []).push(fn);
        },
        set onclick(fn) {
            // jak w DOM: przypisanie onclick ZASTEPUJE poprzedni handler
            this._onclick = fn;
        },
        get onclick() {
            return this._onclick || null;
        },
        _onclick: null
    };
}

function loadWizard() {
    const code = fs.readFileSync(WIZARD_FILE, 'utf-8');
    const els = {};
    const el = (id) => els[id] || (els[id] = makeEl());
    const context = {
        document: {
            getElementById: (id) => el(id),
            querySelectorAll: () => [],
            querySelector: () => null,
            addEventListener: () => {}
        },
        getActiveItemsArray: () => [{ id: 'RT2-1-01-10-100' }],
        showToast: () => {}
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(code, context, { filename: 'wizard.js' });
    return { ctx: context, els };
}

function clickNext(els) {
    const btn = els['wizard-nav-next'];
    const fns = [...(btn.handlers.click || [])];
    if (typeof btn._onclick === 'function') fns.push(btn._onclick);
    fns.forEach((fn) => fn());
    return fns.length;
}

describe('frontend: kreator rur — pojedynczy awans na klik Dalej', () => {
    it('krok 2 -> klik -> krok 3 (scenariusz zgloszenia)', () => {
        const { ctx, els } = loadWizard();
        vm.runInContext('initWizard()', ctx);
        vm.runInContext('goToPhase(2)', ctx);
        const handlerCount = clickNext(els);
        expect(handlerCount).toBe(1);
        expect(vm.runInContext('currentWizardStep', ctx)).toBe(3);
    });

    it('przycisk next nie ma zdublowanego bindowania w zrodle', () => {
        const content = fs.readFileSync(WIZARD_FILE, 'utf-8');
        expect(content).not.toMatch(/wizard-nav-next'\)\?\.addEventListener/);
        // sterowanie per krok przez onclick zostaje
        expect(content).toMatch(/nextBtn\.onclick = phaseNext/);
        // prev nadal na listenerze (nie ma onclick w goToPhase)
        expect(content).toMatch(/wizard-nav-prev'\)\?\.addEventListener/);
    });
});
