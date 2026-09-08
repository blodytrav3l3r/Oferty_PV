// @ts-check
/* ===== SYNCHRONIZACJA KONFIGURACJI I WALIDACJA ===== */

/** Zamknięty zbiór typów uszczelek. 'smar' nie istnieje — legacy śmieci w danych
 * traktowane jak 'brak' (zero uszczelek), nigdy cichy default GSG. */
const GASKET_TYPES = ['GSG', 'SDV', 'SDV PO', 'NBR'];

/**
 * Kanoniczna nazwa produktu uszczelki dla typu i DN — jedno źródło prawdy
 * (ta sama mapa co lokalny gasketNameForDn w mlDualRanking.js).
 */
function gasketNameForType(uType, dn) {
    if (uType === 'SDV') return `Uszczelka SDV DN${dn}`;
    if (uType === 'SDV PO') return `Uszczelka SDV DN${dn} SDV z pierścieniem odciążającym`;
    if (uType === 'NBR') return `Uszczelka GSG DN${dn} z NBR`;
    return `Uszczelka GSG DN${dn}`;
}

function lookupGasketProduct(productId) {
    return typeof getStudnieProductById === 'function'
        ? getStudnieProductById(productId)
        : studnieProducts.find((pr) => pr.id === productId);
}

function recalcGaskets(well) {
    if (!well) well = getCurrentWell();
    if (!well) return;

    const existingGasketPrices = new Map();
    const existingByDn = new Map();
    well.config.forEach((item) => {
        const p = lookupGasketProduct(item.productId);
        if (!p || p.componentType !== 'uszczelka') return;
        if (item.frozenPrice != null && !existingGasketPrices.has(item.productId)) {
            existingGasketPrices.set(item.productId, {
                frozenPrice: item.frozenPrice,
                frozenPriceBase: item.frozenPriceBase
            });
        }
        if (p.dn && !existingByDn.has(p.dn)) existingByDn.set(p.dn, item);
    });

    const newConfig = well.config.filter((item) => {
        const p = lookupGasketProduct(item.productId);
        return !(p && p.componentType === 'uszczelka');
    });

    if (well.uszczelka && GASKET_TYPES.includes(well.uszczelka)) {
        const uType = well.uszczelka;
        const requiredGaskets = {};

        let bottomDennicaIndex = -1;
        for (let i = newConfig.length - 1; i >= 0; i--) {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(newConfig[i].productId)
                    : studnieProducts.find((pr) => pr.id === newConfig[i].productId);
            if (p && p.componentType === 'dennica') {
                bottomDennicaIndex = i;
                break;
            }
        }

        newConfig.forEach((item, index) => {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            if (
                p &&
                ['krag', 'krag_ot', 'plyta_din', 'plyta_redukcyjna', 'konus'].includes(
                    p.componentType
                )
            ) {
                if (p.dn) {
                    requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                }
            } else if (p && p.componentType === 'dennica') {
                if (p.dn) {
                    if (index === bottomDennicaIndex) {
                        if (item.quantity > 1) {
                            requiredGaskets[p.dn] =
                                (requiredGaskets[p.dn] || 0) + (item.quantity - 1);
                        }
                    } else {
                        requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                    }
                }
            }
        });

        for (const dn in requiredGaskets) {
            const qty = requiredGaskets[dn];
            const gasketName = gasketNameForType(uType, dn);
            const kept = existingByDn.get(dn);
            const keptProd = kept ? lookupGasketProduct(kept.productId) : null;

            if (kept && keptProd && keptProd.name === gasketName) {
                // Ten sam typ: zachowaj pozycję w całości, tylko ilość.
                // Zmiana uszczelki ma ruszać wyłącznie uszczelki — reszta
                // configu (i frozenPrice kręgów) jest poza tą funkcją.
                newConfig.push({ ...kept, quantity: qty });
                continue;
            }

            const gasketProd = studnieProducts.find(
                (p) => p.componentType === 'uszczelka' && p.name === gasketName
            );
            if (gasketProd) {
                const newItem = {
                    productId: gasketProd.id,
                    quantity: qty,
                    autoAdded: true
                };
                const savedPrices = existingGasketPrices.get(gasketProd.id);
                if (savedPrices) {
                    newItem.frozenPrice = savedPrices.frozenPrice;
                    if (savedPrices.frozenPriceBase != null) {
                        newItem.frozenPriceBase = savedPrices.frozenPriceBase;
                    }
                }
                newConfig.push(newItem);
            } else if (kept && keptProd) {
                // Katalog nie zna oczekiwanej nazwy (rename produktu) —
                // zachowaj istniejącą pozycję po productId zamiast gubić uszczelkę.
                newConfig.push({ ...kept, quantity: qty });
            }
        }
    }

    well.config = newConfig;
}

