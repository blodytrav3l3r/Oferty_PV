// @ts-check
/* ============================
   S.O.K. — Druk Zleceń Produkcyjnych
   printManager.js
   ============================ */

/** Cache dla pobranych szablonów HTML (Tymczasowo wyłączone do celów edycji na żywo) */
const templateCache = new Map();

/**
 * Potwierdzenie wydruku z edytora — licznik rośnie tylko po świadomym
 * kliknięciu [Drukuj], nie na samo otwarcie dialogu systemowego.
 * Esc/Anuluj/overlay dają false = brak liczenia (spójnie z listą zleceń).
 * @param {string} title
 * @param {string} documentName
 * @param {string} orderNumber
 */
async function confirmEditorPrint(title, documentName, orderNumber) {
    if (typeof window.appConfirm !== 'function') return false;
    return window.appConfirm(
        'Wydrukować ' +
            documentName +
            '?\n' +
            (orderNumber || '—') +
            '\n\nLicznik: potwierdzone uruchomienie wydruku.',
        { title, okText: 'Drukuj', cancelText: 'Anuluj', type: 'info' }
    );
}

function buildProductionPrintFileName(data) {
    const number = String(data.productionOrderNumber || '').replace(/[^a-zA-Z0-9]/g, '');
    const well = String(data.snr || data.wellName || '')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[. ]+|[. ]+$/g, '')
        .trim();
    return [number, well].filter(Boolean).join(' ') || 'zlecenie';
}

/**
 * Dolicza wydruk wykonany bezpośrednio z edytora zlecenia do licznika
 * widocznego w kartotece zleceń (ten sam endpoint co wydruki z listy).
 * Serwer zwraca świeżą wersję dokumentu — wpisujemy ją do listy PZ w RAM,
 * bo inaczej najbliższy zapis z edytora dostaje fałszywy 409.
 * @param {string|null|undefined} orderId
 * @param {'zlecenie'|'etykieta'} kind
 */
async function recordEditorPrint(orderId, kind) {
    if (!orderId) return;
    try {
        const res = await fetch(
            '/api/orders-studnie/production/' + encodeURIComponent(orderId) + '/print-count',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(typeof authHeaders === 'function' ? authHeaders() : {})
                },
                body: JSON.stringify({ kind })
            }
        );
        if (!res.ok) {
            logger.error('printManager', 'recordEditorPrint: HTTP ' + res.status);
            if (res.status === 409) {
                showToast(
                    'Licznik wydruku nie zapisany — zlecenie zmienione równolegle. Odśwież listę zleceń.',
                    'error'
                );
            }
            return;
        }
        const payload = await res.json().catch(() => ({}));
        applyPrintCountVersion(orderId, payload.version);
    } catch (err) {
        logger.error('printManager', 'recordEditorPrint error:', err);
    }
}

/** Wersja dokumentu z serwera (SSoT) → wpis PZ w RAM. Brak liczby = pomiń. */
function applyPrintCountVersion(orderId, version) {
    if (typeof version !== 'number') return;
    const list = Array.isArray(window.productionOrders) ? window.productionOrders : [];
    const entry = list.find((po) => po && String(po.id) === String(orderId));
    if (entry) entry.version = version;
}

/**
 * Zwraca szablon pobierany jednorazowo (teraz pobiera na nowo co kliknięcie by aktualizować zmiany graficzne w locie).
 */
