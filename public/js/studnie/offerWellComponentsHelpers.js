// @ts-check
/* ===== HELPERY KOMPONENTÓW STUDNI ===== */
/* calculateAssignedPrzejscia — przypisanie przejść do elementów konfiguracji */
/* Zależności: studnieProducts, buildConfigMap, findAssignedElement (globalne) */

function calculateAssignedPrzejscia(well) {
    const assigned = {};
    const rzDna = parseFloat(well.rzednaDna) || 0;

    let configMap = [];
    if (typeof buildConfigMap === 'function') {
        configMap = buildConfigMap(well, (id) => studnieProducts.find((pr) => pr.id === id), true);
    } else {
        let currY = 0;
        let dennicaCount = 0;
        for (let j = well.config.length - 1; j >= 0; j--) {
            const p = studnieProducts.find((x) => x.id === well.config[j].productId);
            if (!p) continue;
            let h = 0;
            if (p.componentType === 'dennica') {
                dennicaCount++;
                h = (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
            } else {
                h = (p.height || 0) * (well.config[j].quantity || 1);
            }
            configMap.push({
                index: j,
                start: currY,
                end: currY + h,
                componentType: p.componentType
            });
            currY += h;
        }
    }

    if (well.przejscia) {
        well.przejscia.forEach((pr) => {
            const mmFromBottom = (parseFloat(pr.rzednaWlaczenia || rzDna) - rzDna) * 1000;

            let idx = well.config.length - 1;
            let target = null;

            if (typeof findAssignedElement === 'function') {
                const fae = findAssignedElement(mmFromBottom, configMap);
                if (fae && fae.entry) {
                    idx = fae.assignedIndex;
                    target = fae.entry;
                }
            } else {
                target = configMap.find((cm) => mmFromBottom >= cm.start && mmFromBottom < cm.end);
                idx = target ? target.index : well.config.length - 1;
            }

            if (!assigned[idx]) assigned[idx] = [];

            let drillingBasePrice = 0;
            /** @type {any} */
            let bestDrillProd = null;
            const p = studnieProducts.find((x) => x.id === pr.productId);
            if (p) {
                const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');
                if (
                    !isInsitu &&
                    target &&
                    (target.componentType === 'krag' || target.componentType === 'krag_ot')
                ) {
                    const trDn = parseInt(pr.dn) || parseInt(p.dn) || 0;
                    if (trDn > 0) {
                        const drillingProducts = studnieProducts.filter(
                            (x) => x.category === 'Wiercenie'
                        );
                        let bestDnDiff = Infinity;
                        drillingProducts.forEach((drill) => {
                            let drillDn = parseInt(drill.dn);
                            if (isNaN(drillDn)) {
                                const match = drill.id.match(/Wiercenie-(\d+)/i);
                                if (match) drillDn = parseInt(match[1]);
                            }
                            if (!isNaN(drillDn) && drillDn >= trDn) {
                                if (drillDn - trDn < bestDnDiff) {
                                    bestDnDiff = drillDn - trDn;
                                    bestDrillProd = drill;
                                }
                            }
                        });
                        if (bestDrillProd) {
                            drillingBasePrice = bestDrillProd.price || 0;
                        }
                    }
                }
            }

            assigned[idx].push({
                ...pr,
                _drillingBasePrice: drillingBasePrice,
                _drillingProd: bestDrillProd
            });
        });
    }
    return assigned;
}

window.calculateAssignedPrzejscia = calculateAssignedPrzejscia;
