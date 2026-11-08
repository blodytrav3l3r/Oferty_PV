// @ts-nocheck -- jsdom parses partial markup and vm executes the shared adapter factory
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const readPublic = (relativePath: string) =>
    fs.readFileSync(path.join(ROOT, 'public', relativePath), 'utf8');

describe('wspólna Karta Budowy', () => {
    test.each([
        ['Rury', 'rury.html', 'rury'],
        ['Studnie', 'studnie.html', 'studnie']
    ])(
        '%s ładuje kanoniczny formularz i inicjalizuje bridge przed adapterem domeny',
        (_domain, page, domain) => {
            const html = readPublic(page);
            expect(html).toContain('data-partial="partials/shared/karta-build-card.html"');
            expect(html).toContain(`data-karta-domain="${domain}"`);
            expect(html).not.toContain('js/shared/kartaBudowyCommon.js');
            expect(html.indexOf('js/shared/clientContacts.js')).toBeGreaterThanOrEqual(0);
            expect(html.indexOf('js/shared/clientContacts.js')).toBeLessThan(
                html.indexOf(`js/${domain}/orderKartaBudowy.js`)
            );
            const sharedBridge = readPublic('js/shared/clientContacts.js');
            expect(sharedBridge).toContain(
                "import { createKartaBudowyCommon } from './kartaBudowyCommon.js';"
            );
            expect(sharedBridge).toContain('kartaBudowy: createKartaBudowyCommon');
            expect(readPublic('js/shared/kartaBudowyCommon.js')).not.toContain(
                'window.KartaBudowyCommon'
            );
        }
    );

    test('formularz wspólny ma sekcje nabywcy, miejsca budowy i kontaktów budowy', () => {
        const partial = readPublic('partials/shared/karta-build-card.html');
        const document = new DOMParser().parseFromString(partial, 'text/html');

        [
            'step4-client-number',
            'step4-client-contacts',
            'step4-invest-name',
            'step4-invest-postal-code',
            'step4-invest-city',
            'step4-invest-street',
            'step4-invest-location-description',
            'step4-build-contacts',
            'step4-osoba-kontakt'
        ].forEach((id) => expect(document.getElementById(id)).not.toBeNull());
        expect(document.querySelector('.karta-build-studnie-only')).not.toBeNull();
        expect(
            document.querySelector('#step4-uszczelka-wrap.karta-build-studnie-only')
        ).not.toBeNull();
        const buildContacts = document.getElementById('step4-build-contacts');
        expect(buildContacts?.hasAttribute('data-cc-role')).toBe(false);
        expect(document.getElementById('step4-build-contact-role')).toBeNull();
        expect(readPublic('css/style.cards.css')).toContain(
            "#partial-step4[data-karta-domain='rury'] .karta-build-studnie-only"
        );
        expect(readPublic('css/style.cards.css')).not.toContain("[data-cc='role']");
    });

    test('rzędy kopiowania i danych ofertowych są inline na desktopie i składają się na telefonie', () => {
        const styles = readPublic('css/style.cards.css');
        expect(styles).toContain('#wizard-step-4 .karta-build-copy-row');
        expect(styles).toContain('grid-template-columns: minmax(0, 1fr) auto;');
        expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
        expect(styles).toContain('@media (max-width: 640px)');
        expect(styles).toContain('grid-template-columns: minmax(0, 1fr);');
    });

    test('sekcje Karty Budowy używają wspólnej skali odstępów S.O.K.', () => {
        const styles = readPublic('css/style.cards.css');
        const partial = readPublic('partials/shared/karta-build-card.html');
        const document = new DOMParser().parseFromString(partial, 'text/html');
        expect(styles).toContain('#wizard-step-4 .karta-build-form');
        expect(styles).toContain('gap: var(--tile-gap-md);');
        expect(styles).toContain('padding: 0;');
        expect(styles).toContain('margin-top: var(--section-gap);');
        expect(
            document.querySelectorAll(
                '#wizard-step-4 .karta-build-form > div[style*="padding: 0.6rem 1.2rem"]'
            )
        ).toHaveLength(0);
    });

    test('kanoniczny formularz nie zawiera nowych stylów inline', () => {
        const partial = readPublic('partials/shared/karta-build-card.html');
        const document = new DOMParser().parseFromString(partial, 'text/html');

        expect(document.querySelectorAll('[style]')).toHaveLength(0);
    });

    test('wspólny adapter kopiuje, zbiera i odtwarza dane stron oraz kontaktów', () => {
        const context: any = makeContext();
        loadCommon(context);

        context.window.ClientContacts.kartaBudowy.prefill({});
        const collected = context.window.ClientContacts.kartaBudowy.collect();

        expect(collected.clientContacts).toEqual([
            { name: 'Anna Nowak', phone: '600 700 800', email: 'anna@example.test' }
        ]);
        expect(collected.kontaktyBudowa).toEqual([
            { name: 'Piotr Nowak', phone: '500 400 300', email: 'piotr@example.test' }
        ]);
        expect(collected.investName).toBe('Hala A');

        context.window.ClientContacts.kartaBudowy.restore({
            clientName: 'Budimex S.A.',
            kontaktZamawiajacy: collected.clientContacts,
            kontaktyBudowa: collected.kontaktyBudowa,
            investName: 'Hala B'
        });
        expect(context.elements['step4-client-name'].value).toBe('Budimex S.A.');
        expect(context.elements['step4-build-contacts'].contacts[0].name).toBe('Piotr Nowak');
        expect(context.elements['step4-invest-name'].value).toBe('Hala B');
    });

    test('adapter rozdziela historyczne pole kontaktu Rur na nabywcę i budowę', () => {
        const context: any = makeContext();
        loadCommon(context);

        context.window.ClientContacts.kartaBudowy.restore(
            { osobaKontakt: 'Zamawiający: Jan Kowalski, 600 123 456, Budowa: Kierownik' },
            { splitLegacyOsobaKontakt: true }
        );

        expect(context.elements['step4-client-contacts'].contacts).toEqual([
            { name: 'Jan Kowalski', phone: '600 123 456', email: '' }
        ]);
        expect(context.elements['step4-build-contacts'].contacts).toEqual([
            { name: 'Kierownik', phone: '', email: '' }
        ]);
    });

    test('adapter zachowuje historyczny kontakt Rur bez prefiksu Zamawiający', () => {
        const context: any = makeContext();
        loadCommon(context);

        context.window.ClientContacts.kartaBudowy.restore(
            { osobaKontakt: 'Jan Kowalski, 600 123 456' },
            { splitLegacyOsobaKontakt: true }
        );

        expect(context.elements['step4-client-contacts'].contacts).toEqual([
            { name: 'Jan Kowalski', phone: '600 123 456', email: '' }
        ]);
    });

    test('restore odtwarza legacy kontakty budowy i respektuje jawną pustą listę', () => {
        const context: any = makeContext();
        loadCommon(context);
        context.document.getElementById('step4-build-contacts');

        context.window.ClientContacts.kartaBudowy.restore({
            investContacts: [
                { name: 'Anna Nowak', phone: '600 700 800', email: 'anna@example.test' }
            ]
        });
        expect(context.elements['step4-build-contacts'].contacts).toEqual([
            { name: 'Anna Nowak', phone: '600 700 800', email: 'anna@example.test' }
        ]);

        context.window.ClientContacts.kartaBudowy.restore({
            kontaktyBudowa: [],
            investContacts: [{ name: 'Stary kontakt', phone: '500', email: '' }]
        });
        expect(context.elements['step4-build-contacts'].contacts).toEqual([]);
    });

    test('restore odtwarza historyczne scalarowe investContact', () => {
        const context: any = makeContext();
        loadCommon(context);

        context.window.ClientContacts.kartaBudowy.restore({
            investContact: 'Kierownik budowy, 600 700 800'
        });

        expect(context.elements['step4-build-contacts'].contacts).toEqual([
            { name: 'Kierownik budowy', phone: '600 700 800', email: '' }
        ]);
    });

    test('restore pozostawia prefill, gdy skopiowana karta nie ma pól kontaktu', () => {
        const context: any = makeContext();
        loadCommon(context);
        context.document.getElementById('step4-client-contacts');
        context.document.getElementById('step4-build-contacts');
        context.elements['step4-client-contacts'].contacts = [
            { name: 'Klient', phone: '100', email: 'client@example.test' }
        ];
        context.elements['step4-build-contacts'].contacts = [
            { name: 'Budowa', phone: '200', email: 'build@example.test' }
        ];

        context.window.ClientContacts.kartaBudowy.restore({ offerNumbers: ['OS/1'] });

        expect(context.elements['step4-client-contacts'].contacts[0].name).toBe('Klient');
        expect(context.elements['step4-build-contacts'].contacts[0].name).toBe('Budowa');
    });
});

