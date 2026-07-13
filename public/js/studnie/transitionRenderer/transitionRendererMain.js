// @ts-check
/* ===== transitionRenderer — główny renderer + eventy ===== */

window.renderTransitionTileHTML = function renderTransitionTileHTML(
    item,
    globalIndex,
    product,
    opts
) {
    if (opts === undefined) opts = {};
    var przName = product ? product.category : 'Nieznane';
    var dn = product ? product.dn : '\u2014';
    var price = product ? product.price : 0;

    classifyFlowType(item, globalIndex);

    var flow = getFlowVisuals(item.flowType);
    var angleColor = getAngleColor(item.angle);
    var heightMm = opts.heightMm != null ? opts.heightMm : 0;

    var spadekKLabel = opts.spadekKinetaLabel || 'Spadek w kinecie';
    var spadekMLabel = opts.spadekMufaLabel || 'Spadek w mufie';

    var showEdit = opts.showEditBtn !== false;
    var showDelete = opts.showDeleteBtn !== false;
    var showPrice = opts.showPrice !== false;
    var enableDrag = opts.enableDragDrop === true;

    var dragAttrs = enableDrag ? 'data-prz-idx="' + globalIndex + '" draggable="true"' : '';
    var cursorStyle = enableDrag ? 'cursor:grab;' : '';

    var assignedCfgIdx = opts.assignedCfgIndex != null ? opts.assignedCfgIndex : -1;
    var highlightAttrs =
        enableDrag && assignedCfgIdx >= 0
            ? 'data-action="przHighlight" data-global-index="' +
              globalIndex +
              '" data-cfg-index="' +
              assignedCfgIdx +
              '"'
            : '';

    var dnLabel = typeof dn === 'string' && dn.indexOf('/') >= 0 ? dn : 'DN ' + dn;

    var actionsHTML = '';
    if (showEdit || showDelete) {
        actionsHTML =
            '<div style="display:flex; align-items:center; gap:0.25rem; padding-left:0.5rem; border-left:1px dashed rgba(255,255,255,0.1);">';
        if (showEdit) {
            actionsHTML +=
                '<button data-action="editPrzejscie" data-global-index="' +
                globalIndex +
                '" title="Edytuj" class="prz-btn-edit"><i data-lucide="pencil"></i></button>';
        }
        if (showDelete) {
            actionsHTML +=
                '<button data-action="removePrzejscieFromWell" data-global-index="' +
                globalIndex +
                '" title="Usu\u0144" class="prz-btn-delete"><i data-lucide="x"></i></button>';
        }
        actionsHTML += '</div>';
    }

    var priceSubInfo = '';
    if (opts.drillingBasePrice > 0 && opts.drillingProd) {
        priceSubInfo =
            '<div style="font-size:0.55rem; color:#f97316; text-align:right; white-space:nowrap; line-height:1; position:absolute; bottom:-8px; right:6px;" title="' +
            escapeHtml(opts.drillingProd.name) +
            '">+ Wiercenie: ' +
            (typeof fmt === 'function' ? fmt(opts.drillingBasePrice) : opts.drillingBasePrice) +
            ' PLN</div>';
    }

    var priceHTML = showPrice
        ? '<div style="width:95px; flex-shrink:0; height:54px; position:relative; display:flex; flex-direction:column; justify-content:flex-start; align-items:flex-end;">' +
          '<div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:right;">Cena</div>' +
          '<div style="font-size:1.0rem; font-weight:800; color:var(--success); font-family:\'Inter\'; margin-top:2px; padding:0.15rem 0.4rem;">' +
          (typeof fmt === 'function' ? fmt(price) : price) +
          ' <span style="font-size:0.6rem;">PLN</span></div>' +
          priceSubInfo +
          '</div>'
        : '';

    var doplataVal = item.doplata != null ? item.doplata : 0;
    var doplataColor = doplataVal > 0 ? '#10b981' : doplataVal < 0 ? '#ef4444' : '#fbbf24';
    var doplataHTML = showPrice
        ? '<div style="width:90px; flex-shrink:0; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:flex-end; position:relative;" title="Pole nie rabatowane">' +
          '<div class="ui-text-muted-sm" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; text-align:right;">Dop\u0142ata</div>' +
          '<div data-qe-id="' +
          item.id +
          '" data-qe-field="doplata" data-action="activateQuickEdit" data-global-index="' +
          globalIndex +
          '" data-field="doplata" class="prz-field-doplata" style="font-size:1.0rem; font-weight:800; color:' +
          doplataColor +
          "; font-family:'Inter'; margin-top:2px;\">" +
          (typeof fmt === 'function' ? fmt(doplataVal) : doplataVal) +
          ' <span style="font-size:0.6rem;">PLN</span></div>' +
          '</div>'
        : '';

    if (!item.id) item.id = 'prz-legacy-' + globalIndex + '-' + Math.floor(Math.random() * 1000);

    var clockIdx = getClockIndex(item, opts);
    var numDisplay =
        clockIdx !== '' && clockIdx !== undefined
            ? '<div title="Oznaczenie zegarowe" style="position:absolute; top:-6px; right:-6px; background:#1e293b; border:1px solid ' +
              flow.border +
              '; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:800; color:' +
              flow.color +
              '; box-shadow:0 1px 3px rgba(0,0,0,0.5);">' +
              clockIdx +
              '</div>'
            : '';

    var extraPadding = opts.drillingBasePrice > 0 && opts.drillingProd ? '0.85rem' : '0.4rem';
    return (
        '<div ' +
        dragAttrs +
        ' style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid ' +
        flow.border +
        '; border-radius:10px; min-height:64px; min-width: max-content; padding:0.4rem 0.45rem ' +
        extraPadding +
        ' 0.45rem; box-sizing:border-box; position:relative; transition:all 0.2s ease; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem; ' +
        cursorStyle +
        '" ' +
        highlightAttrs +
        '>' +
        '<!-- FLOW TYPE BUTTON -->' +
        '<button data-action="openFlowTypePopup" data-global-index="' +
        globalIndex +
        '" title="Kliknij by zmieni\u0107 na Wlot/Wylot" style="position:relative; background:' +
        flow.bg +
        '; color:' +
        flow.color +
        '; border:1px solid ' +
        flow.border +
        '; border-radius:8px; padding:0.15rem 0.4rem; display:flex; flex-direction:column; align-items:center; cursor:pointer; width:55px; min-width:55px; transition:all 0.2s;">' +
        numDisplay +
        '<span style="font-size:1.1rem; margin-bottom:0px;">' +
        flow.icon +
        '</span>' +
        '<span style="font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-top:-2px;">' +
        flow.label +
        '</span>' +
        '</button>' +
        '<!-- SZCZEG\u00d3\u0141Y -->' +
        '<div style="flex:1; display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">' +
        '<div style="display:flex; flex-direction:column; gap:0.1rem; flex:1; min-width:200px; white-space:normal; padding-right:0.5rem;">' +
        '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem;">' +
        '<span data-action="openChangePrzejscieTypePopup" data-global-index="' +
        globalIndex +
        '" title="Kliknij, aby zmieni\u0107 typ przej\u015bcia" class="prz-field-color" style="font-size:0.95rem; font-weight:800; color:var(--text-primary);">' +
        escapeHtml(przName) +
        '</span>' +
        '<span data-action="openChangePrzejscieDnPopup" data-global-index="' +
        globalIndex +
        '" title="Kliknij, aby zmieni\u0107 \u015brednic\u0119" class="prz-field-dn" style="font-size:0.95rem; color:#a78bfa; font-weight:800;">' +
        escapeHtml(dnLabel) +
        '</span>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:0.5rem; margin-right: 0.2rem; white-space:nowrap; flex-shrink:0;">' +
        '<div style="width:160px; flex-shrink:0; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">' +
        '<div class="ui-text-muted-sm" class="ellipsis-center" title="' +
        escapeHtml(spadekKLabel) +
        ' [mm]">' +
        escapeHtml(spadekKLabel) +
        ' [%]</div>' +
        '<div data-qe-id="' +
        item.id +
        '" data-qe-field="spadekKineta" data-action="activateQuickEdit" data-global-index="' +
        globalIndex +
        '" data-field="spadekKineta" title="Kliknij aby edytowa\u0107" class="prz-field" style="font-size:1.0rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); display:inline-block; margin-top:8px;">' +
        (item.spadekKineta != null &&
        item.spadekKineta !== '' &&
        parseFloat(item.spadekKineta) !== 0
            ? Math.round(parseFloat(item.spadekKineta)) + ' %'
            : '\u2014') +
        '</div>' +
        '</div>' +
        '<div style="width:160px; flex-shrink:0; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">' +
        '<div class="ui-text-muted-sm" class="ellipsis-center" title="' +
        escapeHtml(spadekMLabel) +
        ' [mm]">' +
        escapeHtml(spadekMLabel) +
        ' [%]</div>' +
        '<div data-qe-id="' +
        item.id +
        '" data-qe-field="spadekMufa" data-action="activateQuickEdit" data-global-index="' +
        globalIndex +
        '" data-field="spadekMufa" title="Kliknij aby edytowa\u0107" class="prz-field" style="font-size:1.0rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); display:inline-block; margin-top:8px;">' +
        (item.spadekMufa != null && item.spadekMufa !== '' && parseFloat(item.spadekMufa) !== 0
            ? Math.round(parseFloat(item.spadekMufa)) + ' %'
            : '\u2014') +
        '</div>' +
        '</div>' +
        '<div style="width:65px; flex-shrink:0; position:relative; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">' +
        '<div class="ui-text-muted-sm" class="ellipsis-center">K\u0105t</div>' +
        '<div data-qe-id="' +
        item.id +
        '" data-qe-field="angle" data-action="activateQuickEdit" data-global-index="' +
        globalIndex +
        '" data-field="angle" title="Kliknij aby edytowa\u0107 wpisuj\u0105c liczb\u0119" class="prz-field-angle" style="font-size:1.0rem; font-weight:800; color:' +
        angleColor +
        '; text-shadow:0 1px 2px rgba(0,0,0,0.3); display:inline-block; margin-top:8px;">' +
        item.angle +
        '\u00b0</div>' +
        '</div>' +
        '<div style="width:95px; flex-shrink:0; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">' +
        '<div class="ui-text-muted-sm" class="ellipsis-center" title="Wysoko\u015b\u0107 [mm]">Wysoko\u015b\u0107 [mm]</div>' +
        '<div data-qe-id="' +
        item.id +
        '" data-qe-field="heightMm" data-action="activateQuickEdit" data-global-index="' +
        globalIndex +
        '" data-field="heightMm" title="Wysoko\u015b\u0107 od dolnej kraw\u0119dzi elementu" class="prz-field-height" style="font-size:1.0rem; font-weight:800; color:#f59e0b; text-shadow:0 1px 2px rgba(0,0,0,0.3); display:inline-block; margin-top:8px;">' +
        heightMm +
        ' mm</div>' +
        '</div>' +
        '<div style="width:105px; flex-shrink:0; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">' +
        '<div class="ui-text-muted-sm" class="ellipsis-center" title="K\u0105t wykonania">K\u0105t wykonania</div>' +
        '<div style="font-size:1.0rem; font-weight:700; color:#38bdf8; display:inline-block; padding:0.15rem 0.4rem; margin-top:8px;" title="360\u00b0 - k\u0105t">' +
        calcExecutionAngle(item.angle) +
        '\u00b0</div>' +
        '</div>' +
        '<div style="width:70px; flex-shrink:0; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">' +
        '<div class="ui-text-muted-sm" class="ellipsis-center" title="K\u0105t gony">K\u0105t gony</div>' +
        '<div style="font-size:1.0rem; font-weight:700; color:#2dd4bf; display:inline-block; padding:0.15rem 0.4rem; margin-top:8px;" title="K\u0105t wykonania w gonach">' +
        calcGonyAngle(item.angle) +
        'g</div>' +
        '</div>' +
        '<div style="width:80px; flex-shrink:0; height:54px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center;">' +
        '<div class="ui-text-muted-sm" class="ellipsis-center">Rz\u0119dna</div>' +
        '<div data-qe-id="' +
        item.id +
        '" data-qe-field="rzednaWlaczenia" data-action="activateQuickEdit" data-global-index="' +
        globalIndex +
        '" data-field="rzednaWlaczenia" title="Kliknij aby edytowa\u0107 wpisuj\u0105c liczb\u0119" class="prz-field-rzedna" style="font-size:1.0rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); display:inline-block; margin-top:8px;">' +
        (item.rzednaWlaczenia || '\u2014') +
        '</div>' +
        '</div>' +
        priceHTML +
        doplataHTML +
        '</div>' +
        '</div>' +
        actionsHTML +
        '</div>'
    );
};

