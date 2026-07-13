// @ts-check
/* ===== PRINT MANAGER — Funkcje rdzenne (API publiczne, helpers, przejscia rows) ===== */

const templateCache = new Map();

async function getTemplate(path) {
    try {
        const res = await fetch(path + '?v=' + Date.now());
        if (!res.ok) throw new Error(`Nie znaleziono szablonu: ${path}`);
        const html = await res.text();
        templateCache.set(path, html);
        return html;
    } catch (err) {
        showToast(`Błąd szablonu: ${err.message}`, 'error');
        logger.error('printManager', err);
        return null;
    }
}

function renderTemplate(template, dataObj) {
    return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
        return dataObj[key] !== undefined ? dataObj[key] : '';
    });
}

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

    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();

            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 60000);
        }, 500);
    };
}

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
        snr: well.numer || well.name || '',
        srednica: getValue('zl-srednica', well.dn),
        wysokosc: getValue('zl-wysokosc'),
        glebokosc: getValue('zl-glebokosc'),
        dnoKineta: getValue('zl-dno-kineta'),
        rodzajStudni: getValue('zl-rodzaj-studni'),
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
        well,
        product,
        elementIndex,
        wellIndex,
        existing
    };
}

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

function ensureDisplayIndices(przejscia) {
    if (!przejscia || przejscia.length === 0) return;

    const sorted = [...przejscia].sort((a, b) => {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });

    sorted.forEach((p, idx) => {
        p.displayIndex = idx;
    });
}

function findBlindKinetaEntries(well, dennicaElementIndex, configMap, rzDna) {
    const allPrzejscia = well.przejscia || [];
    if (allPrzejscia.length === 0) return [];

    const dennicaAngles = new Set();
    allPrzejscia.forEach((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mm = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mm, configMap);
        if (assignedIndex === dennicaElementIndex) {
            dennicaAngles.add(parseFloat(item.angle) || 0);
        }
    });

    const blindEntries = [];
    const seenAngles = new Set();

    allPrzejscia.forEach((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mm = (pel - rzDna) * 1000;
        const { assignedIndex, entry } = findAssignedElement(mm, configMap);

        if (assignedIndex === dennicaElementIndex) return;
        if (!entry) return;
        if (entry.componentType !== 'krag_ot' && entry.componentType !== 'dennica') return;

        const angle = parseFloat(item.angle) || 0;
        if (dennicaAngles.has(angle)) return;
        if (seenAngles.has(angle)) return;

        seenAngles.add(angle);
        blindEntries.push(item);
    });

    return blindEntries;
}

function buildPrzejsciaRows(data) {
    const well = data.well;
    const przejscia = well.przejscia || [];
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProductFn, true);

    ensureDisplayIndices(przejscia);

    const assignedPrzejscia = przejscia.filter((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
        return assignedIndex === data.elementIndex;
    });

    let blindEntries = [];
    const isDennica = data.product && data.product.componentType === 'dennica';
    if (isDennica) {
        blindEntries = findBlindKinetaEntries(well, data.elementIndex, configMap, rzDna);
    }

    const totalSlots = Math.max(assignedPrzejscia.length + blindEntries.length, 4);

    const uniqueAngles = [...new Set(assignedPrzejscia.map((p) => parseFloat(p.angle) || 0))].sort(
        (a, b) => a - b
    );
    const angleToLabelNum = {};
    uniqueAngles.forEach((a, idx) => {
        angleToLabelNum[a] = idx;
    });

    const rows = [];
    for (let i = 0; i < totalSlots; i++) {
        const p = assignedPrzejscia[i];
        if (p) {
            const prefix = p.flowType === FLOW_TYPES.WYLOT ? 'Wylot' : 'Wlot';
            const angleNum = angleToLabelNum[parseFloat(p.angle) || 0];
            rows.push(formatPrzejscieRow(prefix + ' ' + angleNum, p, findProductFn, rzDna));
            continue;
        }

        const blind = blindEntries[i - assignedPrzejscia.length];
        if (blind) {
            const blindAngleNum = angleToLabelNum[parseFloat(blind.angle) || 0] ?? i;
            rows.push(formatBlindKinetaRow('Wlot ', blind, findProductFn));
            continue;
        }

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
    return rows;
}

function formatPrzejscieRow(label, p, findProductFn, rzDna) {
    const product = findProductFn ? findProductFn(p.productId) : null;
    const rodzaj = product ? product.category : '';
    const srednica = product ? product.dn : '';

    const spadekKineta = p.spadekKineta || '';
    const spadekMufa = p.spadekMufa || '';
    const angle = parseFloat(p.angle) || 0;

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
        spadekKineta:
            spadekKineta && parseFloat(spadekKineta) !== 0
                ? Math.round(parseFloat(spadekKineta)) + ' %'
                : '',
        spadekMufa:
            spadekMufa && parseFloat(spadekMufa) !== 0
                ? Math.round(parseFloat(spadekMufa)) + ' %'
                : '',
        katStopien: angle + '°',
        uwagi,
        katGon,
        katWykonania: katWyk + '°'
    };
}

function formatBlindKinetaRow(label, p, findProductFn) {
    const product = findProductFn ? findProductFn(p.productId) : null;
    const srednica = product ? product.dn : '';
    const angle = parseFloat(p.angle) || 0;

    const katGon = p.angleGony || ((angle * 400) / 360).toFixed(2);
    const katWyk = p.angleExecution !== undefined ? p.angleExecution : 360 - angle;

    return {
        label,
        rodzaj: 'Ślepa kineta',
        srednica,
        spadekKineta: '',
        spadekMufa: '',
        katStopien: angle + '°',
        uwagi: 'Ślepa',
        katGon,
        katWykonania: katWyk + '°'
    };
}

async function printZlecenie() {
    await saveProductionOrder();

    const data = collectPrintData();
    if (!data) return;

    showToast('Generowanie zlecenia...', 'info');

    const template = await getTemplate('templates/zlecenie.html');
    if (!template) return;

    const html = buildZlecenieHtml(template, data);
    silentPrint(html);
}

window.printZlecenie = printZlecenie;
