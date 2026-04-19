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
 * Zbiera wszystkie dane potrzebne do wydruku z bieżącego formularza zlecenia
 * i wybranego elementu. Zwraca null, jeśli nic nie zostało wybrane.
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
        // Parametry studni
        snr: well.numer || well.name || '',
        srednica: getValue('zl-srednica', well.dn),
        wysokosc: getValue('zl-wysokosc'),
        glebokosc: getValue('zl-glebokosc'),
        dnoKineta: getValue('zl-dno-kineta'),
        rodzajStudni: getValue('zl-rodzaj-studni'),
        // Parametry
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
        // Surowe dane
        well,
        product,
        elementIndex,
        wellIndex,
        existing
    };
}

/** Mapuje wewnętrzną wartość parametru na czytelną dla człowieka etykietę */
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
 * Nadaje displayIndex przejściom na podstawie kątów (ruch wskazówek zegara).
 * Przejścia na tym samym kącie dostają ten sam numer. Kąt 0° = indeks 0.
 */
function ensureDisplayIndices(przejscia) {
    if (!przejscia || przejscia.length === 0) return;

    const sorted = [...przejscia].sort((a, b) => {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });

    let currentIdx = 0;
    let prevAngle = null;

    sorted.forEach(p => {
        const angle = parseFloat(p.angle) || 0;
        if (prevAngle !== null && angle !== prevAngle) {
            currentIdx++;
        }
        p.displayIndex = currentIdx;
        prevAngle = angle;
    });
}

/**
 * Buduje wiersze przejść dla wydruku Zlecenia.
 * Iteruje po displayIndex od 0 do max, zostawiając puste wiersze dla luk.
 * Etykiety (Wlot/Wylot) odpowiadają rzeczywistemu flowType przejścia.
 */
