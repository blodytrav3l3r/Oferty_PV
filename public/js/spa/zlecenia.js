/**
 * Logic for Kartoteka Zleceń Produkcyjnych
 */

const AppZlecenia = (() => {
    let ordersCache = [];
    let activeFilter = 'all'; // 'all' | 'draft' | 'accepted'
    let selectedIds = new Set(); // multi-select for batch print

    const statusMap = {
        draft: { label: 'Oczekujące', class: 'status-draft', icon: '<i data-lucide="hourglass-2"></i>' },
        accepted: { label: 'Zatwierdzone', class: 'status-accepted', icon: '<i data-lucide="check-check"></i>' }
    };

    /* ===== INIT ===== */

    async function init() {
        const token = getAuthToken();
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        setupSearch();
        await loadOrders();
    }

    /* ===== HELPERS ===== */

    function formatDate(isoString) {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
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

    /** Simple template interpolation: replaces {{KEY}} with values from dataObj */
    function renderTemplate(template, dataObj) {
        return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
            return dataObj[key] !== undefined ? dataObj[key] : '';
        });
    }

    /** Fetch an HTML template, uses cache-busting for dev */
    async function fetchTemplate(path) {
        try {
            const res = await fetch(path + '?v=' + Date.now());
            if (!res.ok) throw new Error('Nie znaleziono szablonu: ' + path);
            return await res.text();
        } catch (err) {
            showToast('Błąd szablonu: ' + err.message, 'error');
            return null;
        }
    }

    /** Print HTML silently using a hidden iframe */
    function silentPrint(htmlString) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText =
            'position:fixed;right:0;bottom:0;width:1200px;height:1200px;border:0;opacity:0;z-index:-9999;';
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
                    if (document.body.contains(iframe)) document.body.removeChild(iframe);
                }, 60000);
            }, 500);
        };
    }

    /* ===== SEARCH & FILTER ===== */

    function setupSearch() {
        const input = document.getElementById('zlecenia-search-input');
        if (input) {
            input.addEventListener('input', () => renderTable(input.value.toLowerCase().trim()));
        }
    }

    function setFilter(filter) {
        activeFilter = filter;
        document.querySelectorAll('.zlecenia-filter-tab').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        const searchInput = document.getElementById('zlecenia-search-input');
        renderTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
    }

    /* ===== DATA LOADING ===== */

    async function loadOrders() {
        const tbody = document.getElementById('zlecenia-table-body');
        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted); font-style:italic;">Ładowanie danych z serwera...</td></tr>';
        }

        try {
            const res = await fetch('/api/orders-studnie/production/registry', {
                headers: authHeaders()
            });
            if (!res.ok) throw new Error('Nie udało się pobrać zleceń: ' + res.status);

            const data = await res.json();
            ordersCache = data.data || [];
            selectedIds.clear();

            renderStats();
            const searchInput = document.getElementById('zlecenia-search-input');
            renderTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
        } catch (err) {
            console.error(err);
            showToast('<i data-lucide="x-circle"></i> Błąd pobierania zleceń', 'error');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:#ef4444;">Wystąpił błąd: ${err.message}</td></tr>`;
            }
        }
    }

    /* ===== STATS ===== */

    function renderStats() {
        const container = document.getElementById('zlecenia-stats');
        if (!container) return;

        const total = ordersCache.length;
        const accepted = ordersCache.filter((o) => o.status === 'accepted').length;
        const draft = ordersCache.filter((o) => o.status !== 'accepted').length;
        const today = new Date().toISOString().slice(0, 10);
        const todayCount = ordersCache.filter(
            (o) => o.createdAt && o.createdAt.slice(0, 10) === today
        ).length;

        container.innerHTML = `
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(129,140,248,0.1); color:#818cf8;"><i data-lucide="layers"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${total}</div>
                    <div class="zlecenia-stat-label">Wszystkie zlecenia</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(16,185,129,0.1); color:#34d399;"><i data-lucide="check-check"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${accepted}</div>
                    <div class="zlecenia-stat-label">Zatwierdzone</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(245,158,11,0.1); color:#fbbf24;"><i data-lucide="hourglass-2"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${draft}</div>
                    <div class="zlecenia-stat-label">Oczekujące</div>
                </div>
            </div>
            <div class="zlecenia-stat-card">
                <div class="zlecenia-stat-icon" style="background:rgba(168,85,247,0.1); color:#c084fc;"><i data-lucide="zap"></i></div>
                <div class="zlecenia-stat-info">
                    <div class="zlecenia-stat-value">${todayCount}</div>
                    <div class="zlecenia-stat-label">Dodane dziś</div>
                </div>
            </div>
        `;
    }

    /* ===== SELECTION ===== */

    function toggleSelect(id, checkbox) {
        if (checkbox.checked) {
            selectedIds.add(id);
        } else {
            selectedIds.delete(id);
        }
        updateBatchBar();
    }

    function toggleSelectAll(masterCheckbox) {
        const checkboxes = document.querySelectorAll('.zlecenia-row-cb');
        checkboxes.forEach((cb) => {
            cb.checked = masterCheckbox.checked;
            const id = cb.dataset.id;
            if (masterCheckbox.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
            }
        });
        updateBatchBar();
    }

    function updateBatchBar() {
        const bar = document.getElementById('zlecenia-batch-bar');
        if (!bar) return;

        if (selectedIds.size > 0) {
            bar.style.display = 'flex';
            bar.querySelector('.batch-count').textContent = selectedIds.size;
        } else {
            bar.style.display = 'none';
        }
    }

    /* ===== TABLE RENDER ===== */

    function getFilteredOrders(searchTerm = '') {
        let filtered = ordersCache;

        if (activeFilter === 'draft') {
            filtered = filtered.filter((o) => o.status !== 'accepted');
        } else if (activeFilter === 'accepted') {
            filtered = filtered.filter((o) => o.status === 'accepted');
        }

        if (searchTerm) {
            filtered = filtered.filter((o) => {
                const fields = [
                    o.productionOrderNumber,
                    o.handlerName,
                    o.creatorName,
                    o.wellName,
                    o.projectName,
                    o.obiekt,
                    o.salesOrderNumber,
                    o.dbSalesOrderNumber,
                    o.elementName,
                    o.productName
                ].map((f) => (f || '').toLowerCase());
                return fields.some((f) => f.includes(searchTerm));
            });
        }

        return filtered;
    }

    function renderTable(searchTerm = '') {
        const tbody = document.getElementById('zlecenia-table-body');
        if (!tbody) return;

        const filtered = getFilteredOrders(searchTerm);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2.5rem; color:var(--text-muted); font-style:italic;">Brak zleceń spełniających kryteria.</td></tr>`;
            updateBatchBar();
            return;
        }

        const html = filtered
            .map((o) => {
                const statusConfig = statusMap[o.status] || {
                    label: o.status || 'Nieznany',
                    class: '',
                    icon: '<i data-lucide="help-circle"></i>'
                };

                const orderNum = o.productionOrderNumber
                    ? `<span class="order-num">${o.productionOrderNumber}</span>`
                    : `<span class="order-num-missing">— brak —</span>`;

                const salesOrderLabel =
                    o.dbSalesOrderNumber || o.salesOrderNumber
                        ? `<span class="sales-order-badge">${o.dbSalesOrderNumber || o.salesOrderNumber}</span>`
                        : '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>';

                const wellName = o.wellName || '—';
                const projectName = o.projectName || o.obiekt || '';
                const elementInfo =
                    o.elementName ||
                    o.productName ||
                    (o.elementIndex !== undefined ? `Element #${o.elementIndex}` : '—');

                const isAccepted = o.status === 'accepted';
                const isDraft = !isAccepted && o.id;
                const isChecked = selectedIds.has(o.id);

                // Action buttons
                let actions = '';
                if (o.offerId) {
                    actions += `<button class="action-btn action-btn-edit" onclick="AppZlecenia.editOrder('${o.offerId}', '${o.wellId || ''}', '${o.elementIndex !== undefined ? o.elementIndex : ''}', '${o.dbSalesOrderId || ''}')" title="Edytuj"><i data-lucide="pencil"></i></button>`;
                }
                actions += `<button class="action-btn" onclick="AppZlecenia.printSingleZlecenie('${o.id}')" title="Drukuj zlecenie"><i data-lucide="printer"></i></button>`;
                actions += `<button class="action-btn" onclick="AppZlecenia.printSingleEtykieta('${o.id}')" title="Drukuj etykietę"><i data-lucide="tag"></i></button>`;
                if (isDraft) {
                    actions += `<button class="action-btn action-btn-delete" onclick="AppZlecenia.deleteOrder('${o.id}')" title="Usuń zlecenie"><i data-lucide="trash-2"></i></button>`;
                }

                return `
                <tr>
                    <td style="width:40px; text-align:center;">
                        <input type="checkbox" class="zlecenia-row-cb" data-id="${o.id}" ${isChecked ? 'checked' : ''} onclick="AppZlecenia.toggleSelect('${o.id}', this)" style="cursor:pointer; width:16px; height:16px; accent-color:#818cf8;">
                    </td>
                    <td>${orderNum}</td>
                    <td class="date-cell">${formatDate(o.createdAt)}</td>
                    <td>
                        <div class="well-cell-name">${wellName}</div>
                        ${projectName ? `<div class="well-cell-project">${projectName}</div>` : ''}
                    </td>
                    <td>${salesOrderLabel}</td>
                    <td class="element-cell">${elementInfo}</td>
                    <td><span class="person-badge person-handler"><i data-lucide="user"></i> ${o.handlerName || '—'}</span></td>
                    <td><span class="person-badge person-creator"><i data-lucide="settings"></i> ${o.creatorName || '—'}</span></td>
                    <td><span class="status-badge ${statusConfig.class}">${statusConfig.icon} ${statusConfig.label}</span></td>
                    <td style="text-align:right">
                        <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                            ${actions}
                        </div>
                    </td>
                </tr>
            `;
            })
            .join('');

        tbody.innerHTML = html;
        updateBatchBar();
    }

    /* ===== PRINTING (from registry — uses stored PO data) ===== */

    /**
     * Build przejscia rows from the stored PO snapshot.
     * This is a simplified version that doesn't require studnieProducts/buildConfigMap.
     */
    function buildPrzejsciaRowsFromPO(po) {
        const przejscia = po.przejscia || [];
        const rzDna = parseFloat(po.rzednaDna) || 0;

        const rows = [];
        const wylot = przejscia.find((p) => p.flowType === 'wylot' || parseFloat(p.angle) === 0);
        const wloty = przejscia.filter((p) => p !== wylot);

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
                spadekKineta: spadekK ? Math.round(parseFloat(spadekK)) + ' mm' : '',
                spadekMufa: spadekM ? Math.round(parseFloat(spadekM)) + ' mm' : '',
                katStopien: angle + '°',
                uwagi: '+ ' + wysokoscMm + ' mm',
                katGon,
                katWykonania: katWyk + '°'
            };
        }

        if (wylot) rows.push(formatRow('Wylot 0', wylot));
        wloty.forEach((p, i) => rows.push(formatRow(`Wlot ${i + 1}`, p)));

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

    /** Build a Zlecenie SVG graphic from stored przejscia */
    function generateSvgFromPO(po) {
        const przejscia = po.przejscia || [];
        if (przejscia.length === 0) return '';
        const rzDna = parseFloat(po.rzednaDna) || 0;

        const size = 320;
        const center = size / 2;
        const radius = 60;

        let svg = `<svg viewBox="0 0 ${size} ${size}" width="200" height="200" style="background:transparent; overflow:visible;">`;
        svg += `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#222" stroke-width="2.5" />`;
        svg += `<line x1="${center}" y1="${center - 5}" x2="${center}" y2="${center + 5}" stroke="#999" stroke-width="0.8" />`;
        svg += `<line x1="${center - 5}" y1="${center}" x2="${center + 5}" y2="${center}" stroke="#999" stroke-width="0.8" />`;

        const labels = [];

        przejscia.forEach((p, i) => {
            const angle = parseFloat(p.angle) || 0;
            const rad = (angle * Math.PI) / 180;
            const x = center - radius * Math.sin(rad);
            const y = center + radius * Math.cos(rad);
            const isWylot = p.flowType === 'wylot' || angle === 0;

            svg += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${isWylot ? '#000' : '#444'}" stroke-width="${isWylot ? 3.5 : 1.8}" />`;

            const labelRadius = radius + 20;
            const lx = center - labelRadius * Math.sin(rad);
            const ly = center + labelRadius * Math.cos(rad);

            let anchor = 'middle';
            let offsetX = 0;
            if (lx < center - 15) {
                anchor = 'end';
                offsetX = -2;
            } else if (lx > center + 15) {
                anchor = 'start';
                offsetX = 2;
            }

            const pel = parseFloat(p.rzednaWlaczenia) || rzDna;
            const hMm = Math.round((pel - rzDna) * 1000);
            const hText = hMm > 0 ? ` (+${hMm}mm)` : '';

            const rodzaj = (p.productCategory || (isWylot ? 'WYLOT' : 'WLOT')).toUpperCase();

            labels.push({
                origX: lx, origY: ly, lx: lx, ly: ly,
                anchor: anchor,
                offsetX: offsetX,
                isRight: (lx >= center),
                text1: `${i}. ${rodzaj}`,
                text2: `${angle}°${hText}`
            });
        });

        // Anti-overlap pass (vertical sorting/pushing)
        let leftLabels = labels.filter(l => !l.isRight).sort((a,b) => a.ly - b.ly);
        let rightLabels = labels.filter(l => l.isRight).sort((a,b) => a.ly - b.ly);
        
        const MIN_DY = 28;
        function spread(arr) {
            for(let loops = 0; loops < 8; loops++) {
                for(let i = 0; i < arr.length - 1; i++) {
                    let diff = arr[i+1].ly - arr[i].ly;
                    if(diff < MIN_DY) {
                        let push = (MIN_DY - diff) / 2;
                        arr[i].ly -= push;
                        arr[i+1].ly += push;
                    }
                }
            }
        }
        spread(leftLabels);
        spread(rightLabels);

        labels.forEach(l => {
            if (Math.abs(l.origY - l.ly) > 2) {
                // Skrócona linia przerywana aby nie wchodziła pod tekst
                let lineDist = (l.ly > l.origY) ? -8 : 8; 
                svg += `<line x1="${l.origX}" y1="${l.origY}" x2="${l.lx}" y2="${l.ly + lineDist}" stroke="#ccc" stroke-dasharray="2,2" stroke-width="0.8" />`;
            }
            svg += `<text x="${l.lx + l.offsetX}" y="${l.ly}" text-anchor="${l.anchor}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#000">`;
            svg += `<tspan x="${l.lx + l.offsetX}" dy="0" fill="#000">${l.text1}</tspan>`;
            svg += `<tspan x="${l.lx + l.offsetX}" dy="1.15em" font-size="10" font-weight="normal" fill="#444">${l.text2}</tspan>`;
            svg += `</text>`;
        });

        svg += `</svg>`;
        return svg;
    }

    /** Build the full Zlecenie HTML from PO data + template */
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
                paramLabel(po.rodzajStopni) + (po.stopnieInne ? ' — ' + po.stopnieInne : '') ||
                'Brak',
            KLASA_BETONU: po.klasaBetonu || 'Brak',
            KAT_STOPNI: po.katStopni ? po.katStopni + '°' : 'Brak',
            WYKONANIE: po.wykonanie || 'Brak',
            POWLOKA: getPowloka(),
            GRAFIKA_KATOW: generateSvgFromPO(po)
        };

        // Transitions rows 0-3 (match configurator: render all rows including empty)
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

        // Remaining rows (match configurator: render ALL rows including empty)
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

    /** Build Etykieta HTML from PO data, with unique SVG IDs for batch mode */
    function buildEtykietaFromPO(template, po, pageIndex = 0) {
        function getCertData(dn) {
            const dnStr = String(dn || '');
            const match = dnStr.match(/(\d{3,4})/);
            const numDn = match ? parseInt(match[1]) : 0;
            if ([1000, 1200].includes(numDn)) {
                return { img: 'templates/ce_mark.png', alt: 'CE', text: 'AT/2009-03-1733' };
            }
            return {
                img: 'templates/b_mark.png',
                alt: 'B',
                text: 'IBDIM KOT 2018/0195 WYD.2<br>KDWU B/73/2023'
            };
        }

        const cert = getCertData(po.srednica || po.dn);

        // Build element rows from stored snapshot
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

        // Use unique SVG ids per page for batch printing
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

        // Replace SVG IDs in template to unique per page
        let html = renderTemplate(template, payload);
        html = html.replace('id="snr-svg"', `id="${snrSvgId}"`);
        html = html.replace('id="order-svg"', `id="${orderSvgId}"`);
        html = html.replace("fitSvgText('snr-svg')", `fitSvgText('${snrSvgId}')`);
        html = html.replace("fitSvgText('order-svg')", `fitSvgText('${orderSvgId}')`);

        return html;
    }

    /* ===== PRINT ACTIONS ===== */

    async function printSingleZlecenie(orderId) {
        const po = ordersCache.find((o) => o.id === orderId);
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
        const po = ordersCache.find((o) => o.id === orderId);
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
        if (selectedIds.size === 0) {
            showToast('Zaznacz zlecenia do wydruku', 'error');
            return;
        }

        const orders = ordersCache.filter((o) => selectedIds.has(o.id));
        if (orders.length === 0) {
            showToast('Brak zleceń do wydruku', 'error');
            return;
        }

        showToast(`Generowanie ${orders.length} zleceń...`, 'info');

        const template = await fetchTemplate('templates/zlecenie.html');
        if (!template) return;

        // Extract reusable page block from the raw template
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

        // Populate the page template for each order
        let allPages = '';
        orders.forEach((po) => {
            allPages += buildZlecenieFromPageBlock(pageTemplate, po) + '\n';
        });

        const finalHTML =
            headSection + batchPageStyle + '</head>\n<body>\n' + allPages + '</body></html>';
        silentPrint(finalHTML);
    }

    /** Build a single zlecenie page block (no <html>/<head>/<body>) */
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
                paramLabel(po.rodzajStopni) + (po.stopnieInne ? ' — ' + po.stopnieInne : '') ||
                'Brak',
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
        if (selectedIds.size === 0) {
            showToast('Zaznacz zlecenia do wydruku', 'error');
            return;
        }

        const orders = ordersCache.filter((o) => selectedIds.has(o.id));
        if (orders.length === 0) {
            showToast('Brak zleceń do wydruku', 'error');
            return;
        }

        showToast(`Generowanie ${orders.length} etykiet...`, 'info');

        const template = await fetchTemplate('templates/etykieta.html');
        if (!template) return;

        // Extract the reusable page block and the fitSvgText function from the template
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

        // Build each page with unique SVG IDs
        let allPages = '';
        let allFitCalls = '';

        orders.forEach((po, i) => {
            const populatedPage = buildEtykietaPageBlock(pageTemplate, po, i);
            allPages += populatedPage + '\n';
            allFitCalls += `fitSvgText('snr-svg-${i}'); fitSvgText('order-svg-${i}');\n`;
        });

        // Build final document with SVG fit script
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

    /** Build a single etykieta page block with unique SVG IDs */
    function buildEtykietaPageBlock(pageTemplate, po, pageIndex) {
        function getCertData(dn) {
            const dnStr = String(dn || '');
            const match = dnStr.match(/(\d{3,4})/);
            const numDn = match ? parseInt(match[1]) : 0;
            if ([1000, 1200].includes(numDn)) {
                return { img: 'templates/ce_mark.png', alt: 'CE', text: 'AT/2009-03-1733' };
            }
            return {
                img: 'templates/b_mark.png',
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

        // Replace SVG IDs with unique per-page IDs
        html = html.replace('id="snr-svg"', `id="snr-svg-${pageIndex}"`);
        html = html.replace('id="order-svg"', `id="order-svg-${pageIndex}"`);

        return html;
    }

    /* ===== DELETE ===== */

    async function deleteOrder(id) {
        const order = ordersCache.find((o) => o.id === id);
        if (!order) return;

        if (order.status === 'accepted') {
            showToast('Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.', 'error');
            return;
        }

        if (
            !(await appConfirm('Usunąć zlecenie ' + (order.productionOrderNumber || '') + '?', {
                title: 'Usuwanie zlecenia',
                type: 'danger'
            }))
        )
            return;

        try {
            const res = await fetch('/api/orders-studnie/production/' + id, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Błąd serwera');
            }

            ordersCache = ordersCache.filter((o) => o.id !== id);
            selectedIds.delete(id);
            renderStats();
            const searchInput = document.getElementById('zlecenia-search-input');
            renderTable(searchInput ? searchInput.value.toLowerCase().trim() : '');
            showToast('Zlecenie usunięte', 'info');

            try {
                if (
                    window.parent &&
                    window.parent.SpaRouter &&
                    typeof window.parent.SpaRouter.refreshModule === 'function'
                ) {
                    window.parent.SpaRouter.refreshModule('zlecenia');
                }
            } catch (e) {
                /* ignore */
            }
        } catch (e) {
            console.error('deleteOrder error:', e);
            showToast(e.message, 'error');
        }
    }

    /* ===== NAVIGATION ===== */

    function editOrder(offerId, wellId = '', elementIndex = '', salesOrderId = '') {
        if (!offerId) return;

        let extraParams = '&autoopen=zlecenia';
        if (wellId) extraParams += `&wellId=${wellId}`;
        if (elementIndex !== '') extraParams += `&elementIndex=${elementIndex}`;

        const useOrderMode =
            salesOrderId &&
            salesOrderId !== '' &&
            salesOrderId !== 'null' &&
            salesOrderId !== 'undefined';
        const mainParam = useOrderMode ? `order=${salesOrderId}` : `edit=${offerId}`;

        if (window.parent && window.parent.SpaRouter) {
            window.parent.location.hash = `#/studnie?${mainParam}${extraParams}`;
        } else {
            window.location.href = `studnie.html?${mainParam}${extraParams}`;
        }
    }

    /* ===== PUBLIC API ===== */

    return {
        init,
        loadOrders,
        editOrder,
        deleteOrder,
        setFilter,
        toggleSelect,
        toggleSelectAll,
        printSingleZlecenie,
        printSingleEtykieta,
        printBatchZlecenia,
        printBatchEtykiety
    };
})();
window.AppZlecenia = AppZlecenia;

document.addEventListener('DOMContentLoaded', () => {
    AppZlecenia.init();
});
