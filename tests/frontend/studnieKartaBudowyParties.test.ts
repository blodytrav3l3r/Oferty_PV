// @ts-nocheck -- vm sandbox for browser script
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('studnie karta budowy: dane inwestycji i stron', () => {
    test('formularz zachowuje kolejność sekcji zgodną z widokiem zamówienia', () => {
        const partial = fs.readFileSync(
            path.join(__dirname, '../../public/partials/shared/karta-build-card.html'),
            'utf8'
        );
        const positions = [
            partial.indexOf('<!-- Wiersz 1: Emaile i numer oferty -->'),
            partial.indexOf('<section aria-labelledby="step4-buyer-title">'),
            partial.indexOf('<!-- Wiersz 2: Adres i Płatności -->'),
            partial.indexOf('<!-- Wiersz 4: Osoby do kontaktu'),
            partial.indexOf('<section aria-labelledby="step4-build-location-title">'),
            partial.indexOf('<section aria-labelledby="step4-build-contact-title">'),
            partial.indexOf('<!-- Wiersz 5: Transport -->')
        ];

        expect(positions.every((position) => position >= 0)).toBe(true);
        positions.slice(1).forEach((position, index) => {
            expect(positions[index]).toBeLessThan(position);
        });
    });

    test('Step 4 ma wspólny kontener rytmu formularza', () => {
        const partial = fs.readFileSync(
            path.join(__dirname, '../../public/partials/shared/karta-build-card.html'),
            'utf8'
        );
        const document = new DOMParser().parseFromString(partial, 'text/html');

        expect(document.querySelector('#wizard-step-4 .karta-build-form')).not.toBeNull();
    });

    test('sekcje kontaktów klienta i inwestycji mają równoległe nazwy', () => {
        const step1 = fs.readFileSync(
            path.join(__dirname, '../../public/partials/shared/step1-client.html'),
            'utf8'
        );
        const step4 = fs.readFileSync(
            path.join(__dirname, '../../public/partials/shared/karta-build-card.html'),
            'utf8'
        );
        expect(step1).toContain('Osoby do kontaktu — klient');
        expect(step1).toContain('Osoby do kontaktu — inwestycja');
        expect(step4).toContain('Osoby do kontaktu — klient');
        expect(step4).toContain('data-cc-hidden="step4-osoba-kontakt"');
        expect(step4).toContain('Osoby do kontaktu — budowa');
        expect(step4).not.toContain('data-cc-role');
        expect(step4).not.toContain('step4-build-contact-role');
    });

    test('jednoliniowe pola danych karty korzystają ze wspólnego rozmiaru formularza', () => {
        const partial = fs.readFileSync(
            path.join(__dirname, '../../public/partials/shared/karta-build-card.html'),
            'utf8'
        );
        const document = new DOMParser().parseFromString(partial, 'text/html');
        const inputIds = [
            'step4-client-number',
            'step4-client-name',
            'step4-client-nip',
            'step4-client-address',
            'step4-invest-name',
            'step4-invest-postal-code',
            'step4-invest-city',
            'step4-invest-street'
        ];

        inputIds.forEach((id) => {
            const input = document.getElementById(id);
            expect(input?.classList.contains('form-input')).toBe(true);
            expect(input?.classList.contains('form-input-wide')).toBe(true);
        });
        const directions = document.getElementById('step4-invest-location-description');
        expect(directions?.classList.contains('form-input')).toBe(true);
        expect(directions?.classList.contains('form-input-wide')).toBe(true);
        expect(directions?.getAttribute('rows')).toBe('2');

        [
            'step4-build-contact-name',
            'step4-build-contact-phone',
            'step4-build-contact-email'
        ].forEach((id) => {
            expect(document.getElementById(id)?.type).toBe('hidden');
        });
        expect(document.getElementById('step4-build-contact-role')).toBeNull();
    });

    function runContext(
        values = {},
        sourceContacts = [],
        investmentContacts = [],
        missingIds = []
    ) {
        const elements = {};
        const document = {
            getElementById(id) {
                if (missingIds.includes(id)) return null;
                if (!elements[id]) {
                    elements[id] = {
                        value: values[id] || '',
                        style: {},
                        dataset: {},
                        contacts:
                            id === 'client-contacts'
                                ? sourceContacts
                                : id === 'invest-contacts'
                                  ? investmentContacts
                                  : []
                    };
                }
                return elements[id];
            }
        };
        const normalizeContacts = (contacts) =>
            Array.isArray(contacts)
                ? contacts
                      .map((contact) => ({
                          name: contact?.name?.trim() || '',
                          phone: contact?.phone?.trim() || '',
                          email: contact?.email?.trim() || ''
                      }))
                      .filter((contact) => contact.name || contact.phone || contact.email)
                : [];
        const clientContacts = {
            normalizeContacts,
            parseLegacyMirror(value) {
                if (!value) return [];
                return value.split(';').map((entry) => {
                    const match = entry.trim().match(/^(.*?)[,;]\s*([\d+() -]{7,20})$/);
                    return match
                        ? { name: match[1].trim(), phone: match[2].trim(), email: '' }
                        : { name: entry.trim(), phone: '', email: '' };
                });
            },
            contactsToMirrorString(contacts) {
                return normalizeContacts(contacts)
                    .map((contact) => [contact.name, contact.phone].filter(Boolean).join(', '))
                    .join('; ');
            },
            renderEditor(container, contacts) {
                container.contacts = normalizeContacts(contacts);
                if (container === document.getElementById('step4-client-contacts')) {
                    document.getElementById('step4-osoba-kontakt').value =
                        this.contactsToMirrorString(container.contacts);
                }
            },
            bindEditor() {},
            collectContacts(container) {
                return normalizeContacts(container?.contacts);
            }
        };
        const context = {
            window: { ClientContacts: clientContacts },
            document,
            collectPrzejsciaDetailsFromTable: () => []
        };
        vm.createContext(context);
        const common = fs
            .readFileSync(
                path.join(__dirname, '../../public/js/shared/kartaBudowyCommon.js'),
                'utf8'
            )
            .replace(/^export /gm, '');
        vm.runInContext(
            `${common}\nwindow.ClientContacts.kartaBudowy = createKartaBudowyCommon({ document, clientContacts: window.ClientContacts });`,
            context
        );
        vm.runInContext(
            fs.readFileSync(
                path.join(__dirname, '../../public/js/studnie/orderKartaBudowy.js'),
                'utf8'
            ),
            context
        );
        return { context, elements };
    }

    test('collect zapisuje dane budowy, kontaktu i nabywcy w kolejności domenowej', () => {
        const { context, elements } = runContext({
            'step4-invest-name': 'Hala A',
            'step4-invest-postal-code': '00-001',
            'step4-invest-city': 'Warszawa',
            'step4-invest-street': 'Leśna 2',
            'step4-invest-location-description': 'Wjazd od północy',
            'step4-build-contact-name': 'Jan Kowalski',
            'step4-build-contact-phone': '500 600 700',
            'step4-build-contact-email': 'jan@example.test',
            'step4-client-number': 'K-001',
            'step4-client-name': 'Budimex S.A.',
            'step4-client-nip': '1234567890',
            'step4-client-address': 'ul. Testowa 1, Warszawa'
        });
        context.document.getElementById('step4-build-contacts');
        elements['step4-build-contacts'].contacts = [
            {
                name: 'Jan Kowalski',
                phone: '500 600 700',
                email: 'jan@example.test',
                role: 'Kierownik budowy'
            }
        ];
        context.document.getElementById('step4-client-contacts').contacts = [
            { name: 'Jan Kowalski', phone: '500 600 700', email: 'jan@example.test' }
        ];

        const data = context.collectKartaBudowyDataStep4();

        expect(data).toMatchObject({
            investName: 'Hala A',
            investPostalCode: '00-001',
            investCity: 'Warszawa',
            investStreet: 'Leśna 2',
            investLocationDescription: 'Wjazd od północy',
            kontaktBudowaImie: 'Jan Kowalski',
            kontaktBudowaTelefon: '500 600 700',
            kontaktBudowaEmail: 'jan@example.test',
            kontaktZamawiajacy: [
                { name: 'Jan Kowalski', phone: '500 600 700', email: 'jan@example.test' }
            ],
            kontaktyBudowa: [
                {
                    name: 'Jan Kowalski',
                    phone: '500 600 700',
                    email: 'jan@example.test'
                }
            ],
            osobaKontakt: 'Jan Kowalski, 500 600 700',
            clientNumber: 'K-001',
            clientName: 'Budimex S.A.',
            clientNip: '1234567890',
            clientAddress: 'ul. Testowa 1, Warszawa'
        });
    });

    test('prefill rozdziela pierwszy kontakt inwestycji od kontaktu klienta', () => {
        const { context, elements } = runContext(
            {},
            [{ name: 'Anna Nowak', phone: '111 222 333', email: 'anna@example.test' }],
            [],
            ['invest-contacts']
        );

        context.window.ClientContacts.kartaBudowy.prefill({
            clientNumber: 'K-002',
            clientName: 'Firma',
            clientNip: '9988776655',
            clientAddress: 'Adres firmy',
            clientContacts: [
                { name: 'Anna Nowak', phone: '111 222 333', email: 'anna@example.test' }
            ],
            investName: 'Obiekt',
            investPostalCode: '01-100',
            investCity: 'Łódź',
            investStreet: 'Polna 4',
            investLocationDescription: 'Brama 3',
            investContacts: [
                { name: 'Piotr Nowak', phone: '600 700 800', email: 'p@example.test' },
                { name: 'Ewa Lis', phone: '500 400 300', email: 'e@example.test' }
            ]
        });

        expect(elements['step4-client-contacts'].contacts).toEqual([
            { name: 'Anna Nowak', phone: '111 222 333', email: 'anna@example.test' }
        ]);
        expect(elements['step4-osoba-kontakt'].value).toBe('Anna Nowak, 111 222 333');
        expect(elements['step4-build-contacts'].contacts).toEqual([
            {
                name: 'Piotr Nowak',
                phone: '600 700 800',
                email: 'p@example.test'
            },
            {
                name: 'Ewa Lis',
                phone: '500 400 300',
                email: 'e@example.test'
            }
        ]);
        expect(elements['step4-build-contact-name'].value).toBe('Piotr Nowak');
        expect(elements['step4-build-contact-phone'].value).toBe('600 700 800');
        expect(elements['step4-build-contact-email'].value).toBe('p@example.test');
        expect(elements['step4-invest-name'].value).toBe('Obiekt');
        expect(elements['step4-client-number'].value).toBe('K-002');
    });

    test('prefill kopiuje wszystkie kontakty inwestycji z kroku 1 do kontaktów budowy', () => {
        const investmentContacts = [
            { name: 'Piotr Nowak', phone: '600 700 800', email: 'piotr@example.test' },
            { name: 'Ewa Lis', phone: '500 400 300', email: 'ewa@example.test' }
        ];
        const { context, elements } = runContext({}, [], investmentContacts);

        context.window.ClientContacts.kartaBudowy.prefill({});

        expect(elements['step4-build-contacts'].contacts).toEqual(investmentContacts);
        expect(elements['step4-build-contact-name'].value).toBe('Piotr Nowak');
        expect(elements['step4-build-contact-email'].value).toBe('piotr@example.test');
    });

    test('pusta lista kontaktów inwestycji nie przywraca danych ze starej oferty', () => {
        const { context, elements } = runContext();
        context.document.getElementById('invest-contacts');
        elements['invest-contacts'].contacts = [];

        context.window.ClientContacts.kartaBudowy.prefill({
            investContacts: [
                { name: 'Stara osoba', phone: '500 600 700', email: 'old@example.test' }
            ]
        });

        expect(elements['step4-build-contacts'].contacts).toEqual([]);
    });

    test('odtwarza i kopiuje kontakty budowy ignorując historyczne role', () => {
        const contacts = [
            {
                name: 'Anna Nowak',
                phone: '111 222 333',
                email: 'anna@example.test',
                role: 'Kierownik budowy'
            },
            {
                name: 'Jan Kowalski',
                phone: '444 555 666',
                email: 'jan@example.test',
                role: 'Odbiór dostawy'
            }
        ];
        const { context, elements } = runContext();
        context.document.getElementById('step4-build-contacts');

        context._applyExistingKartaBudowyData({ kontaktyBudowa: contacts }, null);
        expect(elements['step4-build-contacts'].contacts).toEqual([
            { name: 'Anna Nowak', phone: '111 222 333', email: 'anna@example.test' },
            { name: 'Jan Kowalski', phone: '444 555 666', email: 'jan@example.test' }
        ]);

        context.applyCopiedKartaBudowyData({
            kontaktBudowaImie: 'Stara osoba',
            kontaktBudowaTelefon: '600',
            kontaktBudowaEmail: 'stara@example.test',
            investContacts: []
        });
        expect(elements['step4-build-contacts'].contacts).toEqual([
            {
                name: 'Stara osoba',
                phone: '600',
                email: 'stara@example.test'
            }
        ]);
    });

    test('pusta lista kontaktów z kroku 1 nie przywraca starszych danych klienta', () => {
        const { context, elements } = runContext({}, [
            { name: 'Anna Nowak', phone: '111 222 333', email: 'anna@example.test' }
        ]);
        context.document.getElementById('client-contacts');
        elements['client-contacts'].contacts = [];

        context.window.ClientContacts.kartaBudowy.prefill({
            clientContacts: [
                { name: 'Anna Nowak', phone: '111 222 333', email: 'anna@example.test' }
            ],
            clientContact: 'Anna Nowak, 111 222 333'
        });

        expect(elements['step4-client-contacts'].contacts).toEqual([]);
    });

    test('kopiowanie starej karty bez nowych pól nie usuwa danych z kroku 1', () => {
        const { context, elements } = runContext({
            'step4-invest-name': 'Obiekt z kroku 1',
            'step4-client-name': 'Nabywca z kroku 1',
            'step4-osoba-kontakt': 'Kontakt nabywcy'
        });
        ['step4-invest-name', 'step4-client-name', 'step4-osoba-kontakt'].forEach((id) =>
            context.document.getElementById(id)
        );

        context.applyCopiedKartaBudowyData({ offerNumbers: ['OF/1'] });

        expect(elements['step4-invest-name'].value).toBe('Obiekt z kroku 1');
        expect(elements['step4-client-name'].value).toBe('Nabywca z kroku 1');
        expect(elements['step4-osoba-kontakt'].value).toBe('Kontakt nabywcy');
    });

    test('odtworzenie zapisanej pustej wartości nie przywraca starego prefillu', () => {
        const { context, elements } = runContext({ 'step4-invest-name': 'Obiekt z kroku 1' });
        context.document.getElementById('step4-invest-name');

        context._applyExistingKartaBudowyData({ investName: '' }, null);

        expect(elements['step4-invest-name'].value).toBe('');
    });

    test('odtworzenie i kopiowanie zachowuje pełną listę kontaktów z e-mailami', () => {
        const contacts = [
            { name: 'Anna Nowak', phone: '111 222 333', email: 'anna@example.test' },
            { name: 'Jan Kowalski', phone: '444 555 666', email: 'jan@example.test' }
        ];
        const { context, elements } = runContext();
        context.document.getElementById('step4-client-contacts');

        context._applyExistingKartaBudowyData({ kontaktZamawiajacy: contacts }, null);
        expect(elements['step4-client-contacts'].contacts).toEqual(contacts);
        expect(elements['step4-osoba-kontakt'].value).toBe(
            'Anna Nowak, 111 222 333; Jan Kowalski, 444 555 666'
        );

        context.applyCopiedKartaBudowyData({ kontaktZamawiajacy: contacts });
        expect(elements['step4-client-contacts'].contacts).toEqual(contacts);
    });

    test('odtwarza kontakt z archiwalnej karty zapisanej jako tekst', () => {
        const { context, elements } = runContext();
        context.document.getElementById('step4-client-contacts');

        context._applyExistingKartaBudowyData({ osobaKontakt: 'Anna Nowak, 111 222 333' }, null);

        expect(elements['step4-client-contacts'].contacts).toEqual([
            { name: 'Anna Nowak', phone: '111 222 333', email: '' }
        ]);
    });

    test('inicjalizuje kartę raz na kontekst i ponownie po zmianie kontekstu', () => {
        const { context, elements } = runContext();
        const initCalls = [];
        context.initKartaBudowyStep4 = (offerNumber) => initCalls.push(offerNumber);
        context.document.getElementById('step4-client-name');
        elements['step4-client-name'].value = 'Wpisane przez użytkownika';

        context._enterKartaBudowyStep4();
        context._enterKartaBudowyStep4();
        expect(initCalls).toEqual([undefined]);
        expect(elements['step4-client-name'].value).toBe('Wpisane przez użytkownika');

        context.pendingOrderCreationData = {
            offer: { id: 'offer-1', number: 'OS/1' },
            selectedWells: [{ id: 'well-1' }]
        };
        context._enterKartaBudowyStep4();
        expect(initCalls).toEqual([undefined, 'OS/1']);
    });
});
