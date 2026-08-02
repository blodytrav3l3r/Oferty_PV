// @ts-check

/* ===== GLOBAL RECALCULATOR ===== */

const RECALC_CLOSURE_TYPES = [
    'konus',
    'plyta_din',
    'plyta_najazdowa',
    'plyta_zamykajaca',
    'pierscien_odciazajacy'
];

const RECALC_REDUCIBLE_DNS = [1200, 1500, 2000, 2500];

const RECALC_RELIEF_TYPES = ['pierscien_odciazajacy', 'plyta_najazdowa', 'plyta_zamykajaca'];

const RECALC_AUTO_ACCENT = '#a78bfa';

// Kolejność kafelków zakończeń: konus → płyta DIN → pierścień odciążający → płyty odciążające.
// Nieznane typy lądują na końcu (?? 99).
const RECALC_CLOSURE_ORDER = {
    konus: 0,
    plyta_din: 1,
    pierscien_odciazajacy: 2,
    plyta_najazdowa: 3,
    plyta_zamykajaca: 4
};

function _recalcSortClosures(products) {
    // sort() jest stabilny (ES2019+) — produkty tego samego typu zachowują porządek z bazy.
    // Kopiujemy tablicę przed sortowaniem (mutacja wejściowej — znany błąd #15 z AGENTS.md).
    return [...products].sort(
        (a, b) =>
            (RECALC_CLOSURE_ORDER[a.componentType] ?? 99) -
            (RECALC_CLOSURE_ORDER[b.componentType] ?? 99)
    );
}

function _recalcClosureColor(componentType) {
    if (typeof SVG_COLORS !== 'undefined' && SVG_COLORS[componentType]) {
        return SVG_COLORS[componentType];
    }
    return typeof SVG_COLORS !== 'undefined' && SVG_COLORS.fallback
        ? SVG_COLORS.fallback
        : '#334155';
}

function _recalcSafeDn(dn) {
    return String(dn).replace(/[^A-Za-z0-9._-]/g, '');
}

function _recalcBuildClosureTile({ dn, id, name, componentType, height, isAuto, isActive, kind }) {
    const prefix = kind === 'red' ? 'recalc-redtop' : 'recalc-top';
    const handler = kind === 'red' ? 'recalcSelectRedTop' : 'recalcSelectTop';
    const safeDn = _recalcSafeDn(dn);
    const safeId = escapeHtml(id);
    const isKonus = componentType === 'konus';
    let label = isAuto ? (kind === 'red' ? 'Auto (Konus)' : 'Auto (Domyślny)') : name;
    let heightLabel = '';
    if (isKonus && !isAuto) {
        label = name.split(/\s+H=/i)[0] || name;
        if (height) heightLabel = 'H=' + height;
    }
    const accent = isAuto ? RECALC_AUTO_ACCENT : _recalcClosureColor(componentType);
    const iconHtml = isAuto ? '<i data-lucide="refresh-cw" aria-hidden="true"></i>' : '';
    const classList = ['recalc-tile'];
    if (isActive) classList.push('active');
    if (isAuto) classList.push('recalc-tile-auto');

    return `
    <button type="button" class="${classList.join(' ')}" id="${prefix}-${safeDn}-${safeId}"
            style="--tile-accent:${accent};"
            onclick="window.${handler}('${safeDn}', '${safeId}')"
            aria-pressed="${isActive}">
        ${iconHtml}<span class="recalc-tile-name">${escapeHtml(label)}</span>
        ${heightLabel ? `<span class="recalc-tile-height">${escapeHtml(heightLabel)}</span>` : ''}
        <span class="recalc-tile-check" aria-hidden="true"><i data-lucide="check"></i></span>
    </button>`;
}

