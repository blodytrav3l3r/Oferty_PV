/* ===== OFERTY STUDNIE — ZAPIS OFERTY ===== */

async function saveOfferStudnie() {
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof showToast === 'function') {
            showToast('Zapisywanie oferty jest zablokowane w trybie edycji zamówienia.', 'error');
        }
        return false;
    }

    if (isSavingOffer) return false;

    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    const number = getVal('offer-number').trim();
    if (!number) {
        showToast('Wprowadź numer oferty', 'error');
        return false;
    }

    const date = getVal('offer-date');
    const clientName = getVal('client-name').trim();
    const clientNip = getVal('client-nip').trim();
    const clientAddress = getVal('client-address').trim();
    const clientContact = getVal('client-contact').trim();
    const investName = getVal('invest-name').trim();
    const investAddress = getVal('invest-address').trim();
    const investContractor = getVal('invest-contractor').trim();
    const notes =
        document.getElementById('offer-tab-notes')?.value.trim() ||
        document.getElementById('offer-notes')?.value.trim() ||
        '';
    const paymentTerms =
        document.getElementById('offer-tab-payment-terms')?.value.trim() ||
        document.getElementById('offer-payment-terms')?.value.trim() ||
        'Do uzgodnienia lub według indywidualnych warunków handlowych.';
    const validity = normalizeValidityValue(
        document.getElementById('offer-tab-validity')?.value.trim() ||
            document.getElementById('offer-validity')?.value.trim() ||
            '7 dni'
    );
    const transportKm = parseFloat(getVal('transport-km')) || 0;
    const transportRate = parseFloat(getVal('transport-rate')) || 0;

    let totalNetto = 0;
    let totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    isSavingOffer = true;

    if (
        !editingOfferIdStudnie &&
        currentUser &&
        (currentUser.role === 'admin' || currentUser.role === 'pro') &&
        !editingOfferAssignedUserId
    ) {
        try {
            const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
            const usersData = await usersResp.json();
            const allUsers = usersData.data || [];

            if (allUsers.length > 0) {
                const currentId = currentUser.id;
                const selectedUser = await showUserSelectionPopup(allUsers, currentId);
                if (selectedUser === null) {
                    showToast('Anulowano zapis oferty - brak wybranego opiekuna', 'info');
                    isSavingOffer = false;
                    return false;
                }
                editingOfferAssignedUserId = selectedUser.id;
                editingOfferAssignedUserName = selectedUser.displayName || selectedUser.username;

                const btnChangeUser = document.getElementById('btn-change-offer-user');
                if (btnChangeUser)
                    btnChangeUser.innerHTML = `<i data-lucide="user"></i> Opiekun: ${escapeHtml(editingOfferAssignedUserName)}`;
            }
        } catch (e) {
            logger.error('offerManager', 'Błąd wyboru opiekuna:', e);
        }
    }

    const { storageService } = await import('../../shared/StorageService.js');

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

    let globalWeightForTransport = 0;
    wells.forEach((w) => (globalWeightForTransport += calcWellStats(w).weight));
    const transportKmVal = parseFloat(document.getElementById('transport-km').value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate').value) || 0;
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0) {
        const totalTransportsCount =
            typeof calcTransportCount === 'function'
                ? calcTransportCount(globalWeightForTransport, currentTransportMode)
                : Math.ceil(globalWeightForTransport / MAX_TRANSPORT_WEIGHT);
        const costPerTrip = transportKmVal * transportRateVal;
        totalTransportCostForOffer = totalTransportsCount * costPerTrip;
    }

    const productMap = new Map(studnieProducts.map((p) => [p.id, p]));
    const wellsForExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            globalWeightForTransport > 0
                ? totalTransportCostForOffer * (stats.weight / globalWeightForTransport)
                : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn || '';
        const activeDiscounts =
            typeof getWellActiveDiscounts === 'function'
                ? getWellActiveDiscounts(well)
                : typeof wellDiscounts !== 'undefined'
                  ? wellDiscounts
                  : {};
        const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0, preco: 0 };
        const nadbudowaMult = 1 - (disc.nadbudowa || 0) / 100;
        const precoMult = 1 - (disc.preco || 0) / 100;
        const assignedPrzejscia =
            typeof calculateAssignedPrzejscia === 'function'
                ? calculateAssignedPrzejscia(well)
                : {};
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            rzednaWlazu: well.rzednaWlazu,
            rzednaDna: well.rzednaDna,
            magazyn: well.magazyn,
            config: (well.config || []).map((item, index) => {
                const p = productMap.get(item.productId);
                if (!p) return { ...item };
                if (p.componentType === 'kineta') {
                    return { ...item, _xskip: true, _xp: 0 };
                }
                const isDennica = ['dennica', 'styczna'].includes(p.componentType);
                const hasKineta =
                    p.componentType === 'dennica' &&
                    well.config.some((c) => {
                        const kp = productMap.get(c.productId);
                        return kp && kp.componentType === 'kineta';
                    });
                const myPrzejscia = assignedPrzejscia[index] || [];
                let hasSurcharge = hasKineta || myPrzejscia.length > 0;
                if (!hasSurcharge && typeof getItemPriceBreakdown === 'function') {
                    const bd = getItemPriceBreakdown(well, p, false, item);
                    hasSurcharge =
                        bd.pehd > 0 ||
                        bd.malowanieW > 0 ||
                        bd.malowanieZ > 0 ||
                        bd.zelbet > 0 ||
                        bd.nierdzewna > 0;
                }
                if (!hasSurcharge && typeof calculatePrecoAllocationForItem === 'function') {
                    const pa = calculatePrecoAllocationForItem(well, index);
                    if (pa.hasPreco && pa.allocatedCost > 0) hasSurcharge = true;
                }
                if (hasSurcharge) {
                    let basePrice =
                        typeof getItemAssessedPrice === 'function'
                            ? getItemAssessedPrice(well, p, true, item)
                            : p.price || 0;
                    if (p.componentType === 'dennica') {
                        const ki = well.config.find((c) => {
                            const kp = productMap.get(c.productId);
                            return kp && kp.componentType === 'kineta';
                        });
                        if (ki) {
                            const kp = productMap.get(ki.productId);
                            const kPrice =
                                typeof getItemAssessedPrice === 'function'
                                    ? getItemAssessedPrice(well, kp, true, ki)
                                    : 0;
                            basePrice += kPrice;
                        }
                    }
                    for (const prz of myPrzejscia) {
                        const pp = productMap.get(prz.productId);
                        if (!pp) continue;
                        basePrice +=
                            (pp.price || 0) * nadbudowaMult +
                            (prz._drillingBasePrice || 0) * nadbudowaMult +
                            (parseFloat(prz.doplata) || 0);
                    }
                    if (typeof calculatePrecoAllocationForItem === 'function') {
                        const pa = calculatePrecoAllocationForItem(well, index);
                        if (pa.hasPreco && pa.allocatedCost > 0) {
                            basePrice += pa.allocatedCost * precoMult;
                        }
                    }
                    return { ...item, _xp: basePrice };
                }
                const discountPct = isDennica ? disc.dennica || 0 : disc.nadbudowa || 0;
                return { ...item, _xp: p.price || 0, _xd: discountPct };
            }),
            przejscia: well.przejscia
        };
    });

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
            (currentUser
                ? currentUser.firstName && currentUser.lastName
                    ? `${currentUser.firstName} ${currentUser.lastName}`
                    : currentUser.username
                : ''),
        createdByUserId:
            editingOfferCreatedByUserId ||
            existingDoc?.createdByUserId ||
            (currentUser ? currentUser.id : null),
        createdByUserName:
            editingOfferCreatedByUserName ||
            existingDoc?.createdByUserName ||
            (currentUser
                ? currentUser.firstName && currentUser.lastName
                    ? `${currentUser.firstName} ${currentUser.lastName}`
                    : currentUser.username
                : ''),
        number,
        date,
        clientName,
        clientNip,
        clientAddress,
        clientContact,
        investName,
        investAddress,
        investContractor,
        notes,
        paymentTerms,
        validity,
        wells: structuredClone(wells),
        wellsExport: wellsForExport,
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        transportKm,
        transportRate,
        transportMode: currentTransportMode,
        wellDiscounts:
            typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts || {}) : {},
        totalWeight,
        totalNetto: totalNetto + totalTransportCostForOffer,
        totalBrutto: (totalNetto + totalTransportCostForOffer) * 1.23,
        createdAt: existingDoc?.createdAt || new Date().toISOString(),
        lastEditedBy: currentUser
            ? currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username
            : '',
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

        const idx = offersStudnie.findIndex((o) => o.id === editingOfferIdStudnie);
        const updatedOffer = { ...offerDoc, id: editingOfferIdStudnie };

        if (idx >= 0) offersStudnie[idx] = updatedOffer;
        else offersStudnie.push(updatedOffer);

        renderSavedOffersStudnie();

        _sendAcceptanceTelemetry(wells, 'OFFER_SAVE');

        if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellAccepted) {
            wells.forEach(function (w) {
                if (w.config && w.config.length > 0) {
                    window.mlRewardHooks.onWellAccepted({ eventType: 'OFFER_SAVED' });
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