function syncKineta(well) {
    if (!well || !well.config) return;

    // Psia buda → dennica zawsze bez dna: kineta/spocznik/spocznikH wymuszone na brak
    if (well.psiaBuda) {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    }

    if (well.kineta && well.kineta !== 'brak') {
        if (!well.spocznik || well.spocznik === 'brak') {
            well.spocznik = 'beton';
            if (typeof showToast === 'function')
                showToast('Domyślny spocznik (Beton) został wybrany automatycznie.', 'info');
        }
    } else {
        if (well.spocznik && well.spocznik !== 'brak') {
            well.spocznik = 'brak';
            well.spocznikH = 'brak';
            if (typeof showToast === 'function')
                showToast('Spocznik wyczyszczony. Wybierz najpierw Kinetę.', 'warning');
        }
    }

    if (well.wkladkaOsadnikPreco === 'tak') {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
        well.config = well.config.filter((item) => {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            return !(p && p.componentType === 'kineta');
        });

        if (!well.wkladkaOsadnikH) {
            let dennicaHeight = 0;
            if (well.config) {
                well.config.forEach((item) => {
                    const p =
                        typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(item.productId)
                            : studnieProducts.find((pr) => pr.id === item.productId);
                    if (p && (p.componentType === 'dennica' || p.componentType === 'styczna')) {
                        dennicaHeight += (p.height || 0) * (item.quantity || 1);
                    }
                });
            }
            well.wkladkaOsadnikH = dennicaHeight || 1000;
        }

        if (well.config) {
            well.config.forEach((item) => {
                delete item._osadnikCost;
            });
        }
        return;
    }

    if (well.config) {
        well.config.forEach((item) => {
            delete item._osadnikCost;
        });
    }

    if (well.kineta === 'preco' || well.kineta === 'precotop' || well.kineta === 'unolith') {
        well.spocznikH = '1/1';
    }

    const newConfig = well.config.filter((item) => {
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'kineta');
    });

    const hasDennica = (well.config || []).some((item) => {
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'dennica';
    });

    if (hasDennica && well.spocznikH && well.spocznikH !== 'brak') {
        const SPOCZNIK_MAP = { 12: '1/2', 23: '2/3', 34: '3/4', 11: '1/1' };
        const kinetaProd = studnieProducts.find(
            (p) =>
                p.componentType === 'kineta' &&
                parseInt(p.dn) === parseInt(well.dn) &&
                (SPOCZNIK_MAP[p.id.split('-').pop()] || '') === well.spocznikH
        );
        if (kinetaProd) {
            newConfig.push({
                productId: kinetaProd.id,
                quantity: 1,
                autoAdded: true
            });
        }
    }

    well.config = newConfig;
}

function enforceGlobalKonusPehdRule() {
    if (typeof wells === 'undefined' || !wells || wells.length === 0) return false;

    if (window.konusResolverOpen) return false;

    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak') {
            let hasKonus = false;

            if (w.config && w.config.length > 0) {
                const found = w.config.some((c) => {
                    const p =
                        typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(c.productId)
                            : studnieProducts.find((pr) => pr.id === c.productId);
                    return p && p.componentType === 'konus';
                });
                if (found) hasKonus = true;
            }

            if (w.zakonczenie) {
                const p =
                    typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(w.zakonczenie)
                        : studnieProducts.find((pr) => pr.id === w.zakonczenie);
                if (p && p.componentType === 'konus') {
                    hasKonus = true;
                }
            }
            if (w.redukcjaZakonczenie) {
                const p =
                    typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(w.redukcjaZakonczenie)
                        : studnieProducts.find((pr) => pr.id === w.redukcjaZakonczenie);
                if (p && p.componentType === 'konus') {
                    hasKonus = true;
                }
            }

            if (hasKonus) {
                if (typeof window.showKonusPehdResolverModal === 'function') {
                    showToast(
                        'Wykryto niedozwoloną konfigurację (Konus + PEHD) w studni #' +
                            (i + 1) +
                            '. Wymagana zmiana.',
                        'error'
                    );
                    window.showKonusPehdResolverModal(i);
                    return true;
                }
            }
        }
    }
    return false;
}

