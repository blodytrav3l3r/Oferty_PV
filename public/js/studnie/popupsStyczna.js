// @ts-check

/* ===== STYCZNA POPUP ===== */

function showStycznaPopup(mode = 'select') {
    const standardProducts = [
        ...studnieProducts.filter((p) => p.componentType === 'styczna' && !p.id.includes('KOREK'))
    ].sort((a, b) => (a.dn || 0) - (b.dn || 0));
    const korekProducts = [
        ...studnieProducts.filter((p) => p.componentType === 'styczna' && p.id.includes('KOREK'))
    ].sort((a, b) => (a.dn || 0) - (b.dn || 0));

    const renderProductRow = (p) => `
        <button class="styczna-product-btn" onclick="handleStycznaProductChoice('${p.id}', '${mode}')" style="
            display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:0.6rem;
            padding:0.55rem 0.8rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);
            border-radius:8px; cursor:pointer; transition:all 0.15s; text-align:left; color:inherit; width:100%;
        " onmouseenter="this.style.borderColor='rgba(249,115,22,0.5)'; this.style.background='rgba(249,115,22,0.1)'"
           onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='rgba(255,255,255,0.03)'">
            <div>
                <div style="font-size:0.82rem; font-weight:700; color:var(--text-primary, #fff);">DN${p.dn}</div>
                <div style="font-size:0.65rem; color:var(--text-muted, #888); margin-top:1px;">${p.name}</div>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${p.weight ? fmtInt(p.weight) + ' kg' : ''}</div>
            <div style="font-size:0.85rem; font-weight:800; color:var(--success, #10b981);">${fmtInt(p.price)} PLN</div>
        </button>`;

    const renderSection = (title, icon, products) => {
        if (products.length === 0) return '';
        return `
            <div style="margin-bottom:0.8rem;">
                <div style="font-size:0.72rem; text-transform:uppercase; color:#f97316; font-weight:800; letter-spacing:0.5px; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.3rem;">
                    <span>${icon}</span> ${title}
                </div>
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                    ${products.map(renderProductRow).join('')}
                </div>
            </div>`;
    };

    showModal({
        id: 'styczna-modal',
        titleId: 'styczna-title',
        html: `
      <div style="background:var(--bg-secondary, #1e293b); border:1px solid rgba(249,115,22,0.3); border-radius:16px; padding:1.2rem 1.5rem; width:520px; max-width:92vw; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; position:sticky; top:0; background:var(--bg-secondary, #1e293b); padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.08);">
          <div id="styczna-title" style="font-size:1rem; font-weight:800; color:#f97316;"><i data-lucide="cylinder" aria-hidden="true"></i> Wybierz studnię styczną</div>
          <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem;"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        ${renderSection('Studnie Styczne', '<i data-lucide="cylinder"></i>', standardProducts)}
        ${renderSection('Studnie Styczne z korkiem', '<i data-lucide="plug"></i>', korekProducts)}
      </div>
    `
    });
}

function handleStycznaProductChoice(productId, mode) {
    closeModal();
    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) {
        showToast('Nie znaleziono produktu', 'error');
        return;
    }

    const isKorek = productId.includes('KOREK');
    const variant = isKorek ? 'korek' : 'standard';

    const stycznaDn = parseInt(product.dn);

    if (mode === 'add') {
        const well = createNewWell(null, 'styczna');
        well.stycznaVariant = variant;
        well.stycznaDn = product.dn;
        const effDn = 1000;
        if (stycznaDn >= 1400) {
            const plate = studnieProducts.find(
                (p) => p.componentType === 'plyta_zamykajaca' && parseInt(p.dn) === effDn
            );
            if (plate) {
                well.zakonczenie = plate.id;
                offerDefaultZakonczenie = plate.id;
                well.zakonczenieByDn = well.zakonczenieByDn || {};
                well.zakonczenieByDn[effDn] = plate.id;
            }
        } else {
            well.zakonczenie = null;
            offerDefaultZakonczenie = null;
        }
        well.name = isKorek
            ? 'St. Styczna z korkiem DN' + product.dn + ' (#' + wellCounter + ')'
            : 'St. Styczna DN' + product.dn + ' (#' + wellCounter + ')';
        well.config = [{ productId: productId, quantity: 1 }];
        wells.push(well);
        currentWellIndex = wells.length - 1;
        const bcontentConcrete = document.getElementById('bcontent-concrete');
        if (bcontentConcrete && bcontentConcrete.style.display === 'none') {
            switchBuilderTab('concrete');
        }
        refreshAll();
        showToast(`Dodano: ${well.name}`, 'success');
    } else {
        const well = getCurrentWell();
        if (!well) return;
        well.stycznaVariant = variant;
        well.stycznaDn = product.dn;
        well.dn = 'styczna';
        const effDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        if (stycznaDn >= 1400) {
            const plate = studnieProducts.find(
                (p) => p.componentType === 'plyta_zamykajaca' && parseInt(p.dn) === effDn
            );
            if (plate) {
                well.zakonczenie = plate.id;
                well.zakonczenieByDn = well.zakonczenieByDn || {};
                well.zakonczenieByDn[effDn] = plate.id;
            }
        } else if (stycznaDn <= 1200) {
            well.zakonczenie = null;
        }
        const existingIdx = well.config.findIndex((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'styczna';
        });
        if (existingIdx >= 0) {
            well.config[existingIdx] = { productId: productId, quantity: 1 };
        } else {
            well.config.push({ productId: productId, quantity: 1 });
        }
        well.name = isKorek
            ? 'St. Styczna z korkiem DN' + product.dn + ' (#' + (currentWellIndex + 1) + ')'
            : 'St. Styczna DN' + product.dn + ' (#' + (currentWellIndex + 1) + ')';
        doSelectDN('styczna');
    }
}
