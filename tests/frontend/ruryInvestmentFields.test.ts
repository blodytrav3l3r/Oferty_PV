import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Rury: dane inwestycji', () => {
    test('formularz ma układ adresu, kraj i osobny kontakt na budowę', () => {
        const html = read('public/partials/shared/step1-client.html');

        for (const id of [
            'invest-name',
            'invest-postal-code',
            'invest-city',
            'invest-street',
            'invest-country',
            'invest-location-description',
            'invest-contacts'
        ]) {
            expect(html).toContain(`id="${id}"`);
        }
        expect(html).toContain('data-cc-add-label="Dodaj kontakt na budowę"');
        expect(html).toContain('<option value="PL">Polska</option>');
        expect(html).toContain('id="invest-address"');
        expect(html).toContain('id="invest-contractor"');
    });

    test('eksport oferty z zamówienia przekazuje lokalizację i kontakty do PDF oraz DOCX', () => {
        const route = read('src/routes/orders/ruryOrders.export.ts');
        const occurrences =
            route.match(/investLocationDescription:\s*String\(body\.investLocationDescription/g) ||
            [];

        expect(occurrences).toHaveLength(1);
        expect(route).toContain('investContacts: body.investContacts');
        expect(route).toContain('investLocationDescription: body.investLocationDescription');
    });

    test('edycja zamówienia hydratyzuje pola inwestycji tylko raz', () => {
        const source = read('public/js/rury/orderEditMode.js');

        expect(source).toContain(
            "setVal('invest-location-description', orderData.investLocationDescription || '');"
        );
        expect(source).toContain('renderInvestContactsList(orderData.investContacts || [], {');
        expect(source.match(/setVal\('invest-street'/g)).toHaveLength(1);
    });

    test('zapis edytowanego zamówienia zbiera pola lokalizacji z formularza', () => {
        const source = read('public/js/rury/orderCrud.js');
        const saveStart = source.indexOf('async function saveRuryOrder()');
        const saveEnd = source.indexOf('\nasync function ', saveStart + 1);
        const saveBody = source.slice(saveStart, saveEnd);

        expect(saveBody).toContain('getInvestLocationFields()');
        expect(saveBody).toContain('...(investmentFields || {})');
        expect(saveBody).toContain('ordersRury = ordersRury.map');
        expect(read('public/js/shared/offerCrudCommon.js')).toContain('investLocationDescription:');
        expect(read('public/js/shared/offerCrudCommon.js')).toContain(
            'investContacts: getInvestContactsList()'
        );
    });

    test('XLSX zachowuje lokalizację i kontakty przy eksporcie oraz imporcie', () => {
        const exportHelpers = read('public/js/rury/offerExportsHelpers.js');
        const importer = read('public/js/rury/offerExports.js');

        for (const field of [
            'investStreet',
            'investPostalCode',
            'investCity',
            'investCountry',
            'investLocationDescription'
        ]) {
            expect(exportHelpers).toContain(`['${field}'`);
            expect(importer).toContain(`${field}: meta.${field}`);
        }
        expect(exportHelpers).toContain('JSON.stringify(offer.investContacts || [])');
        expect(importer).toContain("JSON.parse(meta.investContacts || '[]')");
        expect(importer).toContain('investContacts,');

        const context = vm.createContext({ window: {} }) as vm.Context & {
            buildMetaRows: (offer: object) => unknown[][];
        };
        vm.runInContext(exportHelpers + '\nthis.buildMetaRows = buildOfferXlsxMetaRows;', context);
        const contacts = [{ name: 'Jan Kowalski', phone: '123456789', email: 'jan@example.com' }];
        const rows = context.buildMetaRows({
            id: 'offer-1',
            number: 'OF-1',
            date: '2026-11-07',
            investStreet: 'ul. Długa 1',
            investPostalCode: '00-001',
            investCity: 'Warszawa',
            investCountry: 'PL',
            investLocationDescription: 'Wjazd od północy',
            investContacts: contacts,
            items: []
        });
        const meta = Object.fromEntries(rows.slice(1));

        expect(meta.investStreet).toBe('ul. Długa 1');
        expect(meta.investPostalCode).toBe('00-001');
        expect(meta.investCity).toBe('Warszawa');
        expect(meta.investCountry).toBe('PL');
        expect(meta.investLocationDescription).toBe('Wjazd od północy');
        expect(JSON.parse(String(meta.investContacts))).toEqual(contacts);
    });
});
