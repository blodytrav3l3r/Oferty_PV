/* ============================
   WITROS — Druk Zleceń Produkcyjnych
   printManager.js
   ============================ */

/** Cache dla pobranych szablonów HTML (Tymczasowo wyłączone do celów edycji na żywo) */
const templateCache = new Map();

/**
 * Zwraca szablon pobierany jednorazowo (teraz pobiera na nowo co kliknięcie by aktualizować zmiany graficzne w locie).
 */
async function getTemplate(path) {
    // WYŁĄCZENIE CACHE:
    // if (templateCache.has(path)) {
    //    return templateCache.get(path);
    // }

    try {
        const res = await fetch(path + '?v=' + Date.now()); // dla deweloperki można utrzymać ?v=, w prod ew. zdjąć
        if (!res.ok) throw new Error(`Nie znaleziono szablonu: ${path}`);
        const html = await res.text();
        templateCache.set(path, html);
        return html;
    } catch (err) {
        showToast(`Błąd szablonu: ${err.message}`, 'error');
        console.error(err);
        return null;
    }
}

/**
 * Uniwersalny silnik interpolacji – podmienia wszystkie wystąpienia {{KLUCZ}}
 * na wartości ze słownika (obiektu) dataObj.
 */
function renderTemplate(template, dataObj) {
    return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
        return dataObj[key] !== undefined ? dataObj[key] : '';
    });
}

/**
 * Wydrukuj ciąg HTML używając ukrytego iframe, aby całkowicie
 * ominąć blokadę pop-upów w przeglądarkach.
 */
function silentPrint(htmlString) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1200px';
    iframe.style.height = '1200px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlString);
    doc.close();

    // Auto-drukowanie po załadowaniu makiety
    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            // Posprzątanie ukrytego elementu DOM (np. po minucie gdy użytkownik już kliknie w oknie druku)
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 60000);
        }, 500); // 500ms dla bezpiecznego wczytania czcionek/obrazków webowych przed wydrukiem
    };
}

/**
 * Collect all data needed for printing from the current zlecenia form
 * and the selected element. Returns null if nothing is selected.
 */
function collectPrintData() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return null;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const { well, product, elementIndex, wellIndex } = el;
    const existing = productionOrders.find(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );

    const getValue = (id, fallback = '') => document.getElementById(id)?.value || fallback;

    return {
        productionOrderNumber:
            existing?.productionOrderNumber || getValue('zl-nr-zlecenia', '— brak —'),
        obiekt: getValue('zl-obiekt'),
        adres: getValue('zl-adres'),
        wykonawca: getValue('zl-wykonawca'),
        fakturowane: getValue('zl-fakturowane'),
        data: getValue('zl-data'),
        nazwisko: getValue('zl-nazwisko'),
        dataProdukcji: getValue('zl-data-produkcji'),
        // Well specs
        snr: well.numer || well.name || '',
        srednica: getValue('zl-srednica', well.dn),
        wysokosc: getValue('zl-wysokosc'),
        glebokosc: getValue('zl-glebokosc'),
        dnoKineta: getValue('zl-dno-kineta'),
        rodzajStudni: getValue('zl-rodzaj-studni'),
        // Params
        redukcjaKinety: getValue('zl-red-kinety'),
        spocznikH: getValue('zl-spocznik-h'),
        din: getValue('zl-din'),
        rodzajStopni: getValue('zl-rodzaj-stopni'),
        stopnieInne: getValue('zl-stopnie-inne'),
        katStopni: getValue('zl-kat-stopni'),
        wykonanie: getValue('zl-wykonanie'),
        usytuowanie: getValue('zl-usytuowanie'),
        kineta: getValue('zl-kineta'),
        spocznik: getValue('zl-spocznik'),
        klasaBetonu: getValue('zl-klasa-betonu'),
        uwagi: getValue('zl-uwagi'),
        // Raw data
        well,
        product,
        elementIndex,
        wellIndex,
        existing
    };
}

