// @ts-check
/* ===== PRINT MANAGER — Budowa HTML i drukowanie ===== */

/**
 * Buduje tekst z odwołaniami do powiązanych elementów produkcyjnych
 * (dennica ↔ kręgi) w tej samej studni.
 * Dla dennicy: lista numerów zleceń kręgów w studni.
 * Dla kręgu: numer studni + numery zleceń dennicy i pozostałych kręgów.
 */
function buildSiblingCrossReferences(data) {
    const well = data.well;
    const currentElementIndex = data.elementIndex;
    const currentProduct = data.product;

    if (!well || !well.id) return '';
    if (typeof zleceniaElementsList === 'undefined' || zleceniaElementsList.length === 0) return '';

    // Elementy produkcyjne w tej samej studni (bez bieżącego)
    const siblings = zleceniaElementsList.filter(
        (el) => el.well.id === well.id && el.elementIndex !== currentElementIndex
    );

    if (siblings.length === 0) return '';

    const getPoNumber = (el) => {
        const po = (productionOrders || []).find(
            (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
        );
        return po?.productionOrderNumber || '—';
    };

    const isDennica = currentProduct && currentProduct.componentType === 'dennica';

    if (isDennica) {
        // Dennica → pokaż tylko numery zleceń kręgów
        const kregiNumbers = siblings.map((el) => getPoNumber(el));
        return 'Kręgi: ' + kregiNumbers.join(', ');
    }

    // Krąg → pokaż numer zlecenia dennicy jako "Studnia" + numery pozostałych kręgów
    const parts = [];
    const dennice = siblings.filter((el) => el.product && el.product.componentType === 'dennica');
    const otherKregi = siblings.filter(
        (el) => el.product && el.product.componentType !== 'dennica'
    );

    dennice.forEach((el) => parts.push('Studnia: ' + getPoNumber(el)));
    otherKregi.forEach((el) => parts.push('Krąg: ' + getPoNumber(el)));

    return parts.join(', ');
}

function buildZlecenieHtml(template, data) {
    const przejsciaRows = buildPrzejsciaRows(data);

    let angleTypeTitle = 'Kąt stopień';
    const dnStr = String(data.well.dn || '');
    const numDn = parseInt(dnStr.match(/(\d{3,4})/) ? dnStr.match(/(\d{3,4})/)[1] : '0');
    if (data.product && data.product.componentType === 'krag_ot') {
        angleTypeTitle = 'Kąt stopień';
    } else if (numDn === 2000 || numDn === 2500) {
        angleTypeTitle = 'Kąt stopień';
    } else if ([1000, 1200, 1500].includes(numDn)) {
        angleTypeTitle = 'Kąt wykonania';
    }

    let finalUwagi = data.uwagi || '';
    if (
        data.well &&
        data.well.wkladkaOsadnikPreco === 'tak' &&
        data.product &&
        (data.product.componentType === 'dennica' || data.product.componentType === 'styczna')
    ) {
        const osadnikNote = `<strong style="color:#f59e0b; font-size:1.1em; display:block; margin-top:5px;">UWAGA: OSADNIK - WKŁADKA PRECO (Dno + Ściany ${data.well.wkladkaOsadnikH || 0} mm)</strong>`;
        finalUwagi = finalUwagi ? finalUwagi + '<br>' + osadnikNote : osadnikNote;
    } else if (
        data.well &&
        (data.well.precoFullHeight === 'tak' || data.well.precoFullHeight === true) &&
        data.product &&
        (data.product.componentType === 'dennica' || data.product.componentType === 'styczna')
    ) {
        const fullHeightNote =
            '<strong style="color:red; font-size:1.1em; display:block; margin-top:5px;">UWAGA: WKŁADKA PRECO NA CAŁEJ WYSOKOŚCI DENNICY!</strong>';
        finalUwagi = finalUwagi ? finalUwagi + '<br>' + fullHeightNote : fullHeightNote;
    }

    // Zbudowanie dużego płaskiego obiektu z wartościami dla {{ZMIENNYCH}}
    const payload = {
        NR_ZLECENIA: data.productionOrderNumber || '',
        OBIEKT: data.obiekt || '',
        ADRES: data.adres || '',
        WYKONAWCA: data.wykonawca || '',
        FAKTUROWANE: data.fakturowane || '',
        DATA_PRODUKCJI: data.dataProdukcji || '',
        SNR: data.snr || '',
        SREDNICA: data.srednica || '',
        WYSOKOSC: data.wysokosc || '',
        GLEBOKOSC: data.glebokosc || '',
        DNO_KINETA: data.dnoKineta || '',
        UWAGI: finalUwagi,
        // Odwołania do powiązanych elementów (dennica ↔ kręgi) dodawane poniżej
        DATA: data.data || '',
        NAZWISKO: data.nazwisko || '',
        RED_KINETY: paramLabel(data.redukcjaKinety) || 'Brak',
        SPOCZNIK_H: paramLabel(data.spocznikH) || 'Brak',
        USYTUOWANIE: paramLabel(data.usytuowanie) || 'Brak',
        DIN: data.din || 'Brak',
        KINETA: paramLabel(data.kineta) || 'Brak',
        SPOCZNIK: paramLabel(data.spocznik) || 'Brak',
        RODZAJ_STOPNI:
            paramLabel(data.rodzajStopni) + (data.stopnieInne ? ' — ' + data.stopnieInne : '') ||
            'Brak',
        KLASA_BETONU: data.klasaBetonu || 'Brak',
        KAT_STOPNI: data.katStopni ? data.katStopni + '°' : 'Brak',
        WYKONANIE: data.wykonanie || 'Brak',
        POWLOKA: getPowlokaString(data.well),
        TYP_KATA: angleTypeTitle,
        GRAFIKA_KATOW: generateWellSvg(data)
    };

    // Dodaj odwołania do powiązanych elementów (dennica ↔ kręgi) w sekcji Uwagi
    const crossRefs = buildSiblingCrossReferences(data);
    if (crossRefs) {
        payload.UWAGI = (payload.UWAGI ? payload.UWAGI + '<br>' : '') + '<b>' + crossRefs + '</b>';
    }

    // Pre-kalkulacja specjalnych wierszy przejść [0..3] — 9 komórek: etykieta + 8 danych
    for (let i = 0; i < 4; i++) {
        if (przejsciaRows[i]) {
            payload[`PRZEJSCIA_ROW_${i}`] = `
                <td>${przejsciaRows[i].label}</td>
                <td>${przejsciaRows[i].rodzaj}</td>
                <td class="center">${przejsciaRows[i].srednica}</td>
                <td class="center">${przejsciaRows[i].spadekKineta}</td>
                <td class="center">${przejsciaRows[i].spadekMufa}</td>
                <td class="center">${przejsciaRows[i].katStopien}</td>
                <td>${przejsciaRows[i].uwagi}</td>
                <td class="center">${przejsciaRows[i].katGon}</td>
                <td class="center">${przejsciaRows[i].katWykonania}</td>
            `;
        } else {
            payload[`PRZEJSCIA_ROW_${i}`] = `<td colspan="9"></td>`;
        }
    }

    // Pre-kalkulacja reszty wierszy (Wlot 4 - 10) — 11 kolumn: puste(cs2) + etykieta + 8 danych
    payload['PRZEJSCIA_ROWS_REST'] = przejsciaRows
        .slice(4)
        .map(
            (r) => `
        <tr>
            <td colspan="2"></td>
            <td>${r.label}</td>
            <td>${r.rodzaj}</td>
            <td class="center">${r.srednica}</td>
            <td class="center">${r.spadekKineta}</td>
            <td class="center">${r.spadekMufa}</td>
            <td class="center">${r.katStopien}</td>
            <td>${r.uwagi}</td>
            <td class="center">${r.katGon}</td>
            <td class="center">${r.katWykonania}</td>
        </tr>
    `
        )
        .join('');

    return renderTemplate(template, payload);
}

// ===== ETYKIETA PRINT =====

/** Buduje listę komponentów studni dla etykiety. */
function buildEtykietaElements(data) {
    const well = data.well;
    const config = well.config || [];
    const items = [];
    const countMap = new Map();

    config.forEach((item) => {
        const productId = item.productId || item.id;
        const product = studnieProducts.find((p) => p.id === productId);
        if (!product) return;

        // Pomijaj kinetę i właz na etykiecie
        if (product.componentType === 'kineta' || product.componentType === 'wlaz') return;

        const key = product.id;
        if (countMap.has(key)) {
            countMap.get(key).count++;
        } else {
            countMap.set(key, { count: 1, indeks: product.id || '', nazwa: product.name || '' });
        }
    });

    const uszczelkaProduct = studnieProducts.find(
        (p) =>
            p.category === 'uszczelka' &&
            (String(p.dn) === String(well.dn) ||
                p.name?.includes('DN ' + well.dn) ||
                p.name?.includes('DN' + well.dn))
    );

    if (uszczelkaProduct && config.length > 1) {
        countMap.set('_seal_' + uszczelkaProduct.id, {
            count: config.length,
            indeks: uszczelkaProduct.id || '',
            nazwa: uszczelkaProduct.name || `USZCZELKI DO STUDNI DN ${well.dn}MM`
        });
    }

    countMap.forEach((val) =>
        items.push({ ilosc: val.count + ' szt.', indeks: val.indeks, nazwa: val.nazwa })
    );
    return items;
}

/**
 * Zwraca dane certyfikacyjne na podstawie średnicy studni.
 * DN1000, DN1200 → CE + AT/2009-03-1733
 * DN1500, DN2000, DN2500 → B + IBDIM KOT 2018/0195 WYD.2 KDWU B/73/2023
 */
function getCertificationData(dn) {
    const dnStr = String(dn || '');
    const match = dnStr.match(/(\d{3,4})/);
    const numDn = match ? parseInt(match[1]) : 0;

    if ([1000, 1200].includes(numDn)) {
        return {
            img: 'images/ce-mark.png',
            alt: 'CE',
            text: 'AT/2009-03-1733'
        };
    }

    // DN1500, DN2000, DN2500 — Znak budowlany B
    return {
        img: 'images/b-mark.png',
        alt: 'B',
        text: 'IBDIM KOT 2018/0195 WYD.2<br>KDWU B/73/2023'
    };
}

function buildEtykietaHtml(template, data) {
    const elementy = buildEtykietaElements(data);
    const mainElement = data.product?.name || '';

    const elementRows = elementy
        .map(
            (e) => `
        <tr>
            <td class="el-qty">${e.ilosc}</td>
            <td class="el-idx">${e.indeks}</td>
            <td class="el-name">${e.nazwa}</td>
        </tr>
    `
        )
        .join('');

    const cert = getCertificationData(data.srednica);

    const payload = {
        SNR: data.snr || '',
        MAIN_ELEMENT: mainElement,
        NR_ZLECENIA: data.productionOrderNumber || '',
        ELEMENTY_ROWS: elementRows,
        CERT_IMG: cert.img,
        CERT_ALT: cert.alt,
        CERT_TEXT: cert.text
    };

    return renderTemplate(template, payload);
}

async function printEtykieta() {
    // Auto-zapis zlecenia + synchronizacja oferty/zamówienia przed wydrukiem
    await saveProductionOrder();

    const data = collectPrintData();
    if (!data) return;

    showToast('Generowanie etykiety...', 'info');

    const template = await getTemplate('templates/etykieta.html');
    if (!template) return;

    const html = buildEtykietaHtml(template, data);
    silentPrint(html);
}

async function printEtykietaAll() {
    if (!zleceniaElementsList || zleceniaElementsList.length === 0) {
        showToast('Brak elementów do druku', 'error');
        return;
    }

    showToast('Generowanie wydruku zbiorczego...', 'info');

    const template = await getTemplate('templates/etykieta.html');
    if (!template) return;

    // Szukamy bloku ze strukturalną zawartością widoku do duplikacji
    const pageMatch = template.match(
        /<div class="page">([\s\S]*?)<\/div>\s*<!-- KONIEC BLOKU "page" -->/
    );
    if (!pageMatch) {
        showToast('Błąd szablonu etykiety - brak bloku div.page', 'error');
        return;
    }

    const pageTemplate = pageMatch[0];
    const htmlBefore = template.substring(0, pageMatch.index);
    const htmlAfter = template.substring(pageMatch.index + pageTemplate.length);

    let allPagesHTML = '';
    const savedIdx = zleceniaSelectedIdx;

    for (let i = 0; i < zleceniaElementsList.length; i++) {
        zleceniaSelectedIdx = i;
        const pageData = collectPrintData();
        if (!pageData) continue;

        let populatedPage = buildEtykietaHtml(pageTemplate, pageData);

        if (i < zleceniaElementsList.length - 1) {
            populatedPage += '\n<div class="page-break"></div>\n';
        }

        allPagesHTML += populatedPage;
    }

    zleceniaSelectedIdx = savedIdx;

    if (!allPagesHTML) {
        showToast('Brak danych do druku', 'warning');
        return;
    }

    const finalHTML = htmlBefore + allPagesHTML + htmlAfter;
    silentPrint(finalHTML);
}

// ===== GLOBAL EXPORTS =====
window.printEtykieta = printEtykieta;
window.printEtykietaAll = printEtykietaAll;