function enforceLoadClassRules(well, changedParam) {
    if (!well) return;
    if (changedParam === 'klasaNosnosci_korpus') {
        const korpus = well.klasaNosnosci_korpus;
        if (korpus === 'E600' || korpus === 'F900') {
            let changed = false;
            if (well.dennicaMaterial !== 'zelbetowa') {
                well.dennicaMaterial = 'zelbetowa';
                changed = true;
            }
            if (well.nadbudowa !== 'zelbetowa') {
                well.nadbudowa = 'zelbetowa';
                changed = true;
            }
            if (changed) {
                showToast(`Klasa ${korpus}: Dennica i Nadbudowa ustawione na Żelbet`, 'info');
            }
        }
    }
    if (changedParam === 'dennicaMaterial' || changedParam === 'nadbudowa') {
        const korpus = well.klasaNosnosci_korpus;
        if ((korpus === 'E600' || korpus === 'F900') && well[changedParam] !== 'zelbetowa') {
            well[changedParam] = 'zelbetowa';
            const name = changedParam === 'dennicaMaterial' ? 'Dennica' : 'Nadbudowa';
            showToast(`Klasa ${korpus}: ${name} musi być Żelbet!`, 'error');
        }
    }
}

function enforceLoadClassRulesWizard(changedParam, value) {
    if (changedParam === 'klasaNosnosci_korpus') {
        if (value === 'E600' || value === 'F900') {
            let changed = false;
            const setZelbet = (param) => {
                const group = document.querySelector(`.param-group[data-param="${param}"]`);
                if (group) {
                    const zelbetBtn = group.querySelector('[data-val="zelbetowa"]');
                    if (zelbetBtn && !zelbetBtn.classList.contains('active')) {
                        group
                            .querySelectorAll('.param-tile')
                            .forEach((b) => b.classList.remove('active'));
                        zelbetBtn.classList.add('active');
                        wizardConfirmedParams.add(param);
                        changed = true;
                    }
                }
            };
            setZelbet('dennicaMaterial');
            setZelbet('nadbudowa');
            if (changed) {
                showToast(
                    `Klasa ${value}: Dennica i Nadbudowa ustawione na Żelbet (wymagane)`,
                    'info'
                );
            }
        }
    }
    if (
        (changedParam === 'dennicaMaterial' || changedParam === 'nadbudowa') &&
        value !== 'zelbetowa'
    ) {
        const korpusVal = getActiveTileValue('klasaNosnosci_korpus');
        if (korpusVal === 'E600' || korpusVal === 'F900') {
            const group = document.querySelector(`.param-group[data-param="${changedParam}"]`);
            if (group) {
                group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
                const zelbetBtn = group.querySelector('[data-val="zelbetowa"]');
                if (zelbetBtn) zelbetBtn.classList.add('active');
                const name = changedParam === 'dennicaMaterial' ? 'Dennica' : 'Nadbudowa';
                showToast(`Klasa ${korpusVal}: ${name} musi być Żelbet!`, 'error');
            }
        }
    }
}

/* ===== Rejestracja globali ===== */
window.recalcGaskets = recalcGaskets;
window.GASKET_TYPES = GASKET_TYPES;
window.gasketNameForType = gasketNameForType;
window.syncKineta = syncKineta;
window.enforceGlobalKonusPehdRule = enforceGlobalKonusPehdRule;
window.enforceLoadClassRules = enforceLoadClassRules;
window.enforceLoadClassRulesWizard = enforceLoadClassRulesWizard;
