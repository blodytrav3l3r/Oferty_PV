import fs from 'fs';
import path from 'path';
import vm from 'vm';

// syncOrderContactsFromForm + pickOrderContactFields (offerCrudCommon.js).
const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel: string) => fs.readFileSync(path.join(ROOT, 'public', rel), 'utf8');

function loadCommon(byId: (id: string) => any, collect: () => any[], withBridge: boolean) {
    const sandbox: any = {
        console,
        document: {
            getElementById: (id: string) => byId(id),
            addEventListener: () => {}
        }
    };
    sandbox.window = sandbox;
    if (withBridge) sandbox.window.ClientContacts = { collectContacts: collect };
    vm.createContext(sandbox);
    vm.runInContext(readPub('js/shared/offerCrudCommon.js'), sandbox, {
        filename: 'offerCrudCommon.js'
    });
    return sandbox;
}

describe('pickOrderContactFields: macierz', () => {
    function pick(sb: any, f: any) {
        sb.f = f;
        return vm.runInContext('pickOrderContactFields(f)', sb);
    }

    test('pełne dane przechodzą 1:1', () => {
        const sb = loadCommon(
            () => null,
            () => [],
            true
        );
        const f = {
            clientContacts: [{ name: 'Jan', phone: '600', email: 'j@x.pl' }],
            clientContact: 'Jan, 600',
            contactPerson: 'Jan',
            clientPhone: '600',
            clientEmail: 'j@x.pl'
        };
        expect(pick(sb, f)).toEqual(f);
    });

    test.each([[null], [undefined], [{}]])('brak danych → domyślne %p', (input) => {
        const sb = loadCommon(
            () => null,
            () => [],
            true
        );
        expect(pick(sb, input)).toEqual({
            clientContacts: [],
            clientContact: '',
            contactPerson: '',
            clientPhone: '',
            clientEmail: ''
        });
    });

    test('nie-tablicowe clientContacts → []', () => {
        const sb = loadCommon(
            () => null,
            () => [],
            true
        );
        const out = pick(sb, { clientContacts: 'Jan, 600', clientContact: 'Jan, 600' });
        expect(out.clientContacts).toEqual([]);
        expect(out.clientContact).toBe('Jan, 600');
    });
});

describe('syncOrderContactsFromForm: guardy i happy path', () => {
    function sync(sb: any, order: any) {
        sb.order = order;
        vm.runInContext('syncOrderContactsFromForm(order)', sb);
        return order;
    }

    test('brak edytora w DOM: obiekt nietknięty', () => {
        const sb = loadCommon(
            () => null,
            () => [{ name: 'X', phone: '1', email: '' }],
            true
        );
        const order = { clientContacts: [{ name: 'Jan', phone: '600', email: '' }] };
        expect(sync(sb, order)).toEqual({
            clientContacts: [{ name: 'Jan', phone: '600', email: '' }]
        });
    });

    test('brak mostka ESM: obiekt nietknięty (nie zeruje baseline)', () => {
        const sb = loadCommon(
            (id: string) => (id === 'client-contacts' ? {} : null),
            () => [{ name: 'X', phone: '1', email: '' }],
            false
        );
        const order = { clientContacts: [{ name: 'Jan', phone: '600', email: '' }] };
        expect(sync(sb, order)).toEqual({
            clientContacts: [{ name: 'Jan', phone: '600', email: '' }]
        });
    });

    test('happy path: lista + split + mirror z formularza', () => {
        const sb = loadCommon(
            (id: string) =>
                id === 'client-contacts'
                    ? {}
                    : id === 'client-contact'
                      ? { value: 'Jan, 600' }
                      : null,
            () => [{ name: 'Jan', phone: '600', email: '' }],
            true
        );
        expect(sync(sb, {})).toEqual({
            clientContacts: [{ name: 'Jan', phone: '600', email: '' }],
            contactPerson: 'Jan',
            clientPhone: '600',
            clientEmail: '',
            clientContact: 'Jan, 600'
        });
    });

    test('brak inputu mirror: mirror wyprowadzony z listy', () => {
        const sb = loadCommon(
            (id: string) => (id === 'client-contacts' ? {} : null),
            () => [{ name: 'Jan', phone: '600', email: '' }],
            true
        );
        sb.window.ClientContacts.contactsToMirrorString = () => 'Jan, 600';
        const order: any = { clientContact: 'stare' };
        expect(sync(sb, order).clientContact).toBe('Jan, 600');
    });
});
