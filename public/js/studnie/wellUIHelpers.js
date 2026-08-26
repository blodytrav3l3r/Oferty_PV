// @ts-check
/* ===== HELPERY UI STUDNI ===== */
/* renderDiscountPanel — panel rabatów i podsumowania w sidebarze */
/* Zależności: wells, wellDiscounts, calcWellStats, studnieProducts, fmtInt, updateDiscount, updateGlobalPehdDiscount, updateGlobalPaintingCost, getPehdEffectiveArea (globalne) */

function renderDiscountPanel() {
    const panel = document.getElementById('wells-discount-panel');
    if (!panel) return;

    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];
    const activeDNs = dktCap.filter((dn) => wells.some((w) => w.dn === dn));

    if (activeDNs.length === 0) {
        panel.innerHTML =
            '<div class="discount-empty"><i data-lucide="banknote" style="width:20px;height:20px;opacity:0.5;display:block;margin:0 auto 0.4rem;"></i>Brak studni.<br>Dodaj studnię aby ustawić rabaty.</div>';
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            lucide.createIcons({ root: panel });
        return;
    }

    let grandTotal = 0;
    let grandDiscounted = 0;

    let html =
        '<div class="discount-header"><i data-lucide="banknote" style="width:14px;height:14px;"></i> Rabaty i podsumowanie</div>';

    activeDNs.forEach((dn) => {
        const groupWells = wells.filter((w) => w.dn === dn);
        const discountDn = dn === 'styczna' ? 'styczne' : dn;
        let dennicaBaseSum = 0;
        let nadbudowaBaseSum = 0;
        let dennicaAfterSum = 0;
        let nadbudowaAfterSum = 0;
        groupWells.forEach((w) => {
            const s = calcWellStats(w);
            dennicaBaseSum += s.priceDennicaBase;
            nadbudowaBaseSum += s.priceNadbudowaBase;
            dennicaAfterSum += s.priceDennica;
            nadbudowaAfterSum += s.priceNadbudowa;
        });
        const totalDN = dennicaBaseSum + nadbudowaBaseSum;
        const disc = wellDiscounts[discountDn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
        const totalAfter = dennicaAfterSum + nadbudowaAfterSum;

        const korpusClasses = [
            ...new Set(
                groupWells.map((w) => w.klasaNosnosci_korpus).filter((k) => k && k !== 'D400')
            )
        ];
        const zwienczenieClasses = [
            ...new Set(
                groupWells.map((w) => w.klasaNosnosci_zwienczenie).filter((k) => k && k !== 'D400')
            )
        ];

        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        const dnLabel = dn === 'styczna' ? 'Studnia Styczna' : 'DN' + dn;
        const hasPrecoInGroup = groupWells.some(
            (w) => w.kineta === 'preco' || w.kineta === 'precotop'
        );

        html += '<div class="discount-card">';
        html +=
            '<div class="discount-card-head"><span class="discount-card-title">' +
            dnLabel +
            '</span><span class="discount-card-count">' +
            groupWells.length +
            ' szt.</span></div>';
        html += '<div class="discount-grid">';
        html +=
            '<span class="discount-label">Dennica / Baza</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
            (disc.dennica || 0) +
            '" id="disc-' +
            discountDn +
            '-dennica" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
            discountDn +
            "','dennica',this.value)\" aria-label=\"Rabat dennica " +
            dnLabel +
            '"><span class="discount-suffix">%</span></div>';
        html +=
            '<span class="discount-label">Nadbudowa</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
            (disc.nadbudowa || 0) +
            '" id="disc-' +
            discountDn +
            '-nadbudowa" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
            discountDn +
            "','nadbudowa',this.value)\" aria-label=\"Rabat nadbudowa " +
            dnLabel +
            '"><span class="discount-suffix">%</span></div>';

        korpusClasses.forEach((cls) => {
            const isAccent = true;
            html += '<div class="discount-section" style="grid-column:1/-1"></div>';
            html +=
                '<div style="grid-column:1/-1" class="discount-section-title ' +
                (isAccent ? 'discount-section-title--accent' : 'discount-section-title--warn') +
                '"><span class="discount-dot ' +
                (isAccent ? 'discount-dot--accent' : 'discount-dot--warn') +
                '"></span>Korpus ' +
                cls +
                '</div>';
            html +=
                '<span class="discount-label discount-label--accent">Korpus ' +
                cls +
                ' Dennica/Kineta</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc['dennica' + cls] || 0) +
                '" id="disc-' +
                discountDn +
                '-dennica' +
                cls +
                '" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','dennica" +
                cls +
                '\',this.value)" aria-label="Rabat dennica ' +
                cls +
                ' ' +
                dnLabel +
                '"><span class="discount-suffix">%</span></div>';
            html +=
                '<span class="discount-label discount-label--accent">Korpus ' +
                cls +
                ' Nadbudowa</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc['nadbudowa' + cls] || 0) +
                '" id="disc-' +
                discountDn +
                '-nadbudowa' +
                cls +
                '" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','nadbudowa" +
                cls +
                '\',this.value)" aria-label="Rabat nadbudowa ' +
                cls +
                ' ' +
                dnLabel +
                '"><span class="discount-suffix">%</span></div>';
        });

        zwienczenieClasses.forEach((cls) => {
            const dotCls = cls === 'E600' ? 'discount-dot--accent' : 'discount-dot--warn';
            const titleCls =
                cls === 'E600' ? 'discount-section-title--accent' : 'discount-section-title--warn';
            // jeśli korpus już dodał sekcję dla tego cls, nie duplikuj nagłówka — ale zwienczenie to osobna linia
            const alreadyHasHeader = korpusClasses.includes(cls);
            if (!alreadyHasHeader) {
                html += '<div class="discount-section" style="grid-column:1/-1"></div>';
                html +=
                    '<div style="grid-column:1/-1" class="discount-section-title ' +
                    titleCls +
                    '"><span class="discount-dot ' +
                    dotCls +
                    '"></span>Klasa ' +
                    cls +
                    '</div>';
            }
            html +=
                '<span class="discount-label ' +
                (cls === 'E600' ? 'discount-label--accent' : 'discount-label--warn') +
                '">Zako\u0144czenie ' +
                cls +
                '</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc['zwienczenie' + cls] || 0) +
                '" id="disc-' +
                discountDn +
                '-zwienczenie' +
                cls +
                '" class="discount-input" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','zwienczenie" +
                cls +
                '\',this.value)" aria-label="Rabat zako\u0144czenie ' +
                cls +
                ' ' +
                dnLabel +
                '"><span class="discount-suffix">%</span></div>';
        });

        if (hasPrecoInGroup) {
            html +=
                '<span class="discount-label discount-label--danger">Wk\u0142adka PRECO</span><div class="discount-input-wrap"><input type="number" min="0" max="100" step="0.5" value="' +
                (disc.preco || 0) +
                '" id="disc-' +
                discountDn +
                '-preco" class="discount-input discount-input--danger" onclick="this.select()" onchange="updateDiscount(\'' +
                discountDn +
                "','preco',this.value)\" aria-label=\"Rabat PRECO " +
                dnLabel +
                '"><span class="discount-suffix discount-suffix--danger">%</span></div>';
        }

        html += '</div>';
        const isDiscounted = totalAfter < totalDN;
        html +=
            '<div class="discount-card-foot"><span class="discount-foot-label">Po rabacie:</span><span class="discount-foot-value ' +
            (isDiscounted ? 'discount-foot-value--discounted' : 'discount-foot-value--plain') +
            '">' +
            fmtInt(totalAfter) +
            ' PLN</span></div>';
        html += '</div>';
    });

    // Sekcja wkładki PEHD (globalna)
    const anyPehd = wells.some(
        (w) =>
            (w.wkladkaDennica && w.wkladkaDennica !== 'brak') ||
            (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') ||
            (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak')
    );
    if (anyPehd) {
        const pehdDiscountValue = wells[0] && wells[0].pehdDiscount ? wells[0].pehdDiscount : 0;
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
        const currentPehdPriceAfter = currentPehdPrice * (1 - pehdDiscountValue / 100);

        html += '<div class="discount-card discount-card--pehd">';
        html +=
            '<div class="discount-card-head"><span class="discount-card-title discount-card-title--pehd"><i data-lucide="shield" style="width:14px;height:14px;"></i> Wk\u0142adka PEHD</span><span class="discount-pehd-price">Bazowo: ' +
            currentPehdPrice +
            ' PLN/m²</span></div>';
        html +=
            '<div style="text-align:right; margin-bottom:0.35rem;"><span class="discount-pehd-after" id="sidebar-pehd-price-after">' +
            currentPehdPriceAfter.toFixed(2) +
            ' PLN/m²</span></div>';
        html +=
            '<div class="discount-grid"><span class="discount-label discount-label--blue">Globalny Rabat</span><div class="discount-input-wrap"><input type="number" min="0" step="1" value="' +
            pehdDiscountValue +
            '" id="disc-global-pehd" class="discount-input discount-input--blue" onclick="this.select()" onchange="updateGlobalPehdDiscount(this.value)" aria-label="Globalny rabat PEHD"><span class="discount-suffix discount-suffix--blue">%</span></div></div>';
        html += '</div>';
    }

    // Sekcja kosztów malowania (globalna)
    const anyMalowanieW = wells.some((w) => w.malowanieW && w.malowanieW !== 'brak');
    const anyMalowanieZ = wells.some((w) => w.malowanieZ && w.malowanieZ !== 'brak');

    if (anyMalowanieW || anyMalowanieZ) {
        const refWell = wells[0] || {};
        const malWCena = refWell.malowanieWewCena || '';
        const malZCena = refWell.malowanieZewCena || '';

        html += '<div class="discount-card discount-card--paint">';
        html +=
            '<div class="discount-card-head"><span class="discount-card-title discount-card-title--paint"><i data-lucide="paintbrush" style="width:14px;height:14px;"></i> Koszt malowania</span><span class="discount-pehd-price">PLN / m²</span></div>';
        html += '<div class="discount-grid">';

        if (anyMalowanieW) {
            html +=
                '<span class="discount-label discount-label--purple">Wewn\u0119trzne</span><div class="discount-input-wrap"><input type="number" min="0" step="0.01" value="' +
                malWCena +
                '" id="disc-mal-wew-cena" class="discount-input discount-input--purple" onclick="this.select()" onchange="updateGlobalPaintingCost(\'malowanieWewCena\', this.value)" aria-label="Koszt malowania wewn\u0119trznego"><span class="discount-suffix discount-suffix--purple">z\u0142</span></div>';
        }

        if (anyMalowanieZ) {
            html +=
                '<span class="discount-label discount-label--purple">Zewn\u0119trzne</span><div class="discount-input-wrap"><input type="number" min="0" step="0.01" value="' +
                malZCena +
                '" id="disc-mal-zew-cena" class="discount-input discount-input--purple" onclick="this.select()" onchange="updateGlobalPaintingCost(\'malowanieZewCena\', this.value)" aria-label="Koszt malowania zewn\u0119trznego"><span class="discount-suffix discount-suffix--purple">z\u0142</span></div>';
        }

        html += '</div></div>';
    }

    // Suma całkowita
    const hasDiscount = grandDiscounted < grandTotal;
    html +=
        '<div class="discount-total"><span class="discount-total-label">Suma ca\u0142kowita</span><div class="discount-total-values">';
    if (hasDiscount)
        html += '<span class="discount-total-crossed">' + fmtInt(grandTotal) + ' PLN</span>';
    html +=
        '<span class="discount-total-main">' + fmtInt(grandDiscounted) + ' PLN</span></div></div>';

    panel.innerHTML = html;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: panel });
}

window.renderDiscountPanel = renderDiscountPanel;