function makeContext() {
    const elements: Record<string, any> = {
        'client-name': { value: 'Budimex S.A.' },
        'client-number': { value: 'K-1' },
        'client-nip': { value: '1234567890' },
        'client-address': { value: 'Testowa 1' },
        'invest-name': { value: 'Hala A' },
        'invest-postal-code': { value: '00-001' },
        'invest-city': { value: 'Warszawa' },
        'invest-street': { value: 'Leśna 2' },
        'invest-location-description': { value: 'Brama północna' },
        'client-contacts': {
            contacts: [{ name: 'Anna Nowak', phone: '600 700 800', email: 'anna@example.test' }]
        },
        'invest-contacts': {
            contacts: [{ name: 'Piotr Nowak', phone: '500 400 300', email: 'piotr@example.test' }]
        }
    };
    const document = {
        getElementById(id: string) {
            if (!elements[id]) elements[id] = { value: '', contacts: [] };
            return elements[id];
        }
    };
    const normalizeContacts = (contacts: any[]) =>
        Array.isArray(contacts)
            ? contacts
                  .filter((contact) => contact?.name || contact?.phone || contact?.email)
                  .map((contact) => ({
                      name: contact.name || '',
                      phone: contact.phone || '',
                      email: contact.email || ''
                  }))
            : [];
    const clientContacts = {
        normalizeContacts,
        collectContacts: (element: any) => normalizeContacts(element?.contacts || []),
        renderEditor(element: any, contacts: any[]) {
            element.contacts = normalizeContacts(contacts);
            const hiddenId = element.dataset?.ccHidden;
            if (hiddenId && elements[hiddenId]) {
                elements[hiddenId].value = this.contactsToMirrorString(contacts);
            }
        },
        bindEditor() {},
        parseLegacyMirror(value: string) {
            return String(value || '')
                .split(';')
                .map((part) => {
                    const match = part.trim().match(/^(.*?)[,;]\s*([\d+() -]{7,20})$/);
                    return match
                        ? { name: match[1].trim(), phone: match[2].trim(), email: '' }
                        : { name: part.trim(), phone: '', email: '' };
                })
                .filter((contact) => contact.name || contact.phone);
        },
        contactsToMirrorString(contacts: any[]) {
            return normalizeContacts(contacts)
                .map((contact) => [contact.name, contact.phone].filter(Boolean).join(', '))
                .join('; ');
        }
    };
    elements['client-contacts'].dataset = { ccHidden: 'client-contact' };
    elements['invest-contacts'].dataset = { ccHidden: 'invest-contact' };
    return { window: { ClientContacts: clientContacts }, document, elements };
}

function loadCommon(context: any) {
    vm.createContext(context);
    const source = readPublic('js/shared/kartaBudowyCommon.js').replace(/^export /gm, '');
    vm.runInContext(
        `${source}\nwindow.ClientContacts.kartaBudowy = createKartaBudowyCommon({ document, clientContacts: window.ClientContacts });`,
        context
    );
}
