// @ts-nocheck -- DOMParser is provided by the frontend Jest environment.
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const readPublic = (relativePath: string) =>
    fs.readFileSync(path.join(ROOT, 'public', relativePath), 'utf8');

describe('wspólny krok Dane klienta i oferty', () => {
    test.each(['rury.html', 'studnie.html'])('%s ładuje kanoniczny partial kroku 1', (page) => {
        expect(readPublic(page)).toContain('data-partial="partials/shared/step1-client.html"');
    });

    test('wspólny formularz zachowuje pola i nie dodaje stylów inline', () => {
        const partial = readPublic('partials/shared/step1-client.html');
        const document = new DOMParser().parseFromString(partial, 'text/html');

        [
            'offer-form-title',
            'client-number',
            'client-name',
            'client-nip',
            'client-address',
            'client-contacts',
            'client-contact',
            'invest-name',
            'invest-postal-code',
            'invest-city',
            'invest-street',
            'invest-country',
            'invest-location-description',
            'invest-contacts',
            'invest-contact',
            'offer-number',
            'offer-date',
            'transport-km',
            'transport-rate',
            'offer-notes',
            'offer-payment-terms',
            'offer-validity',
            'wizard-next-step1'
        ].forEach((id) => expect(document.getElementById(id)).not.toBeNull());

        expect(document.querySelectorAll('[style]')).toHaveLength(0);
        expect(
            document.querySelector('#wizard-next-step1')?.getAttribute('data-wizard-action')
        ).toBe('next');
        expect(document.querySelector('[data-csp="onRuryTransportFormChange"]')).toBeNull();
    });

    test('przycisk Dalej zachowuje osobną nawigację każdego modułu', () => {
        const ruryWizard = readPublic('js/rury/wizard.js');
        const studnieWizard = readPublic('js/studnie/uiHelpers.js');

        expect(ruryWizard).toContain("step1NextButton.addEventListener('click', phaseNext)");
        expect(studnieWizard).toContain("step1NextButton.addEventListener('click', wizardNext)");
    });

    test('siatki formularza składają się na wąskich ekranach', () => {
        const styles = readPublic('css/style.cards.css');

        expect(styles).toContain('@media (max-width: 900px)');
        expect(styles).toContain('@media (max-width: 600px)');
        expect(styles).toContain('.wizard-step-client .wizard-client-grid--four');
        expect(styles).toContain('.wizard-step-client .wizard-client-grid--payment');
    });
});
