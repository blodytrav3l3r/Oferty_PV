// @ts-check
/* ===== wellTransitionManagerRender.js — rendering menedżera przejść ===== */

window.tmRenderTable = function () {
    const container = document.getElementById('tm-table-body');
    if (!container) return;

    const sortedWells = [...tmWellData];
    if (tmSortState.column === 'wellName') {
        sortedWells.sort((a, b) => {
            const va = a.wellName.toLowerCase();
            const vb = b.wellName.toLowerCase();
            return tmSortState.asc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }

    let html = '';
    let visibleCount = 0;
    let allChecked = true;
    let anyChecked = false;

    sortedWells.forEach((w) => {
        const matchingTrs = [];
        w.transitions.forEach((tr) => {
            let matchMat = true,
                matchDn = true,
                matchSearch = true;
            if (
                tmCurrentFilters.sourceMaterial.length > 0 &&
                !tmCurrentFilters.sourceMaterial.includes(tr.material)
            )
                matchMat = false;
            if (tmCurrentFilters.dn.length > 0 && !tmCurrentFilters.dn.includes(String(tr.dnRaw)))
                matchDn = false;
            if (tmCurrentFilters.search) {
                const s = tmCurrentFilters.search;
                matchSearch =
                    w.wellName.toLowerCase().includes(s) ||
                    tr.material.toLowerCase().includes(s) ||
                    String(tr.dnRaw).includes(s);
            }
            if (matchMat && matchDn && matchSearch) matchingTrs.push(tr);
        });
        if (matchingTrs.length === 0) return;
        visibleCount++;

        const wellSelCount = matchingTrs.filter((tr) =>
            tmSelectedTransitions.has(`${w.wellIndex}:${tr.trIndex}`)
        ).length;
        const wellAllSel = wellSelCount === matchingTrs.length;
        const wellSomeSel = wellSelCount > 0;
        if (!wellAllSel) allChecked = false;
        if (wellSomeSel) anyChecked = true;

        const tilesHtml = matchingTrs
            .map((tr) => {
                const key = `${w.wellIndex}:${tr.trIndex}`;
                const isSel = tmSelectedTransitions.has(key);
                const safeMaterial = tr.material.replace(/'/g, "\\'");
                const locked = isWellLocked(w.wellIndex);
                return `
            <div ${locked ? '' : `data-action="tmOpenEditTransitionPopup" data-well-idx="${w.wellIndex}" data-tr-idx="${tr.trIndex}"`}
                  style="background:${isSel ? 'rgba(16,185,129,0.15)' : '#1a2536'};
                         border:1px solid ${isSel ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)'};
                         border-radius:8px; padding:0.4rem 0.45rem; ${locked ? 'cursor:default;' : 'cursor:pointer;'}
                         transition:all 0.2s; display:flex; flex-direction:column; gap:0.1rem;"
                  data-wp-locked="${locked}" data-wp-sel="${isSel}">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:0.3rem;">
                <div style="display:flex; align-items:center; gap:0.3rem; min-width:0; flex:1;">
                  <input type="checkbox" class="tm-row-cb" value="${key}" ${isSel ? 'checked' : ''} data-action="tmToggleTransition" data-key="${key}"
                         style="width:14px; height:14px; cursor:pointer; margin:0; flex-shrink:0;" ${locked ? 'disabled' : ''}>
                  <span style="font-size:0.76rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${safeMaterial}">${tr.material}</span>
                  <span style="font-size:0.82rem; font-weight:800; color:#4ade80; flex-shrink:0;">DN${tr.dnRaw}</span>
                </div>
                ${
                    locked
                        ? ''
                        : `
                <button data-action="tmOpenEditTransitionPopup" data-well-idx="${w.wellIndex}" data-tr-idx="${tr.trIndex}" class="wp-hover-bg"
                        style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.2); border-radius:4px; cursor:pointer; padding:0.05rem 0.3rem; color:#34d399; font-size:0.6rem; line-height:1.3; flex-shrink:0; transition:all 0.15s; --hb:rgba(16,185,129,0.25);">
                  ✎
                </button>`
                }
              </div>
              <div style="display:flex; gap:0.3rem; align-items:center; font-size:0.65rem; color:var(--text-muted);">
                <span>${tr.rzedna != null ? parseFloat(tr.rzedna).toFixed(2) + 'm' : '—'}</span>
                <span style="opacity:0.3;">·</span>
                <span style="color:#fcd34d; font-weight:600;">${tr.angle}°</span>
                <span style="opacity:0.3;">·</span>
                <span style="background:${tr.flowType === FLOW_TYPES.WLOT ? 'rgba(52,211,153,0.18)' : 'rgba(251,191,36,0.18)'}; color:${tr.flowType === FLOW_TYPES.WLOT ? '#34d399' : '#fbbf24'}; padding:0.02rem 0.3rem; border-radius:3px; font-size:0.6rem; font-weight:700;">${tr.flowType === FLOW_TYPES.WLOT ? 'WLOT' : 'WYLOT'}</span>
              </div>
            </div>`;
            })
            .join('');

        const wellLocked = isWellLocked(w.wellIndex);
        html += `
        <div style="background:#111827; border:1px solid ${wellLocked ? 'rgba(239,68,68,0.2)' : wellSomeSel ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}; border-radius:10px; margin-bottom:0.6rem; overflow:hidden; transition:all 0.2s;${wellLocked ? ' opacity:0.7;' : ''}">
          <div style="display:flex; align-items:center; padding:0.55rem 0.75rem; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05);">
            <input type="checkbox" ${wellAllSel ? 'checked' : ''} data-action="tmToggleWell" data-well-index="${w.wellIndex}"
                   style="width:16px; height:16px; margin-right:0.75rem; cursor:pointer;" ${wellLocked ? 'disabled' : ''}>
            <div style="flex:1; display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <span style="font-weight:700; color:var(--text-primary); font-size:0.85rem;">${w.wellName}</span>
              ${wellLocked ? '<span style="color:#f87171; font-size:0.68rem; display:flex; align-items:center; gap:0.2rem;"><i data-lucide="lock" style="width:12px;height:12px;"></i>Zablokowana</span>' : ''}
              <span style="color:var(--text-muted); font-size:0.72rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); padding:0.1rem 0.45rem; border-radius:5px; font-weight:600;">DN${w.wellDn}</span>
              <span style="color:var(--text-muted); font-size:0.72rem;">Rzędna: ${w.rzednaDna}</span>
              <span style="color:#34d399; font-weight:700; font-size:0.8rem;">${fmtInt(w.price)} PLN</span>
            </div>
            <span style="color:var(--text-muted); font-size:0.68rem; background:rgba(16,185,129,0.1); padding:0.15rem 0.55rem; border-radius:12px; white-space:nowrap; font-weight:500; border:1px solid rgba(16,185,129,0.15);">
              ${wellSelCount}/${matchingTrs.length}
            </span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:0.45rem; padding:0.55rem;">
            ${tilesHtml}
          </div>
        </div>`;
    });

    if (visibleCount === 0) {
        html = `<div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:0.9rem;">
                  <div style="font-size:2.5rem; margin-bottom:0.5rem; opacity:0.2;">⊘</div>
                  Brak przejść spełniających kryteria.
                </div>`;
    }

    container.innerHTML = html;

    const visEl = document.getElementById('tm-visible-count');
    if (visEl) visEl.textContent = String(visibleCount);
    tmUpdateSelectedCount();

    const selectAllCb = document.getElementById('tm-select-all');
    if (selectAllCb) {
        selectAllCb.disabled = visibleCount === 0;
        selectAllCb.checked = visibleCount > 0 && allChecked && anyChecked;
    }

    tmUpdatePreview();
};

function tmHighlightTiles(containerId, selectedVal) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('[data-val]').forEach((d) => {
        const isSel = d.dataset.val === selectedVal;
        d.style.background = isSel ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)';
        d.style.borderColor = isSel ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)';
        d.style.color = isSel ? '#a7f3d0' : 'var(--text-primary)';
    });
}

