import { createDom, escapeHtml, escapeHtmlAttr, loadStudnieScript } from './helpers/studnieHarness';

interface SetupOptions {
    products?: any[];
    confirmResult?: boolean;
    withProductLookup?: boolean;
}

function setup(options: SetupOptions = {}) {
    const dom = createDom();
    const toasts: Array<{ msg: string; type?: string }> = [];
    const appConfirm = jest.fn(async () => options.confirmResult !== false);
    const updateStudnieSaveBtn = jest.fn();
    const renderStudniePriceList = jest.fn();
    const closeModal = jest.fn();
    const trapFocus = jest.fn();
    const products = options.products ? [...options.products] : [];

    const globals: Record<string, unknown> = {
        CATEGORIES_STUDNIE: ['Krąg', 'Dennica', 'Przejścia'],
        escapeHtml,
        escapeHtmlAttr,
        appConfirm,
        updateStudnieSaveBtn,
        renderStudniePriceList,
        closeModal,
        trapFocus,
        showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
        studnieProducts: products,
        _studniePricelistDirty: false
    };
    if (options.withProductLookup !== false) {
        globals.getStudnieProductById = (id: string) => products.find((p) => p.id === id);
    }

    const { context, exposed } = loadStudnieScript({
        file: 'public/js/studnie/pricelistProductCrud.js',
        dom,
        globals,
        expose: '{ deleteStudnieProduct, copyStudnieProduct, showAddStudnieProductModal, addStudnieProduct }'
    });

    return {
        dom,
        context,
        exposed,
        products,
        toasts,
        appConfirm,
        updateStudnieSaveBtn,
        renderStudniePriceList,
        closeModal,
        trapFocus
    };
}

const KRAG = { id: 'K-1000', name: 'Krąg DN1000', price: 250, componentType: 'krag', dn: 1000 };

function registerAddForm(dom: ReturnType<typeof createDom>, values: Record<string, string>) {
    const ids = [
        'np-category',
        'np-id',
        'np-name',
        'np-price',
        'np-height',
        'np-weight',
        'np-area',
        'np-areaExt',
        'np-transport',
        'np-pehd',
        'np-malW',
        'np-malZ',
        'np-zelbet',
        'np-drabNierdzewna',
        'np-zapasDol',
        'np-zapasGora',
        'np-zapasDolMin',
        'np-zapasGoraMin',
        'np-custom-category'
    ];
    for (const id of ids) dom.register(id, { value: values[id] ?? '' });
}

describe('pricelistProductCrud — deleteStudnieProduct', () => {
    it('anulowanie potwierdzenia nie zmienia cennika', async () => {
        const { exposed, context, updateStudnieSaveBtn } = setup({
            products: [KRAG],
            confirmResult: false
        });

        await exposed.deleteStudnieProduct('K-1000');

        expect(context.studnieProducts).toHaveLength(1);
        expect(context._studniePricelistDirty).toBe(false);
        expect(updateStudnieSaveBtn).not.toHaveBeenCalled();
    });

    it('potwierdzenie usuwa element, brudzi cennik i odświeża listę', async () => {
        const {
            exposed,
            context,
            toasts,
            updateStudnieSaveBtn,
            renderStudniePriceList,
            appConfirm
        } = setup({ products: [KRAG, { ...KRAG, id: 'K-2000' }] });

        await exposed.deleteStudnieProduct('K-1000');

        expect(appConfirm).toHaveBeenCalledWith('Usunąć ten element z cennika?', {
            title: 'Usuwanie elementu',
            type: 'danger'
        });
        expect(context.studnieProducts.map((p: any) => p.id)).toEqual(['K-2000']);
        expect(context._studniePricelistDirty).toBe(true);
        expect(updateStudnieSaveBtn).toHaveBeenCalledTimes(1);
        expect(renderStudniePriceList).toHaveBeenCalledTimes(1);
        expect(toasts).toEqual([{ msg: 'Element usunięty', type: 'info' }]);
    });
});

