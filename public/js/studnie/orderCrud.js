// @ts-check
async function createOrderFromOffer() {
    try {
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            if (typeof showToast === 'function') {
                showToast(
                    'Tworzenie nowego zamówienia jest niedostępne w trybie edycji zamówienia.',
                    'error'
                );
            }
            return;
        }

        let selectedWells;
        const existingCheckboxes = document.querySelectorAll('.well-order-checkbox');
        if (existingCheckboxes.length > 0) {
            selectedWells = collectSelectedWellsForOrder();
        } else {
            selectedWells = [...wells];
        }
        if (selectedWells.length === 0) {
            showToast('Zaznacz co najmniej jedną studnię do zamówienia', 'error');
            return;
        }

        if (isSavingOffer) {
            showToast('Trwa zapisywanie...', 'info');
            let waitIterations = 0;
            while (isSavingOffer && waitIterations < 100) {
                await new Promise((r) => setTimeout(r, 200));
                waitIterations++;
            }
            if (isSavingOffer) {
                showToast('Zapis oferty trwał zbyt długo. Spróbuj ponownie.', 'error');
                return;
            }
        } else {
            const saveResult = await saveOfferStudnie();
            isSavingOffer = false;
            if (saveResult === false) return;
        }

        const number = document.getElementById('offer-number')?.value?.trim();
        if (!number) {
            showToast('Błąd: Brak numeru oferty', 'error');
            return;
        }
        if (!editingOfferIdStudnie) {
            showToast('Błąd krytyczny: Brak ID oferty po zapisie', 'error');
            return;
        }

        logger.info(
            'orderManager',
            '[createOrderFromOffer] editingOfferIdStudnie =',
            editingOfferIdStudnie
        );
        logger.info(
            'orderManager',
            '[createOrderFromOffer] offersStudnie count =',
            offersStudnie.length
        );
        const offer =
            typeof getOfferStudnieById === 'function'
                ? getOfferStudnieById(editingOfferIdStudnie)
                : offersStudnie.find((o) => o.id === editingOfferIdStudnie);
        logger.info('orderManager', '[createOrderFromOffer] offer found =', !!offer);

        if (!offer) {
            showToast(
                'Nie znaleziono oferty (ID: ' +
                    editingOfferIdStudnie +
                    ', total: ' +
                    offersStudnie.length +
                    ')',
                'error'
            );
            return;
        }

        const alreadyOrderedIds = getOrderedWellIds(offer.id);
        const conflicting = selectedWells.filter((w) => alreadyOrderedIds.has(w.id));
        if (conflicting.length > 0) {
            showToast('Wybrane studnie są już częścią innego zamówienia', 'error');
            return;
        }

        const confirmMsg =
            selectedWells.length === wells.length
                ? `Utworzysz zamówienie na WSZYSTKIE ${selectedWells.length} studni z oferty.\nWybrane studnie zostaną zablokowane do edycji w ofercie.\n\nKontynuować?`
                : `Utworzysz zamówienie na ${selectedWells.length} z ${wells.length} studni.\nWybrane studnie zostaną zablokowane do edycji w ofercie.\nPozostałe studnie będziesz mógł domówić później.\n\nKontynuować?`;

        if (
            !(await appConfirm(confirmMsg, {
                title: 'Tworzenie zamówienia częściowego',
                type: 'warning'
            }))
        )
            return;

        if (!ordersStudnie) {
            ordersStudnie = await loadOrdersStudnie();
        }
        const existingOrdersForOffer = getOrdersForOffer(offer.id);
        pendingOrderCreationData = {
            offer,
            selectedWells,
            kartaBudowyTemplateOrders: existingOrdersForOffer
        };
        initKartaBudowyStep4(offer.number);

        if (typeof goToWizardStep === 'function') {
            goToWizardStep(4);
        } else {
            currentWizardStep = 4;
            if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        }
    } catch (err) {
        logger.error('orderManager', '[createOrderFromOffer] Error:', err);
        if (typeof showToast === 'function') {
            showToast(
                'Wystąpił błąd podczas tworzenia zamówienia: ' + (err.message || 'nieznany błąd'),
                'error'
            );
        }
    }
}

let pendingOrderCreationData = null;

