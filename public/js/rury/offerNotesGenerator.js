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

// Rdzeń wspólny w shared/offerNotesGenerator.js (TASK-045)
window.generateOfferNotes = createOfferNotesGenerator([getRuryPEHDSummary, getRuryGasketSummary]);