describe('pricelistProductCrud — copyStudnieProduct', () => {
    it('brak produktu nie tworzy kopii', async () => {
        const { exposed, context } = setup({ products: [KRAG] });

        await exposed.copyStudnieProduct('brak');

        expect(context.studnieProducts).toHaveLength(1);
    });

    it('wstawia kopię zaraz za oryginałem z sufiksem (Kopia)', async () => {
        const other = { ...KRAG, id: 'K-2000' };
        const { exposed, context, toasts, updateStudnieSaveBtn, renderStudniePriceList } = setup({
            products: [KRAG, other]
        });

        await exposed.copyStudnieProduct('K-1000');

        const list = context.studnieProducts;
        expect(list.map((p: any) => p.id)).toEqual(['K-1000', 'K-1000-KOP', 'K-2000']);
        expect(list[1].name).toBe('Krąg DN1000 (Kopia)');
        expect(list[1].price).toBe(250);
        expect(context._studniePricelistDirty).toBe(true);
        expect(updateStudnieSaveBtn).toHaveBeenCalledTimes(1);
        expect(renderStudniePriceList).toHaveBeenCalledTimes(1);
        expect(toasts).toEqual([{ msg: 'Element skopiowany', type: 'success' }]);
    });

    it('kolejne kopie dostają numerowany sufiks, a kopia nie dzieli referencji z oryginałem', async () => {
        const { exposed, context } = setup({
            products: [KRAG, { ...KRAG, id: 'K-1000-KOP' }]
        });

        await exposed.copyStudnieProduct('K-1000');

        const copy = context.studnieProducts.find((p: any) => p.id === 'K-1000-KOP1');
        expect(copy).toBeDefined();
        expect(copy).not.toBe(context.studnieProducts[0]);
    });

    it('działa też bez helpera getStudnieProductById', async () => {
        const { exposed, context } = setup({ products: [KRAG], withProductLookup: false });

        await exposed.copyStudnieProduct('K-1000');

        expect(context.studnieProducts).toHaveLength(2);
    });
});

describe('pricelistProductCrud — showAddStudnieProductModal', () => {
    it('buduje modal z kategoriami, escapuje wartości i rejestruje toggle pól', () => {
        const { exposed, dom, trapFocus, context } = setup({
            products: [
                { id: 'p1', name: 'Przejście', componentType: 'przejscie', category: 'W + PVC' },
                { id: 'p2', name: 'Przejście 2', componentType: 'przejscie', category: 'W + PVC' },
                {
                    id: 'p3',
                    name: 'Stare',
                    componentType: 'przejscie',
                    category: 'Stara',
                    active: 0
                },
                { id: 'p4', name: 'Krąg', componentType: 'krag', category: 'Krąg' }
            ]
        });
        dom.register('np-category', { value: 'Krąg' });
        registerAddForm(dom, {});

        exposed.showAddStudnieProductModal();

        const overlay = dom.body.children[0];
        expect(overlay.id).toBe('add-product-modal');
        expect(overlay.attrs.role).toBe('dialog');
        expect(overlay.attrs['aria-modal']).toBe('true');
        expect(overlay.className).toContain('js-modal-overlay');
        expect(overlay.innerHTML).toContain('Dodaj element');
        expect(overlay.innerHTML).toContain('value="Przejścia"');
        // datalist: unikalne, aktywne kategorie przejść (bez duplikatu i bez active=0)
        expect((overlay.innerHTML.match(/value="W \+ PVC"/g) ?? []).length).toBe(1);
        expect(overlay.innerHTML).not.toContain('Stara');
        expect(trapFocus).toHaveBeenCalledWith(overlay);
        expect(typeof context.togglePrzejsciaFields).toBe('function');
    });

    it('toggle pokazuje pola przejść i chowa pozostałe', () => {
        const { exposed, dom, context } = setup({ products: [] });
        const category = dom.register('np-category', { value: 'Przejścia' });
        const custom = dom.register('np-custom-category');
        const nonPrzejscia = { style: { display: '' } };
        const przejsciaOnly = { style: { display: 'none' } };
        dom.setQueryAll('.non-przejscia', [nonPrzejscia]);
        dom.setQueryAll('.przejscia-only', [przejsciaOnly]);

        exposed.showAddStudnieProductModal();
        context.togglePrzejsciaFields();

        expect(custom.style.display).toBe('block');
        expect(nonPrzejscia.style.display).toBe('none');
        expect(przejsciaOnly.style.display).toBe('grid');

        category.value = 'Krąg';
        context.togglePrzejsciaFields();
        expect(custom.style.display).toBe('none');
        expect(nonPrzejscia.style.display).toBe('');
        expect(przejsciaOnly.style.display).toBe('none');
    });

    it('klik w tło zamyka modal, klik w treść nie', () => {
        const { exposed, dom, closeModal } = setup({ products: [] });
        dom.register('np-category', { value: 'Krąg' });
        registerAddForm(dom, {});

        exposed.showAddStudnieProductModal();
        const overlay = dom.body.children[0];

        return overlay.dispatch('click', { target: overlay }).then(() => {
            expect(closeModal).toHaveBeenCalledTimes(1);

            return overlay.dispatch('click', { target: { id: 'wnetrze' } }).then(() => {
                expect(closeModal).toHaveBeenCalledTimes(1);
            });
        });
    });

    it('Enter w polu wywołuje dodanie, skróty z modyfikatorem nie', () => {
        const { exposed, dom, context } = setup({ products: [] });
        dom.register('np-category', { value: 'Krąg' });
        registerAddForm(dom, {});
        const addSpy = jest.fn();
        context.addStudnieProduct = addSpy;
        context.window.addStudnieProduct = addSpy;

        exposed.showAddStudnieProductModal();
        const idField = dom.el('np-id');
        const handler = idField.handlers.keydown[0];
        const preventDefault = jest.fn();

        handler({ key: 'Enter', preventDefault });
        expect(preventDefault).toHaveBeenCalled();
        expect(addSpy).toHaveBeenCalledTimes(1);

        handler({ key: 'Enter', ctrlKey: true, preventDefault });
        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(idField.focused).toBe(true);
    });
});

