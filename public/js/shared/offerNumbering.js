// @ts-check

const OFFER_UNIT_CODES = Object.freeze({
    ASM_KLUCZBORK: 'ASM',
    WL_WLOCLAWEK: 'WL'
});

/** @param {OfferNumberOptions} options */
function getNextOfferNumber(options) {
    const unitCode = OFFER_UNIT_CODES[options.organizationUnit || 'ASM_KLUCZBORK'] || 'ASM';
    const numberPattern = new RegExp(`^${options.prefix}/(\\d+)/${unitCode}/${options.year}$`);
    const highestNumber = options.offers.reduce((highest, offer) => {
        const number = offer?.offer_number || offer?.number || '';
        const match = number.match(numberPattern);
        return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);

    return `${options.prefix}/${String(highestNumber + 1).padStart(6, '0')}/${unitCode}/${options.year}`;
}

window.getNextOfferNumber = getNextOfferNumber;

document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.id === 'offer-number')
        event.target.dataset.numberGenerated = 'false';
});
document.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    if (event.target.id !== 'offer-organization-unit') return;
    const numberInput = document.getElementById('offer-number');
    if (numberInput?.dataset.numberGenerated !== 'true') return;
    const generator = window.generateOfferNumber || window.generateOfferNumberStudnie;
    if (typeof generator !== 'function') return;
    numberInput.value = generator();
    numberInput.dataset.numberGenerated = 'true';
});
