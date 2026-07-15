// @ts-check

/* ===== MODAL RABATÓW OFERTY ===== */
let initialOfferDiscountsSnapshot = null;

function openOfferDiscountsPopup() {
    initialOfferDiscountsSnapshot = structuredClone(window.wellDiscounts || {});
    const modal = document.getElementById('offer-discounts-modal');
    if (!modal) return;
    renderOfferDiscountsPopupContent();
    modal.style.display = 'flex';
}

function closeOfferDiscountsPopup() {
    const modal = document.getElementById('offer-discounts-modal');
    if (modal) modal.style.display = 'none';
}

async function handleOfferDiscountsSave() {
    const shouldSave = await window.appConfirm(
        '<div style="font-size: 0.9rem; line-height: 1.4; padding: 0.5rem 0;">Czy na pewno chcesz zapisać zmienione rabaty na stałe do bazy?</div>',
        {
            title: '<div style="font-size: 1.1rem; font-weight: 800; text-transform: none; letter-spacing: normal;">Zapisz nową konfigurację cenową</div>',
            type: 'info',
            allowHtml: true,
            okText: '<i data-lucide="save"></i> Zapisz ofertę',
            cancelText: 'Anuluj'
        }
    );

    if (shouldSave) {
        closeOfferDiscountsPopup();
        if (typeof window.saveOfferStudnie === 'function') {
            await window.saveOfferStudnie();
            if (typeof window.renderSavedOffersStudnie === 'function')
                window.renderSavedOffersStudnie();
        } else {
            showToast('Zapis i odświeżanie niedostępne w tej konotacji.', 'error');
        }
    }
}

async function handleOfferDiscountsCancel() {
    const currentSnapshot = JSON.stringify(window.wellDiscounts || {});
    const initialSnapshot = JSON.stringify(initialOfferDiscountsSnapshot || {});

    if (currentSnapshot !== initialSnapshot) {
        const confirmExit = await window.appConfirm(
            '<div style="font-size: 0.9rem; line-height: 1.4; padding: 1rem 0;">Zmieniono rabaty. Czy na pewno wyjść z okna?<br><span style="color: var(--danger); font-size: 0.7rem;">Wszystkie wpisane zmiany znikną po odrzuceniu.</span></div>',
            {
                title: '<div style="font-size: 1.1rem; font-weight: 800; text-transform: none; letter-spacing: normal;">Niezapisane zmiany rabatów</div>',
                type: 'warning',
                allowHtml: true,
                okText: '<i data-lucide="x-circle"></i> Tak, odrzuć zmiany',
                cancelText: 'Nie, wracam do edycji'
            }
        );

        if (!confirmExit) return;

        // Rollback state
        window.wellDiscounts = JSON.parse(initialSnapshot);

        const diameters = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
        diameters.forEach((dn) => {
            const disc = window.wellDiscounts[dn] || {
                dennica: 0,
                nadbudowa: 0,
                preco: 0,
                pehd: 0
            };
            if (typeof window.applyDiscount === 'function') {
                window.applyDiscount(dn, 'dennica', disc.dennica);
                window.applyDiscount(dn, 'nadbudowa', disc.nadbudowa);
                window.applyDiscount(dn, 'preco', disc.preco || 0);
                window.applyDiscount(dn, 'pehd', disc.pehd || 0);
            }
        });

        if (typeof renderDiscountPanel === 'function') renderDiscountPanel();
        if (typeof updateSummary === 'function') updateSummary();
        if (typeof renderOfferSummary === 'function') renderOfferSummary();
    }

    closeOfferDiscountsPopup();
}

function handleOfferDiscountChange(dn, type, value) {
    if (typeof applyDiscount === 'function') {
        applyDiscount(dn, type, value);
    } else {
        if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
        wellDiscounts[dn][type] = parseFloat(value) || 0;
        if (typeof renderDiscountPanel === 'function') renderDiscountPanel();
        if (typeof updateSummary === 'function') updateSummary();
    }

    updateOfferDiscountsPopupPrices();

    if (typeof renderOfferSummary === 'function') {
        renderOfferSummary();
    }
}