function _recalcBuildReductionSection(dn, exampleMag, groupWells) {
    const safeDn = _recalcSafeDn(dn);
    const dn1000Cand = _recalcSortClosures(
        studnieProducts.filter(
            (p) =>
                p.dn === 1000 &&
                RECALC_CLOSURE_TYPES.includes(p.componentType) &&
                ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                    (exampleMag !== 'Włocławek' && p.magazynKLB === 1)) &&
                groupWells.every(
                    (w) => typeof filterByWellParams !== 'function' || filterByWellParams(p, w)
                )
        )
    );
    const redTiles = [
        _recalcBuildClosureTile({
            dn,
            id: 'auto',
            name: '',
            componentType: '',
            isAuto: true,
            isActive: true,
            kind: 'red'
        }),
        ...dn1000Cand.map((p) =>
            _recalcBuildClosureTile({
                dn,
                id: p.id,
                name: p.name,
                componentType: p.componentType,
                height: p.height,
                isAuto: false,
                isActive: false,
                kind: 'red'
            })
        )
    ].join('');

    return `
    <div class="recalc-reduction">
        <label class="recalc-checkbox-row">
            <input type="checkbox" id="recalc-use-red-${safeDn}" onchange="window.recalcToggleRed(${safeDn})" />
            <span>Wykonaj redukcję na DN1000</span>
        </label>
        <div class="recalc-red-box" id="recalc-red-box-${safeDn}" hidden>
            <div class="recalc-red-field">
                <label class="form-label" for="recalc-red-minh-${safeDn}">Min. wys. komory roboczej (m)</label>
                <input type="number" id="recalc-red-minh-${safeDn}" class="form-input" value="2.5" step="0.1" />
            </div>
            <div class="recalc-section-label">Zakończenie komina DN1000</div>
            <div class="recalc-tile-grid" id="recalc-red-tiles-${safeDn}">${redTiles}</div>
        </div>
    </div>`;
}

function _recalcBuildDnGroup(dn, count, availForDn, exampleMag, groupWells) {
    const safeDn = _recalcSafeDn(dn);
    const topTiles = [
        _recalcBuildClosureTile({
            dn,
            id: 'auto',
            name: '',
            componentType: '',
            isAuto: true,
            isActive: true,
            kind: 'top'
        }),
        ...availForDn.map((p) =>
            _recalcBuildClosureTile({
                dn,
                id: p.id,
                name: p.name,
                componentType: p.componentType,
                height: p.height,
                isAuto: false,
                isActive: false,
                kind: 'top'
            })
        )
    ].join('');

    const emptyState =
        availForDn.length === 0
            ? `<div class="recalc-empty">Brak dostępnych zakończeń w cenniku magazynu ${
                  exampleMag === 'Włocławek' ? 'WL' : 'KLB'
              } dla DN ${escapeHtml(String(dn))}.</div>`
            : '';

    const hasRelief = availForDn.some((p) => RECALC_RELIEF_TYPES.includes(p.componentType));

    const reductionHtml = RECALC_REDUCIBLE_DNS.includes(Number(dn))
        ? _recalcBuildReductionSection(dn, exampleMag, groupWells)
        : '';

    return `
    <div class="recalc-group" data-dn="${safeDn}">
        <div class="recalc-group-header">
            <span class="recalc-group-title">Studnie DN ${escapeHtml(String(dn))}</span>
            <span class="recalc-group-count">${count} szt.</span>
        </div>
        <div class="recalc-section-label">Zakończenie główne</div>
        ${
            hasRelief
                ? '<div class="recalc-hint"><i data-lucide="info" aria-hidden="true"></i> Wybór płyty lub pierścienia odciążającego automatycznie uzupełni komplet.</div>'
                : ''
        }
        <div class="recalc-tile-grid" id="recalc-top-tiles-${safeDn}">
            ${topTiles}
            ${emptyState}
        </div>
        ${reductionHtml}
        <input type="hidden" id="recalc-choice-top-${safeDn}" value="auto" />
        <input type="hidden" id="recalc-choice-redtop-${safeDn}" value="auto" />
    </div>`;
}