async function finalizeOrderFromOffer(offer, selectedWells, kartaBudowyData) {
    let assignedUserId = offer.userId || (currentUser ? currentUser.id : null);
    let assignedUserName =
        offer.userName ||
        (currentUser
            ? currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username
            : '');

    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')) {
        try {
            const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
            if (!usersResp.ok) throw new Error(`HTTP ${usersResp.status}`);
            const usersData = await usersResp.json();
            const allUsers = usersData.data || [];

            if (allUsers.length > 0) {
                const selectedUser = await showUserSelectionPopup(allUsers, assignedUserId);
                if (selectedUser === null) {
                    showToast('Anulowano tworzenie zamówienia', 'info');
                    return;
                }
                assignedUserId = selectedUser.id;
                assignedUserName =
                    selectedUser.firstName && selectedUser.lastName
                        ? `${selectedUser.firstName} ${selectedUser.lastName}`
                        : selectedUser.displayName || selectedUser.username;
            }
        } catch (e) {
            logger.error('orderManager', 'Błąd pobierania użytkowników:', e);
        }
    }

    let orderNumber = '';
    try {
        const claimResp = await fetch('/api/orders-studnie/claim-number/' + assignedUserId, {
            method: 'POST',
            headers: authHeaders()
        });
        const claimData = await claimResp.json();
        if (claimResp.ok && claimData.number) {
            orderNumber = claimData.number;
        } else {
            showToast('Błąd generowania numeru zamówienia: ' + (claimData.error || ''), 'error');
            return;
        }
    } catch (_e) {
        showToast('Błąd połączenia przy generowaniu numeru zamówienia', 'error');
        return;
    }

    const effectiveDiscounts =
        offer && offer.wellDiscounts ? structuredClone(offer.wellDiscounts) : {};

    const selectedWellsCopy = structuredClone(selectedWells);
    if (typeof syncKineta === 'function') {
        selectedWellsCopy.forEach((w) => syncKineta(w));
    }
    if (typeof stripWellRuntimeFields === 'function') {
        stripWellRuntimeFields(selectedWellsCopy);
    }
    // P0: transportowy kontrakt allowlist — runtime/cache nie opuszcza przeglądarki.
    // stripWellRuntimeFields powyżej zostaje jako defense-in-depth na czas migracji.
    const orderWellsDTO =
        typeof toOrderWellsDTO === 'function'
            ? toOrderWellsDTO(selectedWellsCopy)
            : selectedWellsCopy;
    // P0.2: pomiar redukcji DTO na tym samym logicznym payloadzie (before/after).
    try {
        if (typeof Blob !== 'undefined' && selectedWellsCopy.length > 0) {
            const beforeBytes = new Blob([JSON.stringify(selectedWellsCopy)]).size;
            const afterBytes = new Blob([JSON.stringify(orderWellsDTO)]).size;
            window._lastOrderDtoStats = {
                wellsCount: selectedWellsCopy.length,
                beforeBytes,
                afterBytes,
                dtoReductionPercent:
                    beforeBytes > 0
                        ? Math.round(((beforeBytes - afterBytes) / beforeBytes) * 1000) / 10
                        : 0
            };
        }
    } catch (_e) {
        // pomiar pasywny — nigdy nie blokuje tworzenia zamówienia
    }
    const order = {
        id: 'order_studnie_' + Date.now(),
        offerId: offer.id,
        offerNumber: offer.number,
        userId: assignedUserId,
        userName: assignedUserName,
        number: offer.number,
        orderNumber: orderNumber,
        date: offer.date,
        clientName: offer.clientName,
        clientNip: offer.clientNip,
        clientNumber:
            document.getElementById('client-number')?.value?.trim() || offer.clientNumber || '',
        clientAddress: offer.clientAddress,
        clientContact: offer.clientContact,
        investName: offer.investName,
        investAddress: offer.investAddress,
        investContractor: offer.investContractor,
        notes: offer.notes,
        paymentTerms: offer.paymentTerms,
        validity: offer.validity,
        wells: orderWellsDTO,
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        originalSnapshot: {
            // P1: slim snapshot — [{id,name,price,weight,configHash}]
            // zamiast pełnej kopii wells (buyty, nie megabajty).
            // Kształty legacy (Array | {wells}) nadal odczytywane (back-compat).
            slimWells: [],
            wellDiscounts: structuredClone(effectiveDiscounts),
            transportKm: offer.transportKm,
            transportRate: offer.transportRate,
            transportMode: offer.transportMode || 'full'
        },
        transportKm: offer.transportKm,
        transportRate: offer.transportRate,
        transportMode: offer.transportMode || 'fractional',
        kartaBudowy: kartaBudowyData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser ? currentUser.username : ''
    };

    const originalGlobalDiscounts =
        typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : {};
    if (typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = effectiveDiscounts;
    }

    let totalNetto = 0;
    let totalWeight = 0;
    selectedWells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    let orderTransportCost = 0;
    const globalOfferWeight = offer.totalWeight || 0;
    const gKm = parseFloat(offer.transportKm) || 0;
    const gRate = parseFloat(offer.transportRate) || 0;
    const offerMode = offer.transportMode || 'full';
    const globalOfferTransport =
        gKm > 0 && gRate > 0
            ? (typeof calcTransportCount === 'function'
                  ? calcTransportCount(globalOfferWeight, offerMode)
                  : Math.ceil(globalOfferWeight / MAX_TRANSPORT_WEIGHT)) *
              gKm *
              gRate
            : 0;
    if (globalOfferWeight > 0 && totalWeight > 0) {
        orderTransportCost = globalOfferTransport * (totalWeight / globalOfferWeight);
    }

    // P1: statystyki z tej pętli zasilają slim snapshot (brak 3. przebiegu calcWellStats).
    const slimStatsByWell = [];
    order.wellsExport = orderWellsDTO.map((well) => {
        const stats = calcWellStats(well);
        slimStatsByWell.push(stats);
        const wellTransportCost =
            totalWeight > 0 ? orderTransportCost * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config: well.config,
            przejscia: well.przejscia
        };
    });

    const finalOrderNetto = totalNetto + orderTransportCost;

    order.totalWeight = totalWeight;
    order.totalNetto = finalOrderNetto;
    order.originalTotalNetto = finalOrderNetto;
    order.totalBrutto = finalOrderNetto * 1.23;
    order.wellDiscounts = effectiveDiscounts;

    // P1: materializacja slim snapshotu na DTO (ten sam kontekst rabatów co totals).
    // Statystyki reuse z pętli wellsExport — zero dodatkowych calcWellStats.
    if (typeof buildSlimWells === 'function') {
        const statsByIndex = new Map(slimStatsByWell.map((s, i) => [orderWellsDTO[i], s]));
        order.originalSnapshot.slimWells = buildSlimWells(orderWellsDTO, (w) => {
            const s = statsByIndex.get(w);
            return s || { price: 0, weight: 0 };
        });
    }

    freezeWellPrices(order.wells);

    if (typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = originalGlobalDiscounts;
    }

    if (!ordersStudnie) ordersStudnie = [];
    ordersStudnie.push(order);
    // P1 HIGH: zapis tylko nowego zamówienia (payload ~1 zamówienie, nie N).
    if (typeof putSingleOrderStudnie === 'function') {
        const saved = await putSingleOrderStudnie(order);
        if (!saved) return;
    } else {
        await saveOrdersDataStudnie(ordersStudnie);
    }

    await saveOfferStudnie();
    renderSavedOffersStudnie();

    showToast(
        `<i data-lucide="package"></i> Zamówienie ${orderNumber} utworzone (${selectedWells.length} studni z oferty ${offer.number})`,
        'success'
    );

    if (window.kartotekaUI) {
        window.kartotekaUI.notifyOrderMutation();
    }

    if (typeof _sendAcceptanceTelemetry === 'function') {
        _sendAcceptanceTelemetry(selectedWellsCopy, 'ORDER_CONFIRM');
    }

    if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.sendRewardBatch) {
        // P1-HIGH-reward: jeden batch (O(N/500) sekwencyjnych requestów) zamiast
        // N równoległych fetchy → brak ERR_INSUFFICIENT_RESOURCES. Wysyłane tylko
        // studnie z potwierdzonym wierszem telemetry (_lastAutoTelemetryId) —
        // resztę backend i tak odrzuciłby 400 WELL_NOT_FOUND.
        window.mlRewardHooks
            .sendRewardBatch(selectedWellsCopy, {
                action: 'ACCEPT',
                eventType: 'ORDER_CONFIRMED',
                wasAiRanked: (w) => w.configSource === 'AUTO_AI'
            })
            .catch(() => {
                // pasywnie
            });
    } else if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellAccepted) {
        selectedWellsCopy.forEach(function (w) {
            if (w.config && w.config.length > 0) {
                window.mlRewardHooks.onWellAccepted({
                    eventType: 'ORDER_CONFIRMED',
                    wasAiRanked: w.configSource === 'AUTO_AI',
                    well: w
                });
            }
        });
    }

    currentWizardStep = 5;
    if (typeof updateWizardIndicator === 'function') updateWizardIndicator();

    window.location.href = 'studnie.html?order=' + order.id;
}

