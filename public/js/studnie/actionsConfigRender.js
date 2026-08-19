// @ts-check
/* ===== actionsConfigRender.js — renderowanie konfiguracji studni ===== */

window.toggleLinerDisabled = function (index, type) {
    const well = getCurrentWell();
    if (!well || !well.config || !well.config[index]) return;

    const item = well.config[index];
    const p = studnieProducts.find((pr) => pr.id === item.productId);

    if (type === 'pehd') {
        item.disablePehd = !item.disablePehd;
        showToast(
            `Wkładka PEHD na "${p ? p.name : 'Elemencie'}" została ${item.disablePehd ? 'wyłączona' : 'włączona'}.`,
            item.disablePehd ? 'warning' : 'success'
        );
    } else if (type === 'preco') {
        item.disablePreco = !item.disablePreco;
        showToast(
            `Wkładka PRECO na "${p ? p.name : 'Elemencie'}" została ${item.disablePreco ? 'wyłączona' : 'włączona'}.`,
            item.disablePreco ? 'warning' : 'success'
        );
    }

    well.autoLocked = true;
    if (typeof updateAutoLockUI === 'function') updateAutoLockUI();

    refreshAll();
};

function renderWellConfig() {
    const tbody = document.getElementById('well-config-body');
    const well = getCurrentWell();

    if (!tbody) return;

    if (typeof ensureElemIds === 'function' && well && Array.isArray(well.config)) {
        ensureElemIds(well.config);
    }

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Kliknij kafelki powyżej, aby dodać elementy studni</div>';
        return;
    }

    const typeBadge = {
        wlaz: { bg: 'var(--slate-800)', label: 'Właz' },
        plyta_din: { bg: 'var(--cmp-plyta-din)', label: 'Płyta' },
        plyta_najazdowa: { bg: 'var(--cmp-plyta-najazdowa)', label: 'Płyta' },
        plyta_zamykajaca: { bg: 'var(--cmp-plyta-zamykajaca)', label: 'Płyta' },
        pierscien_odciazajacy: { bg: 'var(--cmp-pierscien)', label: 'Pierścień' },
        konus: { bg: 'var(--cmp-konus)', label: 'Konus' },
        avr: { bg: 'var(--cmp-avr)', label: 'AVR' },
        plyta_redukcyjna: { bg: 'var(--cmp-plyta-redukcyjna)', label: 'Redukcja' },
        krag: { bg: 'var(--cmp-krag)', label: 'Krąg' },
        krag_ot: { bg: 'var(--cmp-krag)', label: 'Krąg OT' },
        dennica: { bg: 'var(--cmp-dennica)', label: 'Dennica' },
        kineta: { bg: 'var(--cmp-kineta)', label: 'Kineta' },
        uszczelka: { bg: 'var(--slate-700)', label: 'Uszczelka' },
        styczna: { bg: 'var(--cmp-styczna)', label: 'Styczna' },
        osadnik: { bg: 'var(--cmp-osadnik)', label: 'Osadnik' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p =
            typeof resolveEffectiveProduct === 'function'
                ? resolveEffectiveProduct(well, item.productId, item)
                : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        const itemPrice =
            item.frozenPrice != null && window.isPreviewMode
                ? item.frozenPrice
                : getItemAssessedPrice(well, p, true, item);
        let totalPrice = itemPrice * item.quantity;

        if (p.componentType === 'dennica' || p.componentType === 'styczna') {
            if (!item.isPsiaBuda) {
                const kinetaItem = well.config.find((c) => {
                    const pr = studnieProducts.find((x) => x.id === c.productId);
                    return pr && pr.componentType === 'kineta';
                });
                if (kinetaItem) {
                    const kinetaProd = studnieProducts.find((x) => x.id === kinetaItem.productId);
                    if (kinetaProd) {
                        const rawKinetaPrice =
                            kinetaItem.frozenPrice != null && window.isPreviewMode
                                ? kinetaItem.frozenPrice
                                : getItemAssessedPrice(well, kinetaProd, true, kinetaItem);
                        totalPrice += rawKinetaPrice * (kinetaItem.quantity || 1);
                    }
                }
                if (well.kineta === 'preco' || well.kineta === 'precotop') {
                    const precoCalc = calcPrecoPricing(well);
                    const discKey = well.dn === 'styczna' ? 'styczne' : well.dn;
                    const discPreco = (wellDiscounts[discKey] || {}).preco || 0;
                    const precoMult = 1 - discPreco / 100;
                    totalPrice += precoCalc.suma * precoMult;
                }
                if (well.doplata) {
                    totalPrice += well.doplata;
                }
            }
        }
        const totalWeight = (p.weight || 0) * item.quantity;
        const badge = typeBadge[p.componentType] || { bg: 'var(--slate-700)', label: '?' };

        const canMoveUp = index > 0;
        const canMoveDown = index < well.config.length - 1;

        const isPlaceholder = item.isPlaceholder;
        const plStyle = isPlaceholder
            ? 'opacity:0.7; box-shadow: 0 0 15px rgba(var(--blue-alt-rgb), 0.5); pointer-events: none;'
            : '';

        html += `<div data-cfg-idx="${index}" class="config-tile" draggable="true" ondragstart="handleCfgDragStart(event)" ondragover="handleCfgDragOver(event)" ondrop="handleCfgDrop(event)" ondragend="handleCfgDragEnd(event)" style="background:linear-gradient(90deg, ${badge.bg} 0%, rgba(var(--slate-800-rgb), 0.8) 100%); border:1px solid rgba(var(--white-rgb), 0.05); border-left:4px solid ${badge.bg}; border-radius: var(--radius-sm); padding:0.25rem 0.4rem; position:relative; transition:all 0.2s ease; margin-bottom:0.25rem; cursor:grab; ${plStyle}"
                      onmouseenter="if(!${isPlaceholder}){this.style.filter='brightness(1.5)'; this.style.borderColor='rgba(var(--white-rgb), 0.3)'; this.style.boxShadow='0 0 12px rgba(var(--accent-rgb), 0.5)'; window.highlightSvg('cfg', ${index})}" onmouseleave="if(!${isPlaceholder}){this.style.filter='brightness(1)'; this.style.borderColor='rgba(var(--white-rgb), 0.05)'; this.style.boxShadow='none'; window.unhighlightSvg('cfg', ${index})}">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            
            <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                <div style="display:flex; flex-direction:column; gap:0; align-items:center; background:rgba(var(--black-rgb), 0.3); padding:2px 4px; border-radius: var(--radius-2xs); min-width:24px;">
                  <button class="cfg-move-btn" ${!canMoveUp ? 'disabled' : ''} onclick="moveWellComponent(${index}, -1)" title="W górę" aria-label="W górę" style="background:none; border:none; color:var(--text-muted); padding:0; margin:0; height:12px; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; cursor:${canMoveUp ? 'pointer' : 'default'};"><i data-lucide="chevron-up" class="icon-xs" aria-hidden="true"></i></button>
                  <span style="font-size: var(--fs-xs); line-height:1; color:var(--text-primary); font-weight: var(--fw-extrabold); margin:2px 0;">${index + 1}</span>
                  <button class="cfg-move-btn" ${!canMoveDown ? 'disabled' : ''} onclick="moveWellComponent(${index}, 1)" title="W dół" aria-label="W dół" style="background:none; border:none; color:var(--text-muted); padding:0; margin:0; height:12px; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; cursor:${canMoveDown ? 'pointer' : 'default'};"><i data-lucide="chevron-down" class="icon-xs" aria-hidden="true"></i></button>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.1rem; min-width:0;">
                  <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                    <span style="background:${badge.bg}; color:var(--white); font-size: var(--fs-3xs); padding:1px 5px; border-radius: var(--radius-2xs); font-weight: var(--fw-black); text-transform:uppercase; letter-spacing:0.5px; opacity:0.9;">${badge.label.split(' ')[1] || badge.label}</span>
                    <div style="font-weight: var(--fw-bold); color:var(--text-primary); font-size: var(--fs-lg); line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.isPsiaBuda ? 'Psia buda' : p.name)}${p.componentType === 'uszczelka' && item.quantity > 1 ? ` (x${item.quantity} szt.)` : p.componentType === 'uszczelka' ? ` (1 szt.)` : ''}</div>
                    ${(() => {
                        let badgesHtml = '';

                        const precoAlloc =
                            typeof calculatePrecoAllocationForItem === 'function'
                                ? calculatePrecoAllocationForItem(well, index)
                                : null;
                        if (
                            precoAlloc &&
                            precoAlloc.hasPreco &&
                            (precoAlloc.isBottomMostDennica || precoAlloc.fraction > 0)
                        ) {
                            const fracPerc =
                                precoAlloc.fraction > 0 && precoAlloc.fraction < 1
                                    ? Math.round(precoAlloc.fraction * 100)
                                    : 0;
                            let percDesc = '';
                            if (well.wkladkaOsadnikPreco === 'tak') {
                                percDesc = precoAlloc.isBottomMostDennica
                                    ? `Dno + ${fracPerc ? fracPerc + '% ścian' : 'Ściany'}`
                                    : `${fracPerc ? fracPerc + '% ścian' : 'Ściany'}`;
                            } else {
                                percDesc = precoAlloc.isBottomMostDennica
                                    ? `Baza${fracPerc ? ' + ' + fracPerc + '% uzup.' : ''}`
                                    : `${fracPerc ? fracPerc + '% uzup.' : 'Uzup.'}`;
                            }
                            const isPrecoDisabled = item.disablePreco;
                            const precoColor = isPrecoDisabled
                                ? 'var(--text-muted)'
                                : 'var(--danger)';
                            const precoBg = isPrecoDisabled
                                ? 'rgba(var(--white-rgb), 0.05)'
                                : 'rgba(var(--danger-rgb), 0.1)';
                            const precoBorder = isPrecoDisabled
                                ? 'rgba(var(--white-rgb), 0.2)'
                                : 'rgba(var(--danger-rgb), 0.5)';
                            const precoText = isPrecoDisabled
                                ? `<del>PRECO (${percDesc})</del>`
                                : `PRECO (${percDesc})`;

                            badgesHtml += `<span onclick="window.toggleLinerDisabled(${index}, 'preco')" style="cursor:pointer; font-size: var(--fs-3xs); color:${precoColor}; font-weight: var(--fw-extrabold); margin-left:4px; border:1px solid ${precoBorder}; padding:1px 4px; border-radius: var(--radius-2xs); background:${precoBg}; white-space:nowrap; transition:all 0.2s;" title="Kliknij, aby włączyć/wyłączyć przeliczanie PRECO dla tego elementu">${precoText}</span>`;
                        }

                        const pehdType = getPehdTypeForComponent(well, p.componentType);

                        if (pehdType && pehdType !== 'brak' && p.doplataPEHD) {
                            const isPehdDisabled = item.disablePehd;
                            const pehdColor = isPehdDisabled
                                ? 'var(--text-muted)'
                                : 'var(--blue-alt)';
                            const pehdBg = isPehdDisabled
                                ? 'rgba(var(--white-rgb), 0.05)'
                                : 'rgba(var(--blue-alt-rgb), 0.1)';
                            const pehdBorder = isPehdDisabled
                                ? 'rgba(var(--white-rgb), 0.2)'
                                : 'rgba(var(--blue-alt-rgb), 0.5)';
                            const pehdText = isPehdDisabled ? `<del>PEHD</del>` : `PEHD`;

                            badgesHtml += `<span onclick="window.toggleLinerDisabled(${index}, 'pehd')" style="cursor:pointer; font-size: var(--fs-3xs); color:${pehdColor}; font-weight: var(--fw-extrabold); margin-left:4px; border:1px solid ${pehdBorder}; padding:1px 4px; border-radius: var(--radius-2xs); background:${pehdBg}; white-space:nowrap; transition:all 0.2s;" title="Kliknij, aby włączyć/wyłączyć dopłatę PEHD dla tego elementu">${pehdText}</span>`;
                        }

                        if (
                            well.nadbudowa === 'zelbetowa' &&
                            (p.componentType === 'krag' || p.componentType === 'krag_ot')
                        ) {
                            badgesHtml +=
                                ' <span class="color-warn" class="pill-tag-warn">ŻELBET</span>';
                        }
                        if (
                            (well.dennicaMaterial === 'zelbetowa' ||
                                well.material === 'zelbetowa') &&
                            p.componentType === 'dennica'
                        ) {
                            badgesHtml +=
                                ' <span class="color-warn" class="pill-tag-warn">ŻELBET</span>';
                        }
                        if (
                            well.stopnie === 'nierdzewna' &&
                            (p.componentType === 'krag' ||
                                p.componentType === 'krag_ot' ||
                                p.componentType === 'konus' ||
                                p.componentType === 'dennica')
                        ) {
                            badgesHtml +=
                                ' <span class="color-accent" style="font-size: var(--fs-3xs); border:1px solid rgba(var(--accent2-rgb), 0.5); padding:1px 4px; border-radius: var(--radius-2xs); background:rgba(var(--accent2-rgb), 0.1); margin-left:4px; font-weight: var(--fw-bold);">NIERDZ.</span>';
                        }

                        return badgesHtml;
                    })()}
                  </div>
                  <div style="font-size: var(--fs-xs); color:var(--text-muted); opacity:0.6; padding-left:2px; line-height:1;">${escapeHtml(p.id)}${p.height ? ' | H=' + p.height + 'mm' : ''}</div>
                </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.6rem; flex-shrink:0; min-width:340px;">
              <div style="display:grid; grid-template-columns:36px 65px 60px 48px 120px; gap:0 0.5rem; align-items:center;">
                <span class="fs-xs-muted">WAGA:</span>
                <span style="color:rgba(var(--white-rgb), 0.8); font-weight: var(--fw-bold); font-size: var(--fs-md); white-space:nowrap; text-align:right;">${p.weight || totalWeight > 0 ? fmtInt(totalWeight) + ' kg' : '—'}</span>
                
                <div style="width:60px;"></div>
                
                <span class="fs-xs-muted">CENA:</span>
                <span style="font-size: var(--fs-2xl); font-weight: var(--fw-extrabold); color:var(--success); white-space:nowrap; letter-spacing:0.3px; text-align:right; width:100%; display:block; line-height:1;">${fmtInt(totalPrice)} PLN</span>
              </div>
              <div style="width:26px; display:flex; justify-content:center;">
                <button onclick="removeWellComponent(${index})" title="Usuń" style="width:26px; height:26px; background:rgba(var(--danger-rgb), 0.05); border:1px solid rgba(var(--danger-rgb), 0.2); border-radius: var(--radius-sm); cursor:pointer; color:var(--danger); display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; transition:all 0.2s;" onmouseenter="this.style.background='rgba(var(--danger-rgb), 0.15)'; this.style.borderColor='rgba(var(--danger-rgb), 0.5)';" onmouseleave="this.style.background='rgba(var(--danger-rgb), 0.05)'; this.style.borderColor='rgba(var(--danger-rgb), 0.2)';"><i data-lucide="x" class="icon-xs"></i></button>
              </div>
            </div>

          </div>
        </div>`;
    });

    if (
        (well.kineta === 'preco' ||
            well.kineta === 'precotop' ||
            well.wkladkaOsadnikPreco === 'tak') &&
        typeof calcPrecoPricing === 'function'
    ) {
        const precoCalc = calcPrecoPricing(well);
        if (precoCalc.suma > 0 || precoCalc.error) {
            const kinetaLabel =
                well.wkladkaOsadnikPreco === 'tak'
                    ? 'osadnika'
                    : well.kineta === 'precotop'
                      ? 'PrecoTop'
                      : 'Preco';
            const discKey = well.dn === 'styczna' ? 'styczne' : well.dn;
            const discPreco = (wellDiscounts[discKey] || {}).preco || 0;

            if (precoCalc.error) {
                html += `<div style="margin-top:0.5rem; padding:0.6rem 0.7rem; background:rgba(var(--danger-rgb), 0.15); border:1px solid var(--danger); border-radius: var(--radius-sm); color:var(--danger); font-weight: var(--fw-bold); font-size: var(--fs-lg); line-height:1.4;">`;
                html += `⚠️ ${precoCalc.error}`;
                html += `</div>`;
            } else {
                const precoMult = 1 - discPreco / 100;
                const precoFinal = precoCalc.suma * precoMult;

                html += `<div style="margin-top:0.5rem; padding:0.6rem 0.7rem; background:linear-gradient(135deg, rgba(var(--danger-rgb), 0.1), rgba(var(--accent2-rgb), 0.1)); border:1px solid rgba(var(--danger-rgb), 0.3); border-radius: var(--radius-sm);">`;
                html += `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">`;
                html += `<span style="font-weight: var(--fw-extrabold); font-size: var(--fs-lg); color:var(--danger);">🔧 Wkładka ${kinetaLabel}</span>`;
                html += `<span style="font-weight: var(--fw-extrabold); font-size: var(--fs-2xl); color:var(--success);">${fmtInt(precoFinal)} PLN</span>`;
                html += `</div>`;
                html += `<div style="display:grid; grid-template-columns:1fr auto; gap:0.15rem 0.8rem; font-size: var(--fs-base); color:var(--text-secondary);">`;

                const etykietyBaza =
                    precoCalc.bazowaEtykiety && precoCalc.bazowaEtykiety.length > 0
                        ? ` [${precoCalc.bazowaEtykiety.join(' / ')}]`
                        : '';
                const bazowaLabel =
                    precoCalc.bazowaDN && precoCalc.bazowaDN.length > 0
                        ? ` (DN ${precoCalc.bazowaDN.join(' / DN ')})${etykietyBaza}`
                        : '';
                html += `<span>Kineta bazowa${bazowaLabel}</span><span class="text-right-600">${fmtInt(precoCalc.bazowa)} PLN</span>`;

                if (precoCalc.redukcja > 0) {
                    const redDesc = precoCalc.redukcjaOpis ? ` (${precoCalc.redukcjaOpis})` : '';
                    html += `<span>&nbsp;&nbsp;&nbsp;↳ Redukcja kinety${redDesc}</span><span class="text-right-600">${fmtInt(precoCalc.redukcja)} PLN</span>`;
                }

                if (
                    precoCalc.uniesieniaSzczegoly &&
                    precoCalc.uniesieniaSzczegoly.length > 0 &&
                    precoCalc.bazowaIds
                ) {
                    const uniesieniaBazy = precoCalc.uniesieniaSzczegoly.filter((u) =>
                        precoCalc.bazowaIds.includes(u._id)
                    );
                    uniesieniaBazy.forEach((u) => {
                        html += `<span>&nbsp;&nbsp;&nbsp;↳ Uniesienie kinety (${u.mm} mm) [${u.label}]</span><span class="text-right-600">${fmtInt(u.cena)} PLN</span>`;
                        u._wyrenderowane = true;
                    });
                }

                if (
                    precoCalc.spadkiSzczegoly &&
                    precoCalc.spadkiSzczegoly.length > 0 &&
                    precoCalc.bazowaIds
                ) {
                    const spadkiBazy = precoCalc.spadkiSzczegoly.filter((s) =>
                        precoCalc.bazowaIds.includes(s._id)
                    );
                    spadkiBazy.forEach((s) => {
                        html += `<span>&nbsp;&nbsp;&nbsp;↳ Spadek ${s.typ} (${s.procent} %) [${s.label}]</span><span class="text-right-600">${fmtInt(s.cena)} PLN</span>`;
                        s._wyrenderowane = true;
                    });
                }

                precoCalc.dodWloty.forEach((d) => {
                    const typLabel =
                        d.typ === 'kaskada'
                            ? 'kaskada'
                            : d.typ === 'sciana'
                              ? 'ślepa kineta'
                              : 'dopływ';
                    const flowTypeName =
                        d.label && d.label.startsWith(FLOW_TYPES.WYLOT)
                            ? FLOW_TYPES.WYLOT
                            : FLOW_TYPES.WLOT;
                    const fLabel = d.label ? ` [${d.label}]` : '';
                    html += `<span>Dod. ${flowTypeName} DN${d.dn} (${typLabel})${fLabel}</span><span class="text-right-600">${fmtInt(d.cena)} PLN</span>`;

                    if (precoCalc.uniesieniaSzczegoly && precoCalc.uniesieniaSzczegoly.length > 0) {
                        const uniesieniaDlaWlotu = precoCalc.uniesieniaSzczegoly.filter(
                            (u) => u._id === d._id
                        );
                        uniesieniaDlaWlotu.forEach((u) => {
                            html += `<span>&nbsp;&nbsp;&nbsp;↳ Uniesienie kinety (${u.mm} mm)</span><span class="text-right-600">${fmtInt(u.cena)} PLN</span>`;
                            u._wyrenderowane = true;
                        });
                    }

                    if (precoCalc.spadkiSzczegoly && precoCalc.spadkiSzczegoly.length > 0) {
                        const spadkiDlaWlotu = precoCalc.spadkiSzczegoly.filter(
                            (s) => s._id === d._id
                        );
                        spadkiDlaWlotu.forEach((s) => {
                            html += `<span>&nbsp;&nbsp;&nbsp;↳ Spadek ${s.typ} (${s.procent} %)</span><span class="text-right-600">${fmtInt(s.cena)} PLN</span>`;
                            s._wyrenderowane = true;
                        });
                    }
                });

                if (precoCalc.uniesieniaSzczegoly && precoCalc.uniesieniaSzczegoly.length > 0) {
                    precoCalc.uniesieniaSzczegoly.forEach((u) => {
                        if (!u._wyrenderowane) {
                            const uLabel = u.label ? ` [${u.label}]` : '';
                            html += `<span>Uniesienie kinety (${u.mm} mm)${uLabel}</span><span class="text-right-600">${fmtInt(u.cena)} PLN</span>`;
                        }
                    });
                } else if (
                    precoCalc.uniesienie > 0 &&
                    (!precoCalc.uniesieniaSzczegoly || precoCalc.uniesieniaSzczegoly.length === 0)
                ) {
                    html += `<span>Uniesienie kinety</span><span class="text-right-600">${fmtInt(precoCalc.uniesienie)} PLN</span>`;
                }

                if (precoCalc.skrzynki && precoCalc.skrzynki.ilosc > 0) {
                    html += `<span>Skrzynki włazowe (${precoCalc.skrzynki.ilosc} szt.)</span><span class="text-right-600">${fmtInt(precoCalc.skrzynki.suma)} PLN</span>`;
                }
                if (precoCalc.spadkiSzczegoly && precoCalc.spadkiSzczegoly.length > 0) {
                    precoCalc.spadkiSzczegoly.forEach((s) => {
                        if (!s._wyrenderowane) {
                            const sLabel = s.label ? ` [${s.label}]` : '';
                            html += `<span>Spadek ${s.typ} (${s.procent} %)${sLabel}</span><span class="text-right-600">${fmtInt(s.cena)} PLN</span>`;
                        }
                    });
                } else {
                    if (precoCalc.spadekKineta > 0) {
                        html += `<span>Spadek kineta</span><span class="text-right-600">${fmtInt(precoCalc.spadekKineta)} PLN</span>`;
                    }
                    if (precoCalc.spadekMufa > 0) {
                        html += `<span>Spadek mufa</span><span class="text-right-600">${fmtInt(precoCalc.spadekMufa)} PLN</span>`;
                    }
                }
                if (precoCalc.pelnaWysokosc) {
                    html += `<span>↳ Wkładka uzupełniająca (${precoCalc.pelnaWysokosc.metry.toFixed(2)} m)</span><span class="text-right-600">${fmtInt(precoCalc.pelnaWysokosc.cena)} PLN</span>`;
                }
                if (discPreco > 0) {
                    html += `<span class="color-success">Rabat wkładka PRECO (${discPreco}%)</span><span class="color-success" class="text-right-600">-${fmtInt(precoCalc.suma - precoFinal)} PLN</span>`;
                }
                html += `</div></div>`;
            }
        }
    }

    tbody.innerHTML = html;
}

/* ===== Rejestracja globali ===== */
window.renderWellConfig = renderWellConfig;
