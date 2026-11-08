/**
 * @jest-environment jsdom
 */

// @ts-nocheck

import fs from 'fs';
import path from 'path';

const read = (file: string): string => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const entryDocuments = [
    'public/app.html',
    'public/index.html',
    'public/cennik.html',
    'public/kartoteka.html',
    'public/rury.html',
    'public/studnie.html',
    'public/zlecenia.html'
];

describe('polityka autouzupełniania przeglądarki', () => {
    beforeAll(() => {
        document.body.innerHTML = `
            <input id="company" autocomplete="organization" />
            <input id="address" autocomplete="street-address" />
            <textarea id="notes"></textarea>
            <select id="country" autocomplete="country"><option>Polska</option></select>
            <input id="username" autocomplete="username" />
            <input id="current-password" type="password" autocomplete="current-password" />
            <input id="new-password" type="password" autocomplete="new-password" />
            <input id="hidden" type="hidden" value="snapshot" />
            <input id="custom-list" list="clients-list" autocomplete="off" />
            <datalist id="clients-list"><option value="Klient S.O.K."></option></datalist>
        `;
        new Function(read('public/js/shared/browserAutofillPolicy.js'))();
    });

    test('wyłącza autofill danych, ale zachowuje credential hints i pola ukryte', () => {
        for (const id of ['company', 'address', 'notes', 'country', 'custom-list']) {
            expect(document.getElementById(id)?.getAttribute('autocomplete')).toBe('off');
        }

        expect(document.getElementById('username')?.getAttribute('autocomplete')).toBe('username');
        expect(document.getElementById('current-password')?.getAttribute('autocomplete')).toBe(
            'current-password'
        );
        expect(document.getElementById('new-password')?.getAttribute('autocomplete')).toBe(
            'new-password'
        );
        expect(document.getElementById('hidden')?.hasAttribute('autocomplete')).toBe(false);
        expect(document.getElementById('clients-list')).not.toBeNull();
    });

    test('obejmuje pola dodane dynamicznie', async () => {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <input id="dynamic-email" type="email" autocomplete="email" />
            <textarea id="dynamic-note"></textarea>
            <select id="dynamic-select"><option>Opcja</option></select>
        `;
        document.body.append(modal);
        await new Promise((resolve) => setTimeout(resolve, 0));

        for (const id of ['dynamic-email', 'dynamic-note', 'dynamic-select']) {
            expect(document.getElementById(id)?.getAttribute('autocomplete')).toBe('off');
        }
    });

    test.each(entryDocuments)('%s ładuje wspólną politykę także w swoim dokumencie', (file) => {
        const html = read(file);
        expect(html).toMatch(
            /<script\s+type="module"\s+src="js\/shared\/browserAutofillPolicy\.js\?v=\d+\.\d+\.\d+"><\/script>/
        );
    });

    test('formularze wspólne nie deklarują adresowych tokenów autofill', () => {
        const offer = read('public/partials/shared/step1-client.html');
        const buildCard = read('public/partials/shared/karta-build-card.html');

        expect(offer).not.toMatch(
            /autocomplete="(?:postal-code|address-level2|street-address|country)"/
        );
        expect(buildCard).not.toMatch(
            /autocomplete="(?:postal-code|address-level2|street-address|country)"/
        );
    });
});
