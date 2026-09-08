// @ts-nocheck
/**
 * Regresja: wiersz RAZEM w zakładce Oferta musi dać się wysunąć znad
 * fixed stopki (stopka + pasek nav + luz, mierzone na żywo).
 * Padding ląduje WEWNĄTRZ scrollowanej sekcji — padding na .main leży
 * poza scrollportem i nic nie daje.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadUI(els: Record<string, any>) {
    const file = path.join(process.cwd(), 'public/js/studnie/offerSummaryUI.js');
    const code = fs.readFileSync(file, 'utf-8');
    const context: any = {
        document: {
            getElementById: (id: string) => els[id] || null,
            querySelector: () => null
        },
        window: {
            getComputedStyle: (el: any) => ({
                display: el && el._display ? el._display : 'block'
            })
        }
    };
    vm.createContext(context);
    vm.runInContext(code, context, { filename: 'offerSummaryUI.js' });
    return context;
}

function stubEl(over: Record<string, any> = {}) {
    return { style: {}, offsetHeight: 0, scrollTop: 0, ...over };
}

describe('frontend: odstęp pod tabelą oferty (RAZEM znad stopki)', () => {
    it('padding = stopka + nav + luz na #section-offer (nie na .main)', () => {
        const section = stubEl();
        const ctx = loadUI({
            'section-offer': section,
            'offer-summary-footer-fixed': stubEl({ offsetHeight: 180 }),
            'studnie-wizard-bottom-nav': stubEl({ offsetHeight: 60 })
        });
        vm.runInContext('applyOfferFooterSpacing()', ctx);
        expect(section.style.paddingBottom).toBe('264px');
    });

    it('fallback 200px gdy stopki brak w DOM', () => {
        const section = stubEl();
        const ctx = loadUI({ 'section-offer': section });
        vm.runInContext('applyOfferFooterSpacing()', ctx);
        expect(section.style.paddingBottom).toBe('200px');
    });

    it('ukryta stopka (display:none) nie wlicza się do odstępu', () => {
        const section = stubEl();
        const ctx = loadUI({
            'section-offer': section,
            'offer-summary-footer-fixed': stubEl({ offsetHeight: 180, _display: 'none' }),
            'studnie-wizard-bottom-nav': stubEl({ offsetHeight: 60 })
        });
        vm.runInContext('applyOfferFooterSpacing()', ctx);
        expect(section.style.paddingBottom).toBe('200px');
    });

    it('wiersz RAZEM ma stabilne id do autoscrolla', () => {
        const file = path.join(process.cwd(), 'public/js/studnie/offerSummaryTable.js');
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).toMatch(/id="offer-total-row"/);
    });
});

describe('frontend: scrollOfferTotalIntoView', () => {
    function loadScroll(opts: {
        rowRect: { top: number; bottom: number };
        sectionRect: { top: number; bottom: number };
        withScrollIntoView?: boolean;
    }) {
        const calls: string[] = [];
        const section = stubEl({
            scrollTop: 100,
            getBoundingClientRect: () => opts.sectionRect
        });
        const row: any = stubEl({
            getBoundingClientRect: () => opts.rowRect
        });
        if (opts.withScrollIntoView !== false) {
            row.scrollIntoView = () => calls.push('scrolled');
        }
        const ctx = loadUI({
            'section-offer': section,
            'offer-summary-footer-fixed': stubEl({ offsetHeight: 180 }),
            'studnie-wizard-bottom-nav': stubEl({ offsetHeight: 60 }),
            'offer-total-row': row
        });
        return { ctx, section, calls };
    }

    it('zasłonięty wiersz → dociąga znad stopki', () => {
        const { ctx, section, calls } = loadScroll({
            rowRect: { top: 800, bottom: 850 },
            sectionRect: { top: 100, bottom: 900 }
            // 850 > 900 - 264 → zasłonięty
        });
        vm.runInContext('scrollOfferTotalIntoView()', ctx);
        expect(calls).toEqual(['scrolled']);
        expect(section.scrollTop).toBeGreaterThan(100);
    });

    it('widoczny wiersz → no-op (nie wyrywa scrolla)', () => {
        const { ctx, section, calls } = loadScroll({
            rowRect: { top: 200, bottom: 250 },
            sectionRect: { top: 100, bottom: 900 }
        });
        vm.runInContext('scrollOfferTotalIntoView()', ctx);
        expect(calls).toEqual([]);
        expect(section.scrollTop).toBe(100);
    });

    it('brak scrollIntoView / brak wiersza → no-op bez wyjątku', () => {
        const { ctx } = loadScroll({
            rowRect: { top: 800, bottom: 850 },
            sectionRect: { top: 100, bottom: 900 },
            withScrollIntoView: false
        });
        expect(() => vm.runInContext('scrollOfferTotalIntoView()', ctx)).not.toThrow();
        const ctx2 = loadUI({ 'section-offer': stubEl() });
        expect(() => vm.runInContext('scrollOfferTotalIntoView()', ctx2)).not.toThrow();
    });
});