window.openGlobalRecalcModal = function () {
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return;
    }
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        showToast('Przeliczanie globalne jest niedostępne w trybie edycji zamówienia.', 'error');
        return;
    }
    // ponytail: przyjęto jeden magazyn dla całej oferty (jak w excelColumns.js)
    const exampleMag = wells[0]?.magazyn || 'Kluczbork';

    const rawDns = [...new Set(wells.map((w) => w.dn))];
    const numericDns = rawDns
        .filter((d) => Number.isFinite(Number(d)))
        .sort((a, b) => Number(a) - Number(b));
    const otherDns = rawDns.filter((d) => !Number.isFinite(Number(d)));
    const uniqueDns = [...numericDns, ...otherDns];

    const groupsHtml = uniqueDns
        .map((dn) => {
            const groupWells = wells.filter((w) => w.dn === dn);
            const availForDn = _recalcSortClosures(
                studnieProducts.filter(
                    (p) =>
                        String(p.dn) === String(dn) &&
                        RECALC_CLOSURE_TYPES.includes(p.componentType) &&
                        ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                            (exampleMag !== 'Włocławek' && p.magazynKLB === 1)) &&
                        groupWells.every(
                            (w) =>
                                typeof filterByWellParams !== 'function' || filterByWellParams(p, w)
                        )
                )
            );
            return _recalcBuildDnGroup(dn, groupWells.length, availForDn, exampleMag, groupWells);
        })
        .join('');

    showModal({
        id: 'global-recalc-modal',
        titleId: 'global-recalc-title',
        html: `
    <div class="modal recalc-modal">
      <div class="modal-header"><h3 id="global-recalc-title"><i data-lucide="settings" aria-hidden="true"></i> Automatycznie przelicz ofertę</h3><button type="button" class="btn-icon" aria-label="Zamknij" onclick="window.closeGlobalRecalcModal()"><i data-lucide="x" aria-hidden="true"></i></button></div>
      <div class="recalc-modal-body">
        <p class="recalc-modal-desc">Ustaw preferencje zakończeń dla poszczególnych średnic. Program zaktualizuje ustawienia zakończeń i ponownie wygeneruje układ elementów dla <strong>wszystkich ${wells.length} studni w ofercie</strong> według reguł automatycznych. Studnie należące do zamówień lub zleceń produkcyjnych zostaną pominięte.</p>
        ${groupsHtml}
      </div>
      <div class="recalc-modal-footer">
        <label class="recalc-confirm-row" title="Ochrona przed nadpisaniem ręcznie dobranych konfiguracji">
            <input type="checkbox" id="recalc-confirm-override" onchange="window.recalcToggleConfirm()" />
            <span>Rozumiem, że konfiguracje studni zostaną nadpisane</span>
        </label>
        <button type="button" class="btn btn-secondary" onclick="window.closeGlobalRecalcModal()">Anuluj</button>
        <button type="button" class="btn btn-primary" id="recalc-apply-btn" onclick="window.applyGlobalRecalc()" disabled><i data-lucide="refresh-cw" aria-hidden="true"></i> Przelicz wszystkie</button>
      </div>
      <div id="recalc-progress" class="recalc-progress" aria-live="polite" hidden></div>
    </div>`
    });

    const root = document.getElementById('global-recalc-modal');
    if (root && window.lucide) window.lucide.createIcons({ root });
};

window.closeGlobalRecalcModal = function () {
    const el = document.getElementById('global-recalc-modal');
    if (el) el.remove();
};

function _recalcSetActive(containerId, tileId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.recalc-tile').forEach((t) => {
        const isSel = t.id === tileId;
        t.classList.toggle('active', isSel);
        t.setAttribute('aria-pressed', String(isSel));
    });
}

window.recalcSelectTop = function (dn, id) {
    const input = document.getElementById(`recalc-choice-top-${dn}`);
    if (input) input.value = id;
    _recalcSetActive(`recalc-top-tiles-${dn}`, `recalc-top-${dn}-${id}`);
};

window.recalcSelectRedTop = function (dn, id) {
    const input = document.getElementById(`recalc-choice-redtop-${dn}`);
    if (input) input.value = id;
    _recalcSetActive(`recalc-red-tiles-${dn}`, `recalc-redtop-${dn}-${id}`);
};

window.recalcToggleRed = function (dn) {
    const cb = document.getElementById(`recalc-use-red-${dn}`);
    const box = document.getElementById(`recalc-red-box-${dn}`);
    if (cb && box) box.hidden = !cb.checked;
};

window.recalcToggleConfirm = function () {
    const cb = document.getElementById('recalc-confirm-override');
    const btn = document.getElementById('recalc-apply-btn');
    if (cb && btn) btn.disabled = !cb.checked;
};