function collectSelectedWellsForOrder() {
    const checkboxes = document.querySelectorAll('.well-order-checkbox:checked');
    const selectedWells = [];
    checkboxes.forEach((cb) => {
        const idx = parseInt(cb.dataset.wellIndex, 10);
        if (!isNaN(idx) && wells[idx]) {
            selectedWells.push(wells[idx]);
        }
    });
    return selectedWells;
}

async function saveOrderStudnie() {
    if (!editingOfferIdStudnie) return;
    const offer =
        typeof getOfferStudnieById === 'function'
            ? getOfferStudnieById(editingOfferIdStudnie)
            : offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    if (!offer) return;
    const oId = normalizeId(offer.id);
    const order = ordersStudnie ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId) : null;
    if (!order) return;
    // P1 HIGH: baza do optimistic concurrency — PRZED nadpisaniem updatedAt.
    if (!order._baseUpdatedAt) order._baseUpdatedAt = order.updatedAt || null;

    freezeWellPrices(wells);

    order.wells =
        typeof toOrderWellsDTO === 'function'
            ? toOrderWellsDTO(structuredClone(wells))
            : structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();
    order.paymentTerms =
        document.getElementById('offer-tab-payment-terms')?.value ||
        document.getElementById('offer-payment-terms')?.value ||
        order.paymentTerms ||
        '';
    order.validity =
        document.getElementById('offer-tab-validity')?.value ||
        document.getElementById('offer-validity')?.value ||
        order.validity ||
        '7 dni';

    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;

    const transportKmVal = parseFloat(offer.transportKm) || 0;
    const transportRateVal = parseFloat(offer.transportRate) || 0;
    const orderMode = order.transportMode || offer.transportMode || 'full';
    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0 && totalWeight > 0) {
        totalTransportCostForOffer =
            (typeof calcTransportCount === 'function'
                ? calcTransportCount(totalWeight, orderMode)
                : Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT)) *
            transportKmVal *
            transportRateVal;
    }
    const orderTotal = totalNetto + totalTransportCostForOffer;
    order.totalNetto = orderTotal;
    order.totalBrutto = orderTotal * 1.23;

    order.wellsExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totalWeight > 0 ? totalTransportCostForOffer * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config:
                typeof toWellConfigItemDTO === 'function'
                    ? (well.config || []).map(toWellConfigItemDTO).filter(Boolean)
                    : well.config,
            przejscia:
                typeof toWellPrzejscieDTO === 'function'
                    ? (well.przejscia || []).map(toWellPrzejscieDTO).filter(Boolean)
                    : well.przejscia
        };
    });

    // P1 HIGH: PATCH pojedynczego zamówienia zamiast batch-PUT całego ordersStudnie.
    if (typeof patchSingleOrderStudnie === 'function') {
        const saved = await patchSingleOrderStudnie(order, {
            wells: order.wells,
            wellDiscounts: order.wellDiscounts,
            visiblePrzejsciaTypes: order.visiblePrzejsciaTypes,
            updatedAt: order.updatedAt,
            paymentTerms: order.paymentTerms,
            validity: order.validity,
            totalWeight: order.totalWeight,
            totalNetto: order.totalNetto,
            totalBrutto: order.totalBrutto,
            wellsExport: order.wellsExport
        });
        if (!saved) return;
    } else {
        await saveOrdersDataStudnie(ordersStudnie);
    }
    showToast('<i data-lucide="package"></i> Zamówienie zaktualizowane', 'success');
    if (window.kartotekaUI) {
        window.kartotekaUI.notifyOrderMutation();
    }
}

