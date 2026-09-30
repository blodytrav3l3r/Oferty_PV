// @ts-nocheck -- celowy brak typow dla public/js (delegacja CSP, jsdom)
import fs from 'fs';
import path from 'path';

/**
 * Regresja: przyciski gornego paska SPA (Oferta / Cennik) nie reagowaly,
 * bo pojedynczy data-csp-3 na click byl przykrywany domyslnym 'click'
 * pustego slotu data-csp w handle() (cspActions.js).
 * Guard behawioralny + guard emitera (router.js).
 */

function loadCspActionsOnce() {
    const src = fs.readFileSync(
        path.join(__dirname, '../../public/js/shared/cspActions.js'),
        'utf8'
    );
    // IIFE podpina delegowane listenery na document (jednorazowo per plik testu).
    (0, eval)(src + '\n//# sourceURL=cspActions.js');
}

function click(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

describe('cspActions: delegacja pojedynczych slotow numbered (nav SPA)', () => {
    beforeAll(() => {
        loadCspActionsOnce();
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        (window as any).SpaRouter = { showSection: jest.fn() };
        (window as any).showSectionPlain = jest.fn();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete (window as any).SpaRouter;
        delete (window as any).showSectionPlain;
    });

    test('nowy emiter routera: data-csp="showSection" scope SpaRouter dziala', () => {
        document.body.innerHTML =
            '<button id="b" data-csp="showSection" data-csp-scope="SpaRouter" data-csp-args=\'["offer"]\'>Oferta</button>';
        click(document.getElementById('b')!);
        expect((window as any).SpaRouter.showSection).toHaveBeenCalledWith('offer');
    });

    test('REGRESJA: pojedynczy data-csp-3 na click nie moze byc polykanie', () => {
        document.body.innerHTML =
            '<button id="b" data-csp-3="showSection" data-csp-3-scope="SpaRouter" data-csp-3-args=\'["pricelist"]\'>Cennik</button>';
        click(document.getElementById('b')!);
        expect((window as any).SpaRouter.showSection).toHaveBeenCalledWith('pricelist');
    });

    test('klik w dziecko (span w buttonie) deleguje przez closest', () => {
        document.body.innerHTML =
            '<button id="b" data-csp="showSection" data-csp-scope="SpaRouter" data-csp-args=\'["offer"]\'><span id="inner">Oferta</span></button>';
        click(document.getElementById('inner')!);
        expect((window as any).SpaRouter.showSection).toHaveBeenCalledWith('offer');
    });

    test('multi-event dragover/dragleave/drop nadal rozroznia zdarzenia', () => {
        (window as any).allowDropWellComponent = jest.fn();
        (window as any).dragLeaveWellComponent = jest.fn();
        (window as any).dropWellComponent = jest.fn();
        document.body.innerHTML =
            '<div id="dz" data-csp="allowDropWellComponent" data-csp-on="dragover" ' +
            'data-csp-2="dragLeaveWellComponent" data-csp-2-on="dragleave" ' +
            'data-csp-3="dropWellComponent" data-csp-3-on="drop"></div>';
        const dz = document.getElementById('dz')!;
        dz.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
        dz.dispatchEvent(new Event('dragleave', { bubbles: true, cancelable: true }));
        dz.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
        expect((window as any).allowDropWellComponent).toHaveBeenCalledTimes(1);
        expect((window as any).dragLeaveWellComponent).toHaveBeenCalledTimes(1);
        expect((window as any).dropWellComponent).toHaveBeenCalledTimes(1);
        delete (window as any).allowDropWellComponent;
        delete (window as any).dragLeaveWellComponent;
        delete (window as any).dropWellComponent;
    });

    test('emiter routera nie uzywa juz numerowanych slotow dla pojedynczego handlera', () => {
        const src = fs.readFileSync(path.join(__dirname, '../../public/js/spa/router.js'), 'utf8');
        expect(src).toMatch(/data-csp="showSection"/);
        expect(src).not.toMatch(/data-csp-3="showSection"/);
    });
});
