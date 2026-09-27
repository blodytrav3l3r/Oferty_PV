// @ts-nocheck
/**
 * Regresja: pasek podsumowania rur (Zapisz ofertę / Utwórz zamówienie)
 * widoczny w zakładce Oferta oraz w kroku 3 Konfiguracji (Pozycje oferty).
 * Powrót Oferta → Konfiguracja (krok ≠ 3) musi pasek ukrywać
 * (jeden mechanizm: klasa `hidden`, bez style.display).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

class Cl {
    s = new Set();
    constructor(active = false) {
        if (active) this.s.add('active');
    }
    add(c) {
        this.s.add(c);
    }
    remove(c) {
        this.s.delete(c);
    }
    contains(c) {
        return this.s.has(c);
    }
    toggle(c, force) {
        const v = force === undefined ? !this.s.has(c) : !!force;
        if (v) this.s.add(c);
        else this.s.delete(c);
        return v;
    }
}

function loadNav() {
    const file = path.join(process.cwd(), 'public/js/rury/offerNavigation.js');
    const code = fs.readFileSync(file, 'utf-8');
    const removed = [];
    const bar = {
        style: {
            display: 'block',
            removeProperty(p) {
                removed.push(p);
                delete this[p];
            }
        },
        classList: new Cl(),
        innerHTML: ''
    };
    const sections = {
        'section-builder': { id: 'section-builder', classList: new Cl(true) },
        'section-offer': { id: 'section-offer', classList: new Cl() },
        'section-pricelist': { id: 'section-pricelist', classList: new Cl() },
        'wizard-step-3': { id: 'wizard-step-3', classList: new Cl() }
    };
    const els = { ...sections, 'rury-summary-bar': bar };
    const context = {
        document: {
            getElementById: (id) => els[id] || null,
            querySelectorAll: (sel) => (sel === '.section' ? Object.values(sections) : []),
            querySelector: () => null
        },
        window: {
            location: { search: '', pathname: '/rury.html' },
            history: { replaceState: () => {} }
        },
        URLSearchParams
    };
    vm.createContext(context);
    vm.runInContext(code, context, { filename: 'offerNavigation.js' });
    return { ctx: context, bar, sections, removed };
}

describe('frontend: pasek rur w zakładce Oferta i kroku 3', () => {
    it('powrót Oferta → Konfiguracja ukrywa pasek (scenariusz zgłoszenia)', () => {
        const { ctx, bar, sections } = loadNav();
        vm.runInContext("showSectionRury('builder')", ctx);
        expect(bar.classList.contains('hidden')).toBe(true);
        vm.runInContext("showSectionRury('offer')", ctx);
        expect(bar.classList.contains('hidden')).toBe(false);
        expect(sections['section-offer'].classList.contains('active')).toBe(true);
        vm.runInContext("showSectionRury('builder')", ctx);
        expect(bar.classList.contains('hidden')).toBe(true);
        expect(sections['section-builder'].classList.contains('active')).toBe(true);
    });

    it('legacy inline display czyszczony przy każdym przełączeniu', () => {
        const { ctx, bar, removed } = loadNav();
        bar.style.display = 'block';
        vm.runInContext("showSectionRury('builder')", ctx);
        expect(removed).toContain('display');
        expect('display' in bar.style).toBe(false);
    });

    it('jeden mechanizm widoczności: pasek bez style.display (baner ctx wyjątkiem)', () => {
        const file = path.join(process.cwd(), 'public/js/rury/offerNavigation.js');
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).not.toMatch(/summaryBar[^;]*style\.display/);
        expect(content).not.toMatch(/summaryBar\)\s*summaryBar/);
        expect(content).toMatch(/updateRurySummaryBarVisibility/);
    });

    it('krok 3 Konfiguracji pokazuje pasek, inne kroki go ukrywają', () => {
        const { ctx, bar, sections } = loadNav();
        vm.runInContext("showSectionRury('builder')", ctx);
        expect(bar.classList.contains('hidden')).toBe(true);
        sections['wizard-step-3'].classList.add('active');
        vm.runInContext(
            "updateRurySummaryBarVisibility ? updateRurySummaryBarVisibility() : showSectionRury('builder')",
            ctx
        );
        expect(bar.classList.contains('hidden')).toBe(false);
        expect('display' in bar.style).toBe(false);
        sections['wizard-step-3'].classList.remove('active');
        vm.runInContext("showSectionRury('builder')", ctx);
        expect(bar.classList.contains('hidden')).toBe(true);
    });

    it('goToPhase deleguje widoczność paska (bez bezpośredniego DOM)', () => {
        const file = path.join(process.cwd(), 'public/js/rury/wizard.js');
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).toMatch(/updateRurySummaryBarVisibility/);
        expect(content).not.toMatch(/rury-summary-bar/);
        expect(content).not.toMatch(/summaryBar[^;]*style\.display/);
    });
});
