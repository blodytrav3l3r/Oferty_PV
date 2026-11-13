import fs from 'node:fs';
import vm from 'node:vm';

test('przeliczenie dopłaty PEHD zachowuje grosze', async () => {
    const product = { componentType: 'krag', area: 1.25, doplataPEHD: 0 };
    const context = vm.createContext({
        window: {},
        document: { getElementById: () => ({ value: '10.10' }) },
        studnieProducts: [product],
        getPehdEffectiveArea: (p: typeof product) => p.area,
        roundMoney: (n: number) => Math.round(n * 100) / 100,
        showToast: jest.fn(),
        updateStudnieSaveBtn: jest.fn(),
        renderStudniePriceList: jest.fn(),
        _studniePricelistDirty: false
    });
    vm.runInContext(fs.readFileSync('public/js/studnie/pricelistRepehd.js', 'utf8'), context);

    await context.window.recalculatePEHD();

    expect(product.doplataPEHD).toBe(12.63);
});

test('tooltip dopłaty pokazuje cenę i wynik z groszami', () => {
    const context = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync('public/js/shared/formatters.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('public/js/studnie/actionsWellPainting.js', 'utf8'), context);

    const tooltip = context.getPehdTooltip({ componentType: 'krag', area: 1.25 }, 10.1);

    expect(tooltip).toContain('Cena: 10,10 PLN/m²');
    expect(tooltip).toContain('Dopłata: 12,63 PLN');
});

test('nagłówek tabeli Excel pokazuje cenę elementu z groszami', () => {
    const context = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync('public/js/shared/formatters.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('public/js/studnie/excelHelpers.js', 'utf8'), context);
    context._excelGetResolution = () => ({ componentType: 'krag', dn: '1000', price: 10.49 });

    expect(context._excelGetWellProdPrice({ dn: '1000', config: [{ quantity: 1 }] }, 'krag')).toBe(
        '10,49 PLN'
    );
});

test('karta budowy zaokrągla ceny malowania do groszy', () => {
    const notes = { value: '' };
    const context = vm.createContext({
        window: {},
        document: { getElementById: () => notes },
        pendingOrderCreationData: {
            selectedWells: [{ dn: '1000', malowanieW: 'tak', malowanieWewCena: 10.075 }]
        },
        wellDiscounts: {}
    });
    vm.runInContext(fs.readFileSync('public/js/shared/formatters.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('public/js/studnie/orderKartaBudowy.js', 'utf8'), context);

    context._generateDefaultUwagi();

    expect(notes.value).toContain('10,08 PLN/m²');
});