/** Map internal param value to human-readable label */
function paramLabel(val) {
    const map = {
        tak: 'Tak',
        nie: 'Nie',
        linia_dolna: 'Linia dolna',
        linia_gorna: 'Linia górna',
        w_osi: 'W osi',
        patrz_uwagi: 'Patrz uwagi',
        brak: 'Brak',
        beton: 'Beton',
        beton_gfk: 'Beton z GFK',
        klinkier: 'Klinkier',
        preco: 'Preco',
        precotop: 'PrecoTop',
        unolith: 'UnoLith',
        predl: 'Predl',
        kamionka: 'Kamionka',
        zelbet: 'Żelbet',
        drabinka_a_stalowa: 'Drabinka Typ A/stalowa',
        drabinka_a_szlachetna: 'Drabinka Typ A/stal szlachetna',
        drabinka_b_stalowa: 'Drabinka Typ B/stalowa',
        drabinka_b_szlachetna: 'Drabinka Typ B/stal szlachetna',
        inne: 'Inne',
        '1/2': '1/2',
        '2/3': '2/3',
        '3/4': '3/4',
        '1/1': '1/1'
    };
    return map[val] || val || '';
}

/**
 * Build the przejścia (transitions) rows for the Zlecenie print.
 * Returns array of objects
 */
function buildPrzejsciaRows(data) {
    const well = data.well;
    const przejscia = well.przejscia || [];
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProductFn, true);

    const assignedPrzejscia = przejscia.filter((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
        return assignedIndex === data.elementIndex;
    });

    const rows = [];
    const wylot = assignedPrzejscia.find(
        (p) => p.flowType === 'wylot' || parseFloat(p.angle) === 0
    );
    const wloty = assignedPrzejscia.filter((p) => p !== wylot);

    if (wylot) rows.push(formatPrzejscieRow('Wylot 0', wylot, findProductFn, rzDna));
    wloty.forEach((p, i) =>
        rows.push(formatPrzejscieRow(`Wlot ${i + 1}`, p, findProductFn, rzDna))
    );

    // Pad to 11 rows
    while (rows.length < 11) {
        const idx = rows.length === 0 ? 0 : rows.length;
        const label = idx === 0 ? 'Wylot 0' : `Wlot ${idx}`;
        rows.push({
            label,
            rodzaj: '',
            srednica: '',
            spadekKineta: '',
            spadekMufa: '',
            katStopien: '',
            uwagi: '',
            katGon: '',
            katWykonania: ''
        });
    }
    return rows;
}

function formatPrzejscieRow(label, p, findProductFn, rzDna) {
    const product = findProductFn ? findProductFn(p.productId) : null;
    const rodzaj = product ? product.category : '';
    const srednica = product ? product.dn : '';

    const spadekKineta = p.spadekKineta || '';
    const spadekMufa = p.spadekMufa || '';
    const angle = parseFloat(p.angle) || 0;

    // Oblicz wysokość włączenia w mm od dna
    let pel = parseFloat(p.rzednaWlaczenia);
    if (isNaN(pel)) pel = rzDna || 0;
    const wysokoscMm = Math.round((pel - (rzDna || 0)) * 1000);
    const uwagi = '+ ' + wysokoscMm + ' mm';

    const katGon = p.angleGony || ((angle * 400) / 360).toFixed(2);
    const katWyk = p.angleExecution !== undefined ? p.angleExecution : 360 - angle;

    return {
        label,
        rodzaj,
        srednica,
        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) + ' mm' : '',
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) + ' mm' : '',
        katStopien: angle + '°',
        uwagi,
        katGon: katGon,
        katWykonania: katWyk + '°'
    };
}

// ===== ZLECENIE PRINT =====

async function printZlecenie() {
    // Auto-zapis zlecenia + synchronizacja oferty/zamówienia przed wydrukiem
    await saveProductionOrder();

    const data = collectPrintData();
    if (!data) return;

    showToast('Generowanie zlecenia...', 'info');

    const template = await getTemplate('templates/zlecenie.html');
    if (!template) return;

    const html = buildZlecenieHtml(template, data);
    silentPrint(html);
}

function getPowlokaString(well) {
    if (!well) return 'Brak';
    let parts = [];
    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'cale') malWDesc = 'Całość';
        if (malWDesc) {
            let p = 'Wew: ' + malWDesc;
            if (well.powlokaNameW) p += ' (' + well.powlokaNameW + ')';
            parts.push(p);
        }
    }
    if (well.malowanieZ === 'zewnatrz') {
        let p = 'Zew:';
        if (well.powlokaNameZ) p += ' (' + well.powlokaNameZ + ')';
        parts.push(p);
    }
    return parts.length > 0 ? parts.join('<br>') : 'Brak';
}

/**
 * Generuje grafikę SVG przedstawiającą kąty przejść w studni.
 * Wylot (0°) znajduje się na dole (na godz. 6), inne kąty rosną zgodnie z ruchem wskazówek zegara.
 */