function updateOfferDiscountsPopupPrices() {
    const diameters = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
    let totalOverallNetto = 0;

    let globalWeightForTransport = 0;
    wells.forEach((w) => (globalWeightForTransport += calcWellStats(w).weight));
    const transportKmVal = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate')?.value) || 0;
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0) {
        const totalTransportsCount =
            typeof calcTransportCount === 'function'
                ? calcTransportCount(globalWeightForTransport, currentTransportMode)
                : Math.ceil(globalWeightForTransport / MAX_TRANSPORT_WEIGHT);
        const costPerTrip = transportKmVal * transportRateVal;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    diameters.forEach((dn) => {
        let sumNettoDN = 0;
        wells
            .filter((w) =>
                dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
            )
            .forEach((w) => {
                const stats = calcWellStats(w);
                let transportCost = 0;
                if (globalWeightForTransport > 0) {
                    transportCost =
                        totalTransportCostForOffer * (stats.weight / globalWeightForTransport);
                }
                sumNettoDN += stats.price + transportCost;
            });

        const el = document.getElementById(`offer-dn-price-${dn}`);
        if (el) {
            el.innerHTML = `${typeof fmt === 'function' ? escapeHtml(fmt(sumNettoDN)) : escapeHtml(sumNettoDN)} PLN`;
        }
        totalOverallNetto += sumNettoDN;
    });

    const sumEl = document.getElementById('offer-total-popup-price');
    if (sumEl) {
        sumEl.innerHTML = `${typeof fmt === 'function' ? escapeHtml(fmt(totalOverallNetto)) : escapeHtml(totalOverallNetto)} PLN`;
    }
}

