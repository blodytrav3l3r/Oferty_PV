// @ts-check
/* ===== wellConfigRender.js — config table, sorting, enforcement (barrel) ===== */
/* renderTiles() przeniesione do wellConfigRenderTiles.js */

function renderWellConfig() {
    const tbody = document.getElementById('well-config-body');
    const well = getCurrentWell();

    if (!tbody) return;

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Kliknij kafelki powyżej, aby dodać elementy studni</div>';
        return;
    }

    const typeOrderMap = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 4,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7
    };

    const typeBadge = {
        wlaz: { bg: '#1e293b', label: 'Właz' },
        plyta_din: { bg: '#be185d', label: 'Płyta' },
        plyta_najazdowa: { bg: '#9d174d', label: 'Płyta' },
        plyta_zamykajaca: { bg: '#7c3aed', label: 'Płyta' },
        pierscien_odciazajacy: { bg: '#0891b2', label: 'Pierścień' },
        konus: { bg: '#d97706', label: 'Konus' },
        avr: { bg: '#475569', label: 'AVR' },
        plyta_redukcyjna: { bg: '#6d28d9', label: 'Redukcja' },
        krag: { bg: '#4338ca', label: 'Krąg' },
        krag_ot: { bg: '#4338ca', label: 'Krąg OT' },
        dennica: { bg: '#047857', label: 'Dennica' },
        kineta: { bg: '#9d174d', label: 'Kineta' },
        uszczelka: { bg: '#334155', label: 'Uszczelka' },
        styczna: { bg: '#059669', label: 'Styczna' },
        osadnik: { bg: '#a16207', label: 'Osadnik' }
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
        const totalWeight = (p.weight || 0) * item.quantity;
        const totalAreaInt = (p.area || 0) * item.quantity;
        const totalAreaExt = (p.areaExt || 0) * item.quantity;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };

        const canMoveUp = index > 0;
        const canMoveDown = index < well.config.length - 1;

        const isPlaceholder = item.isPlaceholder;
        const plStyle = isPlaceholder
            ? 'opacity:0.7; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); pointer-events: none;'
            : '';

        html += `<div data-cfg-idx="${index}" class="config-tile" draggable="true" data-action="cfg-tile" data-is-placeholder="${isPlaceholder ? 'true' : 'false'}" style="background:linear-gradient(90deg, ${badge.bg} 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:4px solid ${badge.bg.substring(0, 7)}; border-radius:8px; padding:0.25rem 0.4rem; position:relative; transition:all 0.2s ease; margin-bottom:0.25rem; cursor:grab; ${plStyle}">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">

            <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                <div style="display:flex; flex-direction:column; gap:0; align-items:center; background:rgba(0,0,0,0.25); padding:2px 4px; border-radius:4px; min-width:24px;">
                  <button class="cfg-move-btn" ${!canMoveUp ? 'disabled' : ''} data-action="move-well-up" data-cfg-idx="${index}" title="W górę" aria-label="W górę" style="background:none; border:none; color:var(--text-muted); padding:0; margin:0; height:12px; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; cursor:${canMoveUp ? 'pointer' : 'default'};"><i data-lucide="chevron-up" style="width:14px; height:14px;" aria-hidden="true"></i></button>
                  <span style="font-size:0.65rem; line-height:1; color:var(--text-primary); font-weight:800; margin:2px 0;">${index + 1}</span>
                  <button class="cfg-move-btn" ${!canMoveDown ? 'disabled' : ''} data-action="move-well-down" data-cfg-idx="${index}" title="W dół" aria-label="W dół" style="background:none; border:none; color:var(--text-muted); padding:0; margin:0; height:12px; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; cursor:${canMoveDown ? 'pointer' : 'default'};"><i data-lucide="chevron-down" style="width:14px; height:14px;" aria-hidden="true"></i></button>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.1rem; min-width:0;">
                  <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                    <span style="background:${badge.bg}; color:white; font-size:0.55rem; padding:1px 5px; border-radius:4px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; opacity:0.9;">${badge.label.split(' ')[1] || badge.label}</span>
                    <div style="font-weight:700; color:var(--text-primary); font-size:0.85rem; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}${p.componentType === 'uszczelka' && item.quantity > 1 ? ` (x${item.quantity} szt.)` : p.componentType === 'uszczelka' ? ` (1 szt.)` : ''}</div>
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
                            const precoColor = isPrecoDisabled ? 'var(--text-muted)' : '#f43f5e';
                            const precoBg = isPrecoDisabled
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(244,63,94,0.1)';
                            const precoBorder = isPrecoDisabled
                                ? 'rgba(255,255,255,0.2)'
                                : 'rgba(244,63,94,0.4)';
                            const precoText = isPrecoDisabled
                                ? `<del>PRECO (${percDesc})</del>`
                                : `PRECO (${percDesc})`;

                            badgesHtml += `<span data-action="toggle-liner-preco" data-cfg-idx="${index}" style="cursor:pointer; font-size:0.55rem; color:${precoColor}; font-weight:800; margin-left:4px; border:1px solid ${precoBorder}; padding:1px 4px; border-radius:4px; background:${precoBg}; white-space:nowrap; transition:all 0.2s;" title="Kliknij, aby włączyć/wyłączyć przeliczanie PRECO dla tego elementu">${precoText}</span>`;
                        }

                        let pehdType = null;
                        if (['dennica', 'styczna'].includes(p.componentType)) {
                            pehdType = well.wkladkaDennica;
                        } else if (
                            [
                                'plyta',
                                'plyta_redukcyjna',
                                'plyta_nastudzienna',
                                'stozek',
                                'zwienczenie',
                                'konus',
                                'plyta_din',
                                'plyta_najazdowa',
                                'plyta_zamykajaca',
                                'pierscien_odciazajacy'
                            ].includes(p.componentType)
                        ) {
                            pehdType = well.wkladkaZwienczenie;
                        } else if (['krag', 'krag_ot', 'rura'].includes(p.componentType)) {
                            pehdType = well.wkladkaNadbudowa;
                        }

                        if (pehdType && pehdType !== 'brak' && p.doplataPEHD != null) {
                            const isPehdDisabled = item.disablePehd;
                            const pehdColor = isPehdDisabled ? 'var(--text-muted)' : '#0ea5e9';
                            const pehdBg = isPehdDisabled
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(14,165,233,0.1)';
                            const pehdBorder = isPehdDisabled
                                ? 'rgba(255,255,255,0.2)'
                                : 'rgba(14,165,233,0.4)';
                            const pehdText = isPehdDisabled ? `<del>PEHD</del>` : `PEHD`;

                            badgesHtml += `<span data-action="toggle-liner-pehd" data-cfg-idx="${index}" style="cursor:pointer; font-size:0.55rem; color:${pehdColor}; font-weight:800; margin-left:4px; border:1px solid ${pehdBorder}; padding:1px 4px; border-radius:4px; background:${pehdBg}; white-space:nowrap; transition:all 0.2s;" title="Kliknij, aby włączyć/wyłączyć dopłatę PEHD dla tego elementu">${pehdText}</span>`;
                        }

                        if (
                            well.nadbudowa === 'zelbetowa' &&
                            (p.componentType === 'krag' || p.componentType === 'krag_ot')
                        ) {
                            badgesHtml +=
                                ' <span class="color-warn" style="font-size:0.55rem; border:1px solid rgba(245,158,11,0.4); padding:1px 4px; border-radius:4px; background:rgba(245,158,11,0.1); margin-left:4px; font-weight:700;">ŻELBET</span>';
                        }
                        if (
                            (well.dennicaMaterial === 'zelbetowa' ||
                                well.material === 'zelbetowa') &&
                            p.componentType === 'dennica'
                        ) {
                            badgesHtml +=
                                ' <span class="color-warn" style="font-size:0.55rem; border:1px solid rgba(245,158,11,0.4); padding:1px 4px; border-radius:4px; background:rgba(245,158,11,0.1); margin-left:4px; font-weight:700;">ŻELBET</span>';
                        }
                        if (
                            well.stopnie === 'nierdzewna' &&
                            (p.componentType === 'krag' ||
                                p.componentType === 'krag_ot' ||
                                p.componentType === 'konus' ||
                                p.componentType === 'dennica')
                        ) {
                            badgesHtml +=
                                ' <span class="color-accent" style="font-size:0.55rem; border:1px solid rgba(168,85,247,0.4); padding:1px 4px; border-radius:4px; background:rgba(168,85,247,0.1); margin-left:4px; font-weight:700;">NIERDZ.</span>';
                        }

                        return badgesHtml;
                    })()}
                  </div>
                  <div style="font-size:0.65rem; color:var(--text-muted); opacity:0.6; padding-left:2px; line-height:1;">${p.id}${p.height ? ' | H=' + p.height + 'mm' : ''}</div>
                </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.6rem; flex-shrink:0; min-width:340px;">
              <div style="display:grid; grid-template-columns:36px 65px 60px 48px 120px; gap:0 0.5rem; align-items:center;">
                <span style="font-size:0.52rem; color:rgba(255,255,255,0.25); font-weight:800; letter-spacing:0.6px; text-align:left;">WAGA:</span>
                <span style="color:rgba(255,255,255,0.95); font-weight:700; font-size:0.82rem; white-space:nowrap; text-align:right;">${p.weight || totalWeight > 0 ? fmtInt(totalWeight) + ' kg' : '—'}</span>

                <div style="width:60px;"></div>

                <span style="font-size:0.52rem; color:rgba(255,255,255,0.25); font-weight:800; letter-spacing:0.6px; text-align:left;">CENA:</span>
                <span style="font-size:1.0rem; font-weight:800; color:var(--success); white-space:nowrap; letter-spacing:0.3px; text-align:right; width:100%; display:block; line-height:1;">${fmtInt(totalPrice)} PLN</span>
              </div>
              <div style="width:26px; display:flex; justify-content:center;">
                <button data-action="remove-well-component" data-cfg-idx="${index}" title="Usuń" style="width:26px; height:26px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:6px; cursor:pointer; color:#ef4444; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; transition:all 0.2s;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
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
                html += `<div style="margin-top:0.5rem; padding:0.6rem 0.7rem; background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:10px; color:#ef4444; font-weight:700; font-size:0.85rem; line-height:1.4;">`;
                html += `⚠️ ${precoCalc.error}`;
                html += `</div>`;
            } else {
                const precoMult = 1 - discPreco / 100;
                const precoFinal = precoCalc.suma * precoMult;

                html += `<div style="margin-top:0.5rem; padding:0.6rem 0.7rem; background:linear-gradient(135deg, rgba(244,63,94,0.12), rgba(139,92,246,0.08)); border:1px solid rgba(244,63,94,0.3); border-radius:10px;">`;
                html += `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">`;
                html += `<span style="font-weight:800; font-size:0.85rem; color:#f43f5e;">🔧 Wkładka ${kinetaLabel}</span>`;
                html += `<span style="font-weight:800; font-size:1rem; color:var(--success);">${fmtInt(precoFinal)} PLN</span>`;
                html += `</div>`;
                html += `<div style="display:grid; grid-template-columns:1fr auto; gap:0.15rem 0.8rem; font-size:0.75rem; color:var(--text-secondary);">`;

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
                    html += `<span>&nbsp;&nbsp;&nbsp;↳ Redukcja kinety${redDesc}</span><span style="text-align:right; font-weight:600; color:var(--text-muted);">${fmtInt(precoCalc.redukcja)} PLN</span>`;
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
                        html += `<span>&nbsp;&nbsp;&nbsp;↳ Uniesienie kinety (${u.mm} mm) [${u.label}]</span><span style="text-align:right; font-weight:600; color:var(--text-muted);">${fmtInt(u.cena)} PLN</span>`;
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
                        html += `<span>&nbsp;&nbsp;&nbsp;↳ Spadek ${s.typ} (${s.procent} %) [${s.label}]</span><span style="text-align:right; font-weight:600; color:var(--text-muted);">${fmtInt(s.cena)} PLN</span>`;
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
                            html += `<span>&nbsp;&nbsp;&nbsp;↳ Uniesienie kinety (${u.mm} mm)</span><span style="text-align:right; font-weight:600; color:var(--text-muted);">${fmtInt(u.cena)} PLN</span>`;
                            u._wyrenderowane = true;
                        });
                    }

                    if (precoCalc.spadkiSzczegoly && precoCalc.spadkiSzczegoly.length > 0) {
                        const spadkiDlaWlotu = precoCalc.spadkiSzczegoly.filter(
                            (s) => s._id === d._id
                        );
                        spadkiDlaWlotu.forEach((s) => {
                            html += `<span>&nbsp;&nbsp;&nbsp;↳ Spadek ${s.typ} (${s.procent} %)</span><span style="text-align:right; font-weight:600; color:var(--text-muted);">${fmtInt(s.cena)} PLN</span>`;
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

function sortWellConfigByOrder() {
    const well = getCurrentWell();
    if (!well || !well.config) return;

    if (typeof window.ensureReliefRingPair === 'function') {
        window.ensureReliefRingPair(well);
    }

    const typeOrder = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 4,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7,
        uszczelka: 8
    };

    well.config = [...well.config].sort((a, b) => {
        const pA = studnieProducts.find((p) => p.id === a.productId);
        const pB = studnieProducts.find((p) => p.id === b.productId);
        if (!pA || !pB) return 0;

        let orderA = typeOrder[pA.componentType] ?? 100;
        let orderB = typeOrder[pB.componentType] ?? 100;

        const targetDn = well.redukcjaDN1000 ? well.redukcjaTargetDN || 1000 : null;
        if (targetDn) {
            if (
                (pA.componentType === 'krag' || pA.componentType === 'krag_ot') &&
                parseInt(pA.dn) === parseInt(targetDn)
            ) {
                orderA = 3.5;
            }
            if (
                (pB.componentType === 'krag' || pB.componentType === 'krag_ot') &&
                parseInt(pB.dn) === parseInt(targetDn)
            ) {
                orderB = 3.5;
            }
        }

        if (orderA !== orderB) return orderA - orderB;

        return 0;
    });
    _moveWlazToTop(well);
}

function _moveWlazToTop(well) {
    if (!well || !well.config || well.config.length < 2) return;
    let wlazIdx = -1;
    for (var i = 0; i < well.config.length; i++) {
        const p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
        if (p && p.componentType === 'wlaz') {
            wlazIdx = i;
            break;
        }
    }
    if (wlazIdx > 0) {
        const item = well.config.splice(wlazIdx, 1)[0];
        well.config.unshift(item);
    }
}

function enforceSingularTopClosures(well, productId) {
    if (!well || !well.config) return;

    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) return;

    const topClosureTypes = [
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'konus',
        'pierscien_odciazajacy'
    ];

    if (topClosureTypes.includes(product.componentType)) {
        if (
            product.componentType === 'konus' &&
            well.wkladkaZwienczenie &&
            well.wkladkaZwienczenie !== 'brak'
        ) {
            if (typeof window.showKonusPehdResolverModal === 'function') {
                window.showKonusPehdResolverModal(currentWellIndex);
            } else {
                showToast(
                    'Nie można dodać konusa przy aktywnej wkładce PEHD zwieńczenia.',
                    'error'
                );
            }
            well.config = well.config.filter(
                (item) => !(item.isPlaceholder && item.productId === productId)
            );
            return;
        }

        const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];

        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true;

            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return true;

            if (reliefTypes.includes(product.componentType)) {
                if (reliefTypes.includes(p.componentType)) {
                    return p.componentType !== product.componentType;
                }
                return !topClosureTypes.includes(p.componentType);
            }

            return !topClosureTypes.includes(p.componentType);
        });
    }

    if (product.componentType === 'plyta_redukcyjna') {
        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true;
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return !p || p.componentType !== 'plyta_redukcyjna';
        });
    }
}

window.renderWellConfig = renderWellConfig;
window.sortWellConfigByOrder = sortWellConfigByOrder;
window._moveWlazToTop = _moveWlazToTop;
window.enforceSingularTopClosures = enforceSingularTopClosures;