window.applyGlobalRecalc = async function () {
    const btn = document.getElementById('recalc-apply-btn');
    const cancelBtn = document.querySelector('#global-recalc-modal .btn-secondary');
    const progress = document.getElementById('recalc-progress');
    const originalIndex = currentWellIndex;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="refresh-cw" aria-hidden="true"></i> Przeliczanie...';
    }
    if (cancelBtn) cancelBtn.disabled = true;

    try {
        const uniqueDns = [...new Set(wells.map((w) => w.dn))];
        const prefs = {};

        uniqueDns.forEach((dn) => {
            const topId = document.getElementById(`recalc-choice-top-${dn}`)?.value || 'auto';
            const useRed = document.getElementById(`recalc-use-red-${dn}`)?.checked || false;
            let redTopId = 'auto';
            let redMinH = 2500;

            if (useRed) {
                redTopId = document.getElementById(`recalc-choice-redtop-${dn}`)?.value || 'auto';
                const raw = document.getElementById(`recalc-red-minh-${dn}`)?.value;
                const parsed = parseFloat(String(raw || '').replace(',', '.'));
                redMinH = isNaN(parsed) ? 2500 : Math.round(parsed * 1000);
            }

            prefs[dn] = { topId, useRed, redTopId, redMinH };
        });

        if (progress) progress.hidden = false;

        let processedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < wells.length; i++) {
            const w = wells[i];
            const p = prefs[w.dn];
            if (!p) continue;

            // Blokada: studnia w zamówieniu lub z dowolnym zleceniem produkcyjnym (draft/zaakceptowane) —
            // recalc przebudowałby indeksy PZ (AGENTS.md #23)
            const isLocked =
                (typeof isWellOrdered === 'function' && isWellOrdered(w)) ||
                (window.pzGuard && window.pzGuard.hasPzForWell(w.id));
            if (isLocked) {
                skippedCount++;
                continue;
            }

            if (progress)
                progress.textContent = `Przeliczanie studni ${i + 1}/${wells.length} (DN ${w.dn})...`;

            w.zakonczenie = p.topId === 'auto' ? null : p.topId;
            w.redukcjaDN1000 = p.useRed;
            if (p.useRed) {
                w.redukcjaMinH = p.redMinH;
                w.redukcjaZakonczenie = p.redTopId === 'auto' ? null : p.redTopId;
            } else {
                w.redukcjaZakonczenie = null;
            }
            w.autoLocked = false;

            currentWellIndex = i;
            await autoSelectComponents(true);
            if (w.configStatus === 'ERROR' || !w.config || w.config.length === 0) {
                failedCount++;
                continue;
            }
            processedCount++;
        }

        currentWellIndex = originalIndex;
        refreshAll();

        if (skippedCount > 0 && processedCount > 0) {
            const failedNote =
                failedCount > 0 ? ` Przeliczenie nie powiodło się dla ${failedCount} studni.` : '';
            showToast(
                `<i data-lucide="lock"></i> Przeliczono ${processedCount} z ${wells.length} studni. Pominięto ${skippedCount} studni z zamówieniem/zleceniem produkcyjnym.${failedNote}`,
                'info'
            );
        } else if (skippedCount > 0) {
            showToast(
                `<i data-lucide="lock"></i> Nie przeliczono żadnej studni — wszystkie ${skippedCount} studnie są zablokowane (zamówienie/zlecenie produkcyjne).`,
                'warning'
            );
        } else if (failedCount > 0) {
            showToast(`Nie przeliczono ${failedCount} studni — błąd konfiguracji.`, 'error');
        } else {
            showToast('Wszystkie studnie przeliczone poprawnie', 'success');
        }
        window.closeGlobalRecalcModal();
    } catch (e) {
        logger.error('wellPopups', e);
        showToast('Wystąpił błąd podczas przeliczania', 'error');
        if (progress) progress.textContent = 'Przeliczanie zakończone błędem.';
        if (cancelBtn) cancelBtn.disabled = false;
        if (btn) {
            btn.innerHTML = 'Spróbuj ponownie';
            btn.disabled = false;
        }
    } finally {
        currentWellIndex = originalIndex;
    }
};
