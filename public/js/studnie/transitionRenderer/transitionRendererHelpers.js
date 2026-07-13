// @ts-check
/* ===== transitionRenderer — funkcje pomocnicze (bez DOM) ===== */

function getFlowVisuals(flowType) {
    var isWylot = flowType === FLOW_TYPES.WYLOT;
    return {
        label: isWylot ? 'Wylot' : 'Wlot',
        bg: isWylot ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
        color: isWylot ? '#fca5a5' : '#93c5fd',
        border: isWylot ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)',
        icon: isWylot ? '<i data-lucide="upload"></i>' : '<i data-lucide="download"></i>'
    };
}

function getAngleColor(angle) {
    return angle === 0 || angle === '0' ? '#6366f1' : '#818cf8';
}

function calcExecutionAngle(angle) {
    return angle === 0 || angle === 360 ? 0 : 360 - angle;
}

function calcGonyAngle(angle) {
    return (angle === 0 || angle === 360 ? 0 : ((360 - angle) * 400) / 360).toFixed(2);
}

function getClockIndex(item, opts) {
    if (item.displayIndex !== undefined && item.displayIndex !== null) {
        return item.displayIndex;
    }
    var w = opts.well;
    if (!w && typeof window.getCurrentWell === 'function') {
        w = window.getCurrentWell();
    }
    if (!w || !w.przejscia) return '';
    var sorted = [...w.przejscia].sort(function (a, b) {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });
    var idx = sorted.indexOf(item);
    return idx >= 0 ? idx + 1 : '';
}

function classifyFlowType(item, globalIndex) {
    if (!item.flowTypeManual) {
        item.flowType = item.angle === 0 || item.angle === '0' ? FLOW_TYPES.WYLOT : FLOW_TYPES.WLOT;
    }
    if (!item.flowType) {
        item.flowType =
            globalIndex === 0 && (item.angle === 0 || item.angle === '0')
                ? FLOW_TYPES.WYLOT
                : FLOW_TYPES.WLOT;
    }
}

function buildConfigMap(well, findProductFn, includeName) {
    if (includeName === undefined) includeName = false;
    var typeBadge = {
        wlaz: { bg: '#374151' },
        plyta_din: { bg: '#1e3a5f' },
        plyta_najazdowa: { bg: '#1e3a5f' },
        plyta_zamykajaca: { bg: '#1e3a5f' },
        pierscien_odciazajacy: { bg: '#1e3a5f' },
        konus: { bg: '#7c3aed30' },
        avr: { bg: '#44403c' },
        plyta_redukcyjna: { bg: '#6d28d920' },
        krag: { bg: '#164e63' },
        krag_ot: { bg: '#312e81' },
        dennica: { bg: '#14532d' },
        kineta: { bg: '#9d174d' }
    };
    var configMap = [];
    var currY = 0;
    var dennicaProcessedCount = 0;
    for (var j = well.config.length - 1; j >= 0; j--) {
        var cItem = well.config[j];
        var p = findProductFn(cItem.productId);
        if (!p) continue;
        var h = 0;
        if (p.componentType === 'dennica') {
            for (var q = 0; q < cItem.quantity; q++) {
                dennicaProcessedCount++;
                h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
            }
        } else {
            h = (p.height || 0) * cItem.quantity;
        }
        var entry = {
            index: j,
            start: currY,
            end: currY + h,
            componentType: p.componentType,
            productId: p.id
        };
        if (includeName) {
            var badge = typeBadge[p.componentType] || { bg: '#333333' };
            entry.name = p.name;
            entry.bg = badge.bg;
        }
        configMap.push(entry);
        currY += h;
    }
    return configMap;
}

function findAssignedElement(mmFromBottom, configMap) {
    for (var ci = 0; ci < configMap.length; ci++) {
        var cm = configMap[ci];
        if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
            return { assignedIndex: cm.index, entry: cm };
        }
    }
    if (configMap.length > 0) {
        var tgt = mmFromBottom < 0 ? configMap[0] : configMap[configMap.length - 1];
        return { assignedIndex: tgt.index, entry: tgt };
    }
    return { assignedIndex: -1, entry: null };
}

function computeHeightFromElement(mmFromBottom, configMap) {
    var elementStartMm = 0;
    for (var ci = 0; ci < configMap.length; ci++) {
        var cm = configMap[ci];
        if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
            elementStartMm = cm.start;
            break;
        }
    }
    return Math.round(mmFromBottom - elementStartMm);
}

function ensureDisplayIndices(przejscia) {
    if (!przejscia || przejscia.length === 0) return;
    var sorted = [...przejscia].sort(function (a, b) {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });
    sorted.forEach(function (p, idx) {
        p.displayIndex = idx;
    });
}

function renderMirrorTransitions(container, items, well, findProductFn, configMap, rzDna) {
    if (!container) return;
    if (items.length === 0) {
        container.innerHTML =
            '<div style="padding:1.2rem; text-align:center; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; font-size:0.75rem;">Brak przej\u015b\u0107 szczelnych<br>w tym elemencie.</div>';
        return;
    }
    container.innerHTML = items
        .map(function (item) {
            var globalIndex = well.przejscia.indexOf(item);
            var product = findProductFn(item.productId);
            var pel = parseFloat(item.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDna;
            var mmFromBottom = (pel - rzDna) * 1000;
            var heightMm = computeHeightFromElement(mmFromBottom, configMap);
            return renderTransitionTileHTML(item, globalIndex, product, {
                heightMm: heightMm,
                showEditBtn: false,
                showDeleteBtn: false,
                showPrice: false,
                spadekKinetaLabel: 'Spadek w k.',
                spadekMufaLabel: 'Spadek w m.',
                enableDragDrop: false,
                well: well
            });
        })
        .join('');
}

window.renderTransitionTileHTML = renderTransitionTileHTML;
window.buildConfigMap = buildConfigMap;
window.findAssignedElement = findAssignedElement;
window.computeHeightFromElement = computeHeightFromElement;
window.ensureDisplayIndices = ensureDisplayIndices;
window.renderMirrorTransitions = renderMirrorTransitions;