function tmHighlightTilesMulti(containerId, selectedVals) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll('[data-val]').forEach((d) => {
        const isSel =
            selectedVals.length === 0
                ? d.dataset.val === ''
                : d.dataset.val !== '' && selectedVals.includes(d.dataset.val);
        d.style.background = isSel ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)';
        d.style.borderColor = isSel ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.06)';
        d.style.color = isSel ? '#a7f3d0' : 'var(--text-primary)';
    });
}

window.tmUpdateSelectedCount = function () {
    const countEl = document.getElementById('tm-selected-count');
    if (countEl) countEl.textContent = String(tmSelectedTransitions.size);
};

window.tmUpdatePreview = function () {
    const panel = document.getElementById('tm-preview-panel');
    const content = document.getElementById('tm-preview-content');
    if (!panel || !content) return;

    const targetCat = tmTargetCat;
    if (!targetCat || tmSelectedTransitions.size === 0) {
        panel.style.display = 'none';
        return;
    }

    const replaceList = [];
    const skipList = [];

    tmSelectedTransitions.forEach((key) => {
        const [wellIdxStr, trIdxStr] = key.split(':');
        const wellIdx = parseInt(wellIdxStr, 10);
        const trIdx = parseInt(trIdxStr, 10);
        const well = wells[wellIdx];
        if (!well || !well.przejscia || !well.przejscia[trIdx]) return;
        const tr = well.przejscia[trIdx];
        const p = studnieProducts.find((prod) => prod.id === tr.productId);
        if (!p || p.category === targetCat) return;

        const replacement = studnieProducts.find(
            (pr) =>
                pr.componentType === 'przejscie' &&
                pr.category === targetCat &&
                pr.active !== 0 &&
                pr.dn === p.dn
        );

        const label = `${well.name || `Studnia ${wellIdx + 1}`} — ${p.category} DN${p.dn}`;
        if (replacement) {
            replaceList.push(label);
        } else {
            skipList.push(label);
        }
    });

    if (replaceList.length === 0 && skipList.length === 0) {
        panel.style.display = 'none';
        return;
    }

    let h = '';
    if (replaceList.length > 0) {
        h += `<div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;"><span style="color:#34d399; font-weight:800;">✅ Zostanie zamienione: ${replaceList.length}</span></div>`;
        h += '<div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.5rem;">';
        replaceList.forEach((l) => {
            h += `<span style="background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.2); color:#34d399; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.72rem;">${escapeHtml(l)}</span>`;
        });
        h += '</div>';
    }
    if (skipList.length > 0) {
        h += `<div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;"><span style="color:#f87171; font-weight:800;">⚠️ Brak odpowiednika w ${targetCat}: ${skipList.length}</span></div>`;
        h += '<div style="display:flex; flex-wrap:wrap; gap:0.3rem;">';
        skipList.forEach((l) => {
            h += `<span style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#f87171; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.72rem;">${escapeHtml(l)}</span>`;
        });
        h += '</div>';
    }

    content.innerHTML = h;
    panel.style.display = 'block';
};

