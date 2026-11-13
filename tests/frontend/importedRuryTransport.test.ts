// @ts-nocheck -- kod przeglądarkowy ładowany w vm
import fs from 'fs';
import path from 'path';
import vm from 'vm';

test('transport z importu pozostaje w podsumowaniu do czasu zmiany km lub stawki', () => {
    const elements = {
        'transport-km': { value: '0' },
        'transport-rate': { value: '0' },
        'sum-transport-cost': { innerHTML: '' },
        'sum-total-netto': { textContent: '' }
    };
    const context = {
        window: {},
        document: { getElementById: (id) => elements[id] || null },
        editingOfferId: 'offer-1',
        getActiveItemsArray: () => [],
        calculateTransports: () => ({ totalTransports: 3, lines: [] }),
        fmt: (n) => Number(n).toFixed(2),
        renderTransportBreakdown: () => {}
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/rury/transport.js'), 'utf8'),
        context
    );
    vm.runInContext(
        "currentRuryTransportSeparate = true; window.isRuryTransportSeparate.imported = { id: 'offer-1', cost: 100, count: 3 }; calculateTransports = () => ({ totalTransports: 3, lines: [] }); renderTransportBreakdown = () => {};",
        context
    );
    vm.runInContext('updateOfferSummary()', context);
    expect(elements['sum-transport-cost'].innerHTML).toContain('100.00');
    context.getActiveItemsArray = () => [
        { productId: 'R1', quantity: 3, unitPrice: 0.67, discount: 50 }
    ];
    vm.runInContext('updateOfferSummary()', context);
    expect(elements['sum-total-netto'].textContent).toContain('101.02');
    elements['transport-km'].value = '10';
    elements['transport-rate'].value = '2';
    vm.runInContext('updateOfferSummary()', context);
    expect(elements['sum-transport-cost'].innerHTML).toContain('60.00');
});

