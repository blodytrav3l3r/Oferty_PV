/// <reference lib="dom" />

import fs from 'node:fs';
import vm from 'node:vm';

const source = (file: string): string => fs.readFileSync(file, 'utf8');

function createGrid(
    products: Array<Record<string, unknown>>,
    tab: string,
    editing = true,
    search = ''
) {
    document.body.innerHTML =
        '<div id="studnie-pricelist-body"></div><input id="studnie-pricelist-search">';
    (document.getElementById('studnie-pricelist-search') as HTMLInputElement).value = search;
    const sandbox = vm.createContext({
        document,
        currentCennikTab: tab,
        CENNIK_TAB_FILTERS: {
            przejscia: (p: { componentType: string }) => p.componentType === 'przejscie',
            dn1000: () => true
        },
        studnieProducts: products,
        _studniePricelistDirty: false,
        fmtInt: (n: number) => String(n),
        fmt: (n: number) => String(n),
        escapeHtml: (s: string) => s,
        escapeHtmlAttr: (s: string) =>
            s
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;'),
        updateStudnieSaveBtn: jest.fn(),
        pricelistVersions: { applyEditorLock: jest.fn(), isEditing: () => editing }
    });
    sandbox.window = sandbox;
    vm.runInContext(source('public/js/studnie/pricelistCellEdit.js'), sandbox);
    vm.runInContext(source('public/js/studnie/pricelistManager.js'), sandbox);
    sandbox.renderStudniePriceList();
    return sandbox;
}

describe('dostępność w siatce cennika Studni', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('zmienia Dost. pełnym polem wyboru i zapisuje liczbę 0/1', () => {
        const sandbox = createGrid(
            [
                {
                    id: 'GRP-150',
                    name: 'GRP',
                    category: 'GRP',
                    componentType: 'przejscie',
                    dn: 150,
                    price: 230,
                    active: 0
                }
            ],
            'przejscia'
        );
        const checkbox = document.querySelector<HTMLInputElement>(
            'input[data-action="setStudnieAvailability"][data-field="active"]'
        );

        expect(checkbox).not.toBeNull();
        expect(checkbox?.checked).toBe(false);
        checkbox!.checked = true;
        checkbox!.dispatchEvent(new Event('change', { bubbles: true }));

        expect(sandbox.studnieProducts[0].active).toBe(1);
        expect(sandbox._studniePricelistDirty).toBe(true);
    });

    it('pokazuje pięć niezależnych pól, a w podglądzie blokuje ich zmianę', () => {
        const product = {
            id: 'K-1000',
            name: 'Krąg',
            componentType: 'krag',
            category: 'Studnie DN1000',
            price: 100,
            area: 0,
            magazynWL: 1,
            magazynKLB: 0,
            formaStandardowa: 1,
            formaStandardowaKLB: 0
        };
        const sandbox = createGrid([product], 'dn1000');
        const fields = ['magazynWL', 'magazynKLB', 'formaStandardowa', 'formaStandardowaKLB'];

        expect(
            fields.map(
                (field) =>
                    document.querySelector<HTMLInputElement>(
                        `input[data-action="setStudnieAvailability"][data-field="${field}"]`
                    )?.checked
            )
        ).toEqual([true, false, true, false]);
        fields.forEach((field) => {
            const checkbox = document.querySelector<HTMLInputElement>(
                `input[data-action="setStudnieAvailability"][data-field="${field}"]`
            )!;
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(sandbox.studnieProducts[0]).toMatchObject({
            ...product,
            magazynWL: 0,
            magazynKLB: 1,
            formaStandardowa: 0,
            formaStandardowaKLB: 1
        });

        createGrid([product], 'dn1000', false);
        expect(document.querySelectorAll('input.pricelist-flag-input:disabled')).toHaveLength(8);
        expect(
            document.querySelectorAll(
                'input[data-action="setStudnieCategoryAvailability"]:disabled'
            )
        ).toHaveLength(4);
    });

    it('zaznacza tylko widoczne przejścia jednej kategorii', () => {
        const products = [
            {
                id: 'VISIBLE-GRP-1',
                name: 'A',
                category: 'GRP',
                componentType: 'przejscie',
                active: 0,
                price: 10
            },
            {
                id: 'VISIBLE-GRP-2',
                name: 'B',
                category: 'GRP',
                componentType: 'przejscie',
                active: 1,
                price: 10
            },
            {
                id: 'HIDDEN-GRP',
                name: 'C',
                category: 'GRP',
                componentType: 'przejscie',
                active: 0,
                price: 10
            },
            {
                id: 'VISIBLE-OTHER',
                name: 'D',
                category: 'Other',
                componentType: 'przejscie',
                active: 0,
                price: 10
            }
        ];
        const sandbox = createGrid(products, 'przejscia', true, 'VISIBLE');
        const category = document.querySelector<HTMLInputElement>(
            'input[data-action="setStudnieCategoryAvailability"][data-field="active"]'
        );

        expect(category).not.toBeNull();
        expect(category?.indeterminate).toBe(true);
        category!.checked = true;
        category!.dispatchEvent(new Event('change', { bubbles: true }));

        expect(sandbox.studnieProducts.map((row: { active: number }) => row.active)).toEqual([
            1, 1, 0, 0
        ]);
        expect(sandbox._studniePricelistDirty).toBe(true);
    });

    it('zmienia niezależnie cztery flagi widocznych elementów w jednej kategorii', () => {
        const flags = ['magazynWL', 'magazynKLB', 'formaStandardowa', 'formaStandardowaKLB'];
        const makeProduct = (id: string, componentType: string, value: number) => ({
            id,
            name: id,
            category: 'GRP',
            componentType,
            price: 100,
            area: 0,
            magazynWL: value,
            magazynKLB: value,
            formaStandardowa: value,
            formaStandardowaKLB: value
        });
        const sandbox = createGrid(
            [
                makeProduct('VISIBLE-A', 'krag', 0),
                makeProduct('VISIBLE-B', 'krag', 1),
                makeProduct('HIDDEN-C', 'krag', 0),
                makeProduct('VISIBLE-OTHER', 'dennica', 0)
            ],
            'dn1000',
            true,
            'VISIBLE'
        );
        const controls = flags.map((field) =>
            document.querySelector<HTMLInputElement>(
                `input[data-action="setStudnieCategoryAvailability"][data-field="${field}"]`
            )
        );

        expect(controls.every(Boolean)).toBe(true);
        expect(controls.every((control) => control?.indeterminate)).toBe(true);
        controls.forEach((control) => {
            control!.checked = true;
            control!.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(
            sandbox.studnieProducts
                .slice(0, 2)
                .every((row: Record<string, number>) => flags.every((field) => row[field] === 1))
        ).toBe(true);
        expect(
            sandbox.studnieProducts
                .slice(2)
                .every((row: Record<string, number>) => flags.every((field) => row[field] === 0))
        ).toBe(true);
        controls[0]!.checked = false;
        controls[0]!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(
            sandbox.studnieProducts
                .slice(0, 2)
                .every((row: Record<string, number>) => row.magazynWL === 0 && row.magazynKLB === 1)
        ).toBe(true);
    });
});
