// @ts-check
/* ===== actionsTiles.js — render palety (kafelków) produktów ===== */

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

        if (group.types.includes('styczna')) {
            items.sort((a, b) => (a.dn || 0) - (b.dn || 0));
        }

        if (
            group.types.includes('dennica') ||
            group.types.includes('krag') ||
            group.types.includes('krag_ot')
        ) {
            items.sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
        }

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

            html += `<div class="tile ${activeClass}" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${escapeHtml(p.id)}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${escapeHtml(p.id)}')`}" ondragend="dragEndWellComponent(event)">
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
                if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                    return p.dn === 'styczna' || p.componentType === 'styczna';
                }
                const effDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
                return parseInt(p.dn) === effDn || p.dn === null;
            }

            if (parseInt(p.dn) !== parseInt(dn) && p.dn !== null) return false;

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

                    html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${escapeHtml(p.id)}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${escapeHtml(p.id)}')`}" ondragend="dragEndWellComponent(event)">
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
                if (p.componentType === 'plyta_redukcyjna') {
                    if (parseInt(p.dn) !== parseInt(dn)) return false;
                    return matchesTargetDn(p.name, tDn);
                }
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
                if (g.types.includes('plyta_redukcyjna')) return;
                let items = redProducts.filter((p) => g.types.includes(p.componentType));

                if (g.types.includes('uszczelka')) {
                    items = filterSealsByWellType(items, well);
                }

                if (
                    g.types.includes('dennica') ||
                    g.types.includes('krag') ||
                    g.types.includes('krag_ot')
                ) {
                    items.sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
                }

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

                        html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${escapeHtml(p.id)}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${escapeHtml(p.id)}')`}" ondragend="dragEndWellComponent(event)">
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
