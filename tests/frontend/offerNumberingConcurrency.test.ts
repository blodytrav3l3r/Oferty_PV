import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const readPublic = (file: string) => fs.readFileSync(path.join(ROOT, 'public', file), 'utf8');

describe('serwerowy przydział numeru przy tworzeniu oferty', () => {
    test('Rury proszą serwer o numer dla każdej nowej oferty', () => {
        const source = readPublic('js/rury/offerCrud.js');

        expect(source).toMatch(/generateOfferNumber:\s*!editingOfferId\s*,?/);
    });

    test('Studnie proszą serwer o numer dla każdej nowej oferty', () => {
        const source = readPublic('js/studnie/offerSave.js');

        expect(source).toMatch(/generateOfferNumber:\s*!editingOfferIdStudnie\s*,?/);
    });

    test('orchestrator Studni oznacza oba podglądy jako automatyczne', () => {
        const source = readPublic('js/appStudnie.js');
        const assignments = source.match(
            /nrEl\.value = generateOfferNumberStudnie\(\);\s*nrEl\.dataset\.numberGenerated = 'true';/g
        );

        expect(assignments).toHaveLength(2);
    });

    test('numer w formularzu jest tylko do odczytu', () => {
        const template = readPublic('partials/shared/step1-client.html');

        expect(template).toMatch(/<input(?=[^>]*id="offer-number")(?=[^>]*readonly)[^>]*>/);
    });

    test('po zapisie synchronizuje numer serwera z nagłówkiem oferty', () => {
        const source = readPublic('js/studnie/offerSave.js');

        expect(source).toMatch(
            /numberInput\.value = result\.number;[\s\S]{0,160}syncOfferClientSummary\(\);/
        );
    });
});
