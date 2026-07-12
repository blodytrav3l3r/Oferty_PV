// @ts-check
/* ===== SOLVER — kręgi wiercone (OT) ===== */

/**
 * Buduje tablicę segmentów z konfiguracji (odwróconej).
 */
function buildConfigSegments(configItems, psiaBuda) {
    let y = 0;
    let lastWasD = !!psiaBuda;
    return configItems.map((item) => {
        const prod = studnieProducts.find((p) => p.id === item.productId);
        let h = prod ? parseFloat(prod.height) || 0 : 0;
        if (prod && prod.componentType === 'dennica' && lastWasD) {
            h -= 100;
        }
        const seg = {
            itemBase: item,
            start: y,
            end: y + h,
            type: prod ? prod.componentType : ''
        };
        y += h;
        lastWasD = prod && prod.componentType === 'dennica';
        return seg;
    });
}

/**
 * Po zbudowaniu segmentów, sprawdza czy przejście (otwór) jest WEWNĄTRZ kręgu
 * i zamienia zwykły krag na krag_ot (wiercony) w odpowiednim segmencie.
 *
 * ZASADY:
 * 1. Otwór OT tylko gdy przejście faktycznie jest WEWNĄTRZ tego kręgu (środek otworu)
 * 2. Zamiana na OT musi zachować tę samą wysokość kręgu (nie zmienia totalnej wysokości)
 * 3. Jeśli otwór wychodzi na łączenie dennicy i kręgu → zwraca flagę needsTallerDennica
 *
 * Zwraca { items: kregItems[], needsTallerDennica: boolean }
 */
function applyDrilledRings(kregItems, segments, well, availProducts) {
    const result = { items: kregItems, needsTallerDennica: false };
    if (!well.przejscia || well.przejscia.length === 0) {
        // Zwróć KLON aby caller mógł bezpiecznie zrobić splice na oryginalnej tablicy
        result.items = structuredClone(kregItems);
        return result;
    }
    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
    const newItems = structuredClone(kregItems);
    const usedSegIndices = new Set();

    for (const pr of well.przejscia) {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;

        // Przebuduj wysokość krawędzi dennic z uwzględnieniem redukcji dennic piętrowych
        let currentDennicaEnd = 0;
        let cy = 0;
        let lastWasD = !!well.psiaBuda;
        const configReversed = [...newItems].reverse();
        for (const item of configReversed) {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) continue;
            let h = p.height || 0;
            if (p.componentType === 'dennica' && lastWasD) h -= 100;
            if (p.componentType === 'dennica') currentDennicaEnd = cy + h;
            cy += h;
            lastWasD = p.componentType === 'dennica';
        }

        const prDN =
            typeof pprod.dn === 'string' && pprod.dn.includes('/')
                ? parseFloat(pprod.dn.split('/')[1]) || 160
                : parseFloat(pprod.dn) || 160;

        const holeCenter = mmFromBottom + prDN / 2;

        // Sprawdź, czy otwór przesuwa się przez połączenie dennicy i kręgu
        if (
            currentDennicaEnd > 0 &&
            mmFromBottom < currentDennicaEnd &&
            mmFromBottom + prDN > currentDennicaEnd
        ) {
            result.needsTallerDennica = true;
        }

        // Sprawdź, czy środek otworu znajduje się w całości wewnątrz dennicy — OT nie jest potrzebne
        if (currentDennicaEnd > 0 && holeCenter < currentDennicaEnd) continue;

        // Znajdź, który segment kręgu zawiera środek otworu
        for (let si = 1; si < segments.length; si++) {
            const seg = segments[si];
            if (seg.type !== 'krag' && seg.type !== 'krag_ot') continue;
            if (holeCenter >= seg.start && holeCenter < seg.end && !usedSegIndices.has(si)) {
                usedSegIndices.add(si);

                let segCount = 0;
                for (let ki = 0; ki < newItems.length; ki++) {
                    const kp = studnieProducts.find((p) => p.id === newItems[ki].productId);
                    if (!kp || (kp.componentType !== 'krag' && kp.componentType !== 'krag_ot'))
                        continue;
                    for (let q = 0; q < newItems[ki].quantity; q++) {
                        segCount++;
                        if (segCount === si) {
                            const otProd = availProducts.find((p) => {
                                const isOt =
                                    p.componentType === 'krag_ot' ||
                                    (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
                                    (p.name && String(p.name).toLowerCase().includes('wiercony')) ||
                                    (p.name && String(p.name).toLowerCase().includes('z otworem'));
                                return (
                                    isOt &&
                                    p.dn === kp.dn &&
                                    p.height === kp.height &&
                                    (p.componentType === 'krag' || p.componentType === 'krag_ot')
                                );
                            });
                            if (otProd) {
                                if (newItems[ki].quantity === 1) {
                                    newItems[ki].productId = otProd.id;
                                } else {
                                    newItems[ki].quantity--;
                                    newItems.splice(ki + 1, 0, {
                                        productId: otProd.id,
                                        quantity: 1
                                    });
                                }
                            } else {
                                const dynamicOtId = kp.id + '_OT';
                                if (!studnieProducts.find((p) => p.id === dynamicOtId)) {
                                    const dynamicProd = structuredClone(kp);
                                    dynamicProd.id = dynamicOtId;
                                    dynamicProd.componentType = 'krag_ot';
                                    if (!dynamicProd.name.includes(' wiercony')) {
                                        dynamicProd.name = dynamicProd.name.replace(
                                            'Krąg',
                                            'Krąg wiercony'
                                        );
                                    }
                                    studnieProducts.push(dynamicProd);
                                }

                                if (newItems[ki].quantity === 1) {
                                    newItems[ki].productId = dynamicOtId;
                                } else {
                                    newItems[ki].quantity--;
                                    newItems.splice(ki + 1, 0, {
                                        productId: dynamicOtId,
                                        quantity: 1
                                    });
                                }
                            }
                            break;
                        }
                    }
                    if (segCount >= si) break;
                }
                break;
            }
        }
    }
    result.items = newItems;
    return result;
}