test('zapis edytowanej oferty zachowuje koszt importu i pozwala zastąpić go stawką', async () => {
    const elements = { 'transport-km': { value: '0' }, 'transport-rate': { value: '0' } };
    const saved = [];
    const context = {
        window: {},
        document: { getElementById: (id) => elements[id] || null },
        editingOfferId: 'offer-1',
        editingOfferAssignedUserId: null,
        editingOfferAssignedUserName: '',
        currentOfferItems: [{ productId: 'R1', quantity: 3, unitPrice: 0.67, discount: 50 }],
        currentUser: {},
        offers: [],
        structuredClone: (value) => JSON.parse(JSON.stringify(value)),
        getOfferFormFields: () => ({
            number: 'OF/1',
            transportKm: Number(elements['transport-km'].value),
            transportRate: Number(elements['transport-rate'].value)
        }),
        assignOfferSupervisor: async () => null,
        buildBaseOfferDoc: ({ fields }) => ({ id: 'offer-1', ...fields }),
        showToast: () => {},
        renderSavedOffers: () => {},
        logger: { error: () => {}, warn: () => {} },
        storage: {
            getOfferById: async () => ({}),
            saveOffer: async (doc) => {
                saved.push(doc);
                return { id: doc.id };
            }
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/rury/transport.js'), 'utf8'),
        context
    );
    const crud = fs
        .readFileSync(path.join(__dirname, '../../public/js/rury/offerCrud.js'), 'utf8')
        .replace("await import('../shared/StorageService.js')", '({ storageService: storage })');
    vm.runInContext(crud, context);
    vm.runInContext(
        "currentRuryTransportSeparate = true; window.isRuryTransportSeparate.imported = { id: 'offer-1', cost: 100, count: 3 }; calculateTransports = () => ({ totalTransports: 3 }); calculateTransportDistributionStandalone = () => ({});",
        context
    );
    await vm.runInContext('saveOffer()', context);
    expect(saved[0]).toMatchObject({
        transportCost: 100,
        transportCount: 3,
        externalTransportCost: 100,
        totalNetto: 101.02
    });
    elements['transport-km'].value = '10';
    elements['transport-rate'].value = '2';
    await vm.runInContext('saveOffer()', context);
    expect(saved[1]).toMatchObject({
        transportCost: 60,
        transportCount: 3,
        externalTransportCost: null,
        totalNetto: 61.02
    });
});

test('loadOffer używa rzeczywistego formularza i nie przenosi importowanej kwoty do innej oferty', async () => {
    const elements = {
        'offer-number': { value: '', dataset: {} },
        'transport-km': { value: '' },
        'transport-rate': { value: '' }
    };
    const saved = [];
    const imported = {
        id: 'offer-1',
        number: 'OF/1',
        externalTransportCost: 100,
        transportCount: 3,
        transportSeparate: true,
        items: [{ productId: 'R1', quantity: 1, unitPrice: 50, discount: 0 }]
    };
    const normal = {
        id: 'offer-2',
        number: 'OF/2',
        transportKm: 5,
        transportRate: 2,
        transportSeparate: true,
        items: imported.items
    };
    const context = {
        window: {},
        document: { getElementById: (id) => elements[id] || null, addEventListener: () => {} },
        editingOfferId: null,
        editingOfferAssignedUserId: null,
        editingOfferAssignedUserName: '',
        currentOfferItems: [],
        currentUser: { role: 'admin' },
        offers: [imported, normal],
        structuredClone: (value) => JSON.parse(JSON.stringify(value)),
        getOfferFormFields: () => ({
            number: elements['offer-number'].value,
            transportKm: Number(elements['transport-km'].value),
            transportRate: Number(elements['transport-rate'].value)
        }),
        assignOfferSupervisor: async () => null,
        buildBaseOfferDoc: ({ fields }) => ({ id: context.editingOfferId, ...fields }),
        showToast: () => {},
        renderSavedOffers: () => {},
        syncTransportSecurity: () => {},
        renderOfferItems: () => {},
        showSection: () => {},
        logger: { error: () => {}, warn: () => {} },
        storage: {
            getOfferById: async (id) => (id === 'offer-1' ? imported : normal),
            normalizeOffer: (offer) => offer,
            saveOffer: async (doc) => {
                saved.push(doc);
                return { id: doc.id };
            }
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/shared/offerCrudCommon.js'), 'utf8'),
        context
    );
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/rury/transport.js'), 'utf8'),
        context
    );
    const crud = fs
        .readFileSync(path.join(__dirname, '../../public/js/rury/offerCrud.js'), 'utf8')
        .replaceAll("await import('../shared/StorageService.js')", '({ storageService: storage })');
    vm.runInContext(crud, context);
    vm.runInContext(
        'applyRuryOfferPricelist = async () => {}; calculateTransports = () => ({ totalTransports: 3 }); calculateTransportDistributionStandalone = () => ({});',
        context
    );
    await vm.runInContext("loadOffer('offer-1')", context);
    expect(Number(elements['transport-km'].value)).toBe(0);
    expect(Number(elements['transport-rate'].value)).toBe(0);
    await vm.runInContext('saveOffer()', context);
    expect(saved[0]).toMatchObject({
        transportCost: 100,
        transportCount: 3,
        externalTransportCost: 100
    });
    await vm.runInContext("loadOffer('offer-2')", context);
    await vm.runInContext('saveOffer()', context);
    expect(saved[1]).toMatchObject({ transportCost: 30, externalTransportCost: null });
});

test('zamówienie z oferty zachowuje koszt transportu z importu', async () => {
    const values = {
        'offer-number': { value: 'OF/1' },
        'transport-km': { value: '0' },
        'transport-rate': { value: '0' }
    };
    let saved;
    const context = {
        window: {},
        document: { getElementById: (id) => values[id] || null },
        editingOfferId: 'offer-1',
        editingRuryOrderId: null,
        editingOfferAssignedUserId: 'user-1',
        currentUser: { id: 'user-1' },
        structuredClone: (value) => JSON.parse(JSON.stringify(value)),
        getOfferFormFields: () => ({}),
        authHeaders: () => ({}),
        fetch: async () => ({ ok: true, json: async () => ({ number: 'ZR/1' }) }),
        showToast: () => {},
        saveOrder: (orders) => {
            saved = orders[0];
        },
        logger: { error: () => {} }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/rury/transport.js'), 'utf8'),
        context
    );
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/rury/orderCrud.js'), 'utf8'),
        context
    );
    vm.runInContext(
        "currentRuryTransportSeparate = true; window.isRuryTransportSeparate.imported = { id: 'offer-1', cost: 100, count: 3 }; window.pendingOrderCreationData = { selectedItems: [{ productId: 'R1', quantity: 1 }] }; saveOrdersDataRury = async (orders) => saveOrder(orders);",
        context
    );
    await vm.runInContext("finalizeOrderFromOffer({ id: 'offer-1' }, {})", context);
    expect(saved).toMatchObject({
        transportCost: 100,
        transportCount: 3,
        externalTransportCost: 100,
        originalSnapshot: { transportCost: 100 }
    });
    context.orderEditMode = true;
    context.getCurrentRuryOrder = () => saved;
    expect(vm.runInContext('window.isRuryTransportSeparate.getImported().cost', context)).toBe(100);
});

