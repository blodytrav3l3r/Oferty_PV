const fs = require('fs');

// 1. UPDATE HTML
let html = fs.readFileSync('public/studnie.html', 'utf-8');

const htmlToRemove = `<div style="display: flex; gap: 1rem; margin-top: 1rem;">
                                                <div style="flex: 2;">
                                                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.3px;">Uwagi</label>
                                                    <input type="text" id="step4-przejscia-uwagi-ogolne" class="form-input" style="width:100%; font-size:0.85rem; padding:0.6rem 0.8rem;" placeholder="Wpisz uwagi ogólne do przejść..." />
                                                </div>
                                                <div style="flex: 1; min-width: 120px;">
                                                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.3px;">Ceny materiałów (PLN)</label>
                                                    <input type="number" id="step4-przejscia-ceny" class="form-input" style="width:100%; font-size:0.85rem; padding:0.6rem 0.8rem;" placeholder="Cena..." step="0.01" />
                                                </div>
                                                <div style="flex: 1; min-width: 120px;">
                                                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.3px;">Rabat (%)</label>
                                                    <input type="number" id="step4-przejscia-rabat" class="form-input" style="width:100%; font-size:0.85rem; padding:0.6rem 0.8rem;" placeholder="Rabat..." step="0.1" />
                                                </div>
                                            </div>`;

html = html.replace(htmlToRemove, '');

const insertHtml = `                                    </div>

                                    <!-- Wiersz 11: Uwagi ogólne -->
                                    <div style="padding: 0.6rem 1.2rem;">
                                        <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:0.3px;">
                                            Uwagi
                                        </label>
                                        <textarea id="step4-uwagi-ogolne" class="form-input" style="width: 100%; min-height: 80px; font-size: 0.85rem; padding: 0.6rem 0.8rem; resize: vertical;" placeholder="Wpisz uwagi..."></textarea>
                                    </div>`;

html = html.replace(/                                    <\/div>\r?\n\r?\n                                <div class="wizard-nav"/, insertHtml + '\n\n                                <div class="wizard-nav"');

fs.writeFileSync('public/studnie.html', html);


// 2. UPDATE JS
let js = fs.readFileSync('public/js/studnie/orderManager.js', 'utf-8');

// collectKartaBudowyDataStep4 updates
const jsToRemove1 = `    const przejsciaUwagiOg = (document.getElementById('step4-przejscia-uwagi-ogolne')?.value || '').trim();
    const przejsciaCeny = (document.getElementById('step4-przejscia-ceny')?.value || '').trim();
    const przejsciaRabat = (document.getElementById('step4-przejscia-rabat')?.value || '').trim();`;

js = js.replace(jsToRemove1, `    const uwagiOgolne = (document.getElementById('step4-uwagi-ogolne')?.value || '').trim();`);

const jsToRemove2 = `przejsciaUwagi: przejsciaUwagiOg,
        przejsciaCeny: przejsciaCeny,
        przejsciaRabat: przejsciaRabat,`;

js = js.replace(jsToRemove2, `uwagiOgolne: uwagiOgolne,`);


// initKartaBudowyStep4 updates
const initToRemove = `    const przejsciaUwagiEl = document.getElementById('step4-przejscia-uwagi-ogolne');
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

const initToAdd = `    const uwagiEl = document.getElementById('step4-uwagi-ogolne');
    
    if (existingData) {
        if (uwagiEl) uwagiEl.value = existingData.uwagiOgolne || '';
    }
    
    if (uwagiEl && (!existingData || !existingData.uwagiOgolne)) {
        let discounts = [];
        const selectedWells = window.currentOfferStudnie ? window.currentOfferStudnie.filter(w => w.selectedForOrder) : [];
        if (selectedWells.length > 0 && typeof wellDiscounts !== 'undefined') {
            selectedWells.forEach(w => {
                const discountKey = w.dn === 'styczna' ? 'styczne' : w.dn;
                if (wellDiscounts[discountKey]) {
                    const r = parseFloat(wellDiscounts[discountKey].dennica || 0);
                    if (r > 0) discounts.push(r);
                }
            });
            const uniqueDiscounts = [...new Set(discounts)];
            if (uniqueDiscounts.length > 0) {
                uwagiEl.value = \`Rabat na materiały wg zestawienia do oferty wyniósł \${uniqueDiscounts.join('%, ')}%\`;
            }
        }
    }`;

js = js.replace(initToRemove, initToAdd);

fs.writeFileSync('public/js/studnie/orderManager.js', js);
console.log('Update Complete');