function buildPrzejsciaRows(data) {
    const well = data.well;
    const przejscia = well.przejscia || [];
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProductFn, true);

    // Najpierw nadaj displayIndex WSZYSTKIM przejściom (spójność z Lista przejść)
    ensureDisplayIndices(przejscia);

    const assignedPrzejscia = przejscia.filter((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
        return assignedIndex === data.elementIndex;
    });

    const maxIdx = assignedPrzejscia.length > 0
        ? Math.max(...assignedPrzejscia.map(p => p.displayIndex))
        : -1;
    const totalSlots = Math.max(maxIdx + 1, 4);

    const rows = [];
    for (let i = 0; i < totalSlots; i++) {
        const p = assignedPrzejscia.find(t => t.displayIndex === i);
        if (p) {
            const prefix = p.flowType === 'wylot' ? 'Wylot' : 'Wlot';
            rows.push(formatPrzejscieRow(`${prefix} ${i}`, p, findProductFn, rzDna));
        } else {
            const label = i === 0 ? 'Wylot 0' : `Wlot ${i}`;
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

    // Filtruj przejścia według przypisanego elementu, jeśli podano elementIndex
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
    const size = 400;
    const center = size / 2;
    const radius = 58;
    const labelFontSize = 11;
    const angleFontSize = 9;
    const lineHeight = 10;

    // Oceniamy z jakich kątów korzystamy
    let useKatWykonania = false;
    let angleTypeTitle = "Wg Kąt Stopień";
    
    // Pobranie z normalizacją do liczby (DN '1000' -> 1000)
    const dnStr = String(well.dn || '');
    const match = dnStr.match(/(\d{3,4})/);
    const numDn = match ? parseInt(match[1]) : 0;

    let isKragOt = false;
    if (data.product && data.product.componentType === 'krag_ot') {
        isKragOt = true;
    }

    if (isKragOt) {
        useKatWykonania = false;
        angleTypeTitle = "Kąty: Kąt Stopień";
    } else if (numDn === 2000 || numDn === 2500) {
        useKatWykonania = false;
        angleTypeTitle = "Kąty: Kąt Stopień";
    } else if ([1000, 1200, 1500].includes(numDn)) {
        useKatWykonania = true;
        angleTypeTitle = "Kąty: Kąt Wykonania";
    }

    // Budujemy elementy SVG do tablicy — viewBox dokleimy na końcu
    const svgParts = [];

    // Główny okrąg studni
    svgParts.push(`<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#222" stroke-width="2.5" />`);

    // Krzyż pomocniczy
    svgParts.push(`<line x1="${center}" y1="${center - 5}" x2="${center}" y2="${center + 5}" stroke="#999" stroke-width="0.8" />`);
    svgParts.push(`<line x1="${center - 5}" y1="${center}" x2="${center + 5}" y2="${center}" stroke="#999" stroke-width="0.8" />`);

    // Znacznik 0 stopni na dole grafiki
    svgParts.push(`<line x1="${center}" y1="${center + radius}" x2="${center}" y2="${center + radius + 10}" stroke="#777" stroke-width="1.5" />`);
    svgParts.push(`<text x="${center}" y="${center + radius + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#666">0°</text>`);

    const wylot = przejscia.find(p => p.flowType === 'wylot' || parseFloat(p.angle) === 0);
    ensureDisplayIndices(przejscia);
    const labelsMap = new Map();
    przejscia.forEach(p => {
        const prefix = p.flowType === 'wylot' ? 'Wylot' : 'Wlot';
        labelsMap.set(p, `${prefix} ${p.displayIndex}`);
    });

    const labels = [];

    przejscia.forEach((p) => {
        const baseAngle = parseFloat(p.angle) || 0;
        let angleDeg = baseAngle;
        if (useKatWykonania) {
            angleDeg = p.angleExecution !== undefined ? parseFloat(p.angleExecution) : (baseAngle === 0 || baseAngle === 360 ? 0 : 360 - baseAngle);
        }

        const rad = (angleDeg * Math.PI) / 180;

        const x = center - radius * Math.sin(rad);
        const y = center + radius * Math.cos(rad);

        const isWylot = p === wylot;
        svgParts.push(`<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${isWylot ? '#000' : '#444'}" stroke-width="${isWylot ? 3.5 : 1.8}" />`);

        const product =
            typeof studnieProducts !== 'undefined'
                ? studnieProducts.find((pr) => pr.id === p.productId)
                : null;
        const rodzaj = product ? product.category : '';
        const dn = product ? product.dn : '';
        const pel = parseFloat(p.rzednaWlaczenia) || rzDna;
        const hMm = Math.round((pel - rzDna) * 1000);
        const uwagiText = hMm > 0 ? `+${hMm}mm` : '';

        const labelRadius = radius + 40;
        const lx = center - labelRadius * Math.sin(rad);
        const ly = center + labelRadius * Math.cos(rad);

        let anchor = 'middle';
        let offsetX = 0;
        if (lx < center - 15) {
            anchor = 'end';
            offsetX = -4;
        } else if (lx > center + 15) {
            anchor = 'start';
            offsetX = 4;
        }

        const prefix = labelsMap.get(p) || 'Wlot';
        const fullName = `${prefix}${rodzaj ? ' ' + rodzaj.toUpperCase() : ''}${dn ? ' DN' + dn : ''}`;
        const maxLineLen = 16;
        const words = fullName.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            if (currentLine.length + word.length + 1 > maxLineLen && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        }
        if (currentLine) lines.push(currentLine);

        labels.push({
            origX: lx, origY: ly, lx: lx, ly: ly,
            anchor, offsetX,
            isRight: (lx >= center),
            lines,
            textAngle: `${angleDeg}°${uwagiText ? ' (' + uwagiText + ')' : ''}`
        });
    });
    const leftLabels = labels.filter(l => !l.isRight).sort((a, b) => a.ly - b.ly);
    const rightLabels = labels.filter(l => l.isRight).sort((a, b) => a.ly - b.ly);

    function spreadLabels(arr) {
        const requiredGapBase = 8 + lineHeight;
        for (let loops = 0; loops < 15; loops++) {
            for (let i = 0; i < arr.length - 1; i++) {
                const aLines = arr[i].lines.length;
                const requiredGap = requiredGapBase + aLines * lineHeight;
                const diff = arr[i + 1].ly - arr[i].ly;
                if (diff < requiredGap) {
                    const push = (requiredGap - diff) / 2;
                    arr[i].ly -= push;
                    arr[i + 1].ly += push;
                }
            }
        }
    }
    spreadLabels(leftLabels);
    spreadLabels(rightLabels);

    // Oblicz pełny bounding box z zawartości (okrąg + etykiety)
    let minX = center - radius - 5;
    let maxX = center + radius + 5;
    let minY = center - radius - 5;
    let maxY = center + radius + 5;

    const estimateTextWidth = (text) => text.length * 5.5;

    labels.forEach(l => {
        const textHeight = (l.lines.length + 1) * lineHeight;
        if (l.ly - 5 < minY) minY = l.ly - 5;
        if (l.ly + textHeight > maxY) maxY = l.ly + textHeight;

        // Estymacja szerokości tekstu etykiety (ok. 8px na znak dla 11pt bold)
        const maxTextLen = Math.max(...l.lines.map(ln => ln.length), l.textAngle.length);
        const textW = maxTextLen * 8;
        if (l.anchor === 'end') {
            if (l.lx - textW - 10 < minX) minX = l.lx - textW - 10;
        } else if (l.anchor === 'start') {
            if (l.lx + textW + 10 > maxX) maxX = l.lx + textW + 10;
        } else {
            if (l.lx - textW / 2 - 10 < minX) minX = l.lx - textW / 2 - 10;
            if (l.lx + textW / 2 + 10 > maxX) maxX = l.lx + textW / 2 + 10;
        }

        // Linia prowadząca (leader line)
        if (Math.abs(l.origY - l.ly) > 2) {
            const lineDist = (l.ly > l.origY) ? -8 : 8;
            svgParts.push(`<line x1="${l.origX}" y1="${l.origY}" x2="${l.lx}" y2="${l.ly + lineDist}" stroke="#ccc" stroke-dasharray="2,2" stroke-width="0.8" />`);
        }
        let textSvg = `<text x="${l.lx + l.offsetX}" y="${l.ly}" text-anchor="${l.anchor}" font-family="Arial, sans-serif" font-size="${labelFontSize}" font-weight="bold" fill="#000">`;
        l.lines.forEach((line, li) => {
            textSvg += `<tspan x="${l.lx + l.offsetX}" dy="${li === 0 ? '0' : '1.1em'}" fill="#000">${line}</tspan>`;
        });
        textSvg += `<tspan x="${l.lx + l.offsetX}" dy="1.1em" font-size="${angleFontSize}" font-weight="normal" fill="#444">${l.textAngle}</tspan>`;
        textSvg += `</text>`;
        svgParts.push(textSvg);
    });

    // Dynamiczny viewBox — przycięty do pełnej zawartości
    const pad = 4;
    const vbX = Math.floor(minX - pad);
    const vbY = Math.floor(minY - pad);
    const vbW = Math.ceil(maxX - minX + pad * 2);
    const vbH = Math.ceil(maxY - minY + pad * 2);

    let svg = `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="width:100%; max-height:115px; background:transparent; display:block; margin:0 auto;">`;
    svg += svgParts.join('');
    svg += `</svg>`;
    return svg;
}

function buildZlecenieHtml(template, data) {
    const przejsciaRows = buildPrzejsciaRows(data);

    let angleTypeTitle = "Kąt stopień";
    const dnStr = String(data.well.dn || '');
    const numDn = parseInt(dnStr.match(/(\d{3,4})/) ? dnStr.match(/(\d{3,4})/)[1] : "0");
    if (data.product && data.product.componentType === 'krag_ot') {
        angleTypeTitle = "Kąt stopień";
    } else if (numDn === 2000 || numDn === 2500) {
        angleTypeTitle = "Kąt stopień";
    } else if ([1000, 1200, 1500].includes(numDn)) {
        angleTypeTitle = "Kąt wykonania";
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
        TYP_KATA: angleTypeTitle,
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
