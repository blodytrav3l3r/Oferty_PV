// @ts-check
/* === Helpery oferty rur === */

function generateOfferNumber() {
    const d = new Date();
    const year = d.getFullYear();
    let symbol = 'XX';
    if (typeof currentUser !== 'undefined' && currentUser) {
        if (currentUser.symbol) {
            symbol = currentUser.symbol;
        } else if (currentUser.firstName && currentUser.lastName) {
            symbol = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
        } else if (currentUser.username) {
            symbol = currentUser.username.substring(0, 2).toUpperCase();
        }
    }

    const count = typeof offers !== 'undefined' ? offers.length + 1 : 1;
    return `OF/${String(count).padStart(6, '0')}/${symbol}/${year}`;
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
        '120px',
        '120px',
        '130px',
        '120px',
        '160px',
        '',
        '160px'
    ];
    const extra = [];
    for (let i = 0; i < extraCols; i++) extra.push('120px');
    return [...base, ...extra].map((w) => `<col style="width:${w}">`).join('');
}
window.buildRuryColgroup = buildRuryColgroup;
