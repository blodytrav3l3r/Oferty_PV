import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Shared clientContacts.js (wiele osób do kontaktu) — logika + edytor.
describe('clientContacts', () => {
    let cc: any;

    beforeEach(() => {
        const file = path.join(__dirname, '../../public/js/shared/clientContacts.js');
        let code = fs.readFileSync(file, 'utf8');
        code = code.replace(/^export /gm, '');
        const esc = (s: unknown) => String(s ?? '');
        const context: any = {
            console,
            module: { exports: {} },
            document: undefined,
            window: {
                escapeHtml: esc,
                escapeHtmlAttr: (s: unknown) => String(s ?? '').replace(/"/g, '&quot;')
            }
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        cc = context.window.ClientContacts;
    });

    test('normalizeContacts: trim, puste wypadają, limit 10', () => {
        expect(cc.normalizeContacts(null)).toEqual([]);
        expect(
            cc.normalizeContacts([
                { name: '  Jan  ', phone: '600', email: '' },
                { name: '', phone: '', email: '' },
                null
            ])
        ).toEqual([{ name: 'Jan', phone: '600', email: '' }]);
        const many = Array.from({ length: 15 }, (_, i) => ({ name: `O${i}` }));
        expect(cc.normalizeContacts(many)).toHaveLength(10);
    });

    test('legacyToContacts: tablica górą, fallback klucze legacy', () => {
        const blob = {
            clientContacts: [{ name: 'A', phone: '1', email: '' }],
            contactPerson: 'Stary'
        };
        expect(cc.legacyToContacts(blob)).toEqual([{ name: 'A', phone: '1', email: '' }]);
        expect(
            cc.legacyToContacts({ contactPerson: 'Jan', clientPhone: '600', clientEmail: 'j@x.pl' })
        ).toEqual([{ name: 'Jan', phone: '600', email: 'j@x.pl' }]);
        expect(cc.legacyToContacts({})).toEqual([]);
    });

    test('contactsToLegacy + mirror string z pierwszej osoby', () => {
        expect(
            cc.contactsToLegacy([
                { name: 'Jan', phone: '600', email: 'j@x.pl' },
                { name: 'Anna', phone: '601', email: '' }
            ])
        ).toEqual({ contactPerson: 'Jan', clientPhone: '600', clientEmail: 'j@x.pl' });
        expect(cc.contactsToMirrorString([{ name: 'Jan', phone: '600' }, { name: 'Anna' }])).toBe(
            'Jan, 600; Anna'
        );
    });

    test('parseLegacyMirror rozbija "Imię, telefon; ..."', () => {
        expect(cc.parseLegacyMirror('Jan Kowalski, 600 100 200')).toEqual([
            { name: 'Jan Kowalski', phone: '600 100 200', email: '' }
        ]);
        expect(cc.parseLegacyMirror('')).toEqual([]);
    });

    test('contactRowHtml escapuje wartości (XSS)', () => {
        const html = cc.contactRowHtml({ name: '"><script>', phone: '', email: '' }, 0);
        expect(html).not.toContain('"><script>');
        expect(html).toContain('data-cc="name"');
        expect(html).toContain('data-cc-remove="0"');
    });

    test('editorHtml pozwala zmienić etykietę przycisku dodawania', () => {
        expect(cc.editorHtml([], 'Dodaj kontakt na budowę')).toContain('Dodaj kontakt na budowę');
        expect(cc.editorHtml([])).toContain('Dodaj osobę');
    });

    test('inicjalizuje edytor auto po załadowaniu partiali', () => {
        const file = path.join(__dirname, '../../public/js/shared/clientContacts.js');
        const source = fs.readFileSync(file, 'utf8').replace(/^export /gm, '');
        let containers: any[] = [];
        let onPartialsLoaded: (() => void) | undefined;
        const contactBox = {
            dataset: {},
            innerHTML: '',
            getAttribute: (name: string) =>
                name === 'data-cc-hidden' ? 'invest-contact' : 'Dodaj kontakt na budowę',
            addEventListener() {}
        };
        const hiddenMirror = { value: '' };
        const context: any = {
            document: {
                querySelectorAll: () => containers,
                addEventListener: (name: string, callback: () => void) => {
                    if (name === 'partials:loaded') onPartialsLoaded = callback;
                },
                getElementById: (id: string) => (id === 'invest-contact' ? hiddenMirror : null)
            },
            window: {}
        };
        vm.createContext(context);
        vm.runInContext(source, context);

        containers = [contactBox];
        onPartialsLoaded?.();

        expect(contactBox.innerHTML).toContain('Dodaj kontakt na budowę');
    });

    test('collectContacts czyta wiersze z DOM-stuba', () => {
        const row = (vals: Record<string, string>) => ({
            querySelector: (sel: string) => {
                const m = sel.match(/data-cc="(\w+)"/);
                return m ? { value: vals[m[1]] ?? '' } : null;
            }
        });
        const box = {
            querySelectorAll: () => [
                row({ name: 'Jan', phone: '600', email: '' }),
                row({ name: '', phone: '', email: '' })
            ]
        };
        expect(cc.collectContacts(box)).toEqual([{ name: 'Jan', phone: '600', email: '' }]);
    });
});
