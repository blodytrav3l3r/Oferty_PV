// @ts-check
/* === Helpery oferty rur === */

function generateOfferNumber() {
    const year = Number(
        new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Warsaw' }).format(
            new Date()
        )
    );
    const organizationUnitInput = document.getElementById('offer-organization-unit');
    if (organizationUnitInput && !organizationUnitInput.value) {
        organizationUnitInput.value =
            window.currentUser?.defaultOrganizationUnit || 'ASM_KLUCZBORK';
    }
    const organizationUnit =
        organizationUnitInput?.value || window.currentUser?.defaultOrganizationUnit;
    const currentOffers = typeof offers !== 'undefined' && Array.isArray(offers) ? offers : [];
    return window.getNextOfferNumber({
        prefix: 'OF',
        offers: currentOffers,
        organizationUnit,
        year
    });
}
window.generateOfferNumber = generateOfferNumber;

function buildRuryColgroup(extraCols = 0) {
    const base = [
        '36px',
        '36px',
        '',
        '100px',
        '140px',
        '140px',
        '80px',
        '120px',
        '120px',
        '130px',
        '120px',
        '140px',
        '',
        '130px'
    ];
    const extra = [];
    for (let i = 0; i < extraCols; i++) extra.push('120px');
    return [...base, ...extra].map((w) => `<col style="width:${w}">`).join('');
}
window.buildRuryColgroup = buildRuryColgroup;