async function deleteOrderStudnie(orderId) {
    const order = ordersStudnie ? ordersStudnie.find((o) => o.id === orderId) : null;
    if (order && window.pzGuard && window.pzGuard.hasPzForOrder(order.id, order.offerId)) {
        showToast(
            '<i data-lucide="x-circle"></i> Nie można usunąć zamówienia — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.',
            'error'
        );
        return;
    }

    if (
        !(await appConfirm('Czy na pewno usunąć to zamówienie?', {
            title: 'Usuwanie zamówienia',
            type: 'danger'
        }))
    )
        return;

    try {
        const res = await fetch(`/api/orders-studnie/${orderId}`, {
            method: 'DELETE',
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showToast(
                '<i data-lucide="x-circle"></i> ' + (errData.error || 'Błąd usuwania zamówienia'),
                'error'
            );
            return;
        }
    } catch (e) {
        logger.error('orderManager', 'Błąd usuwania zamówienia przez API:', e);
        showToast('Błąd połączenia z serwerem', 'error');
        return;
    }

    let affectedOfferId = null;
    if (order) {
        affectedOfferId = normalizeId(order.offerId);
    }
    if (ordersStudnie) {
        ordersStudnie = ordersStudnie.filter((o) => o.id !== orderId);
        // P1 HIGH: DELETE już usunął rekord po stronie serwera — bez re-save całości.
    }
    renderSavedOffersStudnie();
    showToast('Zamówienie usunięte. Studnie odblokowane do ponownego zamówienia.', 'info');

    if (typeof renderWellConfig === 'function') renderWellConfig();

    if (affectedOfferId && editingOfferIdStudnie === affectedOfferId) {
        refreshAll();
    }

    if (window.kartotekaUI) {
        window.kartotekaUI.notifyOrderMutation();
    }
}

function getCurrentOfferOrder() {
    if (orderEditMode) return orderEditMode.order;
    if (!editingOfferIdStudnie) return null;
    return ordersStudnie
        ? ordersStudnie.find((o) => o.offerId === editingOfferIdStudnie) || null
        : null;
}

async function enterOrderEditMode(orderId) {
    try {
        logger.info('orderManager', '[enterOrderEditMode] START orderId=', orderId);
        const res = await fetchWithTimeout(
            `/api/orders-studnie/${orderId}`,
            { headers: authHeaders() },
            15000
        );
        if (!res.ok) {
            showToast('Zamówienie nie znalezione', 'error');
            return;
        }
        const json = await res.json();
        const order = json.data;
        if (!order) {
            showToast('Zamówienie nie znalezione', 'error');
            return;
        }

        logger.info(
            'orderManager',
            '[enterOrderEditMode] order loaded, wells count:',
            order.wells ? order.wells.length : 'NO WELLS'
        );

        orderEditMode = { orderId: order.id, order: order };
        // P1 HIGH: baza do optimistic concurrency.
        order._baseUpdatedAt = order.updatedAt || null;
        editingOfferIdStudnie = order.offerId || null;
        window.isPreviewMode = false;

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        wells = Array.isArray(order.wells) ? structuredClone(order.wells) : [];
        migrateWellData(wells);

        if (order.wellDiscounts) {
            window.wellDiscounts = structuredClone(order.wellDiscounts);
        }

        if (order.wells && order.wells.length > 0) {
            const offer = offersStudnie
                ? typeof getOfferStudnieById === 'function'
                    ? getOfferStudnieById(order.offerId)
                    : offersStudnie.find((o) => o.id === order.offerId)
                : null;
            let _w = 0,
                _t = 0;
            order.wells.forEach((w) => {
                const s = calcWellStats(w);
                _w += s.price;
                _t += s.weight;
            });
            const km = parseFloat(order.transportKm || offer?.transportKm) || 0;
            const rate = parseFloat(order.transportRate || offer?.transportRate) || 0;
            const _mode = order.transportMode || offer?.transportMode || 'full';
            let tc = 0;
            if (km > 0 && rate > 0 && _t > 0) {
                const _offerTotalWeight = offer?.totalWeight || _t;
                const _fullOfferCost =
                    (typeof calcTransportCount === 'function'
                        ? calcTransportCount(_offerTotalWeight, _mode)
                        : Math.ceil(_offerTotalWeight / MAX_TRANSPORT_WEIGHT)) *
                    km *
                    rate;
                tc = _offerTotalWeight > 0 ? _fullOfferCost * (_t / _offerTotalWeight) : 0;
            }
            order.totalNetto = _w + tc;
            order.totalBrutto = (_w + tc) * 1.23;
        }

        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];
            if (typeof syncKineta === 'function') syncKineta(w);
        });

        logger.info('orderManager', '[enterOrderEditMode] wells migrated, count:', wells.length);

        wells.forEach((w) => {
            if (w.przejscia) {
                w.przejscia.forEach((pr) => {
                    const prod =
                        typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(pr.productId)
                            : studnieProducts.find((p) => p.id === pr.productId);
                    if (prod && prod.category) {
                        visiblePrzejsciaTypes.add(prod.category);
                    }
                });
            }
        });

        wellCounter = wells.length;
        currentWellIndex = 0;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('offer-number', order.number || '');
        setVal('offer-date', order.date || new Date().toISOString().slice(0, 10));
        setVal('client-name', order.clientName || '');
        setVal('client-nip', order.clientNip || '');
        setVal('client-number', order.clientNumber || '');
        setVal('client-address', order.clientAddress || '');
        setVal('client-contact', order.clientContact || '');
        setVal('invest-name', order.investName || '');
        setVal('invest-address', order.investAddress || '');
        setVal('invest-contractor', order.investContractor || '');

        setVal('transport-km', order.transportKm ?? 100);
        setVal('transport-rate', order.transportRate ?? 10);
        currentTransportMode = order.transportMode || 'full';
        setVal('offer-validity', order.validity || order.offerValidity || '');
        setVal('offer-tab-validity', order.validity || order.offerValidity || '');
        setVal('offer-payment-terms', order.paymentTerms || '');
        setVal('offer-tab-payment-terms', order.paymentTerms || '');

        logger.info(
            'orderManager',
            '[enterOrderEditMode] fields filled, calling skipWizardToStep3...'
        );

        wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
        currentWizardStep = 5;
        document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
        const target = document.getElementById('wizard-step-3');
        if (target) target.classList.add('active');
        if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        if (typeof updateWizardSummaryBar === 'function') updateWizardSummaryBar();

        const layout = document.querySelector('.well-app-layout');
        if (layout) layout.classList.remove('intro-mode');

        showSection('builder');

        logger.info('orderManager', '[enterOrderEditMode] calling refreshAll...');
        refreshAll();

        logger.info('orderManager', '[enterOrderEditMode] calling renderOrderModeBanner...');
        renderOrderModeBanner();
        if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();

        document.title = `📦 Zamówienie: ${order.number || orderId}`;

        logger.info('orderManager', '[enterOrderEditMode] DONE');
        showToast('<i data-lucide="package"></i> Zamówienie wczytane do edycji', 'success');
    } catch (err) {
        logger.error('orderManager', 'Błąd ładowania zamówienia:', err);
        logger.error('orderManager', 'Stack:', err.stack);
        showToast('Błąd ładowania zamówienia: ' + err.message, 'error');
    }
}

