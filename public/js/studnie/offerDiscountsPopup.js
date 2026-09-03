// @ts-check

/* ===== MODAL RABATÓW OFERTY ===== */
let initialOfferDiscountsSnapshot = null;
let initialOfferWellsExtraSnapshot = null;
let _discountsCancelInProgress = false;
let _discountsDismissWired = false;

function _captureOfferWellsExtra() {
    return (typeof wells !== 'undefined' && Array.isArray(wells) ? wells : []).map((w) => ({
        id: w && w.id,
        pehdDiscount: (w && w.pehdDiscount) || 0,
        malowanieWewCena: (w && w.malowanieWewCena) || 0,
        malowanieZewCena: (w && w.malowanieZewCena) || 0,
        malowanieZewManual: !!(w && w.malowanieZewManual)
    }));
}

function _offerDiscountsDirty() {
    const currentSnapshot = JSON.stringify(window.wellDiscounts || {});
    const initialSnapshot = JSON.stringify(initialOfferDiscountsSnapshot || {});
    if (currentSnapshot !== initialSnapshot) return true;
    const currentExtra = JSON.stringify(_captureOfferWellsExtra());
    const initialExtra = JSON.stringify(initialOfferWellsExtraSnapshot || []);
    return currentExtra !== initialExtra;
}

function _wireOfferDiscountsDismiss() {
    if (!_discountsDismissWired) {
        _discountsDismissWired = true;
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const m = document.getElementById('offer-discounts-modal');
            if (m && m.classList.contains('active')) {
                handleOfferDiscountsCancel();
            }
        });
    }
    // Backdrop: znacznik na elemencie, bo partial modals.html może być przeładowany
    const modal = document.getElementById('offer-discounts-modal');
    if (modal && !modal.dataset.dismissWired) {
        modal.dataset.dismissWired = '1';
        modal.addEventListener('click', (e) => {
            if (e.target === modal && modal.classList.contains('active')) {
                handleOfferDiscountsCancel();
            }
        });
    }
}

function openOfferDiscountsPopup() {
    initialOfferDiscountsSnapshot = structuredClone(window.wellDiscounts || {});
    initialOfferWellsExtraSnapshot = _captureOfferWellsExtra();
    _wireOfferDiscountsDismiss();
    const modal = document.getElementById('offer-discounts-modal');
    if (!modal) return;
    renderOfferDiscountsPopupContent();
    modal.classList.add('active');
}

function closeOfferDiscountsPopup() {
    const modal = document.getElementById('offer-discounts-modal');
    if (modal) modal.classList.remove('active');
}

