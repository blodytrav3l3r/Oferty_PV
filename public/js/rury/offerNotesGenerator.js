// @ts-check
/* ===== GENEROWANIE NOTATEK OFERTY (RURY) ===== */

function getRuryPEHDSummary() {
    const items = typeof getActiveItemsArray === 'function' ? getActiveItemsArray() : [];
    const pehd = new Set();
    items.forEach((item) => {
        if (item.pehdType === 'PEHD-3MM') pehd.add('PEHD 3mm');
        if (item.pehdType === 'PEHD-4MM') pehd.add('PEHD 4mm');
    });
    return pehd.size ? `Wkładka PEHD: ${Array.from(pehd).join(', ')}` : null;
}

function getRuryGasketSummary() {
    const items = typeof getActiveItemsArray === 'function' ? getActiveItemsArray() : [];
    const hasGaskets = items.some((item) => item.productId && item.productId.includes('Y-U-GZ-U'));
    return hasGaskets ? 'Uszczelki: gumowe' : null;
}

function generateOfferNotes(onlyIfEmpty = false) {
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

    const pehdSum = getRuryPEHDSummary();
    if (pehdSum) summaryParts.push(pehdSum);

    const gasketSum = getRuryGasketSummary();
    if (gasketSum) summaryParts.push(gasketSum);

    let generatedText = step1Notes ? step1Notes + '\n\n' : '';

    if (summaryParts.length > 0) {
        generatedText += 'Parametry techniczne: ' + summaryParts.join(', ') + '.';
    }

    if (generatedText) {
        generatedText += '\n';
    }
    generatedText += 'Cena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.';

    offerNotesField.value = generatedText.trim();
}

// Udostępnij globalnie (przycisk "Auto-generuj uwagi" oraz render zakładki oferty)
window.generateOfferNotes = generateOfferNotes;