// CSP actions
if (typeof registerCspAction === 'function') {
    registerCspAction('editPrzejscie', {
        handler: function (params) {
            editPrzejscie(parseInt(params.globalIndex, 10));
        },
        params: ['globalIndex']
    });
    registerCspAction('removePrzejscieFromWell', {
        handler: function (params) {
            removePrzejscieFromWell(parseInt(params.globalIndex, 10));
        },
        params: ['globalIndex']
    });
    registerCspAction('openFlowTypePopup', {
        handler: function (params) {
            openFlowTypePopup(parseInt(params.globalIndex, 10));
        },
        params: ['globalIndex']
    });
    registerCspAction('openChangePrzejscieTypePopup', {
        handler: function (params) {
            window.openChangePrzejscieTypePopup(parseInt(params.globalIndex, 10));
        },
        params: ['globalIndex']
    });
    registerCspAction('openChangePrzejscieDnPopup', {
        handler: function (params) {
            window.openChangePrzejscieDnPopup(parseInt(params.globalIndex, 10));
        },
        params: ['globalIndex']
    });
    registerCspAction('activateQuickEdit', {
        handler: function (params, target) {
            window.activateQuickEdit(target, parseInt(params.globalIndex, 10), params.field);
        },
        params: ['globalIndex', 'field']
    });
}

