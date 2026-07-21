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

    const offerDoc = {
        id: simpleId,
        type: 'studnia_oferta',
        userId:
            editingOfferAssignedUserId ||
            existingDoc?.userId ||
            (currentUser ? currentUser.id : null),
        userName:
            editingOfferAssignedUserName ||
            existingDoc?.userName ||
            buildUserDisplayName(currentUser),
        createdByUserId:
            editingOfferCreatedByUserId ||
            existingDoc?.createdByUserId ||
            (currentUser ? currentUser.id : null),
        createdByUserName:
            editingOfferCreatedByUserName ||
            existingDoc?.createdByUserName ||
            buildUserDisplayName(currentUser),
        number: fields.number,
        date: fields.date,
        clientName: fields.clientName,
        clientNip: fields.clientNip,
        clientAddress: fields.clientAddress,
        clientContact: fields.clientContact,
        investName: fields.investName,
        investAddress: fields.investAddress,
        investContractor: fields.investContractor,
        notes: fields.notes,
        paymentTerms: fields.paymentTerms,
        validity: fields.validity,
        wells: structuredClone(wells),
        wellsExport: pricing.wellsForExport,
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        transportKm: fields.transportKm,
        transportRate: fields.transportRate,
        transportMode: currentTransportMode,
        wellDiscounts:
            typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts || {}) : {},
        totalWeight: pricing.totalWeight,
        totalNetto: pricing.totalNetto + pricing.totalTransportCostForOffer,
        totalBrutto: (pricing.totalNetto + pricing.totalTransportCostForOffer) * 1.23,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: buildUserDisplayName(currentUser),
        wizard: {
            globalParams: getWizardGlobalParams(),
            currentStep: typeof currentWizardStep !== 'undefined' ? currentWizardStep : 3,
            version: 1
        }
    };

    try {
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

        // Pasywne uczenie — cichy POST (fire-and-forget, bez blokowania UI)
        _sendAcceptanceTelemetry(wells, 'OFFER_SAVE');

        // Auto-acceptance — rejestruj akceptację w ML pipeline
        if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellAccepted) {
            wells.forEach(function (w) {
                if (w.config && w.config.length > 0) {
                    window.mlRewardHooks.onWellAccepted({ eventType: 'OFFER_SAVED' });
                    // Wyślij acceptance-full do backendu
                    try {
                        fetch('/api/telemetry/ai/acceptance-full', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                telemetryId: w.id || 'well_' + Date.now(),
                                accepted: true,
                                wellId: w.id,
                                warehouse: w.magazyn,
                                configSnapshot: {
                                    dn: w.dn,
                                    ringCount: (w.config || []).length,
                                    warehouse: w.magazyn
                                }
                            })
                        }).catch(function () {});
                    } catch (e) {}
                }
            });
        }

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
                computationMs: 0,
                iterationCount: 0,
                checkedVariants: 0
            });
        } catch (e) {
            // silent
        }
    });
}