window.isPreviewMode = false;

window.applyPreviewLockUI = function () {
    let banner = document.getElementById('preview-lock-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'preview-lock-banner';
        banner.innerHTML = `
            <div style="position:fixed; top:2rem; left:50%; transform:translateX(-50%); background:rgba(var(--slate-950-rgb), 0.8); border:2px solid var(--warn-hover); color:var(--warn-hover); padding:0.8rem 2.5rem; border-radius:40px; z-index:${LAYERS.PREVIEW_BANNER}; box-shadow:0 20px 40px rgba(var(--black-rgb), 0.8); font-weight: var(--fw-extrabold); display:flex; align-items:center; gap:1.5rem; backdrop-filter:blur(10px);">
                <span class="fs-4xl"><i data-lucide="eye"></i>️ HISTORIA — TYLKO DO ODCZYTU</span>
                <button onclick="window.exitPreviewMode()" class="btn btn-sm" style="background:var(--warn-hover); color:var(--black); border:none; padding:0.4rem 1rem; border-radius: var(--radius-lg); font-weight: var(--fw-bold);">ZAMKNIJ PODGLĄD</button>
            </div>
        `;
        document.body.appendChild(banner);
    }

    document
        .querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar')
        .forEach((el) => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.7';
        });

    const originalSaveOrder = window.saveCurrentOrder;
    window.saveCurrentOrder = async () => {
        if (window.isPreviewMode)
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
        else if (originalSaveOrder) await originalSaveOrder();
    };
    const originalSaveOffer = window.saveOfferStudnie;
    window.saveOfferStudnie = async () => {
        if (window.isPreviewMode) {
            showToast('Zapisywanie w trybie podglądu jest zablokowane', 'error');
            return false;
        } else if (originalSaveOffer) return await originalSaveOffer();
    };

    window.isPreviewMode = true;
};

