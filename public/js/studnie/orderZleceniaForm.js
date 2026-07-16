// @ts-check
/* ===== ZLECENIA PRODUKCYJNE — FORMULARZ + INTERAKCJE ===== */

function setZleceniaFilter(filter) {
    zleceniaActiveFilter = filter;
    document.querySelectorAll('.zlecenia-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderZleceniaList();
}

function renderZleceniaSvgPreview(well) {
    const svg = document.getElementById('zlecenia-svg-preview');
    const info = document.getElementById('zlecenia-well-info-mini');
    if (!svg) return;

    renderWellDiagram(svg, well);
    renderZleceniaWellConfig();

    if (info) {
        const stats = calcWellStats(well);
        info.innerHTML =
            '<strong>' +
            escapeHtml(well.name) +
            '</strong> — DN' +
            escapeHtml(String(well.dn ?? '')) +
            ' — H: ' +
            fmtInt(stats.height) +
            'mm — ' +
            fmtInt(stats.weight) +
            'kg';
    }
}

function populateZleceniaForm(el) {
    const { well, product, configItem, elementIndex, wellIndex } = el;
    const container = document.getElementById('zlecenia-form-content');
    if (!container) return;

    const parsed = parseWysokoscGlebokosc(product.name);

    let displayDN = well.dn === 'styczna' ? 'Styczna' : 'DN' + well.dn;
    let displayGlebokosc = parsed.glebokosc || '—';
    let displayWysokosc = parsed.wysokosc || product.height || 0;
    let dnoKinetaVal = parsed.wysokosc - parsed.glebokosc;
    let displayDnoKineta = dnoKinetaVal > 0 ? dnoKinetaVal : '—';

    let actualNextProduct = null;
    for (let i = elementIndex + 1; i < well.config.length; i++) {
        const _p = studnieProducts.find((p) => p.id === well.config[i].productId);
        if (_p && _p.componentType !== 'uszczelka') {
            actualNextProduct = _p;
            break;
        }
    }

    const shouldReduce =
        product.componentType === 'dennica' &&
        ((actualNextProduct && actualNextProduct.componentType === 'dennica') ||
            (well.psiaBuda && !actualNextProduct));

    if (shouldReduce) {
        const reducedH = (product.height || 0) - 100;
        displayWysokosc = reducedH > 100 ? reducedH : product.height || 0;
        const dnMatch = (product.name || '').match(/DN\s*(\d+)/i);
        if (dnMatch) {
            displayDN = 'DN' + dnMatch[1];
        }
        displayGlebokosc = parsed.glebokosc || '—';
        dnoKinetaVal = displayWysokosc - (parsed.glebokosc || 0);
        displayDnoKineta = dnoKinetaVal > 0 ? dnoKinetaVal : '—';
    }

    const din = getStudniaDIN(well.dn);
    const todayStr = new Date().toISOString().split('T')[0];
    const orderNumber = orderEditMode
        ? orderEditMode.order?.orderNumber || orderEditMode.order?.salesOrderNumber || ''
        : '';

    const userName = currentUser ? currentUser.firstName + ' ' + currentUser.lastName : '—';

    const clientName = document.getElementById('client-name')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';
    const investContractor = document.getElementById('invest-contractor')?.value || '';

    const existing = (productionOrders || []).find(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );
    const isAccepted = existing && existing.status === 'accepted';

    const btnAccept = document.getElementById('zl-btn-accept');
    const btnRevoke = document.getElementById('zl-btn-revoke');
    const btnDelete = document.getElementById('zl-btn-delete');
    const btnSave = document.getElementById('zl-btn-save');

    if (btnAccept) btnAccept.style.display = isAccepted ? 'none' : 'inline-flex';
    if (btnRevoke) btnRevoke.style.display = isAccepted ? 'inline-flex' : 'none';
    if (btnDelete) btnDelete.style.display = isAccepted ? 'none' : 'inline-flex';

    if (btnSave) {
        btnSave.disabled = isAccepted;
        btnSave.style.opacity = isAccepted ? '0.5' : '1';
        btnSave.style.cursor = isAccepted ? 'not-allowed' : 'pointer';
    }

    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProductFn, true);

    const assignedPrzejscia = (well.przejscia || []).filter((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
        return assignedIndex === elementIndex;
    });
    const przejsciaCount = assignedPrzejscia.length;

    const stopnieOptions = [
        ['', '— Brak —'],
        ['szlachetna_ocynk', 'Szlachetna ocynk'],
        ['szlachetna_nierdz', 'Szlachetna nierdz'],
        ['stalowa_mal', 'Stalowa malowana'],
        ['stalowa_ocynk', 'Stalowa ocynkowana'],
        ['stalowa_nierdz', 'Stalowa nierdzewna'],
        ['inne', 'Inne (opis)']
    ];

    let baseKatStopni = '';
    let baseRodzajStopni = '';
    const dennicaConfigIdx = well.config.findIndex((c) => {
        const p = findProductFn(c.productId);
        return p && p.componentType === 'dennica';
    });
    if (dennicaConfigIdx >= 0 && typeof zleceniaElementsList !== 'undefined') {
        const dennicaPo = (productionOrders || []).find(
            (po) => po.wellId === well.id && po.elementIndex === dennicaConfigIdx
        );
        if (dennicaPo) {
            baseKatStopni = dennicaPo.katStopni || '';
            baseRodzajStopni = dennicaPo.rodzajStopni || '';
        }
    }

    const katStopni = existing?.katStopni || baseKatStopni || '';
    const wykonanie = katStopni ? calcStopnieExecution(katStopni) : '';
    const stopnieVal = existing?.rodzajStopni || baseRodzajStopni || '';

    const isKragOt = product && product.componentType === 'krag_ot';
    const isAnyKrag = product && product.componentType && product.componentType.startsWith('krag');
    const shouldForceBrak = shouldReduce || isKragOt;

    const redKinetyVal =
        existing?.redukcjaKinety ?? (shouldForceBrak ? 'brak' : (well.redukcjaKinety ?? 'brak'));
    const spocznikHVal = existing?.spocznikH ?? (shouldForceBrak ? 'brak' : (well.spocznikH ?? ''));
    const usytuowanieVal = existing?.usytuowanie ?? well.usytuowanie ?? '';
    const kinetaVal = existing?.kineta ?? (shouldForceBrak ? 'brak' : (well.kineta ?? ''));
    const klasaBetonuVal = existing?.klasaBetonu ?? well.klasaBetonu ?? '';

    const katOptions = ['90', '135', '180', '270'];

    const spocznikMatOptions = [
        ['', '—'],
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'Precotop'],
        ['unolith', 'Unolith'],
        ['predl', 'Predl'],
        ['kamionka', 'Kamionka'],
        ['brak', 'Brak']
    ];

    const rodzajStudniOptions = [
        ['beton', 'Betonowa'],
        ['zelbet', 'Żelbetowa']
    ];

    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? (shouldForceBrak ? 'brak' : (well.spocznik ?? ''));

    let domyslnyRodzajStudni = '';
    if (product.componentType === 'dennica') {
        domyslnyRodzajStudni = well.dennicaMaterial === 'zelbetowa' ? 'zelbet' : 'beton';
    } else {
        domyslnyRodzajStudni = well.nadbudowa === 'zelbetowa' ? 'zelbet' : 'beton';
    }

    const rodzajStudniVal = existing?.rodzajStudni || domyslnyRodzajStudni;

    const kinetaOptions = [
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'Precotop'],
        ['unolith', 'Unolith'],
        ['predl', 'Predl'],
        ['kamionka', 'Kamionka'],
        ['brak', 'Brak'],
        ['zlec', 'Zlecenie']
    ];

    const spocznikOptions = [
        ['', '—'],
        ['200', '200 mm'],
        ['300', '300 mm'],
        ['400', '400 mm'],
        ['brak', 'Brak']
    ];

    const usytOptions = [
        ['', '—'],
        ['lewa', 'Lewa'],
        ['prawa', 'Prawa'],
        ['srodkowa', 'Środkowa'],
        ['jednostronna', 'Jednostronna']
    ];

    const redKinetyOptions = [
        ['brak', 'Brak'],
        ['pelna', 'Pełna'],
        ['50', 'Połowa']
    ];

    const klasaBetonuOptions = [
        ['', '—'],
        ['C30/37', 'C30/37'],
        ['C35/45', 'C35/45'],
        ['C40/50', 'C40/50'],
        ['C45/55', 'C45/55'],
        ['C50/60', 'C50/60']
    ];

    let autoUwagi = [];
    if (shouldForceBrak) {
        autoUwagi.push('REDUKCJA WYSOKOŚCI: podwójna dennica / psia buda');
    }
    if (!isAnyKrag && przejsciaCount > 0) {
        autoUwagi.push('Zabudowa przejść: ' + przejsciaCount + ' szt.');
    }

    let wklUwagi = [];
    if (well.wklRejon && well.wklRejon.trim()) {
        let malWDesc = '';
        if (well.wklRodzaj === 'lazik') malWDesc = 'łaź';
        else if (well.wklRodzaj === 'wklad' || well.wklRodzaj === 'wklad_ocynk') {
            malWDesc = 'wkład' + (well.wklRodzaj === 'wklad_ocynk' ? ' ocynk' : '');
        } else if (well.wklRodzaj === 'stopnie_wkl') {
            malWDesc =
                'stopnie' +
                (parseInt(well.wklIlosc || '0') > 0 ? ' (' + well.wklIlosc + ' szt.)' : '');
        } else if (well.wklRodzaj === 'zlacze') malWDesc = 'złącze';
        else if (well.wklRodzaj === 'kpv' || well.wklRodzaj === 'kpv_ocynk') {
            malWDesc = 'KPV' + (well.wklRodzaj === 'kpv_ocynk' ? ' ocynk' : '');
        } else if (well.wklRodzaj) malWDesc = well.wklRodzaj;

        const wklRejonParts = [];
        if (well.wklRejon && !isNaN(parseFloat(well.wklRejon))) {
            wklRejonParts.push(well.wklRejon + 'mb');
        } else if (well.wklRejon) {
            wklRejonParts.push(well.wklRejon);
        }
        if (well.wklIlosc && malWDesc !== 'stopnie') {
            wklRejonParts.push(well.wklIlosc + ' szt.');
        }
        const rejonStr = wklRejonParts.join(', ');
        wklUwagi.push(
            (malWDesc ? malWDesc + ': ' : '') +
                rejonStr +
                ' — DN' +
                well.dn +
                ' (' +
                escapeHtml(well.name) +
                ')'
        );
    }

    const defaultUwagiStr = autoUwagi.join(', ');
    const finalUwagi = existing?.uwagi !== undefined ? existing.uwagi : defaultUwagiStr;

    let bannerHtml = '';
    if (isAccepted) {
        bannerHtml =
            '<div class="zl-accepted-banner"><i data-lucide="check-circle"></i> Zlecenie zaakceptowane — edycja zablokowana</div>';
    } else if (existing) {
        bannerHtml =
            '<div class="zl-banner" style="background:var(--accent-bg, #e8f5e9);color:var(--accent-hover, #256029);padding:0.4rem 0.8rem;border-radius:6px;margin-bottom:0.5rem;font-size:0.85rem;display:flex;align-items:center;gap:0.4rem;"><i data-lucide="file-text"></i> Zapisano jako nr <strong>' +
            escapeHtml(existing.productionOrderNumber || '—') +
            '</strong></div>';
    }

    const liveErrors = well.configErrors || [];
    let errorsHtml = '';
    const elementErrors = liveErrors.filter(
        (e) => e.elementIndex !== undefined && e.elementIndex === elementIndex && e.type !== 'info'
    );
    if (elementErrors.length > 0) {
        errorsHtml =
            '<div class="zl-errors-banner"><i data-lucide="alert-triangle"></i> <strong>Błędy konfiguracji:</strong><ul>' +
            elementErrors
                .map((e) => '<li>' + escapeHtml(e.message || 'Nieznany błąd') + '</li>')
                .join('') +
            '</ul></div>';
    }

    let przejsciaAppVisible = false;
    const existingPrzejsciaContainer = document.getElementById('zl-inline-przejscia-app-container');
    if (existingPrzejsciaContainer) {
        przejsciaAppVisible = existingPrzejsciaContainer.style.display !== 'none';
    }

    let daneZleceniaVisible = false;
    const existingDaneZlecenia = document.getElementById('zl-dane-zlecenia-container');
    if (existingDaneZlecenia) {
        daneZleceniaVisible = existingDaneZlecenia.style.display !== 'none';
    }

    let daneElementuVisible = true;
    const existingDaneElementu = document.getElementById('zl-dane-elementu-content');
    if (existingDaneElementu) {
        daneElementuVisible = existingDaneElementu.style.display !== 'none';
    }

    container.innerHTML = `
    <div class="zl-form-inner">
        ${bannerHtml}
        ${errorsHtml}

        ${
            !isAccepted &&
            '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">' +
                '<button type="button" class="ui-btn ui-btn-sm ui-btn-outline" onclick="toggleDaneElementu()">' +
                '<i data-lucide="columns-2"></i> Panel boczny</button>' +
                "<button type=\"button\" class=\"ui-btn ui-btn-sm ui-btn-outline\" onclick=\"document.getElementById('zl-inline-przejscia-app-container').style.display = document.getElementById('zl-inline-przejscia-app-container').style.display === 'none' ? '' : 'none'\">" +
                '<i data-lucide="git-merge"></i> Przejścia</button>' +
                "<button type=\"button\" class=\"ui-btn ui-btn-sm ui-btn-outline\" onclick=\"document.getElementById('zl-dane-zlecenia-container').style.display = document.getElementById('zl-dane-zlecenia-container').style.display === 'none' ? '' : 'none'\">" +
                '<i data-lucide="clipboard-list"></i> Dane zlecenia</button>' +
                '</div>'
        }

        <div id="zl-dane-zlecenia-container" style="display:${daneZleceniaVisible ? '' : 'none'};">
            <div class="zl-section-card">
                <div class="zl-section-title"><i data-lucide="clipboard-list"></i> Dane zlecenia</div>
                <div class="zl-grid zl-grid-2col zl-dane-zlecenia-grid">
                    <div class="form-group-sm">
                        <label class="form-label-sm">Obiekt</label>
                        <input type="text" id="zl-obiekt" class="form-input form-input-sm" value="${escapeHtml(well.obiekt || '')}" placeholder="Nazwa obiektu...">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm">Data</label>
                        <input type="date" id="zl-data" class="form-input form-input-sm" value="${escapeHtml(well.data || todayStr)}">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm">Adres</label>
                        <input type="text" id="zl-adres" class="form-input form-input-sm" value="${escapeHtml(well.adres || '')}" placeholder="Adres...">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm">Nazwisko</label>
                        <input type="text" id="zl-nazwisko" class="form-input form-input-sm" value="${escapeHtml(well.nazwisko || userName)}" placeholder="Nazwisko...">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm">Wykonawca</label>
                        <input type="text" id="zl-wykonawca" class="form-input form-input-sm" value="${escapeHtml(well.wykonawca || '')}" placeholder="Wykonawca...">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm">Data produkcji</label>
                        <input type="date" id="zl-data-produkcji" class="form-input form-input-sm" value="${escapeHtml(well.dataProdukcji || '')}">
                    </div>
                    <div class="form-group-sm">
                        <label class="form-label-sm">Fakturowane</label>
                        <input type="text" id="zl-fakturowane" class="form-input form-input-sm" value="${escapeHtml(well.fakturowane || '')}" placeholder="np. TAK / NIE">
                    </div>
                </div>
            </div>
        </div>

        <div id="zl-dane-elementu-grid" style="display:grid; grid-template-columns:${daneElementuVisible ? '230px 1fr' : '36px 1fr'}; gap:0.5rem;">
            <div id="zl-dane-elementu-header-full" style="display:${daneElementuVisible ? 'flex' : 'none'}; flex-direction:column;">
                <div class="zl-section-card" style="flex:1;">
                    <div class="zl-section-title" style="font-size:0.8rem;"><i data-lucide="info"></i> O elemencie</div>
                    <div style="font-size:0.8rem; line-height:1.5;">
                        <div><strong>Nazwa:</strong> ${escapeHtml(product.name || '—')}</div>
                        <div><strong>Indeks:</strong> ${escapeHtml(product.id || '—')}</div>
                        <div><strong>Typ:</strong> ${escapeHtml(product.componentType || '—')}</div>
                        <div><strong>DN:</strong> ${escapeHtml(String(well.dn ?? '—'))}</div>
                        <div><strong>Nr studni:</strong> ${escapeHtml(well.numer || '—')}</div>
                        <div><strong>Producent:</strong> ${escapeHtml(product.producer || '—')}</div>
                        <div><strong>Indeks elem.:</strong> ${elementIndex}</div>
                    </div>
                </div>
            </div>
            <div id="zl-dane-elementu-header-collapsed" style="display:${daneElementuVisible ? 'none' : 'flex'}; flex-direction:column; align-items:center; cursor:pointer; padding-top:4px;" onclick="toggleDaneElementu()">
                <i data-lucide="chevron-right" style="width:20px; height:20px; color:var(--text-muted);"></i>
            </div>

            <div id="zl-dane-elementu-content" style="display:${daneElementuVisible ? 'flex' : 'none'}; flex-direction:column; gap:0.5rem;">
                <div class="zl-section-card">
                    <div class="zl-section-title"><i data-lucide="sliders-horizontal"></i> Parametry elementu</div>

                    <div class="zl-param-grid">
                        <div class="form-group-sm">
                            <label class="form-label-sm">Średnica (mm)</label>
                            <input type="text" id="zl-srednica" class="form-input form-input-sm" value="${displayDN}" readonly style="font-weight:700;color:var(--accent-hover);">
                        </div>
                        <div class="form-group-sm">
                            <label class="form-label-sm">Wysokość (mm)</label>
                            <input type="text" id="zl-wysokosc" class="form-input form-input-sm" value="${displayWysokosc}" readonly style="font-weight:700;color:var(--accent-hover);">
                        </div>
                        <div class="form-group-sm">
                            <label class="form-label-sm">Głębokość (mm)</label>
                            <input type="text" id="zl-glebokosc" class="form-input form-input-sm" value="${displayGlebokosc}" readonly style="font-weight:700;color:var(--accent-hover);">
                        </div>
                        <div class="form-group-sm">
                            <label class="form-label-sm">Dno kinety (mm)</label>
                            <input type="text" id="zl-dno-kineta" class="form-input form-input-sm" value="${displayDnoKineta}" readonly style="font-weight:700;color:var(--accent-hover);">
                        </div>
                    </div>
                </div>

                <div class="zl-section-card">
                    <div class="zl-section-title"><i data-lucide="layers"></i> Rodzaj / Materiał</div>
                    <div class="zl-param-grid">
                        <div class="form-group-sm">
                            <label class="form-label-sm">Rodzaj studni</label>
                            <div class="ui-row-gap zl-param-group">
                                ${rodzajStudniOptions
                                    .map(
                                        ([v, l]) =>
                                            `<button type="button" class="param-tile ui-badge ${v === rodzajStudniVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                                    )
                                    .join('')}
                            </div>
                            <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                        </div>

                        <div class="form-group-sm" ${shouldForceBrak ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                            <label class="form-label-sm">Redukcja kinety</label>
                            <div class="ui-row-gap zl-param-group">
                                ${redKinetyOptions
                                    .map(
                                        ([v, l]) =>
                                            `<button type="button" class="param-tile ui-badge ${v === redKinetyVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                                    )
                                    .join('')}
                            </div>
                            <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
                        </div>

                        <div class="form-group-sm">
                            <label class="form-label-sm">DIN</label>
                            <input type="text" id="zl-din" class="form-input form-input-sm" value="${dinVal}" style="width:100%; color:var(--accent-hover); font-weight:700;">
                        </div>
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Rodzaj stopni</label>
                    <div class="ui-row-gap zl-param-group">
                        ${stopnieOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === stopnieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-stopni" value="${stopnieVal}">
                </div>

                <div id="zl-stopnie-inne-wrap" style="display:${stopnieVal === 'inne' ? 'block' : 'none'};">
                    <div class="form-group-sm">
                        <label class="form-label-sm">Inne (opis)</label>
                        <input type="text" id="zl-stopnie-inne" class="form-input form-input-sm" value="${existing?.stopnieInne || ''}" placeholder="Opis...">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Ustalanie kąta stopni / Wykonanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem; align-items:center;" class="zl-param-group">
                        <input type="number" id="zl-kat-stopni" class="form-input form-input-sm" value="${katStopni}" placeholder="np. 90" min="0" max="360" onclick="this.select()" oninput="onZleceniaKatChange()" style="width:70px;">
                        <span style="font-size:1.2rem; color:var(--text-muted); margin: 0 4px;">→</span>
                        <input type="text" id="zl-wykonanie" class="form-input form-input-sm" value="${wykonanie ? wykonanie + '°' : ''}" readonly style="width:70px; color:var(--accent-hover); font-weight:700; margin-right:5px; pointer-events:none;">
                        ${katOptions
                            .map(
                                (v) =>
                                    `<button type="button" class="param-tile ui-badge" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                            )
                            .join('')}
                    </div>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Wysokość spocznika</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikHVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Usytuowanie</label>
                    <div class="ui-row-gap zl-param-group">
                        ${usytOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === usytuowanieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
                </div>

                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Kineta</label>
                    <div class="ui-row-gap zl-param-group">
                        ${kinetaOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === kinetaVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-kineta" value="${kinetaVal}">
                </div>

                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Spocznik</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikMatOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikMatVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik" value="${spocznikMatVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Klasa betonu</label>
                    <div class="ui-row-gap zl-param-group">
                        ${klasaBetonuOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === klasaBetonuVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
                </div>
            </div>
        </div>
    </div>
    `;

    if (isAccepted) {
        setTimeout(() => {
            container.querySelectorAll('input, textarea, button').forEach((el) => {
                el.disabled = true;
                if (el.tagName === 'BUTTON' && el.classList.contains('param-tile')) {
                    el.style.opacity = '0.7';
                    el.style.cursor = 'not-allowed';
                }
            });
            const transitionsApp = document.getElementById('zl-inline-przejscia-app-container');
            if (transitionsApp) {
                transitionsApp.style.pointerEvents = 'none';
                transitionsApp.style.opacity = '0.6';
            }
        }, 10);
    }

    renderInlinePrzejsciaApp('zl-inline-przejscia-app');
    renderWellPrzejscia({
        containerId: 'zl-przejscia-list',
        countElId: 'zl-przejscia-count',
        filterElementIndex: elementIndex
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function selectZleceniaTile(btn, targetId, val) {
    const group = btn.closest('.zl-param-group');
    if (group) {
        group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
    }
    btn.classList.add('active');

    const input = document.getElementById(targetId);
    if (input) {
        input.value = val;
    }

    if (targetId === 'zl-rodzaj-stopni') {
        onZleceniaStopnieChange();
    }

    if (
        [
            'zl-rodzaj-studni',
            'zl-rodzaj-stopni',
            'zl-red-kinety',
            'zl-spocznik-h',
            'zl-usytuowanie',
            'zl-kineta',
            'zl-spocznik',
            'zl-klasa-betonu'
        ].includes(targetId)
    ) {
        if (typeof zleceniaSelectedIdx === 'number' && zleceniaElementsList) {
            const el = zleceniaElementsList[zleceniaSelectedIdx];
            if (el && el.well && el.product) {
                const tempUwagi = document.getElementById('zl-uwagi')
                    ? document.getElementById('zl-uwagi').value
                    : '';

                const existing = productionOrders.find(
                    (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
                );

                if (targetId === 'zl-rodzaj-studni') {
                    if (el.product.componentType === 'dennica') {
                        el.well.dennicaMaterial = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    } else {
                        el.well.nadbudowa = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    }
                    if (existing) existing.rodzajStudni = val;
                } else if (targetId === 'zl-red-kinety') {
                    el.well.redukcjaKinety = val;
                    if (existing) existing.redukcjaKinety = val;
                } else if (targetId === 'zl-spocznik-h') {
                    el.well.spocznikH = val;
                    if (existing) existing.spocznikH = val;
                } else if (targetId === 'zl-usytuowanie') {
                    el.well.usytuowanie = val;
                    if (existing) existing.usytuowanie = val;
                } else if (targetId === 'zl-kineta') {
                    el.well.kineta = val;
                    if (existing) existing.kineta = val;

                    const syncValues = [
                        'beton',
                        'beton_gfk',
                        'klinkier',
                        'preco',
                        'precotop',
                        'unolith',
                        'predl',
                        'kamionka',
                        'brak'
                    ];
                    if (syncValues.includes(val)) {
                        const spocznikInput = document.getElementById('zl-spocznik');
                        if (spocznikInput) {
                            const group = spocznikInput.closest('.form-group-sm');
                            if (group) {
                                const targetBtn = group.querySelector(
                                    `.param-tile[onclick*="'zl-spocznik', '${val}'"]`
                                );
                                if (targetBtn && !targetBtn.classList.contains('active')) {
                                    targetBtn.click();
                                }
                            }
                        }
                    }
                } else if (targetId === 'zl-spocznik') {
                    el.well.spocznik = val;
                    if (existing) existing.spocznik = val;
                } else if (targetId === 'zl-klasa-betonu') {
                    el.well.klasaBetonu = val;
                    if (existing) existing.klasaBetonu = val;
                } else if (targetId === 'zl-rodzaj-stopni') {
                    let newStopnie = null;
                    if (val === '' || val === 'brak') {
                        newStopnie = 'brak';
                        el.well._selectedRodzajStopni = '';
                    } else if (val.includes('szlachetna')) {
                        newStopnie = 'nierdzewna';
                        el.well._selectedRodzajStopni = val;
                    } else if (val.includes('stalowa')) {
                        newStopnie = 'drabinka';
                        el.well._selectedRodzajStopni = val;
                    } else if (val === 'inne') {
                        el.well._selectedRodzajStopni = val;
                    }

                    const stopnieIndexChanged =
                        newStopnie !== null && newStopnie !== el.well.stopnie;
                    if (stopnieIndexChanged) {
                        el.well.stopnie = newStopnie;
                    }
                    if (existing) existing.rodzajStopni = val;

                    if (!stopnieIndexChanged) {
                        return;
                    }
                }

                if (typeof window.updateParamTilesUI === 'function') window.updateParamTilesUI();

                const oldWellIdx = el.wellIndex;
                const oldCat = el.product.category;
                const oldElementIndex = el.elementIndex;

                if (targetId === 'zl-rodzaj-studni' || targetId === 'zl-rodzaj-stopni') {
                    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();

                    if (typeof window.updateConfigToMatchParams === 'function') {
                        window.updateConfigToMatchParams(el.well);
                    }
                }

                if (typeof window.refreshAll === 'function') {
                    window.refreshAll();
                } else {
                    if (typeof window.renderWellConfig === 'function') window.renderWellConfig();
                    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
                    if (typeof window.updateSummary === 'function') window.updateSummary();
                    if (typeof window.renderWellParams === 'function') window.renderWellParams();
                }

                if (typeof window.buildZleceniaWellList === 'function') {
                    window.buildZleceniaWellList();
                }

                let newTargetIdx = zleceniaElementsList.findIndex(
                    (e) => e.wellIndex === oldWellIdx && e.elementIndex === oldElementIndex
                );
                if (newTargetIdx === -1) {
                    newTargetIdx = zleceniaElementsList.findIndex(
                        (e) =>
                            e.wellIndex === oldWellIdx && e.product && e.product.category === oldCat
                    );
                }
                if (newTargetIdx === -1) {
                    newTargetIdx = zleceniaElementsList.findIndex(
                        (e) => e.wellIndex === oldWellIdx
                    );
                }

                if (newTargetIdx >= 0 && typeof window.selectZleceniaElement === 'function') {
                    window.selectZleceniaElement(newTargetIdx);
                    if (document.getElementById('zl-uwagi')) {
                        document.getElementById('zl-uwagi').value = tempUwagi;
                    }
                }
            }
        }
    }
}

window.toggleDaneElementu = function () {
    const grid = document.getElementById('zl-dane-elementu-grid');
    const content = document.getElementById('zl-dane-elementu-content');
    const headerFull = document.getElementById('zl-dane-elementu-header-full');
    const headerCollapsed = document.getElementById('zl-dane-elementu-header-collapsed');

    if (!grid || !content) return;

    const isVisible = content.style.display !== 'none';

    if (isVisible) {
        content.style.display = 'none';
        if (headerFull) headerFull.style.display = 'none';
        if (headerCollapsed) headerCollapsed.style.display = 'flex';
        grid.style.gridTemplateColumns = '36px 1fr';
    } else {
        content.style.display = 'flex';
        if (headerFull) headerFull.style.display = 'flex';
        if (headerCollapsed) headerCollapsed.style.display = 'none';
        grid.style.gridTemplateColumns = '230px 1fr';
    }
};

function onZleceniaStopnieChange() {
    const hiddenInput = document.getElementById('zl-rodzaj-stopni');
    const wrap = document.getElementById('zl-stopnie-inne-wrap');
    if (hiddenInput && wrap) {
        wrap.style.display = hiddenInput.value === 'inne' ? 'block' : 'none';
    }
}

function onZleceniaKatChange() {
    const katInput = document.getElementById('zl-kat-stopni');
    const wykInput = document.getElementById('zl-wykonanie');
    if (katInput && wykInput) {
        const angle = parseFloat(katInput.value) || 0;
        const exec = angle > 0 ? calcStopnieExecution(angle) : '';
        wykInput.value = exec ? exec + '°' : '';
    }
}

window.setZleceniaFilter = setZleceniaFilter;
window.renderZleceniaSvgPreview = renderZleceniaSvgPreview;
window.selectZleceniaTile = selectZleceniaTile;
window.onZleceniaStopnieChange = onZleceniaStopnieChange;
window.onZleceniaKatChange = onZleceniaKatChange;