test('druk oferty pobiera pełne dane zamiast używać skróconej listy', async () => {
    let html = '';
    const full = {
        id: 'offer-1',
        number: 'OF/1',
        transportSeparate: true,
        externalTransportCost: 100,
        items: [{ productId: 'R1', name: 'Rura', quantity: 1, unitPrice: 50, discount: 0 }]
    };
    const printWin = {
        document: {
            write: (text) => {
                html = text;
            },
            close: () => {},
            querySelectorAll: () => []
        },
        close: () => {}
    };
    const context = {
        window: {},
        offers: [{ id: 'offer-1', number: 'OF/1' }],
        calculateTransports: () => ({ totalTransports: 3, lines: [] }),
        calculateTransportDistributionStandalone: () => ({}),
        fmt: (value) => Number(value).toFixed(2),
        fmtInt: (value) => String(value),
        escapeHtml: (value) => String(value || ''),
        PRINT_TOKENS_CSS: '',
        setInterval: () => 0,
        storage: { getOfferById: async () => full },
        location: { origin: 'http://localhost' },
        open: () => printWin
    };
    context.window = context;
    vm.createContext(context);
    const code = fs
        .readFileSync(path.join(__dirname, '../../public/js/rury/offerExports.js'), 'utf8')
        .replace("await import('../shared/StorageService.js')", '({ storageService: storage })');
    vm.runInContext(code, context);
    await vm.runInContext("exportOfferPDF('offer-1')", context);
    expect(html).toContain('kwota z importu');
    expect(html).toContain('150.00 PLN');
});

test('XLSX pobiera pełną ofertę i zachowuje zaimportowaną kwotę transportu w arkuszu i metadanych', async () => {
    const sheets = {};
    const full = {
        id: 'offer-1',
        number: 'OF/1',
        date: '2026-01-01',
        transportSeparate: true,
        externalTransportCost: 100,
        transportCount: 3,
        items: [{ productId: 'R1', name: 'Rura', quantity: 3, unitPrice: 0.67, discount: 50 }]
    };
    const context = {
        window: {},
        offers: [{ id: 'offer-1' }],
        calculateTransports: () => ({ totalTransports: 3, lines: [] }),
        calculateTransportDistributionStandalone: () => ({}),
        ensureXlsx: async () => {},
        showToast: () => {},
        storage: { getOfferById: async () => full },
        XLSX: {
            utils: {
                aoa_to_sheet: (rows) => ({ rows }),
                book_new: () => ({}),
                book_append_sheet: (_wb, sheet, name) => {
                    sheets[name] = sheet.rows;
                }
            },
            writeFile: () => {}
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(
            path.join(__dirname, '../../public/js/rury/offerExportsHelpers.js'),
            'utf8'
        ),
        context
    );
    const code = fs
        .readFileSync(path.join(__dirname, '../../public/js/rury/offerExports.js'), 'utf8')
        .replaceAll("await import('../shared/StorageService.js')", '({ storageService: storage })');
    vm.runInContext(code, context);
    await vm.runInContext("exportOfferXlsx('offer-1')", context);
    expect(sheets.Oferta.find((row) => row.includes('RAZEM Netto:'))[10]).toBe(101.02);
    expect(sheets.Dane).toContainEqual(['externalTransportCost', 100]);
    expect(sheets.Dane).toContainEqual(['transportCount', 3]);
    let changeHandler;
    let importPromise;
    context.document = {
        createElement: () => ({
            addEventListener: (_event, handler) => {
                changeHandler = handler;
            },
            click: () => {}
        })
    };
    context.FileReader = class {
        readAsArrayBuffer() {
            importPromise = this.onload({ target: { result: new ArrayBuffer(0) } });
        }
    };
    context.XLSX.read = () => ({ Sheets: sheets });
    context.XLSX.utils.sheet_to_json = (rows) => rows;
    context.appConfirm = async () => true;
    context.saveOffersData = () => {};
    context.renderSavedOffers = () => {};
    context.logger = {
        error: (error) => {
            throw error;
        }
    };
    vm.runInContext('importOfferFromXlsx()', context);
    changeHandler({ target: { files: [{}] } });
    await importPromise;
    expect(context.offers[0]).toMatchObject({
        transportCost: 100,
        externalTransportCost: 100,
        transportCount: 3,
        totalNetto: 101.02
    });
});