window.exitPreviewMode = function () {
    window.location.reload();
};

async function loadOrderSnapshot(rebuiltData, orderId) {
    try {
        const order = rebuiltData;
        orderEditMode = { orderId: orderId, order: order };
        // P1 HIGH: baza do optimistic concurrency.
        order._baseUpdatedAt = order.updatedAt || null;
        editingOfferIdStudnie = order.offerId || null;

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        if (order.wellDiscounts) {
            window.wellDiscounts = structuredClone(order.wellDiscounts);
        } else {
            window.wellDiscounts = {};
        }

        wells = Array.isArray(order.wells) ? structuredClone(order.wells) : [];
        if (typeof migrateWellData === 'function') migrateWellData(wells);
        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];

            if (typeof syncKineta === 'function') syncKineta(w);

            if (w.przejscia) {
                w.przejscia.forEach((pr) => {
                    const prod =
                        typeof studnieProducts !== 'undefined'
                            ? typeof getStudnieProductById === 'function'
                                ? getStudnieProductById(pr.productId)
                                : studnieProducts.find((p) => p.id === pr.productId)
                            : null;
                    if (prod && prod.category) visiblePrzejsciaTypes.add(prod.category);
                });
            }
        });

        wellCounter = wells.length > 0 ? wells.length : 1;
        currentWellIndex = 0;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('offer-number', order.number || '');
        setVal('offer-date', order.date || new Date().toISOString().slice(0, 10));
        setVal('client-name', order.clientName || '');
        setVal('client-nip', order.clientNip || '');
        setVal('client-number', order.clientNumber || '');
        setVal('client-address', order.clientAddress || '');
        setVal('client-contact', order.clientContact || '');
        setVal('invest-name', order.investName || '');
        setVal('invest-address', order.investAddress || '');
        setVal('invest-contractor', order.investContractor || '');

        if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
        if (typeof showSection === 'function') showSection('builder');
        if (typeof refreshAll === 'function') refreshAll();

        renderOrderModeBanner();
        document.title = `👁️ PODGLĄD Zamówienia: ${order.number || orderId}`;

        window.applyPreviewLockUI();
    } catch (err) {
        window.isPreviewMode = false;
        logger.error('orderManager', 'Błąd ładowania podglądu zamówienia:', err);
        showToast('Błąd ładowania podglądu zamówienia', 'error');
    }
}
window.loadOrderSnapshot = loadOrderSnapshot;

