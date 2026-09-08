// @ts-check
/* ===== HELPERY KOMPONENTÓW STUDNI ===== */
/* calculateAssignedPrzejscia — przypisanie przejść do elementów konfiguracji */
/* Zależności: studnieProducts, buildConfigMap, findAssignedElement (globalne) */

function calculateAssignedPrzejscia(well) {
    const assigned = {};
    const rzDna = parseFloat(well.rzednaDna) || 0;

    let configMap = [];
    if (typeof buildConfigMap === 'function') {
        configMap = buildConfigMap(
            well,
            (id) =>
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(id)
                    : studnieProducts.find((pr) => pr.id === id),
            true
        );
    } else {
        let currY = 0;
        let belowType = null;
        let psiaSeed = !!well.psiaBuda;
        for (let j = well.config.length - 1; j >= 0; j--) {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(well.config[j].productId)
                    : studnieProducts.find((x) => x.id === well.config[j].productId);
            if (!p) continue;
            let h = 0;
            if (isDennicaLikeProduct(p)) {
                const qty = well.config[j].quantity || 1;
                for (let q = 0; q < qty; q++) {
                    h +=
                        (p.height || 0) - dennicaHeightPenalty(p, psiaSeed ? 'dennica' : belowType);
                    belowType = p.componentType;
                }
                psiaSeed = false;
            } else {
                h = (p.height || 0) * (well.config[j].quantity || 1);
                if (p.componentType !== 'uszczelka') belowType = p.componentType;
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
        // P4-P0: lista Wiercenie + parsowane DN raz per studnia (nie per przejście).
        const drillingProducts = studnieProducts
            .filter((x) => x.category === 'Wiercenie')
            .map((drill) => {
                let drillDn = parseInt(drill.dn);
                if (isNaN(drillDn)) {
                    const match = drill.id.match(/Wiercenie-(\d+)/i);
                    if (match) drillDn = parseInt(match[1]);
                }
                return { drill, drillDn };
            })
            .filter((d) => !isNaN(d.drillDn));
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
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(pr.productId)
                    : studnieProducts.find((x) => x.id === pr.productId);
            if (p) {
                const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');
                if (
                    !isInsitu &&
                    target &&
                    (target.componentType === 'krag' || target.componentType === 'krag_ot')
                ) {
                    const trDn = parseInt(pr.dn) || parseInt(p.dn) || 0;
                    if (trDn > 0) {
                        let bestDnDiff = Infinity;
                        drillingProducts.forEach(({ drill, drillDn }) => {
                            if (drillDn >= trDn) {
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
                _hostType: target ? target.componentType : null,
                _drillingBasePrice: drillingBasePrice,
                _drillingProd: bestDrillProd
            });
        });
    }
    return assigned;
}

window.calculateAssignedPrzejscia = calculateAssignedPrzejscia;