// Drag event listeners
document.addEventListener('dragstart', function (e) {
    if (!e.target.closest('[data-prz-idx]')) return;
    handlePrzDragStart(e);
});
document.addEventListener('dragover', function (e) {
    if (!e.target.closest('[data-prz-idx]')) return;
    handlePrzDragOver(e);
});
document.addEventListener('drop', function (e) {
    if (!e.target.closest('[data-prz-idx]')) return;
    handlePrzDrop(e);
});
document.addEventListener('dragend', function (e) {
    if (!e.target.closest('[data-prz-idx]')) return;
    handlePrzDragEnd(e);
});

// Mouse enter/leave for SVG highlight
document.addEventListener(
    'mouseenter',
    function (e) {
        var target =
            e.target && typeof e.target.closest === 'function'
                ? e.target.closest('[data-action="przHighlight"]')
                : null;
        if (!target) return;
        target.style.filter = 'brightness(1.1)';
        window.highlightSvg('prz', parseInt(target.getAttribute('data-global-index'), 10));
        window.highlightSvg('cfg', parseInt(target.getAttribute('data-cfg-index'), 10));
    },
    true
);

document.addEventListener(
    'mouseleave',
    function (e) {
        var target =
            e.target && typeof e.target.closest === 'function'
                ? e.target.closest('[data-action="przHighlight"]')
                : null;
        if (!target) return;
        target.style.filter = 'brightness(1)';
        window.unhighlightSvg('prz', parseInt(target.getAttribute('data-global-index'), 10));
        window.unhighlightSvg('cfg', parseInt(target.getAttribute('data-cfg-index'), 10));
    },
    true
);

window.renderTransitionTileHTML = renderTransitionTileHTML;