async function getTemplate(path) {
    try {
        const res = await fetch(path + '?v=' + Date.now()); // dla deweloperki można utrzymać ?v=, w prod ew. zdjąć
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

/** Pobiera zapisane zlecenie po zapisie i tworzy dane druku wyłącznie z migawki PZ. */
async function loadSavedProductionOrder(orderId) {
    try {
        const res = await fetch('/api/orders-studnie/production/' + encodeURIComponent(orderId), {
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const payload = await res.json();
        const po = payload && payload.data;
        if (!po || String(po.id) !== String(orderId)) throw new Error('Nieprawidłowa odpowiedź');

        const product =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(po.productId)
                : typeof studnieProducts !== 'undefined'
                  ? studnieProducts.find((item) => item.id === po.productId)
                  : null;
        const well = {
            id: po.wellId,
            dn: po.dn,
            rzednaDna: po.rzednaDna,
            przejscia: Array.isArray(po.przejscia) ? po.przejscia : [],
            malowanieW: po.malowanieW,
            malowanieZ: po.malowanieZ,
            powlokaNameW: po.powlokaNameW,
            powlokaNameZ: po.powlokaNameZ,
            wkladkaOsadnikPreco: po.wkladkaOsadnikPreco,
            wkladkaOsadnikH: po.wkladkaOsadnikH,
            precoFullHeight: po.precoFullHeight
        };

        /** @type {typeof po} */
        const canonicalPo = Object.fromEntries(
            Object.entries(po).filter(([key]) => key !== 'productionOrderPrintNumber')
        );
        return {
            ...canonicalPo,
            snr: po.snr || po.wellName || '',
            srednica: po.srednica || po.dn || '',
            productName: po.productName || product?.name || '',
            product: {
                ...(product || {}),
                name: po.productName || product?.name || '',
                componentType: po.componentType || product?.componentType
            },
            well,
            etykietaElementy: Array.isArray(po.etykietaElementy) ? po.etykietaElementy : [],
            isSavedProductionOrder: true
        };
    } catch (err) {
        logger.error('printManager', 'loadSavedProductionOrder error:', err);
        showToast(
            'Nie udało się pobrać zapisanego zlecenia ' + orderId + '. Wydruk przerwany.',
            'error'
        );
        return null;
    }
}

/**
 * Znajduje przejścia powyżej dolnej dennicy, dla których nie ma w niej
 * przejścia pod tym samym kątem. Wymaga aktywnej kinety.
 *
 * @param {Object}   well                - Obiekt studni.
 * @param {number}   dennicaElementIndex  - Indeks dennicy w well.config.
 * @param {Array}    configMap            - Mapa konfiguracji z buildConfigMap().
 * @param {number}   rzDna                - Rzędna dna studni.
 * @param {boolean}  kinetaEnabled        - Czy na najniższej dennicy ma być kineta.
 * @returns {Array}  Lista przejść wymagających ślepej kinety.
 */
function findBlindKinetaEntries(
    well,
    dennicaElementIndex,
    configMap,
    rzDna,
    kinetaEnabled,
    findProductFn
) {
    const allPrzejscia = well.przejscia || [];
    if (!kinetaEnabled || allPrzejscia.length === 0) return [];

    const dennice = configMap.filter((entry) => entry.componentType === 'dennica');
    if (dennice.length === 0) return [];
    const bottomDennica = dennice.reduce((lowest, entry) =>
        entry.start < lowest.start ? entry : lowest
    );
    if (bottomDennica.index !== dennicaElementIndex) return [];

    const normalizeAngle = (value) => (((parseFloat(value) || 0) % 360) + 360) % 360;

    // Przejścia przypisane do dennicy
    const dennicaAngles = new Set();
    allPrzejscia.forEach((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mm = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mm, configMap);
        if (assignedIndex === dennicaElementIndex) {
            dennicaAngles.add(normalizeAngle(item.angle));
        }
    });

    // Przejścia w elementach powyżej dennicy (krag_ot lub inna dennica)
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

        const angle = normalizeAngle(item.angle);
        if (dennicaAngles.has(angle)) return;
        if (seenAngles.has(angle)) return;

        seenAngles.add(angle);
        blindEntries.push({
            ...item,
            angle,
            isBlindKineta: true,
            productCategory: 'Ślepa kineta',
            productDn: getProductionTransitionDiameter(item, findProductFn),
            displayIndex: blindEntries.length
        });
    });

    return blindEntries;
}

/**
 * Buduje wiersze przejść dla wydruku Zlecenia.
 * Iteruje po displayIndex od 0 do max, zostawiając puste wiersze dla luk.
 * Etykiety (Wlot/Wylot) odpowiadają rzeczywistemu flowType przejścia.
 *
 * Jeśli element to dennica i w kręgu z otworem (lub drugiej dennicy) powyżej
 * istnieje przejście na kącie, którego dennica nie ma — automatycznie dodaje
 * wiersz "Ślepa kineta" na tym kącie.
 */
function buildPrzejsciaRows(data) {
    const well = data.well;
    const przejscia = well.przejscia || [];
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) =>
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(id)
            : studnieProducts.find((pr) => pr.id === id);
    const configMap = data.isSavedProductionOrder ? [] : buildConfigMap(well, findProductFn, true);

    // Najpierw nadaj displayIndex WSZYSTKIM przejściom (spójność z Lista przejść)
    ensureDisplayIndices(przejscia);

    const assignedPrzejscia = data.isSavedProductionOrder
        ? przejscia.map((item) => ({
              item,
              heightFromElementMm: Number.isFinite(item.heightFromElementMm)
                  ? item.heightFromElementMm
                  : null
          }))
        : przejscia
              .map((item) => {
                  let pel = parseFloat(item.rzednaWlaczenia);
                  if (isNaN(pel)) pel = rzDna;
                  const mmFromBottom = (pel - rzDna) * 1000;
                  const { assignedIndex, entry } = findAssignedElement(mmFromBottom, configMap);
                  if (assignedIndex !== data.elementIndex) return null;
                  const heightFromElementMm = entry ? Math.round(mmFromBottom - entry.start) : null;
                  return { item, heightFromElementMm };
              })
              .filter(Boolean);

    // Ślepe kinety — tylko gdy element to dennica
    let blindEntries = [];
    const isDennica = data.product && data.product.componentType === 'dennica';
    if (isDennica && data.isSavedProductionOrder) {
        blindEntries = data.blindKinetaPrzejscia || [];
    } else if (isDennica) {
        blindEntries = findBlindKinetaEntries(
            well,
            data.elementIndex,
            configMap,
            rzDna,
            well.kineta !== 'brak' && configMap.some((entry) => entry.componentType === 'kineta'),
            findProductFn
        );
    }

    // Uwzględnij displayIndex ślepych kinet przy obliczaniu maxIdx
    const totalSlots = Math.max(assignedPrzejscia.length + blindEntries.length, 4);

    // Mapuj unikalne kąty do numerów etykiet (0=0, 90=1, 180=2, ...) dla grupowania wizualnego
    const uniqueAngles = [
        ...new Set(assignedPrzejscia.map(({ item }) => parseFloat(item.angle) || 0))
    ].sort((a, b) => a - b);
    const angleToLabelNum = {};
    uniqueAngles.forEach((a, idx) => {
        angleToLabelNum[a] = idx;
    });

    const rows = [];
    for (let i = 0; i < totalSlots; i++) {
        const assigned = assignedPrzejscia[i];
        if (assigned) {
            const { item: p, heightFromElementMm } = assigned;
            const prefix = p.flowType === FLOW_TYPES.WYLOT ? 'Wylot' : 'Wlot';
            const angleNum = angleToLabelNum[parseFloat(p.angle) || 0];
            rows.push(
                formatPrzejscieRow(prefix + ' ' + angleNum, p, findProductFn, heightFromElementMm)
            );
            continue;
        }

        // Sprawdź czy na tym indeksie jest ślepa kineta
        const blind = blindEntries[i - assignedPrzejscia.length];
        if (blind) {
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
function formatPrzejscieRow(label, p, findProductFn, heightFromElementMm) {
    const product = findProductFn ? findProductFn(p.productId) : null;
    const isCustom = p.isCustom === true;
    const rodzaj =
        p.productCategory ||
        (product
            ? product.category
            : typeof getPrzejscieCategoryLabel === 'function'
              ? getPrzejscieCategoryLabel(p, null)
              : isCustom
                ? String(p.customName || '')
                : '');
    const srednica =
        p.productDn ||
        (product
            ? product.dn
            : typeof getPrzejscieDnLabel === 'function'
              ? getPrzejscieDnLabel(p, null)
              : isCustom
                ? p.dn || ''
                : '');

    const spadekKineta = p.spadekKineta || '';
    const spadekMufa = p.spadekMufa || '';
    const angle = parseFloat(p.angle) || 0;

    const uwagi = Number.isFinite(heightFromElementMm)
        ? '+ ' + Math.round(heightFromElementMm) + ' mm'
        : '—';

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
        katGon: katGon,
        katWykonania: katWyk + '°'
    };
}

/**
 * Formatuje wiersz ślepej kinety do wydruku.
 * Ślepa kineta = kanał w dennicy bez otworu, prowadzący do przejścia w kręgu OT powyżej.
 */
function formatBlindKinetaRow(label, p, findProductFn) {
    const product = findProductFn ? findProductFn(p.productId) : null;
    const srednica = p.productDn || (product ? product.dn : '');
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
        katGon: katGon,
        katWykonania: katWyk + '°'
    };
}

// ===== ZLECENIE PRINT =====

async function printZlecenie() {
    // Auto-zapis zlecenia + synchronizacja oferty/zamówienia przed wydrukiem
    const orderId = await saveProductionOrder();
    if (!orderId) {
        showToast('Wydruk wstrzymany — zlecenie nie zostało zapisane', 'error');
        return;
    }

    const data = await loadSavedProductionOrder(orderId);
    if (!data) return;

    showToast('Generowanie zlecenia...', 'info');

    const template = await getTemplate('templates/zlecenie.html');
    if (!template) return;

    const html = buildZlecenieHtml(template, data);
    const ok = await confirmEditorPrint('Wydruk zlecenia', 'zlecenie', data.productionOrderNumber);
    if (!ok) return;
    silentPrint(html, buildProductionPrintFileName(data));
    await recordEditorPrint(orderId, 'zlecenie');
}

function getPowlokaString(well) {
    if (!well) return 'Brak';
    const parts = [];
    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'dennica') malWDesc = 'Dennica';
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
    let blindKinetaPrzejscia = [];
    if (data.isSavedProductionOrder && data.product && data.product.componentType === 'dennica') {
        blindKinetaPrzejscia = data.blindKinetaPrzejscia || [];
    } else if (
        !data.isSavedProductionOrder &&
        data.elementIndex !== undefined &&
        typeof buildConfigMap !== 'undefined' &&
        typeof findAssignedElement !== 'undefined'
    ) {
        const findProductFn = (id) =>
            typeof studnieProducts !== 'undefined'
                ? typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(id)
                    : studnieProducts.find((pr) => pr.id === id)
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

            // Dla dennicy: dodaj ślepe kinety do grafiki SVG
            const isDennica = data.product && data.product.componentType === 'dennica';
            if (isDennica) {
                blindKinetaPrzejscia = findBlindKinetaEntries(
                    well,
                    data.elementIndex,
                    configMap,
                    rzDna,
                    well.kineta !== 'brak' &&
                        configMap.some((entry) => entry.componentType === 'kineta'),
                    findProductFn
                );
            }
        }
    }

    if (przejscia.length === 0 && blindKinetaPrzejscia.length === 0) return '';

    // Zoptymalizowany obszar roboczy (viewBox), by powiększyć studnię
    const size = 400;
    const center = size / 2;
    const radius = 58;
    const labelFontSize = 11;
    const angleFontSize = 9;
    const lineHeight = 10;

    // Oceniamy z jakich kątów korzystamy
    let useKatWykonania = false;

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
    } else if (numDn === 2000 || numDn === 2500) {
        useKatWykonania = false;
    } else if ([1000, 1200, 1500].includes(numDn)) {
        useKatWykonania = true;
    }

    // Budujemy elementy SVG do tablicy — viewBox dokleimy na końcu
    const svgParts = [];

    // Główny okrąg studni
    svgParts.push(
        `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" class="stroke-slate-950" stroke-width="2.5" />`
    );

    // Krzyż pomocniczy
    svgParts.push(
        `<line x1="${center}" y1="${center - 5}" x2="${center}" y2="${center + 5}" class="stroke-slate-400" stroke-width="0.8" />`
    );
    svgParts.push(
        `<line x1="${center - 5}" y1="${center}" x2="${center + 5}" y2="${center}" class="stroke-slate-400" stroke-width="0.8" />`
    );

    // Znacznik 0 stopni na dole grafiki
    svgParts.push(
        `<line x1="${center}" y1="${center + radius}" x2="${center}" y2="${center + radius + 10}" style="stroke:var(--slate-500)" stroke-width="1.5" />`
    );
    svgParts.push(
        `<text x="${center}" y="${center + radius + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="bold" style="fill:var(--slate-500)">0°</text>`
    );

    const wylot = przejscia.find(
        (p) => p.flowType === FLOW_TYPES.WYLOT || parseFloat(p.angle) === 0
    );
    ensureDisplayIndices(przejscia);

    // Nadaj displayIndex ślepym kinetom (zachowują oryginalny displayIndex z well.przejscia)
    if (blindKinetaPrzejscia.length > 0) {
        ensureDisplayIndices(well.przejscia || []);
    }

    const labelsMap = new Map();
    przejscia.forEach((p) => {
        const prefix = p.flowType === FLOW_TYPES.WYLOT ? 'Wylot' : 'Wlot';
        labelsMap.set(p, `${prefix} ${p.displayIndex}`);
    });
    blindKinetaPrzejscia.forEach((p) => {
        labelsMap.set(p, `Ślepa ${p.displayIndex}`);
    });

    const labels = [];

    // Funkcja rysująca linię i etykietę dla przejścia (zwykłego lub ślepego)
    function drawTransitionSvg(p, isBlind) {
        const baseAngle = parseFloat(p.angle) || 0;
        let angleDeg = baseAngle;
        if (useKatWykonania) {
            angleDeg =
                p.angleExecution !== undefined
                    ? parseFloat(p.angleExecution)
                    : baseAngle === 0 || baseAngle === 360
                      ? 0
                      : 360 - baseAngle;
        }

        const rad = (angleDeg * Math.PI) / 180;

        const x = center - radius * Math.sin(rad);
        const y = center + radius * Math.cos(rad);

        const isWylot = p === wylot;
        if (isBlind) {
            // Ślepa kineta — linia przerywana, szary kolor
            svgParts.push(
                `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" class="stroke-slate-400" stroke-width="1.5" stroke-dasharray="4,3" />`
            );
        } else {
            svgParts.push(
                `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" style="stroke:${isWylot ? 'var(--black)' : 'var(--slate-700)'}" stroke-width="${isWylot ? 3.5 : 1.8}" />`
            );
        }

        const product =
            typeof studnieProducts !== 'undefined'
                ? typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(p.productId)
                    : studnieProducts.find((pr) => pr.id === p.productId)
                : null;
        const rodzaj = isBlind
            ? 'ŚLEPA'
            : p.productCategory ||
              (product ? product.category : p.isCustom === true ? String(p.customName || '') : '');
        const dn =
            p.productDn ||
            (product ? product.dn : p.isCustom === true ? (p.dn != null ? p.dn : '') : '');
        const hMm = Number.isFinite(p.heightFromElementMm)
            ? Math.round(p.heightFromElementMm)
            : null;
        const uwagiText = isBlind ? 'ślepa' : hMm > 0 ? `+${hMm}mm` : '';

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
            origX: lx,
            origY: ly,
            lx: lx,
            ly: ly,
            anchor,
            offsetX,
            isRight: lx >= center,
            lines,
            textAngle: `${angleDeg}°${uwagiText ? ' (' + uwagiText + ')' : ''}`,
            isBlind: isBlind
        });
    }

    przejscia.forEach((p) => drawTransitionSvg(p, false));
    blindKinetaPrzejscia.forEach((p) => drawTransitionSvg(p, true));
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

    // Oblicz pełny bounding box z zawartości (okrąg + etykiety)
    let minX = center - radius - 5;
    let maxX = center + radius + 5;
    let minY = center - radius - 5;
    let maxY = center + radius + 5;

    labels.forEach((l) => {
        const textHeight = (l.lines.length + 1) * lineHeight;
        if (l.ly - 5 < minY) minY = l.ly - 5;
        if (l.ly + textHeight > maxY) maxY = l.ly + textHeight;

        // Estymacja szerokości tekstu etykiety (ok. 8px na znak dla 11pt bold)
        const maxTextLen = Math.max(...l.lines.map((ln) => ln.length), l.textAngle.length);
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
            const lineDist = l.ly > l.origY ? -8 : 8;
            svgParts.push(
                `<line x1="${l.origX}" y1="${l.origY}" x2="${l.lx}" y2="${l.ly + lineDist}" class="stroke-slate-300" stroke-dasharray="2,2" stroke-width="0.8" />`
            );
        }
        const textFill = l.isBlind ? 'var(--slate-400)' : 'var(--black)';
        const subFill = l.isBlind ? 'var(--slate-400)' : 'var(--slate-700)';
        let textSvg = `<text x="${l.lx + l.offsetX}" y="${l.ly}" text-anchor="${l.anchor}" font-family="Arial, sans-serif" font-size="${labelFontSize}" font-weight="bold" style="fill:${textFill}">`;
        l.lines.forEach((line, li) => {
            textSvg += `<tspan x="${l.lx + l.offsetX}" dy="${li === 0 ? '0' : '1.1em'}" style="fill:${textFill}">${line}</tspan>`;
        });
        textSvg += `<tspan x="${l.lx + l.offsetX}" dy="1.1em" font-size="${angleFontSize}" font-weight="normal" style="fill:${subFill}">${l.textAngle}</tspan>`;
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
        const osadnikNote = `<strong style="color:var(--warn); font-size:1.1em; display:block; margin-top:5px;">UWAGA: OSADNIK - WKŁADKA PRECO (Dno + Ściany ${data.well.wkladkaOsadnikH || 0} mm)</strong>`;
        finalUwagi = finalUwagi ? finalUwagi + '<br>' + osadnikNote : osadnikNote;
    } else if (
        data.well &&
        (data.well.precoFullHeight === 'tak' || data.well.precoFullHeight === true) &&
        data.product &&
        (data.product.componentType === 'dennica' || data.product.componentType === 'styczna')
    ) {
        const fullHeightNote =
            '<strong style="color:var(--danger); font-size:1.1em; display:block; margin-top:5px;">UWAGA: WKŁADKA PRECO NA CAŁEJ WYSOKOŚCI DENNICY!</strong>';
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
    const crossRefs = data.siblingCrossReferences;
    if (crossRefs) {
        payload.UWAGI =
            (payload.UWAGI ? payload.UWAGI + '<br>' : '') + '<b>' + escapeHtml(crossRefs) + '</b>';
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
                <td>${escapeHtml(przejsciaRows[i].uwagi || '')}</td>
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
            <td>${escapeHtml(r.uwagi || '')}</td>
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
async function printEtykieta() {
    // Auto-zapis zlecenia + synchronizacja oferty/zamówienia przed wydrukiem
    const orderId = await saveProductionOrder();
    if (!orderId) {
        showToast('Wydruk wstrzymany — zlecenie nie zostało zapisane', 'error');
        return;
    }

    const data = await loadSavedProductionOrder(orderId);
    if (!data) return;

    showToast('Generowanie etykiety...', 'info');

    const template = await getTemplate('templates/etykieta.html');
    if (!template) return;

    const html = buildEtykietaHtml(template, data);
    const ok = await confirmEditorPrint('Wydruk etykiety', 'etykietę', data.productionOrderNumber);
    if (!ok) return;
    silentPrint(html, buildProductionPrintFileName(data));
    await recordEditorPrint(orderId, 'etykieta');
}

// ===== GLOBAL EXPORTS =====
window.printZlecenie = printZlecenie;
window.printEtykieta = printEtykieta;