function showSkippedPopup(skippedDetails, targetCat) {
    const rowsHtml = skippedDetails
        .map(
            (s, i) => `
        <tr>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${i + 1}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${s.wellName}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap;">${s.material}</td>
            <td style="padding:0.35rem 0.6rem; text-align:center; white-space:nowrap;">${s.dn}</td>
            <td style="padding:0.35rem 0.6rem; white-space:nowrap; color:#f87171;">Brak produktu ${s.targetCat} o średnicy ${s.dn}</td>
        </tr>
    `
        )
        .join('');

    showModal({
        id: 'skipped-popup-modal',
        titleId: 'skipped-title',
        html: `
      <div style="background:var(--bg-secondary, #1e293b); border:1px solid rgba(239,68,68,0.3); border-radius:16px; padding:1.2rem 1.5rem; width:700px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; position:sticky; top:0; background:var(--bg-secondary, #1e293b); padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div id="skipped-title" style="font-size:1rem; font-weight:800; color:#f87171;"><i data-lucide="alert-triangle" aria-hidden="true"></i> Pominięte przejścia (${skippedDetails.length})</div>
          <button class="btn-icon" aria-label="Zamknij" data-action="closeModal" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem;"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
            Poniższe przejścia nie zostały zamienione — w kategorii <strong>${targetCat}</strong> nie istnieje produkt o podanej średnicy.
        </div>
        <table style="width:100%; font-size:0.8rem; border-collapse:collapse;">
            <thead style="position:sticky; top:0; background:#1e293b;">
                <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Lp.</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Studnia</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Obecny typ</th>
                    <th style="padding:0.4rem 0.6rem; text-align:center; white-space:nowrap;">Średnica</th>
                    <th style="padding:0.4rem 0.6rem; text-align:left; white-space:nowrap;">Powód pominięcia</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.8rem; border-top:1px solid rgba(255,255,255,0.08);">
            <button class="btn btn-secondary" data-action="closeModalActivatePreview" style="font-size:0.8rem; padding:0.4rem 1rem; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399;">
                <i data-lucide="arrow-left"></i> Wróć do menedżera
            </button>
            <button class="btn btn-secondary" data-action="closeModal" style="font-size:0.8rem; padding:0.4rem 1.2rem;">Zamknij</button>
        </div>
      </div>
    `
    });
    if (window.lucide) window.lucide.createIcons();
}

window.tmRenderTable = tmRenderTable;
window.tmHighlightTiles = tmHighlightTiles;
window.tmHighlightTilesMulti = tmHighlightTilesMulti;
window.tmUpdateSelectedCount = tmUpdateSelectedCount;
window.tmUpdatePreview = tmUpdatePreview;
window.showSkippedPopup = showSkippedPopup;
