// @ts-check
(function (global) {
    function _findPrecoGroup(grupy, dnRury) {
        let bestMatchKey = null;
        let minDiff = Infinity;
        for (const key in grupy) {
            if (!Object.prototype.hasOwnProperty.call(grupy, key)) continue;
            const parts = key.split('-').map(Number);
            if (parts.length === 2) {
                const min = parts[0];
                const max = parts[1];
                if (dnRury >= min && dnRury <= max) {
                    return grupy[key];
                }
                if (min > dnRury && min - dnRury < minDiff) {
                    minDiff = min - dnRury;
                    bestMatchKey = key;
                }
            } else if (parts.length === 1) {
                const val = parts[0];
                if (val === dnRury) return grupy[key];
                if (val > dnRury && val - dnRury < minDiff) {
                    minDiff = val - dnRury;
                    bestMatchKey = key;
                }
            }
        }
        if (bestMatchKey) {
            return grupy[bestMatchKey];
        }
        return 0;
    }

    function _findPrecoRange(table, value, dnRury) {
        if (!table || table.length === 0 || value == null || value === '') return 0;
        const numVal = Math.abs(parseFloat(value));
        if (isNaN(numVal) || numVal === 0) return 0;
        let maxRow = table[0];
        for (let i = 0; i < table.length; i++) {
            const row = table[i];
            if (numVal >= row.min && numVal <= row.max) {
                return _findPrecoGroup(row.grupy, dnRury);
            }
            if (row.max > maxRow.max) {
                maxRow = row;
            }
        }
        if (numVal > maxRow.max) {
            return _findPrecoGroup(maxRow.grupy, dnRury);
        }
        return 0;
    }

    function mergeOverlappingRanges(ranges) {
        if (!ranges || ranges.length === 0) return [];
        const sorted = ranges.slice().sort(function (a, b) {
            return a.bottom - b.bottom;
        });
        const merged = [{ bottom: sorted[0].bottom, top: sorted[0].top }];
        for (let i = 1; i < sorted.length; i++) {
            const current = merged[merged.length - 1];
            const next = sorted[i];
            if (next.bottom < current.top) {
                current.top = Math.max(current.top, next.top);
            } else {
                merged.push({ bottom: next.bottom, top: next.top });
            }
        }
        return merged;
    }

    function ensureDisplayIndices(przejscia) {
        if (!przejscia || przejscia.length === 0) return;
        const sorted = przejscia.slice().sort(function (a, b) {
            return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
        });
        let currentIdx = 0;
        let prevAngle = null;
        for (let i = 0; i < sorted.length; i++) {
            const p = sorted[i];
            const angle = parseFloat(p.angle) || 0;
            if (prevAngle !== null && angle !== prevAngle) {
                currentIdx++;
            }
            p.displayIndex = currentIdx;
            prevAngle = angle;
        }
    }

    function calcPrecoPricingPure(well, helpers) {
        if (!helpers) helpers = {};
        const precoPricing = helpers.precoPricing;
        if (!precoPricing) return emptyResult();
        const studnieProducts = helpers.studnieProducts || [];
        const FLOW_TYPES = helpers.FLOW_TYPES || { WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' };
        const showToast = helpers.showToast;

        function emptyResult() {
            return {
                bazowa: 0,
                dodWloty: [],
                spadekKineta: 0,
                spadekMufa: 0,
                uniesienie: 0,
                redukcja: 0,
                skrzynki: { ilosc: 0, cenaSzt: 0, suma: 0 },
                suma: 0
            };
        }

        const result = emptyResult();

        const dnStudni = parseInt(well.dn);
        if (!dnStudni || !precoPricing[dnStudni]) return result;
        const cennik = precoPricing[dnStudni];

        if (well.wkladkaOsadnikPreco === 'tak') {
            const heightMm = parseFloat(well.wkladkaOsadnikH) || 0;
            const baseCost = cennik.cenaDnoOsadnika || 0;
            const heightCost = (heightMm / 1000) * (cennik.cenaPelnaWysMB || 0);
            result.bazowa = baseCost;
            result.bazowaDN = [well.dn];
            result.bazowaEtykiety = ['Osadnik'];
            if (heightMm > 0) {
                result.pelnaWysokosc = {
                    metry: heightMm / 1000,
                    cena: heightCost,
                    startZ: 0,
                    endZ: heightMm
                };
            }
            result.suma = baseCost + heightCost;
            return result;
        }

        let maxKinetaDn = 0;
        for (let ki = 0; ki < cennik.kinety.length; ki++) {
            if (cennik.kinety[ki].dn > maxKinetaDn) maxKinetaDn = cennik.kinety[ki].dn;
        }

        const allPipes = (well.przejscia || [])
            .map(function (p, index) {
                let prod = null;
                for (let si = 0; si < studnieProducts.length; si++) {
                    if (studnieProducts[si].id === p.productId) {
                        prod = studnieProducts[si];
                        break;
                    }
                }
                return {
                    ...p,
                    _oryginalnyIndex: index,
                    dnRury: parseInt(p.dn) || parseInt(prod && prod.dn) || 0,
                    kat: parseFloat(p.angle) || 0,
                    rzednaWlaczenia:
                        parseFloat(p.rzednaWlaczenia) || parseFloat(well.rzednaDna) || 0
                };
            })
            .filter(function (p) {
                return p.dnRury > 0;
            });

        ensureDisplayIndices(allPipes);

        allPipes.forEach(function (p) {
            let type;
            if (p.flowTypeManual) {
                type = p.flowType || FLOW_TYPES.WLOT;
            } else {
                type = p.kat === 0 || p.kat === 360 ? FLOW_TYPES.WYLOT : FLOW_TYPES.WLOT;
            }
            p._flowLabel = type + ' ' + p.displayIndex;
        });

        for (let pi = 0; pi < allPipes.length; pi++) {
            const p = allPipes[pi];
            if (p.dnRury > maxKinetaDn) {
                result.error =
                    'Brak możliwości wykonania wkładki. Włączenie DN' +
                    p.dnRury +
                    ' przekracza maksymalną przewidzianą średnicę (DN' +
                    maxKinetaDn +
                    ').';
                if (showToast) {
                    showToast(result.error, 'error');
                }
                return result;
            }
        }

        if (allPipes.length === 0) return result;

        // 2. Wybór kinety głównej (dwa największe DN)
        const candidates = allPipes.slice();
        const getZeroScore = function (kat) {
            return Math.min(Math.abs(kat), Math.abs(kat - 360));
        };
        candidates.sort(function (a, b) {
            if (b.dnRury !== a.dnRury) return b.dnRury - a.dnRury;
            return getZeroScore(a.kat) - getZeroScore(b.kat);
        });
        const mainPipes = candidates.splice(0, 2);
        const doloty = candidates;
        const przejscia = mainPipes.concat(
            doloty.sort(function (a, b) {
                return b.dnRury - a.dnRury;
            })
        );

        result.bazowaDN = [mainPipes[0].dnRury];
        result.bazowaEtykiety = [mainPipes[0]._flowLabel];
        result.bazowaIds = [mainPipes[0]._oryginalnyIndex];
        if (mainPipes.length > 1) {
            result.bazowaDN.push(mainPipes[1].dnRury);
            result.bazowaEtykiety.push(mainPipes[1]._flowLabel);
            result.bazowaIds.push(mainPipes[1]._oryginalnyIndex);
        }

        result.kinetaGlowna = {
            dn: result.bazowaDN,
            etykiety: result.bazowaEtykiety,
            ids: result.bazowaIds
        };

        let kinetaRow = null;
        for (let kr = 0; kr < cennik.kinety.length; kr++) {
            if (cennik.kinety[kr].dn >= mainPipes[0].dnRury) {
                kinetaRow = cennik.kinety[kr];
                break;
            }
        }
        if (!kinetaRow) kinetaRow = cennik.kinety[cennik.kinety.length - 1];
        result.bazowa = kinetaRow ? kinetaRow.prosta : 0;

        const rzDnaBase = parseFloat(well.rzednaDna) || 0;
        przejscia.forEach(function (p) {
            const rzWl = p.rzednaWlaczenia || rzDnaBase;
            p._mmFromBottom = (rzWl - rzDnaBase) * 1000;
            p._goraPrzejscia = p._mmFromBottom + p.dnRury;
        });

        const rangesForMerge = przejscia.map(function (p) {
            return { bottom: p._mmFromBottom, top: p._goraPrzejscia };
        });
        const mergedRanges = mergeOverlappingRanges(rangesForMerge);
        const precoInsertTop = mergedRanges[0] ? mergedRanges[0].top : 0;

        // 3. Doloty (trzecie i kolejne przejścia)
        for (let di = 2; di < przejscia.length; di++) {
            const dp = przejscia[di];
            const rzDnaD = parseFloat(well.rzednaDna) || 0;
            const rzWlD = dp.rzednaWlaczenia || rzDnaD;
            const mmFromBottomD = (rzWlD - rzDnaD) * 1000;
            const goraPrzejsciaD = mmFromBottomD + dp.dnRury;

            if (mmFromBottomD >= precoInsertTop) {
                let isKaskada = false;
                for (let ok = 0; ok < przejscia.length; ok++) {
                    const other = przejscia[ok];
                    if (other === dp) continue;
                    if (Math.abs(other.kat - dp.kat) >= 1) continue;
                    const rzWlOther = other.rzednaWlaczenia || rzDnaD;
                    const mmOther = (rzWlOther - rzDnaD) * 1000;
                    const goraOther = mmOther + other.dnRury;
                    if (goraOther < goraPrzejsciaD) {
                        isKaskada = true;
                        break;
                    }
                }
                let dodRow = null;
                for (let dr = 0; dr < cennik.kinety.length; dr++) {
                    if (cennik.kinety[dr].dn >= dp.dnRury) {
                        dodRow = cennik.kinety[dr];
                        break;
                    }
                }
                if (dodRow) {
                    const typ = isKaskada ? 'kaskada' : 'sciana';
                    result.dodWloty.push({
                        _id: dp._oryginalnyIndex,
                        dn: dp.dnRury,
                        cena: dodRow.dodWlot,
                        typ: typ,
                        label: dp._flowLabel
                    });
                }
            } else {
                let dodRow2 = null;
                for (let dr2 = 0; dr2 < cennik.kinety.length; dr2++) {
                    if (cennik.kinety[dr2].dn >= dp.dnRury) {
                        dodRow2 = cennik.kinety[dr2];
                        break;
                    }
                }
                if (dodRow2) {
                    result.dodWloty.push({
                        _id: dp._oryginalnyIndex,
                        dn: dp.dnRury,
                        cena: dodRow2.dodWlot,
                        typ: 'doplyw',
                        label: dp._flowLabel
                    });
                }
            }
        }

        // 5. Skrzynki włazowe (od DN >= 500)
        if (mainPipes[0].dnRury >= 500 && cennik.skrzynkaWlazowa) {
            const ilosc = Math.max(0, Math.floor(mainPipes[0].dnRury / 250) - 1);
            result.skrzynki = {
                ilosc: ilosc,
                cenaSzt: cennik.skrzynkaWlazowa,
                suma: ilosc * cennik.skrzynkaWlazowa
            };
        }

        // 6. Spadek kineta/mufa
        result.spadkiSzczegoly = [];
        przejscia.forEach(function (pp) {
            if (pp.spadekKineta) {
                const kwota = _findPrecoRange(cennik.spadekKineta, pp.spadekKineta, pp.dnRury);
                if (kwota > 0) {
                    result.spadekKineta += kwota;
                    result.spadkiSzczegoly.push({
                        _id: pp._oryginalnyIndex,
                        label: pp._flowLabel,
                        typ: 'kinety',
                        procent: pp.spadekKineta,
                        cena: kwota
                    });
                }
            }
            if (pp.spadekMufa) {
                const kwota2 = _findPrecoRange(cennik.spadekMufa, pp.spadekMufa, pp.dnRury);
                if (kwota2 > 0) {
                    result.spadekMufa += kwota2;
                    result.spadkiSzczegoly.push({
                        _id: pp._oryginalnyIndex,
                        label: pp._flowLabel,
                        typ: 'mufy',
                        procent: pp.spadekMufa,
                        cena: kwota2
                    });
                }
            }
        });

        // 7. Uniesienie kinety
        result.uniesieniaSzczegoly = [];

        if (mainPipes.length > 0) {
            let mainSelected = mainPipes[0];
            if (mainPipes.length > 1) {
                const p0 = mainPipes[0];
                const p1 = mainPipes[1];
                if (p1.dnRury < p0.dnRury && p1._goraPrzejscia <= p0._goraPrzejscia) {
                    mainSelected = p0;
                } else {
                    const dist0 = precoInsertTop - p0._mmFromBottom;
                    const dist1 = precoInsertTop - p1._mmFromBottom;
                    mainSelected = dist0 >= dist1 ? p0 : p1;
                }
            }
            const uniesienieMm = precoInsertTop - mainSelected._goraPrzejscia;
            if (uniesienieMm > 0) {
                const kwotaU = _findPrecoRange(
                    cennik.uniesienie,
                    uniesienieMm,
                    mainPipes[0].dnRury
                );
                if (kwotaU > 0) {
                    result.uniesienie += kwotaU;
                    result.uniesieniaSzczegoly.push({
                        _id: mainSelected._oryginalnyIndex,
                        label: mainSelected._flowLabel,
                        mm: Math.round(uniesienieMm),
                        cena: kwotaU,
                        opis: 'kineta główna'
                    });
                }
            }
        }

        for (let ui = 2; ui < przejscia.length; ui++) {
            const up = przejscia[ui];
            if (up._mmFromBottom >= precoInsertTop) continue;
            const uniesienieMm2 = precoInsertTop - up._goraPrzejscia;
            if (uniesienieMm2 > 0) {
                const kwotaU2 = _findPrecoRange(cennik.uniesienie, uniesienieMm2, up.dnRury);
                if (kwotaU2 > 0) {
                    result.uniesienie += kwotaU2;
                    result.uniesieniaSzczegoly.push({
                        _id: up._oryginalnyIndex,
                        label: up._flowLabel,
                        mm: Math.round(uniesienieMm2),
                        cena: kwotaU2,
                        opis: 'dolot'
                    });
                }
            }
        }

        // 8. Redukcja kinety
        if (
            well.redukcjaKinety !== 'nie' &&
            mainPipes.length > 1 &&
            mainPipes[0].dnRury !== mainPipes[1].dnRury &&
            cennik.redukcja
        ) {
            const roznicaSrednic = Math.abs(mainPipes[0].dnRury - mainPipes[1].dnRury);
            result.redukcja = _findPrecoRange(
                cennik.redukcja,
                roznicaSrednic,
                Math.max(mainPipes[0].dnRury, mainPipes[1].dnRury)
            );
            result.redukcjaOpis = 'z DN' + mainPipes[0].dnRury + ' na DN' + mainPipes[1].dnRury;
        }

        // 9. Wkładka do pełnej wysokości dennicy
        result.pelnaWysokosc = null;
        if (
            (well.precoFullHeight === 'tak' || well.precoFullHeight === true) &&
            cennik.cenaPelnaWysMB
        ) {
            let dennicaHeight = 0;
            if (well.config) {
                for (let ci = 0; ci < well.config.length; ci++) {
                    const item = well.config[ci];
                    if (item.disablePreco) continue;
                    let prod2 = null;
                    for (let si2 = 0; si2 < studnieProducts.length; si2++) {
                        if (studnieProducts[si2].id === item.productId) {
                            prod2 = studnieProducts[si2];
                            break;
                        }
                    }
                    if (
                        prod2 &&
                        (prod2.componentType === 'dennica' || prod2.componentType === 'styczna')
                    ) {
                        dennicaHeight += (prod2.height || 0) * (item.quantity || 1);
                    }
                }
            }
            const pozostaloMm = dennicaHeight - precoInsertTop;
            if (pozostaloMm > 0) {
                const metry = pozostaloMm / 1000;
                result.pelnaWysokosc = {
                    metry: metry,
                    cena: metry * cennik.cenaPelnaWysMB,
                    startZ: precoInsertTop,
                    endZ: dennicaHeight
                };
            }
        }

        // Suma
        result.suma =
            result.bazowa +
            result.dodWloty.reduce(function (s, d) {
                return s + d.cena;
            }, 0) +
            result.skrzynki.suma +
            result.spadekKineta +
            result.spadekMufa +
            result.uniesienie +
            result.redukcja +
            (result.pelnaWysokosc ? result.pelnaWysokosc.cena : 0);

        return result;
    }

    global.calcPrecoPricingPure = calcPrecoPricingPure;
})(typeof window !== 'undefined' ? window : global);
