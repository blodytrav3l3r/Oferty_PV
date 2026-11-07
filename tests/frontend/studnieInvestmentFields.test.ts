import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function loadOfferCrudCommon() {
    const elements: Record<string, any> = {};
    const investContacts = [
        { name: 'Anna Kowalska', phone: '123456789', email: 'anna@example.com' }
    ];
    const renderedInvestContacts: unknown[][] = [];
    elements['invest-contacts'] = {};
    elements['invest-contact'] = { value: '' };
    elements['invest-legacy-address'] = { textContent: '', hidden: true };
    const country = {
        value: 'DE',
        selectedIndex: 0,
        options: [{ textContent: 'Niemcy' }],
        dataset: {},
        appendChild() {}
    };
    const values: Record<string, string> = {
        'invest-name': 'Budowa szkoły',
        'invest-address': '',
        'invest-contractor': 'Legacy contractor',
        'invest-street': 'ul. Długa 1',
        'invest-postal-code': '00-001',
        'invest-city': 'Berlin',
        'invest-location-description': 'Wjazd od północnej strony'
    };
    Object.entries(values).forEach(([id, value]) => (elements[id] = { value }));
    elements['invest-country'] = country;
    const context: Record<string, any> = {
        document: {
            getElementById: (id: string) => elements[id] || null,
            querySelector: (selector: string) =>
                selector === 'select#invest-country' ? country : null,
            createElement: () => ({ value: '', textContent: '' }),
            addEventListener() {}
        },
        window: {
            ClientContacts: {
                collectContacts: (container: unknown) =>
                    container === elements['invest-contacts'] ? investContacts : [],
                parseLegacyMirror: (value: string) => (value ? [{ name: value }] : []),
                renderEditor: (container: unknown, rows: unknown[]) => {
                    if (container === elements['invest-contacts'])
                        renderedInvestContacts.push(rows);
                },
                bindEditor() {}
            }
        }
    };
    vm.createContext(context);
    const source = fs.readFileSync(path.join(ROOT, 'public/js/shared/offerCrudCommon.js'), 'utf8');
    vm.runInContext(
        source +
            '\nthis.__test = { getOfferFormFields, setOfferFormFields, clearOfferFormFields, buildBaseOfferDoc };',
        context
    );
    return { context, elements, investContacts, renderedInvestContacts };
}

describe('Studnie: dane inwestycji', () => {
    test('zbiera adres strukturalny, opis i osobny zestaw kontaktów', () => {
        const { context, investContacts } = loadOfferCrudCommon();

        const fields = context.__test.getOfferFormFields();

        expect(fields.investAddress).toBe('ul. Długa 1, 00-001 Berlin, Niemcy');
        expect(fields.investStreet).toBe('ul. Długa 1');
        expect(fields.investPostalCode).toBe('00-001');
        expect(fields.investCity).toBe('Berlin');
        expect(fields.investCountry).toBe('DE');
        expect(fields.investLocationDescription).toBe('Wjazd od północnej strony');
        expect(fields.investContacts).toEqual(investContacts);
        expect(fields.investContractor).toBe('Legacy contractor');

        const saved = context.__test.buildBaseOfferDoc({
            id: 'offer-1',
            type: 'studnia_oferta',
            fields,
            currentUser: null
        });
        expect(saved.investStreet).toBe('ul. Długa 1');
        expect(saved.investCountry).toBe('DE');
        expect(saved.investLocationDescription).toBe('Wjazd od północnej strony');
        expect(saved.investContacts).toEqual(investContacts);
    });

    test('nowa oferta ustawia Polskę i czyści pola inwestycji', () => {
        const { context, elements } = loadOfferCrudCommon();

        context.__test.clearOfferFormFields();

        expect(elements['invest-country'].value).toBe('PL');
        expect(elements['invest-street'].value).toBe('');
        expect(elements['invest-address'].value).toBe('');
        expect(elements['invest-contractor'].value).toBe('');
    });

    test('stary adres pozostaje zachowany i nie trafia do pola ulicy', () => {
        const { context, elements } = loadOfferCrudCommon();
        elements['invest-street'].value = '';
        elements['invest-postal-code'].value = '';
        elements['invest-city'].value = '';

        context.__test.setOfferFormFields({
            investAddress: 'ul. Stara 5, Kraków',
            investContractor: 'Wykonawca z archiwum'
        });

        expect(elements['invest-street'].value).toBe('');
        expect(elements['invest-address'].value).toBe('ul. Stara 5, Kraków');
        expect(elements['invest-legacy-address'].textContent).toBe(
            'Adres zapisany wcześniej: ul. Stara 5, Kraków'
        );
        expect(elements['invest-legacy-address'].hidden).toBe(false);
        expect(elements['invest-contractor'].value).toBe('Wykonawca z archiwum');
    });

    test('jawnie pusty zestaw kontaktów nie odzyskuje mirroru poprzedniej oferty', () => {
        const { context, elements, renderedInvestContacts } = loadOfferCrudCommon();
        elements['invest-contact'].value = 'Stary Kontakt';

        context.__test.setOfferFormFields({ investContacts: [], investContact: '' });

        expect(renderedInvestContacts[renderedInvestContacts.length - 1]).toEqual([]);
    });
});
