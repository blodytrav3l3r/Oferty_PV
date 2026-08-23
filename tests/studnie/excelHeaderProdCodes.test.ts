/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/* Regresja: nagłówki H3 (kody/ceny) w tabeli Excel muszą być liczone ze studni
   z AKTYWNEJ zakładki DN. Nieaktualny currentWellIndex (np. po excelSwitchTab)
   wskazywał studnię z innego DN → złe kody/ceny w nagłówkach. */

function makeSpan(attrs) {
    return {
        __attrs: attrs,
        textContent: '',
        getAttribute(key) {
            return this.__attrs[key] !== undefined ? this.__attrs[key] : null;
        }
    };
}

function runHeaderUpdate({ activeTab, currentIndex, wells }) {
    const codes = [makeSpan({ 'data-ct': 'krag', 'data-height': '', 'data-reddn': '' })];
    const prices = [makeSpan({ 'data-ct': 'krag', 'data-height': '', 'data-per-product': null })];
    const container = {
        querySelectorAll(sel) {
            return String(sel).indexOf('h3-prodcode') >= 0 ? codes : prices;
        }
    };
    const context = {
        document: { getElementById: (id) => (id === 'excel-table-container' ? container : null) },
        wells,
        _excelActiveTab: activeTab,
        currentWellIndex: currentIndex,
        studnieProducts: [],
        getAvailableProducts: () => PRODUCTS,
        filterByWellParams: (p, well) => String(p.dn) === String(well.dn),
        showToast: () => {}
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelHelpers.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    context._excelUpdateHeaderProdCodes();
    return { codes, prices };
}

const PRODUCTS = [
    { id: 'KRAG-DN1000', componentType: 'krag', dn: '1000', height: null, price: 100 },
    { id: 'KRAG-DN1200', componentType: 'krag', dn: '1200', height: null, price: 200 }
];

function makeWells() {
    return [
        {
            id: 'w1',
            dn: '1000',
            config: [],
            rzednaWlazu: 2,
            rzednaDna: 0,
            kineta: 'brak',
            psiaBuda: false
        },
        {
            id: 'w2',
            dn: '1200',
            config: [],
            rzednaWlazu: 2,
            rzednaDna: 0,
            kineta: 'brak',
            psiaBuda: false
        }
    ];
}

describe('_excelUpdateHeaderProdCodes — wybór studni z aktywnej zakładki', () => {
    test('nieaktualny currentWellIndex (inne DN) nie nadpisuje kodów z aktywnej zakładki', () => {
        const { codes, prices } = runHeaderUpdate({
            activeTab: '1200',
            currentIndex: 0, // studnia DN1000 — nieaktualna dla zakładki DN1200
            wells: makeWells()
        });
        expect(codes[0].textContent).toBe('KRAG-DN1200');
        expect(prices[0].textContent).toContain('PLN');
    });

    test('brak zaznaczenia (currentWellIndex = -1) → fallback na pierwszą studnię zakładki', () => {
        const { codes } = runHeaderUpdate({
            activeTab: '1200',
            currentIndex: -1,
            wells: makeWells()
        });
        expect(codes[0].textContent).toBe('KRAG-DN1200');
    });

    test('zaznaczenie wewnątrz aktywnej zakładki pozostaje użyte', () => {
        const { codes } = runHeaderUpdate({
            activeTab: '1000',
            currentIndex: 0, // studnia DN1000 pasuje do zakładki DN1000
            wells: makeWells()
        });
        expect(codes[0].textContent).toBe('KRAG-DN1000');
    });
});