async function saveCurrentOrder(options = {}) {
    if (!orderEditMode) {
        showToast('Brak trybu zamówienia', 'error');
        return;
    }

    const order = orderEditMode.order;

    // P1 HIGH: baza do optimistic concurrency — PRZED nadpisaniem updatedAt.
    if (!order._baseUpdatedAt) order._baseUpdatedAt = order.updatedAt || null;

    if (!options.skipFreeze) {
        freezeWellPrices(wells);
    }

    order.wells =
        typeof toOrderWellsDTO === 'function'
            ? toOrderWellsDTO(structuredClone(wells))
            : structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;

    const offer = offersStudnie
        ? typeof getOfferStudnieById === 'function'
            ? getOfferStudnieById(order.offerId)
            : offersStudnie.find((o) => o.id === order.offerId)
        : null;
    const transportKmVal = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRateVal = parseFloat(document.getElementById('transport-rate')?.value) || 0;

    order.transportKm = transportKmVal;
    order.transportRate = transportRateVal;
    order.transportMode = currentTransportMode;
    order.paymentTerms =
        document.getElementById('offer-tab-payment-terms')?.value ||
        document.getElementById('offer-payment-terms')?.value ||
        order.paymentTerms ||
        '';
    order.validity =
        document.getElementById('offer-tab-validity')?.value ||
        document.getElementById('offer-validity')?.value ||
        order.validity ||
        '7 dni';

    let totalTransportCostForOffer = 0;
    if (transportKmVal > 0 && transportRateVal > 0 && totalWeight > 0) {
        const offerTotalWeight = offer?.totalWeight || totalWeight;
        const fullOfferCost =
            (typeof calcTransportCount === 'function'
                ? calcTransportCount(offerTotalWeight, currentTransportMode)
                : Math.ceil(offerTotalWeight / MAX_TRANSPORT_WEIGHT)) *
            transportKmVal *
            transportRateVal;
        totalTransportCostForOffer =
            offerTotalWeight > 0 ? fullOfferCost * (totalWeight / offerTotalWeight) : 0;
    }
    const orderTotal = totalNetto + totalTransportCostForOffer;
    order.totalNetto = orderTotal;
    order.totalBrutto = orderTotal * 1.23;

    order.wellsExport = wells.map((well) => {
        const stats = calcWellStats(well);
        const wellTransportCost =
            totalWeight > 0 ? totalTransportCostForOffer * (stats.weight / totalWeight) : 0;
        const zwienczenie =
            typeof getWellZwienczenieName === 'function' ? getWellZwienczenieName(well) : '—';
        return {
            name: well.name,
            dn: well.dn,
            height: stats.height,
            weight: stats.weight,
            zwienczenie: zwienczenie,
            price: stats.price,
            transportCost: wellTransportCost,
            totalPrice: stats.price + wellTransportCost,
            config:
                typeof toWellConfigItemDTO === 'function'
                    ? (well.config || []).map(toWellConfigItemDTO).filter(Boolean)
                    : well.config,
            przejscia:
                typeof toWellPrzejscieDTO === 'function'
                    ? (well.przejscia || []).map(toWellPrzejscieDTO).filter(Boolean)
                    : well.przejscia
        };
    });

    // P1 HIGH: PATCH pojedynczego zamówienia + 409 przy konflikcie
    // (wcześniej fire-and-forget bez sprawdzania res.ok).
    if (typeof patchSingleOrderStudnie === 'function') {
        const saved = await patchSingleOrderStudnie(order, {
            wells: order.wells,
            wellDiscounts: order.wellDiscounts,
            kartaBudowy: order.kartaBudowy,
            updatedAt: order.updatedAt,
            wellsExport: order.wellsExport,
            totalWeight: order.totalWeight,
            totalNetto: order.totalNetto,
            totalBrutto: order.totalBrutto,
            transportKm: order.transportKm,
            transportRate: order.transportRate,
            transportMode: order.transportMode,
            paymentTerms: order.paymentTerms,
            validity: order.validity
        });
        if (!saved) return;
    } else {
        try {
            await fetch(`/api/orders-studnie/${order.id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({
                    wells: order.wells,
                    wellDiscounts: order.wellDiscounts,
                    kartaBudowy: order.kartaBudowy,
                    updatedAt: order.updatedAt,
                    wellsExport: order.wellsExport,
                    totalWeight: order.totalWeight,
                    totalNetto: order.totalNetto,
                    totalBrutto: order.totalBrutto,
                    transportKm: order.transportKm,
                    transportRate: order.transportRate,
                    transportMode: order.transportMode,
                    paymentTerms: order.paymentTerms,
                    validity: order.validity
                })
            });
        } catch (err) {
            logger.error('orderManager', 'Błąd zapisu zamówienia:', err);
            showToast('Błąd zapisu zamówienia', 'error');
            return;
        }
    }
    showToast('<i data-lucide="package"></i> Zamówienie zapisane', 'success');
    renderOrderModeBanner();
    if (typeof renderOfferSummary === 'function') renderOfferSummary();
    if (window.kartotekaUI) {
        window.kartotekaUI.notifyOrderMutation();
    }
}

window.createOrderFromOffer = createOrderFromOffer;
window.saveOrderStudnie = saveOrderStudnie;
window.saveCurrentOrder = saveCurrentOrder;
window.deleteOrderStudnie = deleteOrderStudnie;
window.getCurrentOfferOrder = getCurrentOfferOrder;
window.enterOrderEditMode = enterOrderEditMode;
window.finalizeOrderFromOffer = finalizeOrderFromOffer;

async function syncSourceData(options = {}) {
    let synced = '';
    try {
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            if (typeof window.saveCurrentOrder === 'function') {
                await window.saveCurrentOrder(options);
                synced += 'Zamówienie';
            }
        } else {
            if (typeof window.saveOfferStudnie === 'function') {
                const offerSaved = await window.saveOfferStudnie();
                if (offerSaved) synced += 'Oferta';
            }
        }
    } catch (err) {
        logger.error('orderManager', 'syncSourceData error:', err);
    }
    return synced;
}
window.syncSourceData = syncSourceData;
window.pendingOrderCreationData = pendingOrderCreationData;
