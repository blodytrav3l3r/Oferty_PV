// @ts-check
/* ===== PRINTING — TEMPLATE BUILDERS (Zlecenia) ===== */

function ensureDisplayIndices(przejscia) {
    if (!przejscia || przejscia.length === 0) return;

    const sorted = [...przejscia].sort((a, b) => {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });

    sorted.forEach((p, idx) => {
        p.displayIndex = idx;
    });
}

function buildPrzejsciaRowsFromPO(po) {
    const przejscia = po.przejscia || [];
    const rzDna = parseFloat(po.rzednaDna) || 0;

    ensureDisplayIndices(przejscia);

    function formatRow(label, p) {
        const spadekK = p.spadekKineta || '';
        const spadekM = p.spadekMufa || '';
        const angle = parseFloat(p.angle) || 0;

        let pel = parseFloat(p.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna || 0;
        const wysokoscMm = Math.round((pel - (rzDna || 0)) * 1000);

        const katGon = p.angleGony || ((angle * 400) / 360).toFixed(2);
        const katWyk = p.angleExecution !== undefined ? p.angleExecution : 360 - angle;

        return {
            label,
            rodzaj: p.productCategory || '',
            srednica: p.productDn || '',
            spadekKineta: spadekK ? Math.round(parseFloat(spadekK)) + ' %' : '',
            spadekMufa: spadekM ? Math.round(parseFloat(spadekM)) + ' %' : '',
            katStopien: angle + '°',
            uwagi: '+ ' + wysokoscMm + ' mm',
            katGon,
            katWykonania: katWyk + '°'
        };
    }

    const totalSlots = Math.max(przejscia.length, 4);

    const uniqueAngles = [...new Set(przejscia.map((p) => parseFloat(p.angle) || 0))].sort(
        (a, b) => a - b
    );
    const angleToLabelNum = {};
    uniqueAngles.forEach((a, idx) => {
        angleToLabelNum[a] = idx;
    });

    const rows = [];
    for (let i = 0; i < totalSlots; i++) {
        const p = przejscia[i];
        if (p) {
            const prefix = p.flowType === 'wylot' ? 'Wylot' : 'Wlot';
            const angleNum = angleToLabelNum[parseFloat(p.angle) || 0];
            rows.push(formatRow(prefix + ' ' + angleNum, p));
        } else {
            const label = i === 0 ? 'Wylot 0' : 'Wlot ';
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

function generateSvgFromPO(po) {
    const przejscia = po.przejscia || [];
    if (przejscia.length === 0) return '';
    const rzDna = parseFloat(po.rzednaDna) || 0;

    const size = 400;
    const center = size / 2;
    const radius = 55;
    const labelFontSize = 11;
    const angleFontSize = 9;
    const lineHeight = 10;

    const svgParts = [];
    svgParts.push(
        `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#222" stroke-width="2.5" />`
    );
    svgParts.push(
        `<line x1="${center}" y1="${center - 5}" x2="${center}" y2="${center + 5}" stroke="#999" stroke-width="0.8" />`
    );
    svgParts.push(
        `<line x1="${center - 5}" y1="${center}" x2="${center + 5}" y2="${center}" stroke="#999" stroke-width="0.8" />`
    );

    const labels = [];

    const wylot = przejscia.find((p) => p.flowType === 'wylot' || parseFloat(p.angle) === 0);

    ensureDisplayIndices(przejscia);
    const labelsMap = new Map();
    przejscia.forEach((p) => {
        const prefix = p.flowType === 'wylot' ? 'Wylot' : 'Wlot';
        labelsMap.set(p, `${prefix} ${p.displayIndex}`);
    });

    przejscia.forEach((p) => {
        const angle = parseFloat(p.angle) || 0;
        const rad = (angle * Math.PI) / 180;
        const x = center + radius * Math.sin(rad);
        const y = center + radius * Math.cos(rad);
        const isWylot = p === wylot;

        svgParts.push(
            `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${isWylot ? '#000' : '#444'}" stroke-width="${isWylot ? 3.5 : 1.8}" />`
        );

        const labelRadius = radius + 40;
        const lx = center + labelRadius * Math.sin(rad);
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

        const pel = parseFloat(p.rzednaWlaczenia) || rzDna;
        const hMm = Math.round((pel - rzDna) * 1000);
        const hText = hMm > 0 ? ` (+${hMm}mm)` : '';

        const rodzaj = (p.productCategory || '').toUpperCase();
        const dn = p.productDn || '';
        const prefix = labelsMap.get(p) || 'Wlot';

        const fullName = `${prefix}${rodzaj ? ' ' + rodzaj : ''}${dn ? ' DN' + dn : ''}`;
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
            origX: lx,
            origY: ly,
            lx,
            ly,
            anchor,
            offsetX,
            isRight: lx >= center,
            lines,
            textAngle: `${angle}°${hText}`
        });
    });

    const leftLabels = labels.filter((l) => !l.isRight).sort((a, b) => a.ly - b.ly);
    const rightLabels = labels.filter((l) => l.isRight).sort((a, b) => a.ly - b.ly);

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

    let minX = center - radius - 5;
    let maxX = center + radius + 5;
    let minY = center - radius - 5;
    let maxY = center + radius + 5;

    labels.forEach((l) => {
        const textHeight = (l.lines.length + 1) * lineHeight;
        if (l.ly - 5 < minY) minY = l.ly - 5;
        if (l.ly + textHeight > maxY) maxY = l.ly + textHeight;

        const svgTexts = [...l.lines, l.textAngle];
        const maxTextLen = Math.max(...svgTexts.map((t) => t.length));
        const textW = maxTextLen * 8;

        if (l.anchor === 'end') {
            if (l.lx + l.offsetX - textW - 10 < minX) minX = l.lx + l.offsetX - textW - 10;
        } else if (l.anchor === 'start') {
            if (l.lx + l.offsetX + textW + 10 > maxX) maxX = l.lx + l.offsetX + textW + 10;
        } else {
            if (l.lx + l.offsetX - textW / 2 - 10 < minX) minX = l.lx + l.offsetX - textW / 2 - 10;
            if (l.lx + l.offsetX + textW / 2 + 10 > maxX) maxX = l.lx + l.offsetX + textW / 2 + 10;
        }

        if (Math.abs(l.origY - l.ly) > 2) {
            const lineDist = l.ly > l.origY ? -8 : 8;
            svgParts.push(
                `<line x1="${l.origX}" y1="${l.origY}" x2="${l.lx}" y2="${l.ly + lineDist}" stroke="#ccc" stroke-dasharray="2,2" stroke-width="0.8" />`
            );
        }
        let textSvg = `<text x="${l.lx + l.offsetX}" y="${l.ly}" text-anchor="${l.anchor}" font-family="Arial, sans-serif" font-size="${labelFontSize}" font-weight="bold" fill="#000">`;
        l.lines.forEach((line, li) => {
            textSvg += `<tspan x="${l.lx + l.offsetX}" dy="${li === 0 ? '0' : '1.1em'}" fill="#000">${line}</tspan>`;
        });
        textSvg += `<tspan x="${l.lx + l.offsetX}" dy="1.1em" font-size="${angleFontSize}" font-weight="normal" fill="#444">${l.textAngle}</tspan>`;
        textSvg += `</text>`;
        svgParts.push(textSvg);
    });

    const pad = 12;
    const vbX = Math.floor(minX - pad);
    const vbY = Math.floor(minY - pad);
    const vbW = Math.ceil(maxX - minX + pad * 2);
    const vbH = Math.ceil(maxY - minY + pad * 2);
    const svgW = 200;
    const svgH = Math.round(svgW * (vbH / vbW));

    let svg = `<svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${svgW}" height="${svgH}" style="background:transparent;">`;
    svg += svgParts.join('');
    svg += `</svg>`;
    return svg;
}

function buildZlecenieFromPO(template, po) {
    const przejsciaRows = buildPrzejsciaRowsFromPO(po);

    function getPowloka() {
        const parts = [];
        if (po.malowanieW && po.malowanieW !== 'brak') {
            let desc = '';
            if (po.malowanieW === 'kineta') desc = 'Kineta';
            else if (po.malowanieW === 'kineta_dennica') desc = 'Kineta+denn.';
            else if (po.malowanieW === 'cale') desc = 'Całość';
            if (desc) {
                let p = 'Wew: ' + desc;
                if (po.powlokaNameW) p += ' (' + po.powlokaNameW + ')';
                parts.push(p);
            }
        }
        if (po.malowanieZ === 'zewnatrz') {
            let p = 'Zew:';
            if (po.powlokaNameZ) p += ' (' + po.powlokaNameZ + ')';
            parts.push(p);
        }
        return parts.length > 0 ? parts.join('<br>') : 'Brak';
    }

    const payload = {
        NR_ZLECENIA: po.productionOrderNumber || '',
        OBIEKT: po.obiekt || '',
        ADRES: po.adres || '',
        WYKONAWCA: po.wykonawca || '',
        FAKTUROWANE: po.fakturowane || '',
        DATA_PRODUKCJI: po.dataProdukcji || '',
        SNR: po.snr || po.wellName || '',
        SREDNICA: po.srednica || po.dn || '',
        WYSOKOSC: po.wysokosc || '',
        GLEBOKOSC: po.glebokosc || '',
        DNO_KINETA: po.dnoKineta || '',
        UWAGI: po.uwagi || '',
        DATA: po.data || '',
        NAZWISKO: po.nazwisko || '',
        RED_KINETY: paramLabel(po.redukcjaKinety) || 'Brak',
        SPOCZNIK_H: paramLabel(po.spocznikH) || 'Brak',
        USYTUOWANIE: paramLabel(po.usytuowanie) || 'Brak',
        DIN: po.din || 'Brak',
        KINETA: paramLabel(po.kineta) || 'Brak',
        SPOCZNIK: paramLabel(po.spocznik) || 'Brak',
        RODZAJ_STOPNI:
            paramLabel(po.rodzajStopni) + (po.stopnieInne ? ' — ' + po.stopnieInne : '') || 'Brak',
        KLASA_BETONU: po.klasaBetonu || 'Brak',
        KAT_STOPNI: po.katStopni ? po.katStopni + '°' : 'Brak',
        WYKONANIE: po.wykonanie || 'Brak',
        POWLOKA: getPowloka(),
        GRAFIKA_KATOW: generateSvgFromPO(po)
    };

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

function buildEtykietaFromPO(template, po, pageIndex = 0) {
    function getCertData(dn) {
        const dnStr = String(dn || '');
        const match = dnStr.match(/(\d{3,4})/);
        const numDn = match ? parseInt(match[1]) : 0;
        if ([1000, 1200].includes(numDn)) {
            return { img: 'images/ce-mark.png', alt: 'CE', text: 'AT/2009-03-1733' };
        }
        return {
            img: 'images/b-mark.png',
            alt: 'B',
            text: 'IBDIM KOT 2018/0195 WYD.2<br>KDWU B/73/2023'
        };
    }

    const cert = getCertData(po.srednica || po.dn);

    const elementy = po.etykietaElementy || [];
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

    const snrSvgId = 'snr-svg-' + pageIndex;
    const orderSvgId = 'order-svg-' + pageIndex;

    const payload = {
        SNR: po.snr || po.wellName || '',
        MAIN_ELEMENT: po.productName || '',
        NR_ZLECENIA: po.productionOrderNumber || '',
        ELEMENTY_ROWS: elementRows,
        CERT_IMG: cert.img,
        CERT_ALT: cert.alt,
        CERT_TEXT: cert.text
    };

    let html = renderTemplate(template, payload);
    html = html.replaceAll('id="snr-svg"', `id="${snrSvgId}"`);
    html = html.replaceAll('id="order-svg"', `id="${orderSvgId}"`);
    html = html.replaceAll("fitSvgText('snr-svg')", `fitSvgText('${snrSvgId}')`);
    html = html.replaceAll("fitSvgText('order-svg')", `fitSvgText('${orderSvgId}')`);

    return html;
}
