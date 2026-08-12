// @ts-check
/* ===== ZAPIS OFERTY (STUDNIE) ===== */

async function saveOfferStudnie() {
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof showToast === 'function') {
            showToast('Zapisywanie oferty jest zablokowane w trybie edycji zamówienia.', 'error');
        }
        return false;
    }

    if (isSavingOffer) return false;

    const fields = getOfferFormFields();
    if (!fields.number) {
        showToast('Wprowadź numer oferty', 'error');
        return false;
    }

    fields.validity = normalizeValidityValue(fields.validity);

    // --- KONIEC TELEMETRII ---

    isSavingOffer = true;
    try {
        const assignedUserRes = await assignOfferSupervisor(
            currentUser,
            !editingOfferIdStudnie,
            editingOfferIdStudnie
        );
        if (assignedUserRes === undefined) {
            showToast('Anulowano zapis oferty - brak wybranego opiekuna', 'info');
            isSavingOffer = false;
            return false;
        }
        if (assignedUserRes) {
            editingOfferAssignedUserId = assignedUserRes.id;
            editingOfferAssignedUserName = assignedUserRes.displayName || assignedUserRes.username;
            const btnChangeUser = document.getElementById('btn-change-offer-user');
            if (btnChangeUser)
                btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${escapeHtml(editingOfferAssignedUserName)}`;
        }

        const { storageService } = await import('../shared/StorageService.js');

        let existingDoc = null;
        if (editingOfferIdStudnie) {
            try {
                existingDoc = await storageService.getOfferById(editingOfferIdStudnie);
            } catch (e) {
                logger.warn(
                    'offerManager',
                    '[OfferManager] Nie udało się pobrać istniejącej oferty studni do edycji:',
                    e
                );
            }
        }

        const simpleId = editingOfferIdStudnie || 'offer_studnie_' + Date.now();
        const pricing = calculateOfferPricing(
            wells,
            fields.transportKm,
            fields.transportRate,
            currentTransportMode
        );

        const base = buildBaseOfferDoc({
            id: simpleId,
            type: 'studnia_oferta',
            fields: fields,
            existingDoc: existingDoc,
            currentUser: currentUser,
            assignedUserId: editingOfferAssignedUserId,
            assignedUserName: editingOfferAssignedUserName,
            createdByUserId: editingOfferCreatedByUserId,
            createdByUserName: editingOfferCreatedByUserName
        });

        const offerDoc = Object.assign({}, base, {
            wells: structuredClone(wells),
            wellsExport: pricing.wellsForExport,
            visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
            transportMode: currentTransportMode,
            wellDiscounts:
                typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts || {}) : {},
            totalWeight: pricing.totalWeight,
            totalNetto: pricing.totalNetto + pricing.totalTransportCostForOffer,
            totalBrutto: (pricing.totalNetto + pricing.totalTransportCostForOffer) * 1.23,
            wizard: {
                globalParams: getWizardGlobalParams(),
                currentStep: typeof currentWizardStep !== 'undefined' ? currentWizardStep : 3,
                version: 1
            }
        });

        if (!offerDoc.wells || offerDoc.wells.length === 0) {
            showToast('Błąd: Nie można zapisać pustej oferty.', 'error');
            return false;
        }
        const result = await storageService.saveOffer(offerDoc);
        showToast('Oferta zapisana <i data-lucide="check"></i>', 'success');
        const savedId = result.id || offerDoc.id;
        editingOfferIdStudnie = savedId;

        // Aktualizuj lokalną tablicę dla natychmiastowego renderowania przy użyciu potwierdzonego ID
        const idx = offersStudnie.findIndex((o) => o.id === editingOfferIdStudnie);
        const updatedOffer = { ...offerDoc, id: editingOfferIdStudnie };

        if (idx >= 0) offersStudnie[idx] = updatedOffer;
        else offersStudnie.push(updatedOffer);

        renderSavedOffersStudnie();

        // Pasywne uczenie — cichy POST (fire-and-forget, bez blokowania UI).
        // Przy edycji istniejącej oferty wysyłamy tylko studnie zmienione od
        // ostatniego zapisu — duplikaty identycznych studni zakłamują wzorce
        // (hitCount/confidence) i zbiór treningowy ML.
        const telemetryWells = editingOfferIdStudnie
            ? _filterChangedWells(wells, existingDoc)
            : wells;
        _sendAcceptanceTelemetry(telemetryWells, 'OFFER_SAVE');

        // Auto-acceptance — rejestruj akceptację w ML pipeline.
        // Studnia ręcznie zmodyfikowana (configSource MANUAL*) dostaje NEGATYW
        // wcześniej (reward MODIFY na sugestii AUTO + wzorce substitution/addition/
        // removal w LearningEngine), a pozytyw dopiero przy ORDER_CONFIRM (wasAccepted).
        // Nie wysyłamy dla niej acceptance-full z accepted:false — recordAcceptance
        // oznaczałby NAJNOWSZY rekord studni (świeży manualny config) jako REJECTED,
        // czyli finalny wybór użytkownika zyskiwał −1.0 zamiast NO_FEEDBACK.
        wells.forEach(function (w) {
            if (!w.config || w.config.length === 0) return;
            const accepted = !(w.configSource && w.configSource.indexOf('MANUAL') === 0);
            if (
                accepted &&
                typeof window.mlRewardHooks !== 'undefined' &&
                window.mlRewardHooks.onWellAccepted
            ) {
                window.mlRewardHooks.onWellAccepted({
                    eventType: 'OFFER_SAVED',
                    wasAiRanked: w.configSource === 'AUTO_AI',
                    well: w
                });
            }
            // Wyślij acceptance-full do backendu tylko dla studni zaakceptowanych
            // (AUTO/AI bez modyfikacji). Dla MANUAL pomijamy — patrz komentarz wyżej.
            if (accepted && typeof window.telemetryRecordAcceptanceFull === 'function') {
                try {
                    window.telemetryRecordAcceptanceFull({
                        telemetryId: w.id || 'well_' + Date.now(),
                        accepted: true,
                        offerId: editingOfferIdStudnie,
                        wellId: w.id,
                        warehouse: w.magazyn,
                        configSnapshot: {
                            dn: w.dn,
                            ringCount: (w.config || []).length,
                            warehouse: w.magazyn
                        }
                    });
                } catch (_e) {}
            }
        });

        return true;
    } catch (err) {
        logger.error('offerManager', '[OfferManager] Save error:', err);
        showToast('Błąd zapisu oferty', 'error');
        return false;
    } finally {
        isSavingOffer = false;
    }
}

/**
 * Pasywne uczenie — wysyła konfiguracje studni do Express (/api/telemetry/ai/config).
 * Fire-and-forget: nie blokuje UI, nie wymaga interakcji użytkownika.
 * @param {Array} wellsArr - tablica studni
 * @param {string} signalType - 'OFFER_SAVE' lub 'ORDER_CONFIRM'
 */
function _sendAcceptanceTelemetry(wellsArr, signalType) {
    if (!Array.isArray(wellsArr) || wellsArr.length === 0) return;
    if (typeof window.telemetryRecordConfig !== 'function') return;
    wellsArr.forEach(function (w) {
        if (!w.config || w.config.length === 0) return;
        try {
            window.telemetryRecordConfig({
                well: w,
                configItems: w.config || [],
                solverSource: w.configSource || 'MANUAL',
                wasAccepted: signalType === 'ORDER_CONFIRM',
                wasModified: w.configSource && w.configSource.startsWith('MANUAL'),
                originalConfig:
                    typeof window.buildOriginalConfigFromWell === 'function'
                        ? window.buildOriginalConfigFromWell(w)
                        : undefined,
                computationMs: 0,
                iterationCount: 0,
                checkedVariants: 0
            });
        } catch (_e) {
            // silent
        }
    });
}

/**
 * Zwraca studnie, które różnią się od stanu z ostatniego zapisu oferty.
 * Porównanie oparte o stabilny JSON snapshota konfiguracji — studnie
 * nietknięte od poprzedniego zapisu są pomijane (brak duplikatów telemetrii).
 * @param {Array} wellsArr - aktualna tablica studni
 * @param {Object|null} existingDoc - wcześniej zapisany dokument oferty
 * @returns {Array} studnie z faktyczną różnicą
 */
function _filterChangedWells(wellsArr, existingDoc) {
    if (!existingDoc || !Array.isArray(existingDoc.wells)) return wellsArr;
    var prevMap = new Map(
        existingDoc.wells.map(function (w) {
            return [w.id, JSON.stringify(_wellSnapshot(w))];
        })
    );
    return wellsArr.filter(function (w) {
        var prev = prevMap.get(w.id);
        if (prev === undefined) return true; // nowa studnia
        return prev !== JSON.stringify(_wellSnapshot(w));
    });
}

/**
 * Statystyki wyceny studni (cena + waga) — używane do wykrywania zmian
 * cenowych w telemetrii (totalPrice jest cechą treningową ML).
 * @param {Object} well
 * @returns {{price: number|null, weight: number|null}}
 */
function _wellPricingStats(well) {
    try {
        if (typeof window.calcWellStats === 'function') {
            const stats = window.calcWellStats(well);
            if (stats && typeof stats.price === 'number' && typeof stats.weight === 'number') {
                return {
                    price: Math.round(stats.price * 100) / 100,
                    weight: Math.round(stats.weight * 100) / 100
                };
            }
        }
    } catch (_e) {
        // silent — brak wyceny nie może zablokować zapisu oferty
    }
    return { price: null, weight: null };
}

/**
 * Stabilny snapshot istotnych pól studni do porównania zmian.
 * @param {Object} well
 * @returns {Object}
 */
function _wellSnapshot(well) {
    const pricing = _wellPricingStats(well);
    return {
        dn: well.dn,
        rzednaDna: well.rzednaDna,
        rzednaWlazu: well.rzednaWlazu,
        magazyn: well.magazyn,
        psiaBuda: !!well.psiaBuda,
        stycznaNadbudowa1200: !!well.stycznaNadbudowa1200,
        zakonczenie: well.zakonczenie,
        redukcjaDN1000: !!well.redukcjaDN1000,
        redukcjaTargetDN: well.redukcjaTargetDN,
        wkladkaZwienczenie: well.wkladkaZwienczenie,
        przejscia: well.przejscia || [],
        config: well.config || [],
        configSource: well.configSource || null,
        totalPrice: pricing.price,
        totalWeight: pricing.weight
    };
}

/* ===== Rejestracja globali ===== */
window.saveOfferStudnie = saveOfferStudnie;
