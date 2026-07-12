// @ts-check
/* ===== PRINTING — ACTIONS (Zlecenia) ===== */

async function printSingleZlecenie(orderId) {
    const po = zleceniaOrdersCache.find((o) => o.id === orderId);
    if (!po) {
        showToast('Nie znaleziono zlecenia', 'error');
        return;
    }

    showToast('Generowanie zlecenia...', 'info');

    const template = await fetchTemplate('templates/zlecenie.html');
    if (!template) return;

    const html = buildZlecenieFromPO(template, po);
    silentPrint(html);
}

async function printSingleEtykieta(orderId) {
    const po = zleceniaOrdersCache.find((o) => o.id === orderId);
    if (!po) {
        showToast('Nie znaleziono zlecenia', 'error');
        return;
    }

    showToast('Generowanie etykiety...', 'info');

    const template = await fetchTemplate('templates/etykieta.html');
    if (!template) return;

    const html = buildEtykietaFromPO(template, po);
    silentPrint(html);
}

async function printBatchZlecenia() {
    if (zleceniaSelectedIds.size === 0) {
        showToast('Zaznacz zlecenia do wydruku', 'error');
        return;
    }

    const orders = zleceniaOrdersCache.filter((o) => zleceniaSelectedIds.has(o.id));
    if (orders.length === 0) {
        showToast('Brak zleceń do wydruku', 'error');
        return;
    }

    showToast(`Generowanie ${orders.length} zleceń...`, 'info');

    const template = await fetchTemplate('templates/zlecenie.html');
    if (!template) return;

    const pageStartIdx = template.indexOf('<div class="page">');
    const bodyEndIdx = template.lastIndexOf('</body>');
    if (pageStartIdx < 0 || bodyEndIdx < 0) {
        showToast('Błąd szablonu zlecenia — brak bloku .page', 'error');
        return;
    }

    const headSection = template.substring(0, template.indexOf('</head>'));
    const pageTemplate = template.substring(pageStartIdx, bodyEndIdx).trim();
    const batchPageStyle =
        '<style>.page { page-break-after: always; } .page:last-child { page-break-after: auto; }</style>';

    let allPages = '';
    orders.forEach((po) => {
        allPages += buildZlecenieFromPageBlock(pageTemplate, po) + '\n';
    });

    const finalHTML =
        headSection + batchPageStyle + '</head>\n<body>\n' + allPages + '</body></html>';
    silentPrint(finalHTML);
}

function buildZlecenieFromPageBlock(pageTemplate, po) {
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

    return renderTemplate(pageTemplate, payload);
}

async function printBatchEtykiety() {
    if (zleceniaSelectedIds.size === 0) {
        showToast('Zaznacz zlecenia do wydruku', 'error');
        return;
    }

    const orders = zleceniaOrdersCache.filter((o) => zleceniaSelectedIds.has(o.id));
    if (orders.length === 0) {
        showToast('Brak zleceń do wydruku', 'error');
        return;
    }

    showToast(`Generowanie ${orders.length} etykiet...`, 'info');

    const template = await fetchTemplate('templates/etykieta.html');
    if (!template) return;

    const pageStartIdx = template.indexOf('<div class="page">');
    const pageEndComment = template.indexOf('<!-- KONIEC BLOKU "page" -->');
    if (pageStartIdx < 0 || pageEndComment < 0) {
        showToast('Błąd szablonu etykiety — brak bloku .page', 'error');
        return;
    }

    const headSection = template.substring(0, template.indexOf('</head>'));
    const pageTemplate = template
        .substring(pageStartIdx, pageEndComment + '<!-- KONIEC BLOKU "page" -->'.length)
        .trim();
    const batchPageStyle =
        '<style>.page { page-break-after: always; } .page:last-child { page-break-after: auto; }</style>';

    let allPages = '';
    let allFitCalls = '';

    orders.forEach((po, i) => {
        const populatedPage = buildEtykietaPageBlock(pageTemplate, po, i);
        allPages += populatedPage + '\n';
        allFitCalls += `fitSvgText('snr-svg-${i}'); fitSvgText('order-svg-${i}');\n`;
    });

    const fitScript = `
<script>
function runAllFit() {
    ${allFitCalls}
}
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(runAllFit);
} else {
    setTimeout(runAllFit, 200);
}
setTimeout(runAllFit, 400);
</script>`;

    const finalHTML =
        headSection +
        batchPageStyle +
        '</head>\n<body>\n' +
        allPages +
        fitScript +
        '\n</body></html>';
    silentPrint(finalHTML);
}

function buildEtykietaPageBlock(pageTemplate, po, pageIndex) {
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

    const payload = {
        SNR: po.snr || po.wellName || '',
        MAIN_ELEMENT: po.productName || '',
        NR_ZLECENIA: po.productionOrderNumber || '',
        ELEMENTY_ROWS: elementRows,
        CERT_IMG: cert.img,
        CERT_ALT: cert.alt,
        CERT_TEXT: cert.text
    };

    let html = renderTemplate(pageTemplate, payload);

    html = html.replaceAll('id="snr-svg"', `id="snr-svg-${pageIndex}"`);
    html = html.replaceAll('id="order-svg"', `id="order-svg-${pageIndex}"`);

    return html;
}