function renderOfferDiscountsPopupContent() {
    const body = document.getElementById('offer-discounts-modal-body');
    if (!body) return;

    const diameters = ['1000', '1200', '1500', '2000', '2500', 'styczne'];

    let html = `
    <style>
        input.offer-discount-input::-webkit-outer-spin-button,
        input.offer-discount-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        input.offer-discount-input[type=number] {
            -moz-appearance: textfield;
        }
    </style>
    <p style="color: var(--text-muted); margin: 0 0 0.5rem 0; font-size: 0.72rem; line-height: 1.4;">Ustaw procentowe rabaty dla poszczególnych średnic. Zmiany widoczne na żywo.</p>
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">`;

    let totalOverallNetto = 0;

    let globalWeightForTransport = 0;
    wells.forEach((w) => (globalWeightForTransport += calcWellStats(w).weight));
    const transportKmVal = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate')?.value) || 0;
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0) {
        const totalTransportsCount =
            typeof calcTransportCount === 'function'
                ? calcTransportCount(globalWeightForTransport, currentTransportMode)
                : Math.ceil(globalWeightForTransport / MAX_TRANSPORT_WEIGHT);
        const costPerTrip = transportKmVal * transportRateVal;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    const buildInputBlock = (dn, label, type, value, accentColor, borderColor) => `
        <div style="display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 100px;">
            <span style="font-size: 0.5rem; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">${label}</span>
            <div style="display: flex; align-items: center; justify-content: center; height: 30px; border-radius: 8px; border: 1px solid ${borderColor}; background: rgba(0,0,0,0.3); overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s;" onfocusin="this.style.borderColor='${accentColor}'; this.style.boxShadow='0 0 10px ${borderColor}'" onfocusout="this.style.borderColor='${borderColor}'; this.style.boxShadow='none'">
                <input type="number" class="text-center offer-discount-input" 
                       value="${value}" 
                       onfocus="this.dataset.oldValue=this.value; this.value='';"
                       onblur="if(this.value===''){this.value=this.dataset.oldValue;}else{handleOfferDiscountChange('${dn}', '${type}', this.value);}"
                       onkeydown="if(event.key==='Enter') this.blur();"
                       style="min-width:0; flex:1; font-size: 0.9rem; font-weight: 900; color: ${accentColor}; background: transparent; border: none; outline: none; box-shadow: none; text-align: center;">
                <span style="font-size: 0.7rem; font-weight: 800; color: ${borderColor}; padding-right: 0.4rem; pointer-events: none;">%</span>
            </div>
        </div>`;

    diameters.forEach((dn) => {
        let sumNettoDN = 0;
        wells
            .filter((w) =>
                dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
            )
            .forEach((w) => {
                const stats = calcWellStats(w);
                let transportCost = 0;
                if (globalWeightForTransport > 0) {
                    transportCost =
                        totalTransportCostForOffer * (stats.weight / globalWeightForTransport);
                }
                sumNettoDN += stats.price + transportCost;
            });

        if (sumNettoDN === 0) return;

        totalOverallNetto += sumNettoDN;

        const disc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
        const displayDn = dn === 'styczne' ? 'Styczne' : `DN${dn}`;
        const hasPrecoInGroup = wells
            .filter((w) =>
                dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
            )
            .some((w) => w.kineta === 'preco' || w.kineta === 'precotop');

        html += `
        <div style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 0.45rem 0.7rem; transition: border-color 0.2s;" onmouseenter="this.style.borderColor='rgba(var(--accent-rgb),0.2)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.06)'">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px rgba(var(--accent-rgb),0.4);"></span>
                    <span style="font-weight: 800; font-size: 0.8rem; color: var(--text-primary);">${displayDn}</span>
                </div>
                <div id="offer-dn-price-${dn}" style="color: var(--success); font-weight: 800; font-size: 0.8rem;">${typeof fmt === 'function' ? fmt(sumNettoDN) : sumNettoDN} PLN</div>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${buildInputBlock(dn, 'Dennica / Kineta', 'dennica', disc.dennica, 'var(--accent-hover)', 'rgba(var(--accent-rgb),0.3)')}
                ${buildInputBlock(dn, 'Nadbudowa', 'nadbudowa', disc.nadbudowa, 'var(--accent-hover)', 'rgba(var(--accent-rgb),0.3)')}
                ${hasPrecoInGroup ? buildInputBlock(dn, 'Wkładka PRECO', 'preco', disc.preco || 0, 'var(--danger-hover)', 'rgba(var(--danger-rgb),0.3)') : ''}
            </div>
        </div>`;
    });

    html += '</div>';

    // Sekcja kosztu wkładki PEHD (globalna)
    const anyPehd = wells.some(
        (w) =>
            (w.wkladkaDennica && w.wkladkaDennica !== 'brak') ||
            (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') ||
            (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak')
    );
    if (anyPehd) {
        let currentPehdPrice = 0;
        for (const p of studnieProducts) {
            if (
                p.area > 0 &&
                p.doplataPEHD > 0 &&
                p.componentType !== 'przejscie' &&
                p.componentType !== 'kineta'
            ) {
                currentPehdPrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                break;
            }
        }

        const pehdDiscountValue = wells[0] && wells[0].pehdDiscount ? wells[0].pehdDiscount : 0;
        const currentPehdPriceAfter = currentPehdPrice * (1 - pehdDiscountValue / 100);

        html += `
        <div style="margin-top: 0.5rem; background: rgba(14,165,233,0.06); border: 1px solid rgba(14,165,233,0.15); border-radius: 10px; padding: 0.55rem 0.7rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #0ea5e9; box-shadow: 0 0 6px rgba(14,165,233,0.4);"></span>
                    <span style="font-weight: 800; font-size: 0.8rem; color: #38bdf8;">Wkładka PEHD <span style="font-size:0.65rem; font-weight:600; opacity:0.8; margin-left:0.3rem;">(Bazowa cena: ${currentPehdPrice} PLN/m²)</span></span>
                </div>
                <div style="color: #38bdf8; font-weight: 800; font-size: 0.8rem;"><span id="offer-pehd-price-after-discount">${currentPehdPriceAfter.toFixed(2)}</span> PLN / m²</div>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <div style="flex:1; min-width:120px;">
                    <div style="font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0ea5e9; margin-bottom: 0.15rem;">Globalny Rabat na Wkładkę</div>
                    <div style="display: flex; align-items: center; background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.25); border-radius: 7px; padding: 0 0; overflow:hidden;">
                        <input type="number" min="0" step="1" value="${pehdDiscountValue}"
                            id="offer-pehd-discount"
                            class="text-center offer-discount-input"
                            onclick="this.select()"
                            oninput="handleOfferPehdDiscountChange(this.value)"
                            onkeydown="if(event.key==='Enter') this.blur();"
                            style="min-width:0; flex:1; font-size: 0.9rem; font-weight: 900; color: #38bdf8; background: transparent; border: none; outline: none; text-align: center;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: rgba(14,165,233,0.5); padding-right: 0.4rem;">%</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // Sekcja kosztów malowania (globalna)
    const anyMalW = wells.some((w) => w.malowanieW && w.malowanieW !== 'brak');
    const anyMalZ = wells.some((w) => w.malowanieZ && w.malowanieZ !== 'brak');

    if (anyMalW || anyMalZ) {
        const refW = wells[0] || {};
        const malWC = refW.malowanieWewCena || '';
        const malZC = refW.malowanieZewCena || '';

        html += `
        <div style="margin-top: 0.5rem; background: rgba(168,85,247,0.06); border: 1px solid rgba(168,85,247,0.15); border-radius: 10px; padding: 0.55rem 0.7rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #a855f7; box-shadow: 0 0 6px rgba(168,85,247,0.4);"></span>
                    <span style="font-weight: 800; font-size: 0.8rem; color: #c084fc;">Koszt malowania</span>
                </div>
                <span style="font-size: 0.6rem; color: var(--text-muted);">PLN / m²</span>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">`;

        if (anyMalW) {
            html += `
                <div style="flex:1; min-width:120px;">
                    <div style="font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #a855f7; margin-bottom: 0.15rem;">Wewnętrzne</div>
                    <div style="display: flex; align-items: center; background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.25); border-radius: 7px; padding: 0 0; overflow:hidden;">
                        <input type="number" min="0" step="0.01" value="${malWC}"
                            id="offer-mal-wew-cena"
                            class="text-center offer-discount-input"
                            onclick="this.select()"
                            oninput="handleOfferPaintingCostChange('malowanieWewCena', this.value)"
                            onkeydown="if(event.key==='Enter') this.blur();"
                            style="min-width:0; flex:1; font-size: 0.9rem; font-weight: 900; color: #c084fc; background: transparent; border: none; outline: none; text-align: center;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: rgba(168,85,247,0.5); padding-right: 0.4rem;">zł</span>
                    </div>
                </div>`;
        }

        if (anyMalZ) {
            html += `
                <div style="flex:1; min-width:120px;">
                    <div style="font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #a855f7; margin-bottom: 0.15rem;">Zewnętrzne</div>
                    <div style="display: flex; align-items: center; background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.25); border-radius: 7px; padding: 0 0; overflow:hidden;">
                        <input type="number" min="0" step="0.01" value="${malZC}"
                            id="offer-mal-zew-cena"
                            class="text-center offer-discount-input"
                            onclick="this.select()"
                            oninput="handleOfferPaintingCostChange('malowanieZewCena', this.value)"
                            onkeydown="if(event.key==='Enter') this.blur();"
                            style="min-width:0; flex:1; font-size: 0.9rem; font-weight: 900; color: #c084fc; background: transparent; border: none; outline: none; text-align: center;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: rgba(168,85,247,0.5); padding-right: 0.4rem;">zł</span>
                    </div>
                </div>`;
        }

        html += `</div>
        </div>`;
    }

    if (totalOverallNetto > 0) {
        html += `
        <div style="margin-top: 0.5rem; background: rgba(0,0,0,0.25); border: 1px dashed rgba(255,255,255,0.1); padding: 0.5rem 0.9rem; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Łączna Suma Netto</span>
            <span id="offer-total-popup-price" style="font-size: 1.05rem; font-weight: 900; color: var(--success);">${typeof fmt === 'function' ? fmt(totalOverallNetto) : totalOverallNetto} PLN</span>
        </div>`;
    } else {
        html +=
            '<div style="text-align:center; padding: 1.5rem; color: var(--text-muted); font-size: 0.75rem;">Koszyk oferty jest pusty. Dodaj studnie na etapie konfiguracji.</div>';
    }

    body.innerHTML = html;
}

window.handleOfferPaintingCostChange = function (field, value) {
    if (typeof updateGlobalPaintingCost === 'function') {
        updateGlobalPaintingCost(field, value);
    }
};

window.handleOfferPehdDiscountChange = function (value) {
    if (typeof updateGlobalPehdDiscount === 'function') {
        updateGlobalPehdDiscount(value);
    }
};

// Eksport dla UI HTML (studnie.html)
window.openOfferDiscountsPopup = openOfferDiscountsPopup;
window.closeOfferDiscountsPopup = closeOfferDiscountsPopup;
window.handleOfferDiscountChange = handleOfferDiscountChange;
window.handleOfferPaintingCostChange = handleOfferPaintingCostChange;
window.handleOfferPehdDiscountChange = handleOfferPehdDiscountChange;
window.handleOfferDiscountsSave = handleOfferDiscountsSave;
window.handleOfferDiscountsCancel = handleOfferDiscountsCancel;