async function handleOfferDiscountsSave() {
    const shouldSave = await window.appConfirm(
        '<div style="font-size: var(--fs-xl); line-height: 1.4; padding: 0.5rem 0;">Czy na pewno chcesz zapisać zmienione rabaty na stałe do bazy?</div>',
        {
            title: '<div class="fs-3xl-eb">Zapisz nową konfigurację cenową</div>',
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
    if (_discountsCancelInProgress) return;
    const modal = document.getElementById('offer-discounts-modal');
    if (modal && !modal.classList.contains('active')) return;
    _discountsCancelInProgress = true;
    try {
        if (_offerDiscountsDirty()) {
            const confirmExit = await window.appConfirm(
                '<div class="fs-xl">Zmieniono rabaty. Czy na pewno wyjść z okna?<br><span style="color: var(--danger); font-size: var(--fs-sm);">Wszystkie wpisane zmiany znikną po odrzuceniu.</span></div>',
                {
                    title: '<div class="fs-3xl-eb">Niezapisane zmiany rabatów</div>',
                    type: 'warning',
                    allowHtml: true,
                    okText: '<i data-lucide="x-circle"></i> Tak, odrzuć zmiany',
                    cancelText: 'Nie, wracam do edycji'
                }
            );

            if (!confirmExit) return;

            // Rollback stanu: rabaty DN oraz pola studni mutowane na żywo (PEHD/malowanie)
            window.wellDiscounts = JSON.parse(JSON.stringify(initialOfferDiscountsSnapshot || {}));
            if (typeof wells !== 'undefined' && Array.isArray(wells)) {
                const byId = {};
                (initialOfferWellsExtraSnapshot || []).forEach((s) => {
                    if (s && s.id != null) byId[s.id] = s;
                });
                wells.forEach((w) => {
                    const s = w && byId[w.id];
                    if (!s) return;
                    w.pehdDiscount = s.pehdDiscount;
                    w.malowanieWewCena = s.malowanieWewCena;
                    w.malowanieZewCena = s.malowanieZewCena;
                    w.malowanieZewManual = s.malowanieZewManual;
                });
            }
            if (typeof orderEditMode !== 'undefined' && orderEditMode) {
                if (typeof freezeWellPrices === 'function') {
                    freezeWellPrices(wells);
                }
            }

            if (typeof renderDiscountPanel === 'function') renderDiscountPanel();
            if (typeof updateSummary === 'function') updateSummary();
            if (typeof renderOfferSummary === 'function') renderOfferSummary();
            if (typeof renderWellConfig === 'function') renderWellConfig();
        }

        closeOfferDiscountsPopup();
    } finally {
        _discountsCancelInProgress = false;
    }
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

        const displayDn = dn === 'styczne' ? 'Styczne' : `DN${dn}`;
        const dnCount = wells.filter((w) =>
            dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
        ).length;
        const dnAvgPrice = dnCount > 0 ? sumNettoDN / dnCount : 0;

        const countEl = document.getElementById(`offer-dn-count-${dn}`);
        if (countEl) {
            countEl.textContent = `${dnCount}× ${displayDn}`;
        }
        const avgEl = document.getElementById(`offer-dn-avg-${dn}`);
        if (avgEl) {
            avgEl.textContent = `śr. ${typeof fmt === 'function' ? fmt(Math.round(dnAvgPrice)) : Math.round(dnAvgPrice)} PLN`;
        }

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
    <p style="color: var(--text-muted); margin: 0 0 0.5rem 0; font-size: var(--fs-sm); line-height: 1.4;">Ustaw procentowe rabaty dla poszczególnych średnic. Zmiany widoczne na żywo.</p>
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
            <span style="font-size: var(--fs-3xs); font-weight: var(--fw-bold); color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.4px;">${label}</span>
            <div style="display: flex; align-items: center; justify-content: center; height: 30px; border-radius: var(--radius-sm); border: 1px solid ${borderColor}; background: rgba(var(--black-rgb), 0.3); overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s;" onfocusin="this.style.borderColor='${accentColor}'; this.style.boxShadow='0 0 10px ${borderColor}'" onfocusout="this.style.borderColor='${borderColor}'; this.style.boxShadow='none'">
                <input type="number" class="text-center offer-discount-input" 
                       value="${value}" 
                       onfocus="this.dataset.oldValue=this.value; this.value='';"
                       onblur="if(this.value===''){this.value=this.dataset.oldValue;}else{handleOfferDiscountChange('${dn}', '${type}', this.value);}"
                       onkeydown="if(event.key==='Enter') this.blur();"
                       style="min-width:0; flex:1; font-size: var(--fs-xl); font-weight: var(--fw-black); color: ${accentColor}; background: transparent; border: none; outline: none; box-shadow: none; text-align: center;">
                <span style="font-size: var(--fs-sm); font-weight: var(--fw-extrabold); color: ${borderColor}; padding-right: 0.4rem; pointer-events: none;">%</span>
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

        const dnWells = wells.filter((w) =>
            dn === 'styczne' ? w.type === 'styczna' || w.dn === 'styczna' : w.dn == dn
        );
        const dnCount = dnWells.length;
        const dnAvgPrice = dnCount > 0 ? sumNettoDN / dnCount : 0;

        if (sumNettoDN === 0) return;

        totalOverallNetto += sumNettoDN;

        const disc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
        const displayDn = dn === 'styczne' ? 'Styczne' : `DN${dn}`;
        const hasPrecoInGroup = dnWells.some(
            (w) => w.kineta === 'preco' || w.kineta === 'precotop'
        );
        const korpusClasses = [
            ...new Set(dnWells.map((w) => w.klasaNosnosci_korpus).filter((k) => k && k !== 'D400'))
        ];
        const zwienczenieClasses = [
            ...new Set(
                dnWells.map((w) => w.klasaNosnosci_zwienczenie).filter((k) => k && k !== 'D400')
            )
        ];

        const buildDiscountSection = (title, dotColor, textColor, inputsHtml) => `
            <div style="margin-top:0.45rem; padding-top:0.4rem; border-top:1px solid rgba(var(--white-rgb), 0.07);">
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${dotColor}; box-shadow:0 0 8px rgba(var(--black-rgb), 0.5);"></span>
                    <span style="font-size:var(--fs-2xs); font-weight:var(--fw-extrabold); text-transform:uppercase; letter-spacing:0.6px; color:${textColor};">${title}</span>
                </div>
                <div class="flex-gap-5-wrap">${inputsHtml}</div>
            </div>`;

        let sectionsHtml = buildDiscountSection(
            'Klasa D400',
            'var(--slate-400)',
            'var(--text-secondary)',
            buildInputBlock(
                dn,
                'Dennica / Kineta',
                'dennica',
                disc.dennica,
                'var(--text-secondary)',
                'rgba(var(--white-rgb), 0.18)'
            ) +
                buildInputBlock(
                    dn,
                    'Nadbudowa',
                    'nadbudowa',
                    disc.nadbudowa,
                    'var(--text-secondary)',
                    'rgba(var(--white-rgb), 0.18)'
                ) +
                (hasPrecoInGroup
                    ? buildInputBlock(
                          dn,
                          'Wkładka PRECO',
                          'preco',
                          disc.preco || 0,
                          'var(--danger-hover)',
                          'rgba(var(--danger-rgb), 0.35)'
                      )
                    : '')
        );

        const allClasses = [...new Set([...korpusClasses, ...zwienczenieClasses])].sort((a, b) =>
            a === b ? 0 : a === 'E600' ? -1 : 1
        );
        allClasses.forEach((cls) => {
            const isE600 = cls === 'E600';
            const color = isE600 ? 'var(--accent-hover)' : 'var(--warn-hover)';
            const border = isE600 ? 'rgba(var(--accent-rgb), 0.35)' : 'rgba(var(--warn-rgb), 0.35)';
            const dot = isE600 ? 'var(--accent)' : 'var(--warn)';
            sectionsHtml += buildDiscountSection(
                `Klasa ${cls}`,
                dot,
                color,
                buildInputBlock(
                    dn,
                    'Dennica / Kineta',
                    'dennica' + cls,
                    disc['dennica' + cls] || 0,
                    color,
                    border
                ) +
                    buildInputBlock(
                        dn,
                        'Nadbudowa',
                        'nadbudowa' + cls,
                        disc['nadbudowa' + cls] || 0,
                        color,
                        border
                    ) +
                    buildInputBlock(
                        dn,
                        'Zakończenie',
                        'zwienczenie' + cls,
                        disc['zwienczenie' + cls] || 0,
                        color,
                        border
                    )
            );
        });

        html += `
        <div style="background: rgba(var(--white-rgb), 0.05); border: 1px solid rgba(var(--white-rgb), 0.05); border-radius: var(--radius-sm); padding: 0.45rem 0.7rem; transition: border-color 0.2s;" onmouseenter="this.style.borderColor='rgba(var(--accent-rgb), 0.2)'" onmouseleave="this.style.borderColor='rgba(var(--white-rgb), 0.05)'">
            <div class="flex-space-between">
                <div class="flex-gap-35">
                    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px rgba(var(--accent-rgb), 0.5);"></span>
                    <span id="offer-dn-count-${dn}" style="font-weight: var(--fw-extrabold); font-size: var(--fs-md); color: var(--text-primary);">${escapeHtml(dnCount)}× ${escapeHtml(displayDn)}</span>
                    <span id="offer-dn-avg-${dn}" style="font-size: var(--fs-sm); color: var(--text-secondary); font-weight: var(--fw-bold); opacity: 0.85;">śr. ${typeof fmt === 'function' ? escapeHtml(fmt(Math.round(dnAvgPrice))) : escapeHtml(Math.round(dnAvgPrice))} PLN</span>
                </div>
                <div id="offer-dn-price-${dn}" style="color: var(--success); font-weight: var(--fw-extrabold); font-size: var(--fs-md);">${typeof fmt === 'function' ? fmt(sumNettoDN) : sumNettoDN} PLN</div>
            </div>
            ${sectionsHtml}
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
                p.componentType !== 'kineta' &&
                p.componentType !== 'konus'
            ) {
                currentPehdPrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                break;
            }
        }

        const pehdDiscountValue = wells[0] && wells[0].pehdDiscount ? wells[0].pehdDiscount : 0;
        const currentPehdPriceAfter = currentPehdPrice * (1 - pehdDiscountValue / 100);

        html += `
        <div style="margin-top: 0.5rem; background: rgba(var(--blue-alt-rgb), 0.05); border: 1px solid rgba(var(--blue-alt-rgb), 0.15); border-radius: var(--radius-sm); padding: 0.55rem 0.7rem;">
            <div class="flex-space-between">
                <div class="flex-gap-35">
                    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--blue-alt); box-shadow: 0 0 6px rgba(var(--blue-alt-rgb), 0.5);"></span>
                    <span style="font-weight: var(--fw-extrabold); font-size: var(--fs-md); color: var(--blue-alt);">Wkładka PEHD <span style="font-size: var(--fs-xs); font-weight: var(--fw-semibold); opacity:0.8; margin-left:0.3rem;">(Bazowa cena: ${currentPehdPrice} PLN/m²)</span></span>
                </div>
                <div style="color: var(--blue-alt); font-weight: var(--fw-extrabold); font-size: var(--fs-md);"><span id="offer-pehd-price-after-discount">${currentPehdPriceAfter.toFixed(2)}</span> PLN / m²</div>
            </div>
            <div class="flex-gap-5-wrap">
                <div class="flex-1-120">
                    <div style="font-size: var(--fs-3xs); font-weight: var(--fw-extrabold); text-transform: uppercase; letter-spacing: 0.5px; color: var(--blue-alt); margin-bottom: 0.15rem;">Globalny Rabat na Wkładkę</div>
                    <div style="display: flex; align-items: center; background: rgba(var(--blue-alt-rgb), 0.1); border: 1px solid rgba(var(--blue-alt-rgb), 0.3); border-radius: var(--radius-sm); padding: 0 0; overflow:hidden;">
                        <input type="number" min="0" step="1" value="${pehdDiscountValue}"
                            id="offer-pehd-discount"
                            class="text-center offer-discount-input"
                            onclick="this.select()"
                            oninput="handleOfferPehdDiscountChange(this.value)"
                            onkeydown="if(event.key==='Enter') this.blur();"
                            style="min-width:0; flex:1; font-size: var(--fs-xl); font-weight: var(--fw-black); color: var(--blue-alt); background: transparent; border: none; outline: none; text-align: center;">
                        <span style="font-size: var(--fs-sm); font-weight: var(--fw-extrabold); color: rgba(var(--blue-alt-rgb), 0.5); padding-right: 0.4rem;">%</span>
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
        <div style="margin-top: 0.5rem; background: rgba(var(--accent2-rgb), 0.05); border: 1px solid rgba(var(--accent2-rgb), 0.15); border-radius: var(--radius-sm); padding: 0.55rem 0.7rem;">
            <div class="flex-space-between">
                <div class="flex-gap-35">
                    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent2); box-shadow: 0 0 6px rgba(var(--accent2-rgb), 0.5);"></span>
                    <span style="font-weight: var(--fw-extrabold); font-size: var(--fs-md); color: var(--purple-alt);">Koszt malowania</span>
                </div>
                <span style="font-size: var(--fs-2xs); color: var(--text-muted);">PLN / m²</span>
            </div>
            <div class="flex-gap-5-wrap">`;

        if (anyMalW) {
            html += `
                <div class="flex-1-120">
                    <div style="font-size: var(--fs-3xs); font-weight: var(--fw-extrabold); text-transform: uppercase; letter-spacing: 0.5px; color: var(--purple-alt); margin-bottom: 0.15rem;">Wewnętrzne</div>
                    <div style="display: flex; align-items: center; background: rgba(var(--accent2-rgb), 0.1); border: 1px solid rgba(var(--accent2-rgb), 0.3); border-radius: var(--radius-sm); overflow: hidden;">
                        <input type="number" min="0" step="0.01" value="${malWC}"
                            id="offer-mal-wew-cena"
                            class="text-center offer-discount-input"
                            onclick="this.select()"
                            oninput="handleOfferPaintingCostChange('malowanieWewCena', this.value)"
                            onkeydown="if(event.key==='Enter') this.blur();"
                            style="min-width:0; flex:1; font-size: var(--fs-xl); font-weight: var(--fw-black); color: var(--purple-alt); background: transparent; border: none; outline: none; text-align: center;">
                        <span style="font-size: var(--fs-sm); font-weight: var(--fw-extrabold); color: rgba(var(--accent2-rgb), 0.5); padding-right: 0.4rem;">zł</span>
                    </div>
                </div>`;
        }

        if (anyMalZ) {
            html += `
                <div class="flex-1-120">
                    <div style="font-size: var(--fs-3xs); font-weight: var(--fw-extrabold); text-transform: uppercase; letter-spacing: 0.5px; color: var(--purple-alt); margin-bottom: 0.15rem;">Zewnętrzne</div>
                    <div style="display: flex; align-items: center; background: rgba(var(--accent2-rgb), 0.1); border: 1px solid rgba(var(--accent2-rgb), 0.3); border-radius: var(--radius-sm); overflow: hidden;">
                        <input type="number" min="0" step="0.01" value="${malZC}"
                            id="offer-mal-zew-cena"
                            class="text-center offer-discount-input"
                            onclick="this.select()"
                            oninput="handleOfferPaintingCostChange('malowanieZewCena', this.value)"
                            onkeydown="if(event.key==='Enter') this.blur();"
                            style="min-width:0; flex:1; font-size: var(--fs-xl); font-weight: var(--fw-black); color: var(--purple-alt); background: transparent; border: none; outline: none; text-align: center;">
                        <span style="font-size: var(--fs-sm); font-weight: var(--fw-extrabold); color: rgba(var(--accent2-rgb), 0.5); padding-right: 0.4rem;">zł</span>
                    </div>
                </div>`;
        }

        html += `</div>
        </div>`;
    }

    if (totalOverallNetto > 0) {
        html += `
        <div style="margin-top: 0.5rem; background: rgba(var(--black-rgb), 0.3); border: 1px dashed rgba(var(--white-rgb), 0.1); padding: 0.5rem 0.9rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: var(--fs-xs); font-weight: var(--fw-extrabold); color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Łączna Suma Netto</span>
            <span id="offer-total-popup-price" style="font-size: var(--fs-2xl); font-weight: var(--fw-black); color: var(--success);">${typeof fmt === 'function' ? fmt(totalOverallNetto) : totalOverallNetto} PLN</span>
        </div>`;
    } else {
        html +=
            '<div style="text-align:center; padding: 1.5rem; color: var(--text-muted); font-size: var(--fs-base);">Koszyk oferty jest pusty. Dodaj studnie na etapie konfiguracji.</div>';
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