function generateWellSvg(data) {
    const well = data.well || data;
    if (!well || !well.przejscia) return '';
    let przejscia = well.przejscia || [];
    const rzDna = parseFloat(well.rzednaDna) || 0;

    // Filter transitions by assigned element if elementIndex is provided
    if (
        data.elementIndex !== undefined &&
        typeof buildConfigMap !== 'undefined' &&
        typeof findAssignedElement !== 'undefined'
    ) {
        const findProductFn = (id) =>
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === id)
                : null;
        const configMap = buildConfigMap(well, findProductFn, true);
        if (configMap.length > 0) {
            przejscia = przejscia.filter((p) => {
                let pel = parseFloat(p.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;
                const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
                return assignedIndex === data.elementIndex;
            });
        }
    }

    if (przejscia.length === 0) return '';

    // Zoptymalizowany obszar roboczy (viewBox), by powiększyć studnię
    const size = 240;
    const center = size / 2;
    const radius = 60; // Znacznie większa studnia dla lepszej widoczności

    let svg = `<svg viewBox="0 0 ${size} ${size}" width="180" height="180" style="background: transparent; overflow: visible;">`;

    // Główny okrąg studni
    svg += `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#222" stroke-width="2.5" />`;

    // Krzyż pomocniczy
    svg += `<line x1="${center}" y1="${center - 5}" x2="${center}" y2="${center + 5}" stroke="#999" stroke-width="0.8" />`;
    svg += `<line x1="${center - 5}" y1="${center}" x2="${center + 5}" y2="${center}" stroke="#999" stroke-width="0.8" />`;

    przejscia.forEach((p, i) => {
        const angleDeg = parseFloat(p.angle) || 0;
        const katWyk =
            p.angleExecution !== undefined
                ? parseFloat(p.angleExecution)
                : angleDeg === 0
                  ? 0
                  : 360 - angleDeg;
        const rad = (katWyk * Math.PI) / 180;

        // Współrzędne końca linii (na okręgu)
        const x = center - radius * Math.sin(rad);
        const y = center + radius * Math.cos(rad);

        // Linia podłączenia
        const isWylot = p.flowType === 'wylot' || angleDeg === 0;
        svg += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${isWylot ? '#000' : '#444'}" stroke-width="${isWylot ? 3.5 : 1.8}" />`;

        // Dane do etykiety
        const product =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === p.productId)
                : null;
        const rodzaj = product ? product.category : '';
        const pel = parseFloat(p.rzednaWlaczenia) || rzDna;
        const hMm = Math.round((pel - rzDna) * 1000);
        const uwagiText = hMm > 0 ? `+${hMm}mm` : '';

        // Pozycja etykiety - blisko okręgu
        const labelRadius = radius + 11;
        const lx = center - labelRadius * Math.sin(rad);
        const ly = center + labelRadius * Math.cos(rad);

        // Ustalenie text-anchor
        let anchor = 'middle';
        if (lx < center - 8) anchor = 'end';
        if (lx > center + 8) anchor = 'start';

        // Estetyka etykiety
        svg += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000">`;

        // Linia 1: Indeks i Rodzaj
        svg += `<tspan x="${lx}" dy="0" fill="#000">${i}. ${rodzaj.toUpperCase()}</tspan>`;

        // Linia 2: Kąt i Wysokość (jeśli jest)
        let line2 = `${katWyk}°`;
        if (uwagiText) line2 += ` (${uwagiText})`;
        svg += `<tspan x="${lx}" dy="1.15em" font-size="10" font-weight="normal" fill="#444">${line2}</tspan>`;

        svg += `</text>`;
    });

    svg += `</svg>`;
    return svg;
}

function buildZlecenieHtml(template, data) {
    const przejsciaRows = buildPrzejsciaRows(data);

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
        UWAGI: data.uwagi || '',
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
        GRAFIKA_KATOW: generateWellSvg(data)
    };

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

/** Build the list of well components for the label. */
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
            img: 'templates/ce_mark.png',
            alt: 'CE',
            text: 'AT/2009-03-1733'
        };
    }

    // DN1500, DN2000, DN2500 — Znak budowlany B
    return {
        img: 'templates/b_mark.png',
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
window.printZlecenie = printZlecenie;
window.printEtykieta = printEtykieta;
window.printEtykietaAll = printEtykietaAll;