describe('pricelistProductCrud — addStudnieProduct', () => {
    it('waliduje wymagane pola (indeks, nazwa, cena)', async () => {
        const { exposed, dom, context, toasts } = setup({ products: [] });
        registerAddForm(dom, { 'np-category': 'Krąg' });

        await exposed.addStudnieProduct();

        expect(toasts[0]).toEqual({
            msg: 'Wypełnij wymagane pola (indeks, nazwa, cena)',
            type: 'error'
        });
        expect(context.studnieProducts).toHaveLength(0);
    });

    it('odrzuca duplikat indeksu', async () => {
        const { exposed, dom, context, toasts } = setup({ products: [KRAG] });
        registerAddForm(dom, { 'np-id': 'K-1000', 'np-name': 'Inny', 'np-price': '10' });

        await exposed.addStudnieProduct();

        expect(toasts[0].msg).toBe('Element o takim indeksie już istnieje');
        expect(context.studnieProducts).toHaveLength(1);
    });

    it('przejście wymaga własnej kategorii i zapisuje pola zapasów', async () => {
        const { exposed, dom, context, toasts } = setup({ products: [] });
        registerAddForm(dom, {
            'np-id': 'P-1',
            'np-name': 'Przejście DN600',
            'np-price': '99.5',
            'np-category': 'Przejścia'
        });

        await exposed.addStudnieProduct();
        expect(toasts[0].msg).toBe('Wpisz nazwę kategorii przejścia');

        dom.el('np-custom-category').value = 'W + PVC';
        dom.el('np-zapasDol').value = '200';
        dom.el('np-zapasGora').value = '250';

        await exposed.addStudnieProduct();

        const added = context.studnieProducts[0];
        expect(added).toMatchObject({
            id: 'P-1',
            name: 'Przejście DN600',
            price: 99.5,
            category: 'W + PVC',
            componentType: 'przejscie',
            dn: null,
            height: null,
            area: null,
            areaExt: null,
            transport: null,
            weight: null,
            zapasDol: 200,
            zapasGora: 250,
            zapasDolMin: null,
            zapasGoraMin: null,
            magazynKLB: 1,
            magazynWL: 1,
            active: 1
        });
        expect(added.zapasGora).toBe(250);
        expect(context._studniePricelistDirty).toBe(true);
        expect(toasts[1]).toEqual({ msg: 'Dodano nowy element', type: 'success' });
    });

    it('krąg OT poniżej 500 mm jest odrzucany', async () => {
        const { exposed, dom, context, toasts } = setup({ products: [] });
        registerAddForm(dom, {
            'np-id': 'K-OT',
            'np-name': 'Krąg wiercony DN1000',
            'np-price': '300',
            'np-height': '400',
            'np-category': 'Krąg'
        });

        await exposed.addStudnieProduct();

        expect(toasts[0]).toEqual({
            msg: 'Minimalna wysokość kręgu OT to 500mm',
            type: 'error'
        });
        expect(context.studnieProducts).toHaveLength(0);
    });

    it('rozpoznaje typ komponentu i średnicę po nazwie/kategorii', async () => {
        const { exposed, dom, context } = setup({ products: [] });
        registerAddForm(dom, {
            'np-id': 'K-OT-500',
            'np-name': 'Krąg z otworem DN1500',
            'np-price': '300',
            'np-height': '500',
            'np-category': 'Krąg'
        });

        await exposed.addStudnieProduct();

        expect(context.studnieProducts[0]).toMatchObject({
            componentType: 'krag_ot',
            dn: 1500,
            height: 500
        });
    });

    it.each([
        ['Płyta dennica DN1200', 'dennica'],
        ['Płyta redukcyjna DN1200', 'plyta_redukcyjna'],
        ['Konus DN1000', 'konus'],
        ['Płyta DIN DN1000', 'plyta_din'],
        ['Płyta najazdowa DN1200', 'plyta_najazdowa'],
        ['Płyta zamykająca DN1200', 'plyta_zamykajaca'],
        ['Pierścień odciążający DN1200', 'pierscien_odciazajacy'],
        ['Uszczelka DN1000', 'uszczelka'],
        ['Właz żeliwny', 'wlaz'],
        ['Zawór AVR', 'avr']
    ])('nazwa "%s" daje typ %s', async (name, expected) => {
        const { exposed, dom, context } = setup({ products: [] });
        registerAddForm(dom, {
            'np-id': `ID-${expected}`,
            'np-name': name,
            'np-price': '10',
            'np-category': 'Akcesoria'
        });

        await exposed.addStudnieProduct();

        expect(context.studnieProducts[0].componentType).toBe(expected);
    });

    it('studnia styczna zapisuje dn = styczna, a indeks -OT wystarcza do typu krag_ot', async () => {
        const { exposed, dom, context } = setup({ products: [] });
        registerAddForm(dom, {
            'np-id': 'STYCZNA',
            'np-name': 'Studnia styczna',
            'np-price': '10',
            'np-category': 'Studnie'
        });

        await exposed.addStudnieProduct();
        expect(context.studnieProducts[0].dn).toBe('styczna');

        registerAddForm(dom, {
            'np-id': 'K-OT',
            'np-name': 'Krąg specjalny',
            'np-price': '10',
            'np-height': '750',
            'np-category': 'Krąg'
        });

        await exposed.addStudnieProduct();
        expect(context.studnieProducts[1].componentType).toBe('krag_ot');
    });

    it('dodaje element przez setter window.studnieProducts i zamyka modal', async () => {
        const { exposed, dom, context, closeModal, renderStudniePriceList, updateStudnieSaveBtn } =
            setup({ products: [KRAG] });
        registerAddForm(dom, {
            'np-id': 'K-1200',
            'np-name': 'Krąg DN1200',
            'np-price': '320',
            'np-weight': '500',
            'np-area': '1.5',
            'np-areaExt': '1.8',
            'np-transport': '12',
            'np-pehd': '5',
            'np-malW': '6',
            'np-malZ': '7',
            'np-zelbet': '8',
            'np-drabNierdzewna': '9',
            'np-category': 'Krąg DN1200'
        });

        await exposed.addStudnieProduct();

        const added = context.studnieProducts[1];
        expect(added).toMatchObject({
            id: 'K-1200',
            dn: 1200,
            weight: 500,
            area: 1.5,
            areaExt: 1.8,
            transport: 12,
            doplataPEHD: 5,
            malowanieWewnetrzne: 6,
            malowanieZewnetrzne: 7,
            doplataZelbet: 8,
            doplataDrabNierdzewna: 9
        });
        expect(closeModal).toHaveBeenCalledTimes(1);
        expect(renderStudniePriceList).toHaveBeenCalledTimes(1);
        expect(updateStudnieSaveBtn).toHaveBeenCalledTimes(1);
    });
});
