// @ts-check
/* ===== BUTTON UPDATER — przyciski zakończenia, redukcji, psiej budy ===== */

function updateZakonczenieButton() {
    const btn = document.getElementById('btn-zakonczenie');
    if (!btn) return;
    const well = getCurrentWell();
    if (!well) return;
    if (well.zakonczenie) {
        const p = studnieProducts.find((pr) => pr.id === well.zakonczenie);
        const shortName = p
            ? p.name.length > 12
                ? p.name.substring(0, 12) + '\u2026'
                : p.name
            : well.zakonczenie;
        btn.innerHTML =
            '<span class="text-xs"><i data-lucide="chevron-down"></i></span> ' + shortName;
        btn.style.borderColor = 'rgba(99,102,241,0.4)';
        btn.style.color = '#a78bfa';
    } else {
        btn.innerHTML =
            '<span class="text-xs"><i data-lucide="chevron-down"></i></span> Zako\u0144czenie';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
    }
}

function updateRedukcjaButton() {
    const btn = document.getElementById('btn-redukcja');
    if (!btn) return;
    const well = getCurrentWell();

    if (!well || well.dn === 'styczna' || ![1200, 1500, 2000, 2500].includes(parseInt(well.dn))) {
        btn.style.display = 'none';
        if (typeof updatePsiaBudaButton === 'function') updatePsiaBudaButton();
        return;
    }
    btn.style.display = '';

    const minWrap = document.getElementById('redukcja-min-wrap');
    const minInput = document.getElementById('redukcja-min-h');
    const targetDn = well.redukcjaTargetDN || 1000;

    if (well.redukcjaDN1000) {
        btn.innerHTML = `<span class="text-xs"><i data-lucide="chevrons-down"></i></span> Redukcja DN${targetDn} <span class="text-xs"><i data-lucide="check"></i></span>`;
        btn.style.borderColor = 'rgba(109,40,217,0.5)';
        btn.style.color = '#a78bfa';
        btn.style.background = 'rgba(109,40,217,0.15)';
        if (minWrap) minWrap.style.display = 'flex';
        if (minInput) minInput.value = ((well.redukcjaMinH || 2500) / 1000).toFixed(1);
    } else {
        btn.innerHTML = '<span class="text-xs"><i data-lucide="chevrons-down"></i></span> Redukcja';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
        btn.style.background = '';
        if (minWrap) minWrap.style.display = 'none';
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function onRedukcjaMinChange(valueMeters) {
    const well = getCurrentWell();
    if (!well) return;
    const val = parseFloat(valueMeters);
    if (isNaN(val)) return;
    well.redukcjaMinH = Math.round(val * 1000);
}

function updateRedukcjaZakButton() {
    const btn = document.getElementById('btn-redukcja-zak');
    if (!btn) return;
    const well = getCurrentWell();
    if (!well) return;

    const targetDn = well.redukcjaTargetDN || 1000;
    if (well.redukcjaZakonczenie) {
        const p = studnieProducts.find((pr) => pr.id === well.redukcjaZakonczenie);
        const shortName = p
            ? p.name.replace(/^.*?(Konus|P\u0142yta|Pier\u015bcie\u0144)/i, '$1').substring(0, 18)
            : 'Zak. DN' + targetDn;
        btn.innerHTML =
            '<span class="text-xs"><i data-lucide="chevron-down"></i></span> ' + shortName;
        btn.style.borderColor = 'rgba(99,102,241,0.5)';
        btn.style.color = '#a78bfa';
    } else {
        btn.innerHTML =
            '<span class="text-xs"><i data-lucide="chevron-down"></i></span> Zak. DN' + targetDn;
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
    }
    if (window.lucide) window.lucide.createIcons();
}

function updatePsiaBudaButton() {
    const btn = document.getElementById('btn-psia-buda');
    if (!btn) return;
    const well = getCurrentWell();

    if (well && well.dn === 'styczna') {
        btn.style.display = 'none';
        return;
    }
    btn.style.display = '';

    if (well && well.psiaBuda) {
        btn.innerHTML =
            '<i data-lucide="dog" style="width:14px; height:14px; margin-right:4px;"></i> Psia buda <span style="font-size:0.75rem; margin-left:4px;"><i data-lucide="check"></i></span>';
        btn.style.borderColor = 'rgba(16,185,129,0.5)';
        btn.style.color = '#6ee7b7';
        btn.style.background = 'rgba(16,185,129,0.15)';
    } else {
        btn.innerHTML =
            '<i data-lucide="dog" style="width:14px; height:14px; margin-right:4px;"></i> Psia buda';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
        btn.style.background = '';
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
}
