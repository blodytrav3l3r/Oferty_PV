const fs = require('fs');

let content = fs.readFileSync('public/js/studnie/orderManager.js', 'utf-8');

// 1. collectKartaBudowyDataStep4 updates
const collectRegex1 = /const offerInput = document\.getElementById\('step4-offer-nr-input'\)\?\.value \|\| '';/;
const collectInject1 = `const offerInput = document.getElementById('step4-offer-nr-input')?.value || '';
    const przejsciaUwagiOg = (document.getElementById('step4-przejscia-uwagi-ogolne')?.value || '').trim();
    const przejsciaCeny = (document.getElementById('step4-przejscia-ceny')?.value || '').trim();
    const przejsciaRabat = (document.getElementById('step4-przejscia-rabat')?.value || '').trim();`;

content = content.replace(collectRegex1, collectInject1);

const collectRegex2 = /przejsciaDetails: collectPrzejsciaDetailsFromTable\(\),/;
const collectInject2 = `przejsciaDetails: collectPrzejsciaDetailsFromTable(),
        przejsciaUwagi: przejsciaUwagiOg,
        przejsciaCeny: przejsciaCeny,
        przejsciaRabat: przejsciaRabat,`;

content = content.replace(collectRegex2, collectInject2);


// 2. initKartaBudowyStep4 updates
const initRegex = /renderPrzejsciaDetailsTable\(existingData \? existingData\.przejsciaDetails : null\);/;
const initInject = `renderPrzejsciaDetailsTable(existingData ? existingData.przejsciaDetails : null);

    const przejsciaUwagiEl = document.getElementById('step4-przejscia-uwagi-ogolne');
    const przejsciaCenyEl = document.getElementById('step4-przejscia-ceny');
    const przejsciaRabatEl = document.getElementById('step4-przejscia-rabat');
    
    if (existingData) {
        if (przejsciaUwagiEl) przejsciaUwagiEl.value = existingData.przejsciaUwagi ?? '';
        if (przejsciaCenyEl) przejsciaCenyEl.value = existingData.przejsciaCeny ?? '';
        if (przejsciaRabatEl && existingData.przejsciaRabat !== undefined) {
            przejsciaRabatEl.value = existingData.przejsciaRabat ?? '';
        }
    }
    
    // Automatycznie przepisz rabat z dennic wybranych studni, jeśli pole jest jeszcze puste
    if (przejsciaRabatEl && (!existingData || existingData.przejsciaRabat === undefined || existingData.przejsciaRabat === '')) {
        let maxRabat = 0;
        const selectedWells = window.currentOfferStudnie ? window.currentOfferStudnie.filter(w => w.selectedForOrder) : [];
        if (selectedWells.length > 0 && typeof wellDiscounts !== 'undefined') {
            selectedWells.forEach(w => {
                const discountKey = w.dn === 'styczna' ? 'styczne' : w.dn;
                if (wellDiscounts[discountKey] && wellDiscounts[discountKey].dennica) {
                    const r = parseFloat(wellDiscounts[discountKey].dennica);
                    if (r > maxRabat) maxRabat = r;
                }
            });
            przejsciaRabatEl.value = maxRabat;
        }
    }`;

content = content.replace(initRegex, initInject);

fs.writeFileSync('public/js/studnie/orderManager.js', content);
console.log('Done');
