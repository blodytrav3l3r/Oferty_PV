// @ts-check
/* ===== wellActions.part1.js — helper functions, pure/isolated logic ===== */

/**
 * Znajduje zakończenie tego samego typu dla innej średnicy.
 */
function findClosureForDn(productId, targetDn) {
    if (!productId) return null;
    const prod = studnieProducts.find((p) => p.id === productId);
    if (!prod || !prod.componentType) return null;
    const match = studnieProducts.find(
        (p) =>
            p.componentType === prod.componentType && (parseInt(p.dn) === targetDn || p.dn === null)
    );
    return match ? match.id : null;
}

/**
 * Zapewnia, że w studni znajduje się tylko jedno zakończenie górne.
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

/**
 * Sortuje konfigurację studni zgodnie z fizyczną kolejnością (od góry do dołu).
 */
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
    var wlazIdx = -1;
    for (var i = 0; i < well.config.length; i++) {
        var p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
        if (p && p.componentType === 'wlaz') {
            wlazIdx = i;
            break;
        }
    }
    if (wlazIdx > 0) {
        var item = well.config.splice(wlazIdx, 1)[0];
        well.config.unshift(item);
    }
}

// Eksport do window dla innych modułów
window.enforceSingularTopClosures = enforceSingularTopClosures;
window.sortWellConfigByOrder = sortWellConfigByOrder;
