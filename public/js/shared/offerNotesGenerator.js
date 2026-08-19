// @ts-check
/* ===== GENEROWANIE NOTATEK OFERTY (WSPÓLNY RDZEŃ rury↔studnie) =====
   TASK-045 (PHASE-11): rdzeń budowy tekstu notatek wyciągnięty z
   rury/offerNotesGenerator.js i studnie/offerNotesGenerator.js.
   Różnice domenowe = lista summaryProviders dostarczana przez moduł. */

function createOfferNotesGenerator(summaryProviders) {
    return function generateOfferNotes(onlyIfEmpty = false) {
        const offerNotesField = document.getElementById('offer-tab-notes');
        if (!offerNotesField) return;

        if (onlyIfEmpty && offerNotesField.value.trim() !== '') {
            return;
        }

        let step1Notes = document.getElementById('offer-notes')?.value || '';
        const paramIndex = step1Notes.indexOf('Parametry techniczne:');
        if (paramIndex !== -1) {
            step1Notes = step1Notes.substring(0, paramIndex).trim();
        }
        const transportIndex = step1Notes.indexOf('Cena franco budowa bez rozładunku');
        if (transportIndex !== -1) {
            step1Notes = step1Notes.substring(0, transportIndex).trim();
        }

        const summaryParts = [];

        summaryProviders.forEach((provider) => {
            const part = provider();
            if (part) summaryParts.push(part);
        });

        let generatedText = step1Notes ? step1Notes + '\n\n' : '';

        if (summaryParts.length > 0) {
            generatedText += 'Parametry techniczne: ' + summaryParts.join(', ') + '.';
        }

        if (generatedText) {
            generatedText += '\n';
        }
        generatedText += 'Cena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.';

        offerNotesField.value = generatedText.trim();
    };
}

window.createOfferNotesGenerator = createOfferNotesGenerator;
