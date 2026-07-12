// @ts-check
/* ===== wellConfigRender.js — tiles, config table, sorting, enforcement ===== */

function renderTiles() {
    const container = document.getElementById('tiles-container');
    if (!container) return;
    const well = getCurrentWell();
    if (!well) {
        container.innerHTML =
            '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.8rem;">Dodaj studnię aby wybrać elementy</div>';
        return;
    }
    const dn = well.dn;

    const groups = [
        { title: '<i data-lucide="circle-dot"></i> Włazy', icon: '', types: ['wlaz'] },
        { title: '<i data-lucide="settings"></i> AVR / Pierścienie', icon: '', types: ['avr'] },
        { title: '<i data-lucide="diamond"></i> Konus / Stożek', icon: '', types: ['konus'] },
        {
            title: '<span class="text-xs"><i data-lucide="chevron-down"></i></span> Płyty nakrywające',
            icon: '',
            types: ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy']
        },
        { title: '⬛ Płyty redukcyjne', icon: '', types: ['plyta_redukcyjna'] },
        { title: '<i data-lucide="square"></i> Kręgi', icon: '', types: ['krag'] },
        {
            title: '<i data-lucide="square"></i> Kręgi z otworami (OT)',
            icon: '',
            types: ['krag_ot']
        },
        { title: '<i data-lucide="square"></i> Dennica', icon: '', types: ['dennica'] },
        { title: 'đźŞŁ Osadniki', icon: '', types: ['osadnik'] },
        // Studnie styczne widoczne tylko gdy wybrana typu studni Styczna
        ...(dn === 'styczna'
            ? (() => {
                  const variant = well.stycznaVariant || 'standard';
                  if (variant === 'korek') {
                      return [
                          {
                              title: '<i data-lucide="plug"></i> Studnie Styczne z korkiem',
                              icon: '',
                              types: ['styczna'],
                              filterFn: (p) => p.id.includes('KOREK')
                          }
                      ];
                  }
                  return [
                      {
                          title: '<i data-lucide="cylinder"></i> Studnie Styczne',
                          icon: '',
                          types: ['styczna'],
                          filterFn: (p) => !p.id.includes('KOREK')
                      }
                  ];
              })()
            : []),
        { title: '<i data-lucide="circle-check"></i> Uszczelki', icon: '', types: ['uszczelka'] }
    ];

    let html = '';

    const renderGroup = (group, prods) => {
        let items = prods.filter((p) => group.types.includes(p.componentType));
        if (group.filterFn) {
            items = items.filter(group.filterFn);
        }
        if (items.length === 0) return;

        // Niestandardowe sortowanie dla studni stycznych: sortuj wg DN
        if (group.types.includes('styczna')) {
            items.sort((a, b) => (a.dn || 0) - (b.dn || 0));
        }

        // Niestandardowe sortowanie dla dennicy: sortuj wg wysokości od najniższej do najwyższej
        if (
            group.types.includes('dennica') ||
            group.types.includes('krag') ||
            group.types.includes('krag_ot')
        ) {
            items.sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
        }

        // Sortowanie wg kolejności zadeklarowanej w group.types
        if (
            group.types.length > 1 &&
            !group.types.includes('dennica') &&
            !group.types.includes('krag') &&
            !group.types.includes('krag_ot') &&
            !group.types.includes('styczna')
        ) {
            items.sort((a, b) => {
                const idxA = group.types.indexOf(a.componentType);
                const idxB = group.types.indexOf(b.componentType);
                return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            });
        }

        html += `<div class="tiles-section">
      <div class="tiles-section-title">${group.title}</div>
      <div class="tiles-grid">`;

        items.forEach((p) => {
            const isTopClosure = [
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'konus',
                'pierscien_odciazajacy'
            ].includes(p.componentType);
            const isInConfig = (well.config || []).some((c) => c.productId === p.id);
            const activeClass = isTopClosure && isInConfig ? 'active-top-closure' : '';
            const isLocked = isWellLocked();
            const lockedStyle = isLocked
                ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                : '';

            // Oblicz cenę z dopłatą
            let displayPrice = p.price || 0;
            if (
                well.stopnie === 'nierdzewna' &&
                (p.componentType === 'krag_ot' || p.componentType === 'dennica') &&
                p.doplataDrabNierdzewna
            ) {
                displayPrice += parseFloat(p.doplataDrabNierdzewna);
            }
            if (
                (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
                p.componentType === 'dennica' &&
                p.doplataZelbet
            ) {
                displayPrice += parseFloat(p.doplataZelbet);
            }

            html += `<div class="tile ${activeClass}" data-type="${p.componentType}" style="${lockedStyle}" data-action="add-well-component" data-product-id="${p.id}" draggable="${!isLocked}">
        <div class="tile-name">${p.name}</div>
        <div class="tile-meta">
          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
          <span class="tile-price">${fmtInt(displayPrice)} PLN</span>
        </div>
      </div>`;
        });
        html += `</div></div>`;
    };

    const availProducts = getAvailableProducts(well);
    const primaryProducts = availProducts
        .filter((p) => {
            if (dn === 'styczna') {
                // Dla studni stycznych używamy 'styczna' dla dennicy/stycznej bazy
                if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                    return p.dn === 'styczna' || p.componentType === 'styczna';
                }
                // Reszta nadbudowy dla studni stycznej to standardowe DN1000 lub DN1200
                const effDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
                return parseInt(p.dn) === effDn || p.dn === null;
            }

            // Porównanie DN z konwersją typów (p.dn może być string lub number)
            if (parseInt(p.dn) !== parseInt(dn) && p.dn !== null) return false;

            // Filtrowanie płyt redukcyjnych według wybranej średnicy docelowej
            if (p.componentType === 'plyta_redukcyjna' && well.redukcjaDN1000) {
                const tDn = well.redukcjaTargetDN || 1000;
                const nameUpper = (p.name || '').toUpperCase();
                const matchesTarget =
                    nameUpper.includes('/' + tDn) ||
                    nameUpper.includes(' DN' + tDn) ||
                    nameUpper.includes('X' + tDn) ||
                    nameUpper.includes(' NA ' + tDn) ||
                    nameUpper.includes('→DN' + tDn) ||
                    nameUpper.includes('→' + tDn) ||
                    nameUpper.includes('->DN' + tDn) ||
                    nameUpper.includes('->' + tDn);
                if (!matchesTarget) return false;
            }

            return true;
        })
        .filter((p) => filterByWellParams(p, well));

    groups.forEach((g) => {
        // Specjalna logika dla studni stycznych, aby pokazać poprawny parametr uszczelki w kategorii uszczelek
        if (g.types.includes('uszczelka')) {
            let items = primaryProducts.filter((p) => g.types.includes(p.componentType));
            items = filterSealsByWellType(items, well);

            if (items.length > 0) {
                html += `<div class="tiles-section"><div class="tiles-section-title">${g.title}</div><div class="tiles-grid">`;
                items.forEach((p) => {
                    const isLocked = isWellLocked();
                    const lockedStyle = isLocked
                        ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                        : '';

                    html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" data-action="add-well-component" data-product-id="${p.id}" draggable="${!isLocked}">
                        <div class="tile-name">${p.name}</div>
                        <div class="tile-meta">
                          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
                          <span class="tile-price">${fmtInt(p.price)} PLN</span>
                        </div>
                      </div>`;
                });
                html += `</div></div>`;
            }
        } else {
            renderGroup(g, primaryProducts);
        }
    });

    const hasReduction =
        well.redukcjaDN1000 ||
        (well.config || []).some((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'plyta_redukcyjna';
        });

    if ([1200, 1500, 2000, 2500].includes(parseInt(dn)) && hasReduction) {
        const tDn = well.redukcjaTargetDN || 1000;

        // Funkcja pomocnicza do sprawdzania czy płyta pasuje do docelowej średnicy
        const matchesTargetDn = (name, target) => {
            const n = (name || '').toUpperCase();
            return (
                n.includes('/' + target) ||
                n.includes(' DN' + target) ||
                n.includes('X' + target) ||
                n.includes(' NA ' + target) ||
                n.includes('→DN' + target) ||
                n.includes('→' + target) ||
                n.includes('->DN' + target) ||
                n.includes('->' + target) ||
                n.includes('DO ' + target)
            );
        };

        const redProducts = availProducts
            .filter((p) => {
                // 1. Płyta redukcyjna: musi być dla średnicy studni (dn) i pasować do tDn
                if (p.componentType === 'plyta_redukcyjna') {
                    if (parseInt(p.dn) !== parseInt(dn)) return false;
                    return matchesTargetDn(p.name, tDn);
                }
                // 2. Inne elementy: muszą być bezpośrednio dla tDn
                if (parseInt(p.dn) === tDn) {
                    return p.componentType !== 'dennica' && p.componentType !== 'styczna';
                }
                return false;
            })
            .filter((p) => filterByWellParams(p, well));

        if (redProducts.length > 0) {
            html += `<div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">`;
            html += `<h3 class="color-warn" style="margin-bottom:1rem; font-size:1.1rem;">Redukcja (DN${tDn})</h3>`;

            groups.forEach((g) => {
                // Płyty redukcyjne pomijamy — są dostępne w głównej liście kafelków
                // (wellActions.js:723 + filtr redukcjaDN1000), nie chcemy duplikatu w sekcji Redukcja
                if (g.types.includes('plyta_redukcyjna')) return;
                let items = redProducts.filter((p) => g.types.includes(p.componentType));

                if (g.types.includes('uszczelka')) {
                    items = filterSealsByWellType(items, well);
                }

                // Dodano sortowanie dla sekcji redukcji, analogicznie do głównej sekcji
                if (
                    g.types.includes('dennica') ||
                    g.types.includes('krag') ||
                    g.types.includes('krag_ot')
                ) {
                    items.sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
                }

                // Sortowanie wg kolejności zadeklarowanej w group.types
                if (
                    g.types.length > 1 &&
                    !g.types.includes('dennica') &&
                    !g.types.includes('krag') &&
                    !g.types.includes('krag_ot') &&
                    !g.types.includes('styczna')
                ) {
                    items.sort((a, b) => {
                        const idxA = g.types.indexOf(a.componentType);
                        const idxB = g.types.indexOf(b.componentType);
                        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                    });
                }

                if (items.length > 0) {
                    html += `<div class="tiles-section">
                        <div class="tiles-section-title">${g.title}</div>
                        <div class="tiles-grid">`;

                    items.forEach((p) => {
                        const isLocked = isWellLocked();
                        const lockedStyle = isLocked
                            ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                            : '';

                        let displayPrice = p.price || 0;
                        if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
                            displayPrice += parseFloat(p.doplataDrabNierdzewna);
                        }

                        html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" data-action="add-well-component" data-product-id="${p.id}" draggable="${!isLocked}">
                            <div class="tile-name">${p.name}</div>
                            <div class="tile-meta">
                              <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
                              <span class="tile-price">${fmtInt(displayPrice)} PLN</span>
                            </div>
                          </div>`;
                    });
                    html += `</div></div>`;
                }
            });
            html += `</div>`;
        }
    }

    container.innerHTML = html;
}

function renderWellConfig() {
    const tbody = document.getElementById('well-config-body');
    const well = getCurrentWell();

    if (!tbody) return;

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Kliknij kafelki powyżej, aby dodać elementy studni</div>';
        return;
    }

    // Mapowanie wizualnej kolejności typu komponentu (góra studni → dół)
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

    // Odznaki kolorów typów
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
        // Rozwiąż poprawny wariant produktu wg parametrów studni (auto-korekta productId)
        const p =
            typeof resolveEffectiveProduct === 'function'
                ? resolveEffectiveProduct(well, item.productId, item)
                : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        // W zamówieniu użyj zamrożonej ceny tylko w podglądzie; w ofercie/edycji przelicz na nowo
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
                    // W zamówieniu użyj zamrożonej ceny tylko w podglądzie; w ofercie/edycji przelicz na nowo
                    const rawKinetaPrice =
                        kinetaItem.frozenPrice != null && window.isPreviewMode
                            ? kinetaItem.frozenPrice
                            : getItemAssessedPrice(well, kinetaProd, true, kinetaItem);
                    totalPrice += rawKinetaPrice * (kinetaItem.quantity || 1);
                }
            }
            // PRECO wycena — wliczona w cenę dennicy
            if (well.kineta === 'preco' || well.kineta === 'precotop') {
                const precoCalc = calcPrecoPricing(well);
                const discKey = well.dn === 'styczna' ? 'styczne' : well.dn;
                const discPreco = (wellDiscounts[discKey] || {}).preco || 0;
                const precoMult = 1 - discPreco / 100;
                totalPrice += precoCalc.suma * precoMult;
            }
            // Dopłata wliczona do dennicy / studni stycznej (nie podlega rabatowi)
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

                        // PRECO Logic
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

                        // PEHD Logic
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

                        if (pehdType && pehdType !== 'brak' && p.doplataPEHD) {
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

                        // Żelbet i Drabinka Nierdzewna
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

    // Widoczne rozbicie PRECO — pod elementami konfiguracji
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
                // Blok z błędem PRECO
                html += `<div style="margin-top:0.5rem; padding:0.6rem 0.7rem; background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:10px; color:#ef4444; font-weight:700; font-size:0.85rem; line-height:1.4;">`;
                html += `⚠️ ${precoCalc.error}`;
                html += `</div>`;
            } else {
                // Prawidłowe rozbicie PRECO
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

    // Automatyczne dodawanie pary odciążającej (płyta + pierścień)
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

        // Reguła redukcji: kręgi nad redukcją (nad płytą redukcyjną = order 4)
        // Kręgi o DN = redukcjaTargetDN (np. DN1200) powinny być nad płytą
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

        // Usunięto automatyczne sortowanie po wysokości (pB.height - pA.height).
        // Pozwala to na ręczne układanie elementów tej samej kategorii (np. kręgów tej samej średnicy) przez użytkownika.
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

/**
 * Zapewnia, że w studni znajduje się tylko jedno zakończenie górne.
 * Jeśli dodawany produkt jest zakończeniem, usuwa inne elementy tego typu.
 */
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
            // Usun placeholder poniewaz go blokujemy
            well.config = well.config.filter(
                (item) => !(item.isPlaceholder && item.productId === productId)
            );
            return;
        }

        const reliefTypes = ['pierscien_odciazajacy', 'plyta_zamykajaca', 'plyta_najazdowa'];

        // Usuwamy inne zakończenia górne (ale NIE usuwamy obecnego placeholder-a jeśli to on jest sprawdzany)
        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true; // Zostawiamy placeholder w spokoju

            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return true;

            // Jeśli dodajemy element odciążający
            if (reliefTypes.includes(product.componentType)) {
                // Pozwól na partnera (inny reliefType), ale usuń ten sam typ
                if (reliefTypes.includes(p.componentType)) {
                    return p.componentType !== product.componentType;
                }
                return !topClosureTypes.includes(p.componentType);
            }

            // Jeśli dodajemy element NIE-odciążający (np. konus), usuwamy WSZYSTKIE zakończenia
            return !topClosureTypes.includes(p.componentType);
        });
    }

    // ZASADA: Płyta redukcyjna - tylko 1 na studnię
    if (product.componentType === 'plyta_redukcyjna') {
        well.config = well.config.filter((item) => {
            if (item.isPlaceholder) return true;
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return !p || p.componentType !== 'plyta_redukcyjna';
        });
    }
}

// Eksport do window dla innych modułów
window.renderTiles = renderTiles;
window.renderWellConfig = renderWellConfig;
window.sortWellConfigByOrder = sortWellConfigByOrder;
window._moveWlazToTop = _moveWlazToTop;
window.enforceSingularTopClosures = enforceSingularTopClosures;
