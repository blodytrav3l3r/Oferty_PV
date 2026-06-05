/* ===== ZAMÓWIENIA STUDNI ===== */
async function loadOrdersStudnie() {
    try {
        const res = await fetchWithTimeout('/api/orders-studnie', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        console.error('Błąd ładowania zamówień studni:', err);
        return [];
    }
}

async function saveOrdersDataStudnie(data) {
    try {
        await fetch('/api/orders-studnie', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
    } catch (err) {
        console.error('Błąd zapisu zamówień studni:', err);
    }
}

/* ===== POMOCNIKI ZAMÓWIEŃ CZĘŚCIOWYCH ===== */

/** Zwraca wszystkie zamówienia powiązane z daną ofertą */
function getOrdersForOffer(offerId) {
    if (!ordersStudnie || !offerId) return [];
    const nId = normalizeId(offerId);
    return ordersStudnie.filter((o) => normalizeId(o.offerId || o.offerStudnieId) === nId);
}

/** Zwraca Set<string> z ID studni, które są już zamówione dla danej oferty */
function getOrderedWellIds(offerId) {
    const orders = getOrdersForOffer(offerId);
    const ids = new Set();
    orders.forEach((order) => {
        (order.wells || []).forEach((w) => {
            if (w.id) ids.add(w.id);
        });
    });
    return ids;
}

/** Sprawdza, czy dana studnia jest zamówiona w ramach bieżącej oferty */
function isWellOrdered(well) {
    if (!well || !well.id || !editingOfferIdStudnie) return false;
    return getOrderedWellIds(editingOfferIdStudnie).has(well.id);
}

/** Oblicza progres zamówień dla danej oferty: { ordered, total, percent } */
function getOfferOrderProgress(offerId, offerWells) {
    const orderedIds = getOrderedWellIds(offerId);
    const total = (offerWells || []).length;
    const ordered = (offerWells || []).filter((w) => w.id && orderedIds.has(w.id)).length;
    const percent = total > 0 ? Math.round((ordered / total) * 100) : 0;
    return { ordered, total, percent };
}

/** Zwraca zamówienie, do którego należy dana studnia (jeśli istnieje) */
function getOrderForWellId(wellId, offerId) {
    if (!wellId || !ordersStudnie) return null;
    const nId = offerId ? normalizeId(offerId) : null;
    return ordersStudnie.find((order) => {
        if (nId && normalizeId(order.offerId) !== nId) return false;
        return (order.wells || []).some((w) => w.id === wellId);
    }) || null;
}

window.getOrdersForOffer = getOrdersForOffer;
window.getOrderedWellIds = getOrderedWellIds;
window.isWellOrdered = isWellOrdered;
window.getOfferOrderProgress = getOfferOrderProgress;
window.getOrderForWellId = getOrderForWellId;

async function createOrderFromOffer() {
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof showToast === 'function') {
            showToast('Tworzenie nowego zamówienia jest niedostępne w trybie edycji zamówienia.', 'error');
        }
        return;
    }

    // Zapobiegaj wyścigom w UI, jeśli użytkownik kliknął dwukrotnie lub kliknął Zamówienie podczas trwania zapisu
    if (isSavingOffer) {
        showToast('Trwa zapisywanie...', 'info');
        while (isSavingOffer) {
            await new Promise((r) => setTimeout(r, 200));
        }
    } else {
        // Automatycznie zapisz ofertę, aby upewnić się, że najnowszy stan został przesłany do SQLite i odświeżony
        const saveOk = await saveOfferStudnie();
        if (!saveOk) return; // Zapis nie powiodl sie lub zablokowany
    }

    const number = document.getElementById('offer-number').value.trim();
    if (!number) {
        showToast('Błąd: Brak numeru oferty', 'error');
        return;
    }
    if (!editingOfferIdStudnie) {
        showToast('Błąd krytyczny: Brak ID oferty po zapisie', 'error');
        return;
    }

    console.log('[createOrderFromOffer] editingOfferIdStudnie =', editingOfferIdStudnie);
    console.log('[createOrderFromOffer] offersStudnie count =', offersStudnie.length);
    const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    console.log('[createOrderFromOffer] offer found =', !!offer);

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

    // Zbierz zaznaczone studnie z checkboxów w podsumowaniu oferty
    const selectedWells = collectSelectedWellsForOrder();
    if (selectedWells.length === 0) {
        showToast('Zaznacz co najmniej jedną studnię do zamówienia', 'error');
        return;
    }

    // Weryfikacja — wybrane studnie nie mogą być już zamówione
    const alreadyOrderedIds = getOrderedWellIds(offer.id);
    const conflicting = selectedWells.filter((w) => alreadyOrderedIds.has(w.id));
    if (conflicting.length > 0) {
        showToast('Wybrane studnie są już częścią innego zamówienia', 'error');
        return;
    }

    // Ostrzeżenie: wybrane studnie zostaną zablokowane do edycji w ofercie
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

    // Krok 4.1 — Karta budowy zamiast popupu
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
    
    // Przejdź do kroku 4
    if (typeof goToWizardStep === 'function') {
        goToWizardStep(4);
    } else {
        currentWizardStep = 4;
        if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
    }
}

/**
 * Zmienna przechowująca dane do utworzenia zamówienia w trakcie kroku Karta Budowy
 */
let pendingOrderCreationData = null;

/**
 * Inicjalizuje formularz Karty Budowy w Kroku 4.
 * Może załadować dane nowej oferty lub istniejącego zamówienia.
 */
function initKartaBudowyStep4(primaryOfferNumber) {
    _przejsciaInitialized = false;
    const emailFakturaInput = document.getElementById('step4-email-faktura');
    const emailEfakturaInput = document.getElementById('step4-email-efaktura');
    const offerInput = document.getElementById('step4-offer-nr-input');
    const adresWysylkiInput = document.getElementById('step4-adres-wysylki');
    const warunkiPlatnosciInput = document.getElementById('step4-warunki-platnosci');
    const iloscDniInput = document.getElementById('step4-ilosc-dni');
    const ubezpieczenieInput = document.getElementById('step4-ubezpieczenie');
    const osobaKontaktInput = document.getElementById('step4-osoba-kontakt');
    const zabezpieczenieTransportuInput = document.getElementById('step4-zabezpieczenie-transportu');
    const rodzajTransportuInput = document.getElementById('step4-rodzaj-transportu');
    const wyliczonyTransportInput = document.getElementById('step4-wyliczony-transport');
    const rodzajStopniInput = document.getElementById('step4-rodzaj-stopni');
    const rodzajStopniInneInput = document.getElementById('step4-rodzaj-stopni-inne');
    const rodzajStudniInput = document.getElementById('step4-rodzaj-studni');
    const uszczelkaStudniInput = document.getElementById('step4-uszczelka-studni');
    const uszczelkaStudniInneInput = document.getElementById('step4-uszczelka-studni-inne');
    const kinetaInput = document.getElementById('step4-kineta');
    const kinetaInneInput = document.getElementById('step4-kineta-inne');
    const wysokoscSpocznikaInput = document.getElementById('step4-wysokosc-spocznika');
    const usytuowanieInput = document.getElementById('step4-usytuowanie');
    const kaskadaInput = document.getElementById('step4-kaskada');
    const kaskadaUwagiInput = document.getElementById('step4-kaskada-uwagi');
    const slepaKinetaInput = document.getElementById('step4-slepa-kineta');
    const slepaKinetaUwagiInput = document.getElementById('step4-slepa-kineta-uwagi');
    const redukcjaKinetyInput = document.getElementById('step4-redukcja-kinety');
    const przejsciaTulejoweInput = document.getElementById('step4-przejscia-tulejowe');
    const przejsciaSzczelneInput = document.getElementById('step4-przejscia-szczelne');
    const wlasciwosciBetonuInput = document.getElementById('step4-wlasciwosci-betonu');
    const pozostaleWlasciwosciInput = document.getElementById('step4-pozostale-wlasciwosci');
    const przejsciaZamowioneInput = document.getElementById('step4-przejscia-zamowione');
    const dataZamowieniaInput = document.getElementById('step4-data-zamowienia');
    
    if (emailFakturaInput) emailFakturaInput.value = '';
    if (emailEfakturaInput) emailEfakturaInput.value = '';
    if (offerInput) offerInput.value = '';
    if (adresWysylkiInput) adresWysylkiInput.value = '';
    if (warunkiPlatnosciInput) warunkiPlatnosciInput.value = 'przelew';
    if (iloscDniInput) iloscDniInput.value = '';
    if (ubezpieczenieInput) ubezpieczenieInput.value = '';
    if (osobaKontaktInput) osobaKontaktInput.value = '';
    if (zabezpieczenieTransportuInput) zabezpieczenieTransportuInput.value = 'Nie dotyczy';
    if (rodzajTransportuInput) rodzajTransportuInput.value = 'Transport P.V.';
    if (rodzajStopniInneInput) {
        rodzajStopniInneInput.value = '';
        const wrap = document.getElementById('step4-rodzaj-stopni-inne-wrap');
        if (wrap) wrap.style.display = 'none';
    }
    if (uszczelkaStudniInneInput) {
        uszczelkaStudniInneInput.value = '';
        const wrap = document.getElementById('step4-uszczelka-studni-inne-wrap');
        if (wrap) wrap.style.display = 'none';
    }
    if (kinetaInneInput) {
        kinetaInneInput.value = '';
        const wrap = document.getElementById('step4-kineta-inne-wrap');
        if (wrap) wrap.style.display = 'none';
    }
    
    // Oblicz i wyświetl dane o transporcie (podział na pełne + niepełne kursy)
    let tCost = 0;
    let tWeight = 0;
    let costPerTrip = 0;
    
    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) {
        const o = orderEditMode.order;
        tWeight = o.totalWeight || 0;
        let wNetto = 0;
        if (o.wells) {
            o.wells.forEach(w => wNetto += (typeof calcWellStats === 'function' ? calcWellStats(w).price : 0));
        }
        tCost = o.totalNetto - wNetto;
        costPerTrip = (parseFloat(o.transportKm) || 0) * (parseFloat(o.transportRate) || 0);
    } else if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        const off = pendingOrderCreationData.offer;
        const sel = pendingOrderCreationData.selectedWells;
        if (sel) {
            sel.forEach(w => tWeight += (typeof calcWellStats === 'function' ? calcWellStats(w).weight : 0));
        }
        const gWeight = off.totalWeight || 0;
        const gKm = parseFloat(off.transportKm) || 0;
        const gRate = parseFloat(off.transportRate) || 0;
        const gCost = (gKm > 0 && gRate > 0) ? Math.ceil(gWeight / 24000) * gKm * gRate : 0;
        if (gWeight > 0 && tWeight > 0) {
            tCost = gCost * (tWeight / gWeight);
        }
        costPerTrip = gKm * gRate;
    }
    
    if (wyliczonyTransportInput) {
        const t = Math.max(0, tCost);
        if (t > 0 && costPerTrip > 0) {
            const full = Math.floor(t / costPerTrip);
            const part = t - full * costPerTrip;
            const fmt = (v) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            if (full > 0 && part > 0.01) {
                wyliczonyTransportInput.value = `${full} x ${fmt(costPerTrip)} zł + ${fmt(part)} zł`;
            } else if (full > 0) {
                wyliczonyTransportInput.value = `${full} x ${fmt(costPerTrip)} zł`;
            } else {
                wyliczonyTransportInput.value = `${fmt(part)} zł`;
            }
        } else if (t > 0) {
            const fmt = (v) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            wyliczonyTransportInput.value = `${fmt(t)} zł`;
        } else {
            wyliczonyTransportInput.value = 'Brak transportu';
        }
    }
    
    // Auto-detect Rodzaj stopni, Rodzaj studni, i Kineta
    let detectedStopnie = 'Nie dotyczy';
    let detectedRodzajStudni = 'Nie dotyczy';
    let detectedKineta = 'Brak';
    let detectedWysokoscSpocznika = 'Nie dotyczy';
    let detectedPozostale = [];
    const wellsToDetect = (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) ? orderEditMode.order.wells : ((typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) ? pendingOrderCreationData.selectedWells : []);
    
    if (wellsToDetect && wellsToDetect.length > 0) {
        let hasNierdzewna = false;
        let hasDrabinka = false;
        let hasBrak = false;
        
        let hasZelbet = false;
        let hasBetonStudnia = false;
        
        let hasPrecoTop = false;
        let hasPreco = false;
        let hasBetonKineta = false;
        
        let spocznikHFound = null;
        
        wellsToDetect.forEach(w => {
            // Stopnie
            if (w.stopnie === 'nierdzewna') hasNierdzewna = true;
            else if (w.stopnie === 'drabinka') hasDrabinka = true;
            else if (w.stopnie === 'brak') hasBrak = true;
            
            // Rodzaj studni
            if (w.dennicaMaterial === 'zelbetowa' || w.nadbudowa === 'zelbetowa' || w.material === 'zelbetowa') hasZelbet = true;
            else if (w.dennicaMaterial === 'betonowa' || w.nadbudowa === 'betonowa' || w.material === 'betonowa') hasBetonStudnia = true;
            
            // Kineta
            if (w.kineta === 'precotop') hasPrecoTop = true;
            else if (w.kineta === 'preco') hasPreco = true;
            else if (w.kineta === 'beton') hasBetonKineta = true;
            
            // Wysokość spocznika
            if (w.spocznikH && w.spocznikH !== 'brak') {
                spocznikHFound = w.spocznikH;
            }

            // Agresja
            if (w.agresjaChemiczna && w.agresjaChemiczna !== 'brak' && !detectedPozostale.includes(w.agresjaChemiczna)) {
                detectedPozostale.push(w.agresjaChemiczna);
            }
            if (w.agresjaMrozowa && w.agresjaMrozowa !== 'brak' && !detectedPozostale.includes(w.agresjaMrozowa)) {
                detectedPozostale.push(w.agresjaMrozowa);
            }
        });
        
        if (hasNierdzewna) detectedStopnie = 'Drabinka nierdzewna';
        else if (hasDrabinka) detectedStopnie = 'Drabinka';
        else if (hasBrak) detectedStopnie = 'Brak';
        
        if (hasZelbet) detectedRodzajStudni = 'Żelbet';
        else if (hasBetonStudnia) detectedRodzajStudni = 'Beton';
        
        if (hasPrecoTop) detectedKineta = 'PrecoTop';
        else if (hasPreco) detectedKineta = 'Preco';
        else if (hasBetonKineta) detectedKineta = 'Beton';
        
        if (spocznikHFound) detectedWysokoscSpocznika = spocznikHFound;
    }
    if (rodzajStopniInput) rodzajStopniInput.value = detectedStopnie;
    if (rodzajStudniInput) rodzajStudniInput.value = detectedRodzajStudni;
    if (uszczelkaStudniInput) uszczelkaStudniInput.value = 'Brak';
    if (kinetaInput) kinetaInput.value = detectedKineta;
    if (wysokoscSpocznikaInput) wysokoscSpocznikaInput.value = detectedWysokoscSpocznika;
    if (usytuowanieInput) usytuowanieInput.value = 'Linia dolna';
    if (kaskadaInput) kaskadaInput.value = 'Nie dotyczy';
    if (kaskadaUwagiInput) kaskadaUwagiInput.value = '';
    if (slepaKinetaInput) slepaKinetaInput.value = 'Nie dotyczy';
    if (slepaKinetaUwagiInput) slepaKinetaUwagiInput.value = '';
    if (redukcjaKinetyInput) redukcjaKinetyInput.value = 'Nie dotyczy';
    if (przejsciaTulejoweInput) przejsciaTulejoweInput.value = 'Nie dotyczy';
    if (przejsciaSzczelneInput) przejsciaSzczelneInput.value = 'Nie dotyczy';
    if (wlasciwosciBetonuInput) wlasciwosciBetonuInput.value = 'C40/50';
    if (pozostaleWlasciwosciInput) pozostaleWlasciwosciInput.value = detectedPozostale ? detectedPozostale.join(', ') : '';
    if (przejsciaZamowioneInput) przejsciaZamowioneInput.value = 'Nie dotyczy';
    if (dataZamowieniaInput) dataZamowieniaInput.value = '';
    
    let existingData = null;
    
    // Jeśli edytujemy zamówienie, wczytaj jego dane
    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order && orderEditMode.order.kartaBudowy) {
        existingData = orderEditMode.order.kartaBudowy;
    }

    if (!existingData && typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData && pendingOrderCreationData.kartaBudowyTemplate) {
        existingData = pendingOrderCreationData.kartaBudowyTemplate;
    }
    
    if (existingData) {
        if (emailFakturaInput) emailFakturaInput.value = existingData.emailFaktura || '';
        if (emailEfakturaInput) emailEfakturaInput.value = existingData.emailEfaktura || '';
        if (adresWysylkiInput) adresWysylkiInput.value = existingData.adresWysylki || '';
        if (warunkiPlatnosciInput && existingData.warunkiPlatnosci) warunkiPlatnosciInput.value = existingData.warunkiPlatnosci;
        if (iloscDniInput) iloscDniInput.value = existingData.iloscDni || '';
        if (ubezpieczenieInput) ubezpieczenieInput.value = existingData.ubezpieczenie || '';
        if (osobaKontaktInput) osobaKontaktInput.value = existingData.osobaKontakt || '';
        if (zabezpieczenieTransportuInput && existingData.zabezpieczenieTransportu) zabezpieczenieTransportuInput.value = existingData.zabezpieczenieTransportu;
        if (rodzajTransportuInput && existingData.rodzajTransportu) rodzajTransportuInput.value = existingData.rodzajTransportu;
        if (rodzajStopniInput && existingData.rodzajStopni) {
            rodzajStopniInput.value = existingData.rodzajStopni;
            if (existingData.rodzajStopni === 'Inne') {
                const wrap = document.getElementById('step4-rodzaj-stopni-inne-wrap');
                if (wrap) wrap.style.display = 'block';
                if (rodzajStopniInneInput) rodzajStopniInneInput.value = existingData.rodzajStopniInne || '';
            }
        }
        if (rodzajStudniInput && existingData.rodzajStudni) {
            rodzajStudniInput.value = existingData.rodzajStudni;
        }
        if (uszczelkaStudniInput && existingData.uszczelkaStudni) {
            uszczelkaStudniInput.value = existingData.uszczelkaStudni;
            if (existingData.uszczelkaStudni === 'Inne') {
                const wrap = document.getElementById('step4-uszczelka-studni-inne-wrap');
                if (wrap) wrap.style.display = 'block';
                if (uszczelkaStudniInneInput) uszczelkaStudniInneInput.value = existingData.uszczelkaStudniInne || '';
            }
        }
        if (kinetaInput && existingData.kineta) {
            kinetaInput.value = existingData.kineta;
            if (existingData.kineta === 'Inne') {
                const wrap = document.getElementById('step4-kineta-inne-wrap');
                if (wrap) wrap.style.display = 'block';
                if (kinetaInneInput) kinetaInneInput.value = existingData.kinetaInne || '';
            }
        }
        if (wysokoscSpocznikaInput && existingData.wysokoscSpocznika) {
            wysokoscSpocznikaInput.value = existingData.wysokoscSpocznika;
        }
        if (usytuowanieInput && existingData.usytuowanie) {
            usytuowanieInput.value = existingData.usytuowanie;
        }
        if (kaskadaInput && existingData.kaskada) {
            kaskadaInput.value = existingData.kaskada;
        }
        if (kaskadaUwagiInput && existingData.kaskadaUwagi) {
            kaskadaUwagiInput.value = existingData.kaskadaUwagi;
        }
        if (slepaKinetaInput && existingData.slepaKineta) {
            slepaKinetaInput.value = existingData.slepaKineta;
        }
        if (slepaKinetaUwagiInput && existingData.slepaKinetaUwagi) {
            slepaKinetaUwagiInput.value = existingData.slepaKinetaUwagi;
        }
        if (redukcjaKinetyInput && existingData.redukcjaKinety) {
            redukcjaKinetyInput.value = existingData.redukcjaKinety;
        }
        if (przejsciaTulejoweInput && existingData.przejsciaTulejowe) {
            przejsciaTulejoweInput.value = existingData.przejsciaTulejowe;
        }
        if (przejsciaSzczelneInput && existingData.przejsciaSzczelne) {
            przejsciaSzczelneInput.value = existingData.przejsciaSzczelne;
        }
        if (wlasciwosciBetonuInput && existingData.wlasciwosciBetonu) {
            wlasciwosciBetonuInput.value = existingData.wlasciwosciBetonu;
        }
        if (pozostaleWlasciwosciInput && existingData.pozostaleWlasciwosci) {
            pozostaleWlasciwosciInput.value = existingData.pozostaleWlasciwosci;
        }
        if (przejsciaZamowioneInput && existingData.przejsciaZamowione) {
            przejsciaZamowioneInput.value = existingData.przejsciaZamowione;
        }
        if (dataZamowieniaInput && existingData.dataZamowienia) {
            dataZamowieniaInput.value = existingData.dataZamowienia;
        }
        
        if (existingData.offerNumbers && existingData.offerNumbers.length > 0) {
            if (offerInput) offerInput.value = existingData.offerNumbers.join(', ');
        } else if (primaryOfferNumber) {
            if (offerInput) offerInput.value = primaryOfferNumber;
        }
    } else {
        if (primaryOfferNumber && offerInput) {
            offerInput.value = primaryOfferNumber;
        }
    }

    if (typeof renderKartaBudowyCopyOptions === 'function') {
        renderKartaBudowyCopyOptions();
    }

    // Renderuj szczegóły przejść szczelnych
    renderPrzejsciaDetailsTable(existingData ? existingData.przejsciaDetails : null);

    const uwagiEl = document.getElementById('step4-uwagi-ogolne');
    
    if (existingData) {
        if (uwagiEl) uwagiEl.value = existingData.uwagiOgolne || '';
    }
    
    if (uwagiEl && (!existingData || !existingData.uwagiOgolne)) {
        const selectedWells = pendingOrderCreationData ? pendingOrderCreationData.selectedWells : (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order ? orderEditMode.order.wells : []);
        if (selectedWells.length > 0 && typeof wellDiscounts !== 'undefined') {
            let lines = [];
            let precoDiscounts = new Set();
            let pehdDiscounts = new Set();
            let paintingLines = new Set();

            const uniqueDns = [...new Set(selectedWells.map(w => w.dn))];
            uniqueDns.forEach(dn => {
                const discountKey = dn === 'styczna' ? 'styczne' : dn;
                const d = wellDiscounts[discountKey];
                if (d) {
                    const den = parseFloat(d.dennica || 0);
                    const nad = parseFloat(d.nadbudowa || 0);
                    const pre = parseFloat(d.preco || 0);
                    const pehd = parseFloat(d.pehd || 0);
                    
                    let parts = [];
                    if (den > 0) parts.push(`Dennica: ${den.toFixed(2).replace('.', ',')}%`);
                    if (nad > 0) parts.push(`Nadbudowa: ${nad.toFixed(2).replace('.', ',')}%`);
                    
                    if (parts.length > 0) {
                        const label = dn === 'styczna' ? 'Styczne' : `DN${dn}`;
                        lines.push(`${label} ${parts.join(', ')}`);
                    }
                    if (pre > 0) precoDiscounts.add(pre);
                    if (pehd > 0) pehdDiscounts.add(pehd);
                }
            });
            
            selectedWells.forEach(w => {
                if (w.malowanieW && w.malowanieW !== 'brak') {
                    const price = parseFloat(w.malowanieWewCena || 0).toFixed(2).replace('.', ',');
                    paintingLines.add(`Malowanie wewnątrz (${w.malowanieW}): ${price} PLN/m²`);
                }
                if (w.malowanieZ && w.malowanieZ !== 'brak') {
                    const price = parseFloat(w.malowanieZewCena || 0).toFixed(2).replace('.', ',');
                    paintingLines.add(`Malowanie zewnątrz (${w.malowanieZ}): ${price} PLN/m²`);
                }
            });
            
            precoDiscounts.forEach(pre => lines.push(`Preco: ${pre.toFixed(2).replace('.', ',')}%`));
            pehdDiscounts.forEach(pehd => lines.push(`Wkładka PEHD: ${pehd.toFixed(2).replace('.', ',')}%`));
            paintingLines.forEach(pl => lines.push(pl));

            if (lines.length > 0) {
                uwagiEl.value = lines.join('\n');
            }
        }
    }
}

async function step4NextAction() {
    const kartaData = collectKartaBudowyDataStep4();

    // Scenariusz 1: Edycja istniejącego zamówienia — zapisz kartę i przejdź do kroku 5
    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) {
        orderEditMode.order.kartaBudowy = kartaData;
        goToWizardStep(5);
        return;
    }

    // Scenariusz 2: Tworzenie nowego zamówienia — finalizuj z zebranymi danymi
    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        const { offer, selectedWells } = pendingOrderCreationData;
        pendingOrderCreationData = null;
        await finalizeOrderFromOffer(offer, selectedWells, kartaData);
        return;
    }

    // Scenariusz 3: Fallback — po prostu przejdź do kroku 5
    goToWizardStep(5);
}

function getKartaBudowyCopyOrders() {
    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        return pendingOrderCreationData.kartaBudowyTemplateOrders || [];
    }
    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) {
        const offerId = orderEditMode.order.offerId || orderEditMode.order.offerStudnieId || editingOfferIdStudnie;
        return getOrdersForOffer(offerId).filter((order) => String(order.id) !== String(orderEditMode.order.id));
    }
    return [];
}

async function showKartaBudowyCopyPicker() {
    if (!ordersStudnie) {
        ordersStudnie = await loadOrdersStudnie();
    }

    renderKartaBudowyCopyOptions();

    const copySelect = document.getElementById('step4-copy-order-select');
    const orders = getKartaBudowyCopyOrders();

    if (!orders.some((order) => order.kartaBudowy)) {
        if (typeof showToast === 'function') {
            showToast('Brak zamówień z zapisaną Kartą Budowy dla tej oferty.', 'info');
        }
        return;
    }

    if (copySelect) copySelect.focus();
}

function renderKartaBudowyCopyOptions() {
    const copySelect = document.getElementById('step4-copy-order-select');
    const copyButton = document.getElementById('step4-copy-toggle-btn');
    const helpText = document.getElementById('step4-copy-order-help');
    const orders =
        typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData
            ? pendingOrderCreationData.kartaBudowyTemplateOrders || []
            : getKartaBudowyCopyOrders();

    if (!copySelect) return;

    if (!orders || orders.length === 0) {
        copySelect.innerHTML = '<option>Brak zamówień do kopiowania</option>';
        copySelect.disabled = true;
        if (copyButton) copyButton.disabled = true;
        if (helpText) helpText.textContent = 'Brak wcześniejszych zamówień powiązanych z tą ofertą.';
        return;
    }

    const optionsHtml = [`<option value="">Wybierz kartę budowy do skopiowania</option>`].concat(
        orders.map((order) => {
            const label = order.orderNumber ? order.orderNumber : order.id ? order.id.substring(0, 8) : 'Brak numeru';
            const suffix = order.kartaBudowy ? '' : ' (brak karty budowy)';
            return `<option value="${order.id}"${order.kartaBudowy ? '' : ' disabled'}>${label}${suffix}</option>`;
        })
    );

    copySelect.innerHTML = optionsHtml.join('');
    copySelect.disabled = false;
    if (copyButton) copyButton.disabled = !orders.some((order) => order.kartaBudowy);
    if (helpText) helpText.textContent = 'Wybierz istniejące zamówienie, aby skopiować jego dane Karty Budowy.';
}

function copyKartaBudowyFromOrder() {
    const copySelect = document.getElementById('step4-copy-order-select');
    if (!copySelect) return;

    const orderId = copySelect.value;
    if (!orderId) {
        if (typeof showToast === 'function') {
            showToast('Wybierz zamówienie do skopiowania.', 'error');
        }
        return;
    }

    const orders =
        typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData
            ? pendingOrderCreationData.kartaBudowyTemplateOrders || []
            : getKartaBudowyCopyOrders();
    const sourceOrder = orders.find((order) => String(order.id) === String(orderId));

    if (!sourceOrder) {
        if (typeof showToast === 'function') {
            showToast('Nie znaleziono wybranego zamówienia.', 'error');
        }
        return;
    }

    if (!sourceOrder.kartaBudowy) {
        if (typeof showToast === 'function') {
            showToast('Wybrane zamówienie nie ma zapisanych danych Karty Budowy.', 'error');
        }
        return;
    }

    applyCopiedKartaBudowyData(sourceOrder.kartaBudowy);

    if (typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        pendingOrderCreationData.kartaBudowyTemplate = collectKartaBudowyDataStep4();
    }

    if (typeof showToast === 'function') {
        showToast(`Skopiowano dane Karty Budowy z zamówienia ${sourceOrder.orderNumber || sourceOrder.id.substring(0, 8)}.`, 'success');
    }
}

function applyCopiedKartaBudowyData(sourceData) {
    if (!sourceData) return;

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null) return;
        el.value = value;
    };
    const setSelect = (id, value) => {
        const el = document.getElementById(id);
        if (!el || value === undefined || value === null || value === '') return;
        el.value = value;
    };

    setValue('step4-email-faktura', sourceData.emailFaktura || '');
    setValue('step4-email-efaktura', sourceData.emailEfaktura || '');
    if (Array.isArray(sourceData.offerNumbers) && sourceData.offerNumbers.length > 0) {
        setValue('step4-offer-nr-input', sourceData.offerNumbers.join(', '));
    }
    setValue('step4-adres-wysylki', sourceData.adresWysylki || '');
    setSelect('step4-warunki-platnosci', sourceData.warunkiPlatnosci);
    setValue('step4-ilosc-dni', sourceData.iloscDni || '');
    setValue('step4-ubezpieczenie', sourceData.ubezpieczenie || '');
    setValue('step4-osoba-kontakt', sourceData.osobaKontakt || '');
    setSelect('step4-zabezpieczenie-transportu', sourceData.zabezpieczenieTransportu);
    setSelect('step4-rodzaj-transportu', sourceData.rodzajTransportu);
    setSelect('step4-rodzaj-stopni', sourceData.rodzajStopni);
    setValue('step4-rodzaj-stopni-inne', sourceData.rodzajStopniInne || '');
    setSelect('step4-rodzaj-studni', sourceData.rodzajStudni);
    setSelect('step4-uszczelka-studni', sourceData.uszczelkaStudni);
    setValue('step4-uszczelka-studni-inne', sourceData.uszczelkaStudniInne || '');
    setSelect('step4-kineta', sourceData.kineta);
    setValue('step4-kineta-inne', sourceData.kinetaInne || '');
    setSelect('step4-wysokosc-spocznika', sourceData.wysokoscSpocznika);
    setSelect('step4-usytuowanie', sourceData.usytuowanie);
    setSelect('step4-kaskada', sourceData.kaskada);
    setValue('step4-kaskada-uwagi', sourceData.kaskadaUwagi || '');
    setSelect('step4-slepa-kineta', sourceData.slepaKineta);
    setValue('step4-slepa-kineta-uwagi', sourceData.slepaKinetaUwagi || '');
    setSelect('step4-redukcja-kinety', sourceData.redukcjaKinety);
    setSelect('step4-przejscia-tulejowe', sourceData.przejsciaTulejowe);
    setSelect('step4-przejscia-szczelne', sourceData.przejsciaSzczelne);
    setSelect('step4-wlasciwosci-betonu', sourceData.wlasciwosciBetonu);
    setValue('step4-pozostale-wlasciwosci', sourceData.pozostaleWlasciwosci || '');
    setSelect('step4-przejscia-zamowione', sourceData.przejsciaZamowione);
    setValue('step4-data-zamowienia', sourceData.dataZamowienia || '');
    setValue('step4-uwagi-ogolne', sourceData.uwagiOgolne || '');

    const toggleOther = (selectId, wrapId) => {
        const select = document.getElementById(selectId);
        const wrap = document.getElementById(wrapId);
        if (select && wrap) wrap.style.display = select.value === 'Inne' ? 'block' : 'none';
    };
    toggleOther('step4-rodzaj-stopni', 'step4-rodzaj-stopni-inne-wrap');
    toggleOther('step4-uszczelka-studni', 'step4-uszczelka-studni-inne-wrap');
    toggleOther('step4-kineta', 'step4-kineta-inne-wrap');

    mergeCopiedCustomPrzejscia(sourceData.przejsciaDetails);
}

function mergeCopiedCustomPrzejscia(sourceDetails) {
    if (!Array.isArray(sourceDetails)) return;

    _syncCustomRowsFromDOM();
    const copiedCustomRows = sourceDetails
        .filter((row) => row && row.source !== 'offer' && row.rodzaj)
        .map((row) => ({
            rodzaj: row.rodzaj || '',
            dnOd: row.dnOd ?? '',
            dnDo: row.dnDo ?? '',
            uwagi: row.uwagi || '',
            czyPrzejscie: row.czyPrzejscie || 'TAK',
            source: 'custom'
        }));

    copiedCustomRows.forEach((row) => {
        const exists = _customPrzejscieRows.some(
            (current) =>
                String(current.rodzaj || '') === String(row.rodzaj || '') &&
                String(current.dnOd || '') === String(row.dnOd || '') &&
                String(current.dnDo || '') === String(row.dnDo || '') &&
                String(current.uwagi || '') === String(row.uwagi || '')
        );
        if (!exists) _customPrzejscieRows.push(row);
    });

    renderPrzejsciaDetailsTable(null);
}

/** Zbiera dane z formularza Kroku 4 */
function collectKartaBudowyDataStep4() {
    const emailFaktura = (document.getElementById('step4-email-faktura')?.value || '').trim();
    const emailEfaktura = (document.getElementById('step4-email-efaktura')?.value || '').trim();
    const offerInput = document.getElementById('step4-offer-nr-input')?.value || '';
    const uwagiOgolne = (document.getElementById('step4-uwagi-ogolne')?.value || '').trim();
    const adresWysylki = (document.getElementById('step4-adres-wysylki')?.value || '').trim();
    const warunkiPlatnosci = (document.getElementById('step4-warunki-platnosci')?.value || 'przelew').trim();
    const iloscDni = (document.getElementById('step4-ilosc-dni')?.value || '').trim();
    const ubezpieczenie = (document.getElementById('step4-ubezpieczenie')?.value || '').trim();
    const osobaKontakt = (document.getElementById('step4-osoba-kontakt')?.value || '').trim();
    const zabezpieczenieTransportu = (document.getElementById('step4-zabezpieczenie-transportu')?.value || 'Nie dotyczy').trim();
    const rodzajTransportu = (document.getElementById('step4-rodzaj-transportu')?.value || 'Transport P.V.').trim();
    const rodzajStopni = (document.getElementById('step4-rodzaj-stopni')?.value || 'Nie dotyczy').trim();
    const rodzajStopniInne = (document.getElementById('step4-rodzaj-stopni-inne')?.value || '').trim();
    const rodzajStudni = (document.getElementById('step4-rodzaj-studni')?.value || 'Nie dotyczy').trim();
    const uszczelkaStudni = (document.getElementById('step4-uszczelka-studni')?.value || 'Brak').trim();
    const uszczelkaStudniInne = (document.getElementById('step4-uszczelka-studni-inne')?.value || '').trim();
    const kineta = (document.getElementById('step4-kineta')?.value || 'Brak').trim();
    const kinetaInne = (document.getElementById('step4-kineta-inne')?.value || '').trim();
    const wysokoscSpocznika = (document.getElementById('step4-wysokosc-spocznika')?.value || 'Nie dotyczy').trim();
    const usytuowanie = (document.getElementById('step4-usytuowanie')?.value || 'Linia dolna').trim();
    const kaskada = (document.getElementById('step4-kaskada')?.value || 'Nie dotyczy').trim();
    const kaskadaUwagi = (document.getElementById('step4-kaskada-uwagi')?.value || '').trim();
    const slepaKineta = (document.getElementById('step4-slepa-kineta')?.value || 'Nie dotyczy').trim();
    const slepaKinetaUwagi = (document.getElementById('step4-slepa-kineta-uwagi')?.value || '').trim();
    const redukcjaKinety = (document.getElementById('step4-redukcja-kinety')?.value || 'Nie dotyczy').trim();
    const przejsciaTulejowe = (document.getElementById('step4-przejscia-tulejowe')?.value || 'Nie dotyczy').trim();
    const przejsciaSzczelne = (document.getElementById('step4-przejscia-szczelne')?.value || 'Nie dotyczy').trim();
    const wlasciwosciBetonu = (document.getElementById('step4-wlasciwosci-betonu')?.value || 'C40/50').trim();
    const pozostaleWlasciwosci = (document.getElementById('step4-pozostale-wlasciwosci')?.value || '').trim();
    const wyliczonyTransport = (document.getElementById('step4-wyliczony-transport')?.value || '').trim();
    const przejsciaZamowione = (document.getElementById('step4-przejscia-zamowione')?.value || 'Nie dotyczy').trim();
    const dataZamowienia = (document.getElementById('step4-data-zamowienia')?.value || '').trim();
    
    const offerNumbers = offerInput.split(',').map(n => n.trim()).filter(n => n);
    
    return {
        emailFaktura,
        emailEfaktura,
        offerNumbers,
        adresWysylki,
        warunkiPlatnosci,
        iloscDni,
        ubezpieczenie,
        osobaKontakt,
        zabezpieczenieTransportu,
        rodzajTransportu,
        wyliczonyTransport,
        rodzajStopni,
        rodzajStopniInne,
        rodzajStudni,
        uszczelkaStudni,
        uszczelkaStudniInne,
        kineta,
        kinetaInne,
        wysokoscSpocznika,
        usytuowanie,
        kaskada,
        kaskadaUwagi,
        slepaKineta,
        slepaKinetaUwagi,
        redukcjaKinety,
        przejsciaTulejowe,
        przejsciaSzczelne,
        wlasciwosciBetonu,
        pozostaleWlasciwosci,
        przejsciaZamowione,
        dataZamowienia,
        przejsciaDetails: collectPrzejsciaDetailsFromTable(),
        uwagiOgolne: uwagiOgolne,
        createdAt: new Date().toISOString()
    };
}

function handlePrzejsciaZamowioneChange(selectElement) {
    const dataInput = document.getElementById('step4-data-zamowienia');
    if (!dataInput) return;
    
    if (selectElement.value === 'Tak') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dataInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

/* ===== SEKCJA PRZEJŚĆ SZCZELNYCH — SZCZEGÓŁY Z OFERTY ===== */

/** Tymczasowa tablica ręcznie dodanych wierszy niestandardowych przejść */
let _customPrzejscieRows = [];
let _offerPrzejscieRows = [];
let _przejsciaInitialized = false;

/**
 * Buduje listę typów przejść z cennika (studnieProducts).
 * Zwraca tablicę: [{ rodzaj, dnOd, dnDo, source: 'offer' }]
 */
function buildOfferPrzejsciaTypes() {
    const usedProductIds = new Set();
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (w.przejscia && Array.isArray(w.przejscia)) {
                w.przejscia.forEach((pr) => {
                    if (pr.productId) {
                        usedProductIds.add(pr.productId);
                    }
                });
            }
        });
    }

    const przejsciaProducts = studnieProducts.filter(
        (p) => p.componentType === 'przejscie' && p.active !== 0 && usedProductIds.has(p.id)
    );
    const typeMap = new Map();

    przejsciaProducts.forEach((p) => {
        const cat = p.category;
        if (!cat) return;
        let dn = 0;
        if (typeof p.dn === 'string' && p.dn.includes('/')) {
            dn = parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0;
        } else {
            dn = parseFloat(p.dn) || 0;
        }
        if (!typeMap.has(cat)) {
            typeMap.set(cat, { dnMin: dn, dnMax: dn });
        } else {
            const entry = typeMap.get(cat);
            if (dn < entry.dnMin) entry.dnMin = dn;
            if (dn > entry.dnMax) entry.dnMax = dn;
        }
    });

    const result = [];
    typeMap.forEach((val, key) => {
        result.push({
            rodzaj: key,
            dnOd: val.dnMin,
            dnDo: val.dnMax,
            ilosc: 1,
            uwagi: '',
            czyPrzejscie: 'TAK',
            source: 'offer'
        });
    });
    return result.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj));
}

/**
 * Renderuje tabelę szczegółów przejść szczelnych w Karcie budowy (Step 4).
 * @param {Array|null} existingData — zapisane dane z kartaBudowy.przejsciaDetails
 */
function renderPrzejsciaDetailsTable(existingData) {
    const container = document.getElementById('step4-przejscia-details-table');
    if (!container) return;

    if (!_przejsciaInitialized || existingData) {
        _offerPrzejscieRows = buildOfferPrzejsciaTypes();
        _customPrzejscieRows = [];
        if (existingData && Array.isArray(existingData)) {
            _customPrzejscieRows = existingData.filter((r) => r.source === 'custom');
            const savedOffers = existingData.filter((r) => r.source === 'offer');
            if (savedOffers.length > 0) {
                _offerPrzejscieRows = savedOffers;
            } else {
                _offerPrzejscieRows.forEach((ot) => {
                    const saved = existingData.find((s) => s.source === 'offer' && s.rodzaj === ot.rodzaj);
                    if (saved) {
                        ot.dnOd = saved.dnOd ?? ot.dnOd;
                        ot.dnDo = saved.dnDo ?? ot.dnDo;
                        ot.ilosc = saved.ilosc || 1;
                        ot.uwagi = saved.uwagi || '';
                        ot.czyPrzejscie = saved.czyPrzejscie || 'TAK';
                    }
                });
            }
        }
        _przejsciaInitialized = true;
    }

    // Przywróć dane jeśli istnieją
    const allRows = [..._offerPrzejscieRows, ..._customPrzejscieRows];

    if (allRows.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.72rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak przejść szczelnych w cenniku. Dodaj niestandardowe przejście przyciskiem powyżej.</div>';
        return;
    }

    let html = `<div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem;">
            <thead>
                <tr style="border-bottom:1px solid rgba(139,92,246,0.2);">
                    <th style="text-align:left; padding:0.4rem 0.5rem; color:#a78bfa; font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Rodzaj</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:#a78bfa; font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">DN od</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:#a78bfa; font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">DN do</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:#a78bfa; font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Ilość</th>
                    <th style="text-align:left; padding:0.4rem 0.5rem; color:#a78bfa; font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Uwagi</th>
                    <th style="text-align:center; padding:0.4rem 0.5rem; color:#a78bfa; font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">Czy przejście?</th>
                    <th style="width:36px;"></th>
                </tr>
            </thead>
            <tbody>`;

    // Wiersze z oferty
    _offerPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'offer');
    });

    // Wiersze niestandardowe
    _customPrzejscieRows.forEach((row, idx) => {
        html += buildPrzejscieRowHTML(row, idx, 'custom');
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

/**
 * Buduje HTML wiersza tabeli przejścia szczelnego.
 * @param {Object} row — dane wiersza
 * @param {number} idx — indeks w swojej grupie
 * @param {'offer'|'custom'} source — źródło wiersza
 */

/** Aktualizuje opcje DN w zależności od wybranego rodzaju przejścia */
function updatePrzejscieDnOptions(prefix, category) {
    const dns = new Set();
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach(p => {
            if (p.componentType === 'przejscie' && p.active !== 0 && (!category || category === 'Inne' || p.category === category)) {
                if (typeof p.dn === 'string' && p.dn.includes('/')) {
                    dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                } else if (p.dn) {
                    dns.add(parseFloat(p.dn) || 0);
                }
            }
        });
    }
    const dnOptions = Array.from(dns).filter(d => !isNaN(d) && d > 0).sort((a,b)=>a-b);
    
    ['dnod', 'dndo'].forEach(type => {
        const select = document.getElementById(`${prefix}-${type}-select`);
        const input = document.getElementById(`${prefix}-${type}`);
        if (!select || !input) return;
        
        const currVal = input.value;
        const forceInne = (category === 'Inne');
        const isCurrInne = forceInne || (currVal && !dnOptions.includes(parseFloat(currVal)));
        
        let html = `<option value="" ${!currVal && !forceInne ? 'selected' : ''}>—</option>`;
        html += dnOptions.map(d => `<option value="${d}" ${!forceInne && parseFloat(currVal) === d ? 'selected' : ''}>${d}</option>`).join('');
        html += `<option value="Inne" ${isCurrInne ? 'selected' : ''}>Inne</option>`;
        
        select.innerHTML = html;
        if (isCurrInne) {
            select.value = 'Inne';
            input.style.display = 'block';
        } else if (currVal && dnOptions.includes(parseFloat(currVal))) {
            select.value = parseFloat(currVal);
            input.style.display = 'none';
        } else {
            select.value = '';
            input.value = '';
            input.style.display = 'none';
        }
    });
}

function buildPrzejscieRowHTML(row, idx, source) {
    const prefix = `step4-psz-${source}-${idx}`;
    const rowBg = source === 'custom' ? 'rgba(245,158,11,0.04)' : 'transparent';
    const borderLeft = source === 'custom' ? '2px solid rgba(245,158,11,0.3)' : 'none';

    const cats = new Set();
    const dns = new Set();
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach(p => {
            if (p.componentType === 'przejscie' && p.active !== 0) {
                if (p.category) cats.add(p.category);
                if (!row.rodzaj || row.rodzaj === 'Inne' || p.category === row.rodzaj) {
                    if (typeof p.dn === 'string' && p.dn.includes('/')) {
                        dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                    } else if (p.dn) {
                        dns.add(parseFloat(p.dn) || 0);
                    }
                }
            }
        });
    }
    
    const catOptions = Array.from(cats).sort();
    const dnOptions = Array.from(dns).filter(d => !isNaN(d) && d > 0).sort((a,b)=>a-b);
    
    const isRodzajInne = row.rodzaj && !catOptions.includes(row.rodzaj);
    const isDnOdInne = row.dnOd && !dnOptions.includes(parseFloat(row.dnOd));
    const isDnDoInne = row.dnDo && !dnOptions.includes(parseFloat(row.dnDo));
    
    const warnScript = source === 'offer' ? "if(!this.dataset.warned) { appConfirm('Zmieniasz przejście przepisane z oferty!', { title: 'Ostrzeżenie', type: 'warning', okText: 'Rozumiem', cancelText: 'OK' }); this.dataset.warned = '1'; }" : "";

    const rodzajCell = `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-rodzaj-select" class="form-input" style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="${warnScript} document.getElementById('${prefix}-rodzaj').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('${prefix}-rodzaj').value = this.value; updatePrzejscieDnOptions('${prefix}', this.value);">
                <option value="" disabled ${!row.rodzaj ? 'selected' : ''}>Wybierz rodzaj...</option>
                ${catOptions.map(c => `<option value="${c}" ${row.rodzaj === c ? 'selected' : ''}>${c}</option>`).join('')}
                <option value="Inne" ${isRodzajInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="text" id="${prefix}-rodzaj" class="form-input" value="${(row.rodzaj || '').toString().replace(/"/g, '&quot;')}" placeholder="Wpisz własny rodzaj..." style="width:100%; font-size:0.78rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); display:${isRodzajInne ? 'block' : 'none'};" onchange="${warnScript}">
        </div>`;

    const dnOdCell = `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-dnod-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="${warnScript} document.getElementById('${prefix}-dnod').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('${prefix}-dnod').value = this.value;">
                <option value="" ${!row.dnOd ? 'selected' : ''}>—</option>
                ${dnOptions.map(d => `<option value="${d}" ${parseFloat(row.dnOd) === d ? 'selected' : ''}>${d}</option>`).join('')}
                <option value="Inne" ${isDnOdInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="${prefix}-dnod" class="form-input" value="${row.dnOd || ''}" placeholder="DN od" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:${isDnOdInne ? 'block' : 'none'};" onchange="${warnScript}">
        </div>`;

    const dnDoCell = `
        <div style="display:flex; gap:0.4rem; flex-direction:column;">
            <select id="${prefix}-dndo-select" class="form-input" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="${warnScript} document.getElementById('${prefix}-dndo').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('${prefix}-dndo').value = this.value;">
                <option value="" ${!row.dnDo ? 'selected' : ''}>—</option>
                ${dnOptions.map(d => `<option value="${d}" ${parseFloat(row.dnDo) === d ? 'selected' : ''}>${d}</option>`).join('')}
                <option value="Inne" ${isDnDoInne ? 'selected' : ''}>Inne</option>
            </select>
            <input type="number" id="${prefix}-dndo" class="form-input" value="${row.dnDo || ''}" placeholder="DN do" min="0" style="width:100%; min-width:72px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700; display:${isDnDoInne ? 'block' : 'none'};" onchange="${warnScript}">
        </div>`;

    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:${rowBg}; border-left:${borderLeft};" data-psz-source="${source}" data-psz-idx="${idx}">
        <td style="padding:0.4rem 0.5rem; white-space:nowrap; vertical-align:top;">${rodzajCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">${dnOdCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">${dnDoCell}</td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">
            <input type="number" id="${prefix}-ilosc" class="form-input" value="${row.ilosc || 1}" placeholder="1" min="1" style="width:56px; font-size:0.78rem; padding:0.3rem; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary); font-weight:700;" onchange="${warnScript}">
        </td>
        <td style="padding:0.4rem 0.5rem; vertical-align:top;">
            <input type="text" id="${prefix}-uwagi" class="form-input" value="${(row.uwagi || '').toString().replace(/"/g, '&quot;')}" placeholder="Uwagi..." style="width:100%; font-size:0.75rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-primary);" onchange="${warnScript}">
        </td>
        <td style="padding:0.4rem 0.3rem; text-align:center; vertical-align:top;">
            <select id="${prefix}-czy" class="form-input" style="width:80px; font-size:0.75rem; padding:0.3rem; text-align:center; font-weight:700; border-radius:4px; ${row.czyPrzejscie === 'TAK' ? 'color:#4ade80; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3);' : 'color:#f87171; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);'}" onchange="${warnScript} updatePrzejscieSelectStyle(this)">
                <option value="TAK"${row.czyPrzejscie === 'TAK' ? ' selected' : ''}>TAK</option>
                <option value="NIE"${row.czyPrzejscie === 'NIE' ? ' selected' : ''}>NIE</option>
            </select>
        </td>
        <td style="padding:0.4rem 0.2rem; text-align:center; vertical-align:top;">
            <button type="button" onclick="removePrzejscieRow('${source}', ${idx})" title="Usuń" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#f87171; width:26px; height:26px; border-radius:5px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s;" onmouseenter="this.style.background='rgba(239,68,68,0.25)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
        </td>
    </tr>`;
}

/** Aktualizuje styl selecta TAK/NIE po zmianie wartości */
function updatePrzejscieSelectStyle(selectEl) {
    if (selectEl.value === 'TAK') {
        selectEl.style.color = '#4ade80';
        selectEl.style.background = 'rgba(34,197,94,0.1)';
        selectEl.style.border = '1px solid rgba(34,197,94,0.3)';
    } else {
        selectEl.style.color = 'var(--danger-hover)';
        selectEl.style.background = 'rgba(239,68,68,0.1)';
        selectEl.style.border = '1px solid rgba(239,68,68,0.3)';
    }
}

/** Dodaje nowy wiersz niestandardowego przejścia */
function addCustomPrzejscieRow() {
    // Zbierz aktualny stan z DOM przed dodaniem nowego
    _syncCustomRowsFromDOM();

    _customPrzejscieRows.push({
        rodzaj: '',
        dnOd: '',
        dnDo: '',
        ilosc: 1,
        uwagi: '',
        czyPrzejscie: 'TAK',
        source: 'custom'
    });

    renderPrzejsciaDetailsTable(null);
    // Ustaw fokus na nowym wierszu
    setTimeout(() => {
        const newIdx = _customPrzejscieRows.length - 1;
        const rodzajInput = document.getElementById(`step4-psz-custom-${newIdx}-rodzaj`);
        if (rodzajInput) rodzajInput.focus();
    }, 50);
}

/** Usuwa wiersz niestandardowego przejścia */

/** Usuwa wiersz przejścia szczelnego */
async function removePrzejscieRow(source, idx) {
    _syncCustomRowsFromDOM();
    if (source === 'offer') {
        if (!(await appConfirm('Usuwasz przejście przepisane z oferty. Czy na pewno chcesz to zrobić?', { title: 'Potwierdzenie', type: 'warning' }))) return;
        _offerPrzejscieRows.splice(idx, 1);
    } else {
        _customPrzejscieRows.splice(idx, 1);
    }
    renderPrzejsciaDetailsTable(null);
}


/**
 * Synchronizuje dane wierszy niestandardowych z DOM do pamięci,
 * aby nie stracić wpisanych wartości przy dodawaniu/usuwaniu wiersza.
 */
function _syncCustomRowsFromDOM() {
    const rows = document.querySelectorAll('tr[data-psz-source]');
    rows.forEach(tr => {
        const source = tr.dataset.pszSource;
        const idx = parseInt(tr.dataset.pszIdx);
        const prefix = `step4-psz-${source}-${idx}`;
        
        const rodzajEl = document.getElementById(`${prefix}-rodzaj`);
        const dnOdEl = document.getElementById(`${prefix}-dnod`);
        const dnDoEl = document.getElementById(`${prefix}-dndo`);
        const iloscEl = document.getElementById(`${prefix}-ilosc`);
        const uwagiEl = document.getElementById(`${prefix}-uwagi`);
        const czyEl = document.getElementById(`${prefix}-czy`);
        
        if (!rodzajEl) return;
        
        const data = {
            rodzaj: rodzajEl.value.trim(),
            dnOd: dnOdEl.value ? parseFloat(dnOdEl.value) : '',
            dnDo: dnDoEl.value ? parseFloat(dnDoEl.value) : '',
            ilosc: iloscEl ? parseInt(iloscEl.value) || 1 : 1,
            uwagi: uwagiEl ? uwagiEl.value.trim() : '',
            czyPrzejscie: czyEl ? czyEl.value : 'TAK',
            source: source
        };
        
        if (source === 'custom') {
            _customPrzejscieRows[idx] = data;
        } else if (source === 'offer') {
            _offerPrzejscieRows[idx] = data;
        }
    });
}

/** Zbiera informacje o przejściach szczelnych z tabeli */
function collectPrzejsciaDetailsFromTable() {
    _syncCustomRowsFromDOM();
    const result = [];
    _offerPrzejscieRows.forEach(r => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd: r.dnOd !== '' ? parseFloat(r.dnOd) : 0,
                dnDo: r.dnDo !== '' ? parseFloat(r.dnDo) : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'offer'
            });
        }
    });
    _customPrzejscieRows.forEach(r => {
        if (r.rodzaj && r.rodzaj.trim() !== '') {
            result.push({
                rodzaj: r.rodzaj.trim(),
                dnOd: r.dnOd !== '' ? parseFloat(r.dnOd) : 0,
                dnDo: r.dnDo !== '' ? parseFloat(r.dnDo) : 0,
                ilosc: r.ilosc || 1,
                uwagi: r.uwagi || '',
                czyPrzejscie: r.czyPrzejscie || 'TAK',
                source: 'custom'
            });
        }
    });
    return result;
}

/** Druga część tworzenia zamówienia wywoływana z kroku 4 */
async function finalizeOrderFromOffer(offer, selectedWells, kartaBudowyData) {
    // Określ przypisanego użytkownika dla numeracji zamówienia — domyślnie opiekun oferty
    let assignedUserId = offer.userId || (currentUser ? currentUser.id : null);
    let assignedUserName =
        offer.userName ||
        (currentUser
            ? currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username
            : '');

    // Jeśli pro lub admin — zapytaj, któremu użytkownikowi przypisać zamówienie
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')) {
        try {
            const usersResp = await fetch('/api/users-for-assignment', { headers: authHeaders() });
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
            console.error('Błąd pobierania użytkowników:', e);
        }
    }

    // Pobierz numer zamówienia z serwera
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
    } catch (e) {
        showToast('Błąd połączenia przy generowaniu numeru zamówienia', 'error');
        return;
    }

    // Przelicz sumy tylko dla wybranych studni korzystając z rabatów oferty
    const effectiveDiscounts = (offer && offer.wellDiscounts) ? structuredClone(offer.wellDiscounts) : {};

    // Utwórz zamówienie z WYBRANYCH studni — wykonaj głęboką kopię, zapisz oryginalną migawkę
    const selectedWellsCopy = structuredClone(selectedWells);
    // Upewnij się, że kineta jest zsynchronizowana w każdej studni przed zamrożeniem cen
    if (typeof syncKineta === 'function') {
        selectedWellsCopy.forEach((w) => syncKineta(w));
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
        clientAddress: offer.clientAddress,
        clientContact: offer.clientContact,
        investName: offer.investName,
        investAddress: offer.investAddress,
        investContractor: offer.investContractor,
        notes: offer.notes,
        wells: selectedWellsCopy,
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
        originalSnapshot: {
            wells: structuredClone(selectedWellsCopy),
            wellDiscounts: structuredClone(effectiveDiscounts)
        },
        transportKm: offer.transportKm,
        transportRate: offer.transportRate,
        kartaBudowy: kartaBudowyData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser ? currentUser.username : ''
    };
    
    // Tymczasowo nadpisz globalne rabaty, aby calcWellStats i freezeWellPrices ich użyły
    const originalGlobalDiscounts = typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts) : {};
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

    // Oblicz transport dla zamówienia (proporcjonalnie do wagi wybranych studni)
    let orderTransportCost = 0;
    const globalOfferWeight = offer.totalWeight || 0;
    const gKm = parseFloat(offer.transportKm) || 0;
    const gRate = parseFloat(offer.transportRate) || 0;
    const globalOfferTransport = (gKm > 0 && gRate > 0) ? Math.ceil(globalOfferWeight / 24000) * gKm * gRate : 0;
    if (globalOfferWeight > 0 && totalWeight > 0) {
        orderTransportCost = globalOfferTransport * (totalWeight / globalOfferWeight);
    }
    
    const finalOrderNetto = totalNetto + orderTransportCost;

    order.totalWeight = totalWeight;
    order.totalNetto = finalOrderNetto;
    order.originalTotalNetto = finalOrderNetto;
    order.totalBrutto = finalOrderNetto * 1.23;
    order.wellDiscounts = effectiveDiscounts;

    // Zamroź ceny studni w zamówieniu w momencie tworzenia (używając aktualnie ustawionych rabatów oferty)
    freezeWellPrices(order.wells);

    // Przywróć oryginalne rabaty globalne
    if (typeof wellDiscounts !== 'undefined') {
        window.wellDiscounts = originalGlobalDiscounts;
    }

    if (!ordersStudnie) ordersStudnie = [];
    ordersStudnie.push(order);
    await saveOrdersDataStudnie(ordersStudnie);

    // Zapisz ofertę (aby zachować powiązania)
    await saveOfferStudnie();
    renderSavedOffersStudnie();

    showToast(
        `<i data-lucide="package"></i> Zamówienie ${orderNumber} utworzone (${selectedWells.length} studni z oferty ${offer.number})`,
        'success'
    );

    // Pasywne uczenie — ORDER_CONFIRM = najsilniejszy sygnał (3× waga)
    if (typeof _sendAcceptanceTelemetry === 'function') {
        _sendAcceptanceTelemetry(selectedWellsCopy, 'ORDER_CONFIRM');
    }

    // Ustaw krok na 4.2 (Zamówienie) przed przekierowaniem
    currentWizardStep = 5;
    if (typeof updateWizardIndicator === 'function') updateWizardIndicator();

    // Otwórz zamówienie w tym samym oknie (używa głównego edytora studni w trybie zamówienia)
    window.location.href = 'studnie.html?order=' + order.id;
}

/** Zbiera indeksy zaznaczonych studni z checkboxów w podsumowaniu oferty */
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

function saveOrderStudnie() {
    if (!editingOfferIdStudnie) return;
    const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    if (!offer) return;
    const oId = normalizeId(offer.id);
    const order = ordersStudnie ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId) : null;
    if (!order) return;

    // Zamroź ceny wszystkich elementów przed zapisem
    freezeWellPrices(wells);

    // Zaktualizuj studnie zamówienia bieżącym stanem studni (ceny są już zamrożone)
    order.wells = structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Przelicz sumy
    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;
    order.totalNetto = totalNetto;
    order.totalBrutto = totalNetto * 1.23;

    saveOrdersDataStudnie(ordersStudnie);
    showToast('<i data-lucide="package"></i> Zamówienie zaktualizowane', 'success');
}

/** Zamraża bieżące ceny wszystkich elementów konfiguracji i przejść w każdej studni */
function freezeWellPrices(wellsArr) {
    (wellsArr || []).forEach((well) => {
        // Zamroź elementy konfiguracji (kręgi, dennice, konusy itp.)
        (well.config || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;
            item.frozenPrice = getItemAssessedPrice(well, p, true, item);
            item.frozenPriceBase = getItemAssessedPrice(well, p, false, item);
            item.frozenName = p.name;
        });

        // Zamroź ceny przejść
        let discNadbudowa = 0;
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        if (discountKey && wellDiscounts[discountKey]) {
            discNadbudowa = wellDiscounts[discountKey].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        const configMap = typeof buildConfigMap !== 'undefined' ? buildConfigMap(well, (id) => studnieProducts.find((pr) => pr.id === id), true) : [];

        (well.przejscia || []).forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            let drillingBasePrice = 0;
            let drillProdName = '';
            let drillProdDn = '';
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');

            if (!isInsitu && configMap.length > 0) {
                let rzDna = parseFloat(well.rzednaDna) || 0;
                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                let mmFromBottom = (pel - rzDna) * 1000;

                if (typeof findAssignedElement === 'function') {
                    const assigned = findAssignedElement(mmFromBottom, configMap);
                    if (assigned && assigned.entry && (assigned.entry.componentType === 'krag' || assigned.entry.componentType === 'krag_ot')) {
                        const trDn = parseInt(item.dn) || parseInt(p.dn) || 0;
                        if (trDn > 0) {
                            const drillingProducts = studnieProducts.filter(x => x.category === 'Wiercenie');
                            let bestDrill = null;
                            let bestDnDiff = Infinity;
                            drillingProducts.forEach(drill => {
                                let drillDn = parseInt(drill.dn);
                                if (isNaN(drillDn)) {
                                    const match = drill.id.match(/Wiercenie-(\d+)/i);
                                    if (match) drillDn = parseInt(match[1]);
                                }
                                if (!isNaN(drillDn) && drillDn >= trDn) {
                                    if (drillDn - trDn < bestDnDiff) {
                                        bestDnDiff = drillDn - trDn;
                                        bestDrill = drill;
                                    }
                                }
                            });
                            if (bestDrill) {
                                drillingBasePrice = bestDrill.price || 0;
                                drillProdName = bestDrill.name;
                                drillProdDn = bestDrill.dn || '';
                            }
                        }
                    }
                }
            }

            const transPriceBase = p.price || 0;
            const bP = transPriceBase + drillingBasePrice;
            item.frozenPrice = bP * mult;
            item.frozenPriceBase = bP;
            item.frozenName = p.name || p.category;
            item.frozenTransitionPrice = transPriceBase * mult;
            item.frozenDrillingPrice = drillingBasePrice * mult;
            item.frozenDrillingName = drillProdName;
            item.frozenDrillingDn = drillProdDn;
        });
    });
}

async function deleteOrderStudnie(orderId) {
    // Sprawdź, czy zamówienie ma zaakceptowane zlecenia produkcyjne
    const order = ordersStudnie ? ordersStudnie.find((o) => o.id === orderId) : null;
    if (order) {
        const acceptedPOs = (productionOrders || []).filter(
            (po) => po.offerId === order.offerId && po.status === 'accepted'
        );
        if (acceptedPOs.length > 0) {
            showToast(
                '<i data-lucide="x-circle"></i> Nie można usunąć zamówienia — zawiera zaakceptowane zlecenia produkcyjne. Najpierw cofnij ich akceptację.',
                'error'
            );
            return;
        }
    }

    if (
        !(await appConfirm('Czy na pewno usunąć to zamówienie?', {
            title: 'Usuwanie zamówienia',
            type: 'danger'
        }))
    )
        return;

    // Wywołanie API w celu fizycznego usunięcia zamówienia
    try {
        const res = await fetch(`/api/orders-studnie/${orderId}`, {
            method: 'DELETE',
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.error || 'Błąd usuwania zamówienia', 'error');
            return;
        }
    } catch (e) {
        console.error('Błąd usuwania zamówienia przez API:', e);
        showToast('Błąd połączenia z serwerem', 'error');
        return;
    }

    let affectedOfferId = null;
    if (order) {
        affectedOfferId = normalizeId(order.offerId);
    }
    if (ordersStudnie) {
        ordersStudnie = ordersStudnie.filter((o) => o.id !== orderId);
        saveOrdersDataStudnie(ordersStudnie);
    }
    renderSavedOffersStudnie();
    showToast('Zamówienie usunięte. Studnie odblokowane do ponownego zamówienia.', 'info');

    // Odśwież główną konfigurację, jeśli jest otwarta
    if (typeof renderWellConfig === 'function') renderWellConfig();

    // Jeśli usunięte zamówienie dotyczy aktualnie otwartej oferty w edytorze, odśwież widok
    if (affectedOfferId && editingOfferIdStudnie === affectedOfferId) {
        refreshAll();
    }

    // Odśwież listę UI globalnie
    if (window.pvSalesUI) {
        window.pvSalesUI.loadOrdersMap().then(() => window.pvSalesUI.filterLocalOffers());
    }
}

/** Porównaj bieżące studnie zamówienia z originalSnapshot, zwróć mapę zmian */
function getOrderChanges(order) {
    if (!order || !order.originalSnapshot) return {};
    const changes = {}; // { wellIndex: { type: 'modified'|'added'|'removed', fields: [...] } }

    // Normalizuj originalSnapshot przez migrację, aby uniknąć false positive
    const originalSnapshotData = order.originalSnapshot;
    const originalWells = Array.isArray(originalSnapshotData) ? originalSnapshotData : (originalSnapshotData.wells || []);
    
    const orig = structuredClone(originalWells);
    if (typeof migrateWellData === 'function') migrateWellData(orig);
    const curr = order.wells;

    const maxLen = Math.max(orig.length, curr.length);
    for (let i = 0; i < maxLen; i++) {
        if (i >= orig.length) {
            changes[i] = { type: 'added' };
            continue;
        }
        if (i >= curr.length) {
            changes[i] = { type: 'removed', name: orig[i].name };
            continue;
        }
        const o = orig[i],
            c = curr[i];
        const diffs = [];

        // Porównaj konfigurację (komponenty) - kolejność nie ma znaczenia, tylko productId i całkowita ilość
        const getConfigCounts = (conf) => {
            const counts = {};
            (conf || []).forEach((item) => {
                if (!item.productId) return;
                if (item.autoAdded) return; // Ignoruj komponenty dodane automatycznie przez system (uszczelki, kineta)
                counts[item.productId] = (counts[item.productId] || 0) + (parseInt(item.quantity, 10) || 1);
            });
            return counts;
        };
        const oCounts = getConfigCounts(o.config);
        const cCounts = getConfigCounts(c.config);

        // Porównaj obiekty według kluczy i wartości
        const oKeys = Object.keys(oCounts).sort();
        const cKeys = Object.keys(cCounts).sort();

        let configDiff = oKeys.length !== cKeys.length;
        if (!configDiff) {
            for (let k of oKeys) {
                if (oCounts[k] !== cCounts[k]) {
                    configDiff = true;
                    break;
                }
            }
        }
        if (configDiff) diffs.push('config');

        // Porównaj przejścia (ignorując kąt, wykonanie kąta, angleGony oraz oryginalną kolejność tablicy)
        const cleanPrzejscia = (arr) => {
            const mapped = (arr || []).map((p) => {
                let rz = p.rzednaWlaczenia;
                if (rz !== null && rz !== undefined && rz !== '') {
                    rz = parseFloat(rz).toFixed(3);
                }
                return JSON.stringify({
                    productId: p.productId,
                    rzednaWlaczenia: rz,
                    doplata: parseFloat(p.doplata) || 0, // Zmiana dopłaty przejścia = zmiana ceny studni
                    notes: p.notes || '' // Normalizuj undefined/null do '' aby uniknąć false positive
                });
            });
            return mapped.sort();
        };

        if (cleanPrzejscia(o.przejscia).join('|') !== cleanPrzejscia(c.przejscia).join('|')) {
            diffs.push('przejscia');
        }

        // Porównaj parametry
        const paramKeys = [
            'nadbudowa',
            'dennicaMaterial',
            'wkladkaDennica',
            'wkladkaNadbudowa',
            'wkladkaZwienczenie',
            'klasaBetonu',
            'agresjaChemiczna',
            'agresjaMrozowa',
            'malowanieW',
            'malowanieZ',
            'kineta',
            'redukcjaKinety',
            'stopnie',
            'spocznikH',
            'usytuowanie'
        ];
        paramKeys.forEach((key) => {
            if (String(o[key] || '') !== String(c[key] || '')) diffs.push(key);
        });

        const eqNum = (a, b) => {
            const n1 = parseFloat(a);
            const n2 = parseFloat(b);
            if (isNaN(n1) && isNaN(n2)) return true;
            return Math.abs((n1 || 0) - (n2 || 0)) < 0.001;
        };

        // Porównaj podstawowe pola i rzędne (normalizuj typy — string vs number)
        if (!eqNum(o.dn, c.dn)) diffs.push('dn');
        // Nazwa studni jest ignorowana - zmiana nazwy nie wpływa na cenę
        // if ((o.name || '') !== (c.name || '')) diffs.push('name');
        
        if (!eqNum(o.rzednaWlazu, c.rzednaWlazu)) diffs.push('rzednaWlazu');
        if (!eqNum(o.rzednaDna, c.rzednaDna)) diffs.push('rzednaDna');

        // Zmiana dopłaty studni = zmiana ceny (dopłata wpływa na cenę dennicy)
        if (!eqNum(o.doplata, c.doplata)) diffs.push('doplata');

        if (diffs.length > 0) {
            changes[i] = { type: 'modified', fields: diffs };
        }
    }
    return changes;
}

/** Sprawdź, czy bieżąca oferta ma aktywne zamówienie */
function getCurrentOfferOrder() {
    if (orderEditMode) return orderEditMode.order;
    if (!editingOfferIdStudnie) return null;
    return ordersStudnie
        ? ordersStudnie.find((o) => o.offerId === editingOfferIdStudnie) || null
        : null;
}

/** Wejdź w tryb edycji zamówienia — ładuje zamówienie do głównego edytora */
async function enterOrderEditMode(orderId) {
    try {
        console.log('[enterOrderEditMode] START orderId=', orderId);
        const res = await fetchWithTimeout(`/api/orders-studnie/${orderId}`, { headers: authHeaders() }, 15000);
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

        console.log(
            '[enterOrderEditMode] order loaded, wells count:',
            order.wells ? order.wells.length : 'NO WELLS'
        );

        orderEditMode = { orderId: order.id, order: order };
        editingOfferIdStudnie = order.offerId || null;
        window.isPreviewMode = false;

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        // Wczytaj studnie z zamówienia — upewnij się, że wells jest zawsze tablicą
        wells = Array.isArray(order.wells) ? structuredClone(order.wells) : [];
        migrateWellData(wells);

        // Załaduj zapisane rabaty z zamówienia (zabezpieczenie, jeśli zamówienie ma własne rabaty)
        if (order.wellDiscounts) {
            window.wellDiscounts = structuredClone(order.wellDiscounts);
        } else {
            // Jeśli stare zamówienie nie ma wellDiscounts, można zostawić obecne lub zresetować:
            // window.wellDiscounts = {}; 
        }

        // Dodatkowo upewnij się, że każda studnia ma tablice config i przejscia
        wells.forEach((w) => {
            if (!Array.isArray(w.config)) w.config = [];
            if (!Array.isArray(w.przejscia)) w.przejscia = [];
            if (typeof syncKineta === 'function') syncKineta(w);
        });

        console.log('[enterOrderEditMode] wells migrated, count:', wells.length);

        // Automatyczne odblokowanie widoku kategorii dla użytych przejść
        wells.forEach((w) => {
            if (w.przejscia) {
                w.przejscia.forEach((pr) => {
                    const prod = studnieProducts.find((p) => p.id === pr.productId);
                    if (prod && prod.category) {
                        visiblePrzejsciaTypes.add(prod.category);
                    }
                });
            }
        });

        wellCounter = wells.length;
        currentWellIndex = 0;

        // Wypełnij pola klienta/oferty
        document.getElementById('offer-number').value = order.number || '';
        document.getElementById('offer-date').value =
            order.date || new Date().toISOString().slice(0, 10);
        document.getElementById('client-name').value = order.clientName || '';
        document.getElementById('client-nip').value = order.clientNip || '';
        document.getElementById('client-address').value = order.clientAddress || '';
        document.getElementById('client-contact').value = order.clientContact || '';
        document.getElementById('invest-name').value = order.investName || '';
        document.getElementById('invest-address').value = order.investAddress || '';
        document.getElementById('invest-contractor').value = order.investContractor || '';

        console.log('[enterOrderEditMode] fields filled, calling skipWizardToStep3...');

        // Pomiń kreatora → przejdź bezpośrednio do kroku 5 (Zamówienie = 4.2)
        wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
        currentWizardStep = 5;
        document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
        const target = document.getElementById('wizard-step-3'); // Step 4.2 reuses step 3's UI panel
        if (target) target.classList.add('active');
        if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        if (typeof updateWizardSummaryBar === 'function') updateWizardSummaryBar();
        
        const layout = document.querySelector('.well-app-layout');
        if (layout) layout.classList.remove('intro-mode');

        showSection('builder');

        console.log('[enterOrderEditMode] calling refreshAll...');
        // Aktualizuj UI
        refreshAll();

        console.log('[enterOrderEditMode] calling renderOrderModeBanner...');
        renderOrderModeBanner();
        if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();

        // Aktualizuj tytuł strony
        document.title = `📦 Zamówienie: ${order.number || orderId}`;

        console.log('[enterOrderEditMode] DONE');
        showToast('<i data-lucide="package"></i> Zamówienie wczytane do edycji', 'success');
    } catch (err) {
        console.error('Błąd ładowania zamówienia:', err);
        console.error('Stack:', err.stack);
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
            <div style="position:fixed; top:2rem; left:50%; transform:translateX(-50%); background:rgba(15, 23, 42, 0.95); border:2px solid #fbbf24; color:#fbbf24; padding:0.8rem 2.5rem; border-radius:40px; z-index:99999; box-shadow:0 20px 40px rgba(0,0,0,0.6); font-weight:800; display:flex; align-items:center; gap:1.5rem; backdrop-filter:blur(10px);">
                <span style="font-size:1.2rem;"><i data-lucide="eye"></i>️ HISTORIA — TYLKO DO ODCZYTU</span>
                <button onclick="window.exitPreviewMode()" class="btn btn-sm" style="background:#fbbf24; color:#000; border:none; padding:0.4rem 1rem; border-radius:20px; font-weight:700;">ZAMKNIJ PODGLĄD</button>
            </div>
        `;
        document.body.appendChild(banner);
    }

    // Zablokuj edycje elementow drag & drop formularza studni
    document
        .querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar')
        .forEach((el) => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.7';
        });

    // Podmień funkcje zapisu by zablokować i pokazać toast
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
    window.location.reload(); // Najszybszy i najbezpieczniejszy powrót po przeglądaniu JSONów z historii
};

async function loadOrderSnapshot(rebuiltData, orderId) {
    try {
        const order = rebuiltData;
        orderEditMode = { orderId: orderId, order: order };
        editingOfferIdStudnie = order.offerId || null;

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);
        
        // Załaduj rabaty zamówienia dla poprawnego przeliczania cen w podglądzie
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
                            ? studnieProducts.find((p) => p.id === pr.productId)
                            : null;
                    if (prod && prod.category) visiblePrzejsciaTypes.add(prod.category);
                });
            }
        });

        wellCounter = wells.length > 0 ? wells.length : 1;
        currentWellIndex = 0;

        document.getElementById('offer-number').value = order.number || '';
        document.getElementById('offer-date').value =
            order.date || new Date().toISOString().slice(0, 10);
        document.getElementById('client-name').value = order.clientName || '';
        document.getElementById('client-nip').value = order.clientNip || '';
        document.getElementById('client-address').value = order.clientAddress || '';
        document.getElementById('client-contact').value = order.clientContact || '';
        document.getElementById('invest-name').value = order.investName || '';
        document.getElementById('invest-address').value = order.investAddress || '';
        document.getElementById('invest-contractor').value = order.investContractor || '';

        if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
        if (typeof showSection === 'function') showSection('builder');
        if (typeof refreshAll === 'function') refreshAll();

        renderOrderModeBanner();
        document.title = `👁️ PODGLĄD Zamówienia: ${order.number || orderId}`;

        window.applyPreviewLockUI();
    } catch (err) {
        window.isPreviewMode = false;
        console.error('Błąd ładowania podglądu zamówienia:', err);
        showToast('Błąd ładowania podglądu zamówienia', 'error');
    }
}
window.loadOrderSnapshot = loadOrderSnapshot;

function renderOrderModeBanner() {
    let banner = document.getElementById('order-mode-banner');
    if (!banner) {
        // Utwórz baner u góry środkowej kolumny
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        banner = document.createElement('div');
        banner.id = 'order-mode-banner';
        centerCol.insertBefore(banner, centerCol.firstChild);
    }

    const saveSidebarBtn = document.getElementById('btn-save-studnie-sidebar');
    const saveZamowienieSidebarBtn = document.getElementById('btn-save-zamowienie-sidebar');
    const zleceniaSidebarBtn = document.getElementById('btn-zlecenia-sidebar');

    if (!orderEditMode) {
        banner.style.display = 'none';
        if (saveSidebarBtn) saveSidebarBtn.style.display = 'flex';
        if (saveZamowienieSidebarBtn) saveZamowienieSidebarBtn.style.display = 'none';
        if (zleceniaSidebarBtn) zleceniaSidebarBtn.style.display = 'none';
        // Przywróć wskaźnik kreatora do kroku 3 (Oferta)
        if (typeof currentWizardStep !== 'undefined' && currentWizardStep === 5) {
            currentWizardStep = 3;
            if (typeof updateWizardIndicator === 'function') updateWizardIndicator();
        }
        return;
    }

    banner.style.display = '';
    if (saveSidebarBtn) saveSidebarBtn.style.display = 'none';
    if (saveZamowienieSidebarBtn) saveZamowienieSidebarBtn.style.display = 'flex';
    if (zleceniaSidebarBtn) zleceniaSidebarBtn.style.display = 'flex';

    const order = orderEditMode.order;
    // Oblicz zmiany w stosunku do bieżących studni
    const tempOrder = { ...order, wells: wells };
    const changes = getOrderChanges({ ...order, wells: wells });
    const changeCount = Object.keys(changes).length;
    const hasChanges = changeCount > 0;

    banner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.7rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
        background: ${hasChanges ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))' : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))'};
        border: 2px solid ${hasChanges ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'};
    `;

    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.3rem;"><i data-lucide="package"></i></span>
            <div>
                <div style="font-size:0.82rem; font-weight:800; color:${hasChanges ? '#f87171' : '#34d399'};">
                    TRYB ZAMÓWIENIA — ${order.number || ''}
                </div>
                <div style="font-size:0.65rem; color:var(--text-muted);">
                    ${hasChanges ? `<i data-lucide="alert-triangle"></i> ${changeCount} studni zmienionych od oryginału` : '<i data-lucide="check-circle-2"></i> Bez zmian od oryginału'}
                    • Utworzono: ${new Date(order.createdAt).toLocaleString('pl-PL')}
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
        </div>
    `;
}

async function saveCurrentOrder() {
    if (!orderEditMode) {
        showToast('Brak trybu zamówienia', 'error');
        return;
    }

    const order = orderEditMode.order;

    // Zamroź ceny wszystkich elementów przed zapisem
    freezeWellPrices(wells);

    // Zaktualizuj zamówienie bieżącymi studniami (ceny już zamrożone)
    order.wells = structuredClone(wells);
    if (typeof window.wellDiscounts !== 'undefined') {
        order.wellDiscounts = structuredClone(window.wellDiscounts);
    }
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0,
        totalWeight = 0;
    wells.forEach((well) => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;
    order.totalNetto = totalNetto;
    order.totalBrutto = totalNetto * 1.23;

    // Zapisz przez PATCH
    try {
        await fetch(`/api/orders-studnie/${order.id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({
                wells: order.wells,
                wellDiscounts: order.wellDiscounts,
                kartaBudowy: order.kartaBudowy,
                updatedAt: order.updatedAt,
                totalWeight: order.totalWeight,
                totalNetto: order.totalNetto,
                totalBrutto: order.totalBrutto
            })
        });
        showToast('<i data-lucide="package"></i> Zamówienie zapisane', 'success');
        renderOrderModeBanner();
    } catch (err) {
        console.error('Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}

window.createOrderFromOffer = createOrderFromOffer;
window.saveOrderStudnie = saveOrderStudnie;
window.saveCurrentOrder = saveCurrentOrder;
window.deleteOrderStudnie = deleteOrderStudnie;

/** Synchronizuje zmiany z ofertą lub zamówieniem w zależności od trybu edycji */
async function syncSourceData() {
    let synced = '';
    try {
        if (typeof orderEditMode !== 'undefined' && orderEditMode) {
            // Jesteśmy w trybie edycji zamówienia.
            // Zapisujemy TYLKO zamówienie. Zapisanie oferty w tym trybie usunęłoby studnie,
            // ponieważ globalna tablica 'wells' zawiera teraz tylko studnie z zamówienia.
            if (typeof window.saveCurrentOrder === 'function') {
                await window.saveCurrentOrder();
                synced += 'Zamówienie';
            }
        } else {
            // Jesteśmy w trybie edycji oferty
            if (typeof window.saveOfferStudnie === 'function') {
                const offerSaved = await window.saveOfferStudnie();
                if (offerSaved) synced += 'Oferta';
            }
        }
    } catch (err) {
        console.error('syncSourceData error:', err);
    }
    return synced;
}
window.syncSourceData = syncSourceData;

/* ===== ZLECENIA PRODUKCYJNE ===== */
let productionOrders = [];
let zleceniaElementsList = []; // [{wellIndex, elementIndex, well, product, configItem}]
let zleceniaSelectedIdx = -1;
let zleceniaActiveFilter = 'all'; // 'all' | 'saved' | 'accepted'

/** Zwraca status elementu: 'zaakceptowany', 'zapisany' lub 'otwarty' */
function getElementStatus(el) {
    const savedOrder = (productionOrders || []).find(
        (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
    );
    if (savedOrder && savedOrder.status === 'accepted') return 'accepted';
    if (savedOrder) return 'saved';
    return 'open';
}

/** Ustaw aktywny filtr dla listy elementów zleceń */
function setZleceniaFilter(filter) {
    zleceniaActiveFilter = filter;
    document.querySelectorAll('.zlecenia-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderZleceniaList();
}

async function loadProductionOrders() {
    try {
        const resp = await fetchWithTimeout('/api/orders-studnie/production', { headers: authHeaders() });
        if (resp.ok) {
            const json = await resp.json();
            productionOrders = json.data || [];
        }
    } catch (e) {
        console.error('loadProductionOrders error:', e);
    }
    return productionOrders;
}

async function saveProductionOrdersData(data) {
    const results = [];
    for (const po of data) {
        try {
            const res = await fetch('/api/orders-studnie/production', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(po)
            });
            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error || 'Server error');
            results.push(resData);
        } catch (e) {
            console.error('saveProductionOrdersData error:', e);
            throw e; // Rethrow to handle in caller
        }
    }
    return results;
}

function parseWysokoscGlebokosc(productName) {
    // Parsuje "H=450/300" z nazwy produktu, np. "Dennica DN1000 H=450/300"
    const m = productName && productName.match(/H\s*=\s*(\d+)\s*\/\s*(\d+)/i);
    if (m) return { wysokosc: parseInt(m[1]), glebokosc: parseInt(m[2]) };
    return { wysokosc: 0, glebokosc: 0 };
}

function getStudniaDIN(dn) {
    if ([1000, 1200].includes(dn)) return 'AT/2009-03-1733';
    if ([1500, 2000, 2500].includes(dn)) return 'PN-EN 1917:2004';
    return 'AT/2009-03-1733'; // default for krag_ot
}

function calcStopnieExecution(angle) {
    const a = parseFloat(angle) || 0;
    return a > 0 ? 360 - a : 0;
}

/**
 * Build a snapshot of etykieta elements from well config.
 * Przechowywane ze zleceniem produkcyjnym, aby rejestr mógł drukować etykiety bez kontekstu studnieProducts.
 */
function buildEtykietaElementsSnapshot(well) {
    const config = well.config || [];
    const findProduct = (id) =>
        typeof studnieProducts !== 'undefined' ? studnieProducts.find((p) => p.id === id) : null;
    const countMap = new Map();

    config.forEach((item) => {
        const productId = item.productId || item.id;
        const product = findProduct(productId);
        if (!product) return;
        if (product.componentType === 'kineta' || product.componentType === 'wlaz') return;

        if (countMap.has(product.id)) {
            countMap.get(product.id).count++;
        } else {
            countMap.set(product.id, {
                count: 1,
                indeks: product.id || '',
                nazwa: product.name || ''
            });
        }
    });

    // Dodaj uszczelkę, jeśli dotyczy
    if (typeof studnieProducts !== 'undefined') {
        const uszczelka = studnieProducts.find(
            (p) =>
                p.category === 'uszczelka' &&
                (String(p.dn) === String(well.dn) ||
                    p.name?.includes('DN ' + well.dn) ||
                    p.name?.includes('DN' + well.dn))
        );
        if (uszczelka && config.length > 1) {
            countMap.set('_seal_' + uszczelka.id, {
                count: config.length,
                indeks: uszczelka.id || '',
                nazwa: uszczelka.name || `USZCZELKI DO STUDNI DN ${well.dn}MM`
            });
        }
    }

    const items = [];
    countMap.forEach((val) =>
        items.push({ ilosc: val.count + ' szt.', indeks: val.indeks, nazwa: val.nazwa })
    );
    return items;
}

let wellsSnapshotBeforeZlecenia = null;

function openZleceniaProdukcyjne(targetWellId = null, targetElementIndex = null) {
    console.log('[openZleceniaProdukcyjne] Initializing modal...', {
        targetWellId,
        targetElementIndex,
        wellsCount: wells.length,
        productsCount: studnieProducts.length
    });

    if (wells.length === 0) {
        showToast('Najpierw dodaj studnie lub wczytaj ofertę/zamówienie!', 'error');
        return;
    }

    // TWORZYMY MIGAWKĘ STANU STUDNI
    wellsSnapshotBeforeZlecenia = structuredClone(wells);

    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.add('active');

    // PRZENIESIENIE GŁÓWNEGO DIAGRAMU SVG DO MODALA
    const zwp = document.querySelector('.zlecenia-left');
    const dz = document.getElementById('drop-zone-diagram');
    if (zwp && dz) {
        zwp.innerHTML = ''; // wyczyść oryginalny kontener podglądu
        zwp.appendChild(dz);
        dz.style.flex = '1';
        dz.style.border = 'none'; // usuń obramowanie zewnętrzne, jeśli istnieje
        dz.style.background = 'transparent';
        dz.style.padding = '0.8rem 1.2rem'; // Dopasuj do dopełnienia bocznego modala
    }

    buildZleceniaWellList();

    // Automatycznie wybierz element docelowy, jeśli został podany, w przeciwnym razie pierwszy element
    if (zleceniaElementsList.length > 0) {
        let idxToSelect = 0;
        let foundIdx = -1;

        if (targetWellId) {
            foundIdx = zleceniaElementsList.findIndex(
                (el) =>
                    String(el.well.id) === String(targetWellId) &&
                    String(el.elementIndex) === String(targetElementIndex)
            );
            if (foundIdx === -1) {
                foundIdx = zleceniaElementsList.findIndex(
                    (el) => String(el.well.id) === String(targetWellId)
                );
            }
        } else if (targetElementIndex !== null) {
            foundIdx = zleceniaElementsList.findIndex(
                (el) => String(el.elementIndex) === String(targetElementIndex)
            );
        }

        if (foundIdx !== -1) {
            idxToSelect = foundIdx;
        }

        selectZleceniaElement(idxToSelect);
    }
}

async function closeZleceniaModal() {
    let savedNow = false;
    // Zapytaj użytkownika czy zapisać zmiany przed zamknięciem
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        const shouldSave = await appConfirm('Czy zapisać zmiany przed zamknięciem?', {
            title: 'Zamknięcie zlecenia',
            type: 'warning',
            okText: '<i data-lucide="save"></i> Zapisz i zamknij',
            cancelText: 'Zamknij bez zapisu'
        });
        if (shouldSave) {
            await saveProductionOrder();
            savedNow = true;
        }
    }

    // Jeśli użytkownik zrezygnował z zapisu, przywracamy stan studni sprzed otwarcia modalu
    if (!savedNow && wellsSnapshotBeforeZlecenia) {
        wells.length = 0;
        wells.push(...structuredClone(wellsSnapshotBeforeZlecenia));
        
        if (typeof renderWellsList === 'function') renderWellsList();
        if (typeof updateSummary === 'function') updateSummary();
        if (typeof refreshAll === 'function') refreshAll();
    }
    
    wellsSnapshotBeforeZlecenia = null;

    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.remove('active');

    // PRZYWRÓĆ GŁÓWNY DIAGRAM SVG DO GŁÓWNEGO UKŁADU
    const mainLayout = document.querySelector('.well-app-layout');
    const dz = document.getElementById('drop-zone-diagram');
    if (mainLayout && dz) {
        dz.style.flex = '';
        dz.style.border = '';
        dz.style.background = '';
        dz.style.padding = ''; // Resetuj dopełnienie inline
        mainLayout.insertBefore(dz, mainLayout.firstChild);
    }
}

function buildZleceniaWellList() {
    console.log('[buildZleceniaWellList] Building list from', wells.length, 'wells');
    zleceniaElementsList = [];
    wells.forEach((well, wIdx) => {
        if (!well.config) return;
        for (let eIdx = well.config.length - 1; eIdx >= 0; eIdx--) {
            const item = well.config[eIdx];
            let p = studnieProducts.find((pr) => pr.id === item.productId);

            // Zabezpieczenie na wypadek brakujących produktów na różnych serwerach
            if (!p && item.productId) {
                console.warn(
                    `[buildZleceniaWellList] Produkt o ID ${item.productId} nie został znaleziony w bazie! Próbuję dopasować po nazwie...`
                );
                // Jeśli jest zapisane w trybie zamówienia, być może mamy zapisany tymczasowy produkt?
                // Na razie utwórzmy fikcyjny obiekt produktu, aby UI się nie zepsuło
                p = {
                    id: item.productId,
                    name: 'Produkt nieznany (ID: ' + item.productId + ')',
                    componentType: 'dennica',
                    height: 0
                };
            }

            if (!p) continue;

            const realBaseIdx = findRealBaseIndex(well);
            const isBaseOfTangential = well.dn === 'styczna' && eIdx === realBaseIdx;

            if (
                p.componentType === 'dennica' ||
                p.componentType === 'krag_ot' ||
                isBaseOfTangential
            ) {
                zleceniaElementsList.push({
                    wellIndex: wIdx,
                    elementIndex: eIdx,
                    well: well,
                    product: p,
                    configItem: item
                });
            }
        }
    });

    console.log('[buildZleceniaWellList] Done. Elements found:', zleceniaElementsList.length);
    renderZleceniaList();
}

/** Pomocnik do znalezienia ostatniego fizycznego elementu (ignorując uszczelki) dla sprawdzenia studni stycznej */
function findRealBaseIndex(well) {
    if (!well || !well.config) return -1;
    for (let i = well.config.length - 1; i >= 0; i--) {
        const item = well.config[i];
        const tmpP = studnieProducts.find((pr) => pr.id === item.productId);
        if (tmpP && tmpP.componentType !== 'uszczelka') {
            return i;
        }
    }
    return -1;
}

function renderZleceniaList() {
    const container = document.getElementById('zlecenia-elements-list');
    const countEl = document.getElementById('zlecenia-el-count');
    if (!container) return;

    const search = (document.getElementById('zlecenia-search')?.value || '').toLowerCase();

    const groupedElements = {};
    let visibleCount = 0;

    // Buduj filtrowaną i posortowaną listę elementów
    const statusPriority = { accepted: 0, saved: 1, open: 2 };
    const itemsWithStatus = zleceniaElementsList.map((el, i) => ({
        el,
        index: i,
        status: getElementStatus(el)
    }));

    // Sortuj według priorytetu statusu (najpierw zaakceptowane, potem zapisane, na końcu otwarte)
    itemsWithStatus.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

    itemsWithStatus.forEach((item) => {
        const el = item.el;
        const savedPO = (productionOrders || []).find(
            (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
        );
        const poNum =
            savedPO && savedPO.productionOrderNumber
                ? savedPO.productionOrderNumber.toLowerCase()
                : '';
        const matchesSearch =
            !search ||
            el.product.name.toLowerCase().includes(search) ||
            el.well.name.toLowerCase().includes(search) ||
            ('dn' + el.well.dn).toLowerCase().includes(search) ||
            poNum.includes(search);
        if (!matchesSearch) return;

        // Zastosuj filtr statusu
        if (zleceniaActiveFilter === 'saved' && item.status === 'open') return;
        if (zleceniaActiveFilter === 'accepted' && item.status !== 'accepted') return;

        if (!groupedElements[el.wellIndex]) {
            groupedElements[el.wellIndex] = {
                wellName: el.well.name,
                wellDn: el.well.dn,
                elements: []
            };
        }
        groupedElements[el.wellIndex].elements.push({ el, index: item.index });
        visibleCount++;
    });

    let html = '';

    Object.keys(groupedElements).forEach((wIdx) => {
        const group = groupedElements[wIdx];

        // Nagłówek studni
        html += `<div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-bottom:1px solid var(--border-glass); border-top:1px solid var(--border-glass); position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:center; margin-top:-1px;">
            <div style="font-size:0.75rem; font-weight:800; color:#818cf8; text-transform:uppercase; letter-spacing:0.5px;"><i data-lucide="tag"></i> ${group.wellName}</div>
            <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); background:var(--bg-primary); padding:0.2rem 0.5rem; border-radius:12px; border:1px solid var(--border-glass);">${group.wellDn === 'styczna' ? 'Styczna' : 'DN' + group.wellDn}</div>
        </div>
        <div style="padding: 0.4rem;">`; // wrapper for elements in this well

        group.elements.forEach((item) => {
            const el = item.el;
            const i = item.index;
            const isSaved = (productionOrders || []).some(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const savedOrder = (productionOrders || []).find(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const isAccepted = savedOrder && savedOrder.status === 'accepted';
            const isActive = i === zleceniaSelectedIdx;

            const savedProdOrder = (productionOrders || []).find(
                (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
            );
            const prodOrderNum =
                savedProdOrder && savedProdOrder.productionOrderNumber
                    ? savedProdOrder.productionOrderNumber
                    : '';

            html += `<div class="zlecenia-el-item ${isActive ? 'active' : ''} ${isSaved ? 'saved' : ''} ${isAccepted ? 'accepted' : ''}" onclick="selectZleceniaElement(${i})" style="margin-bottom:0.3rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary);">${el.product.name}</div>
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        ${prodOrderNum ? `<div style="font-size:0.6rem; font-weight:800; color:#818cf8; background:rgba(129,140,248,0.1); padding:0.1rem 0.4rem; border-radius:4px; border:1px solid rgba(129,140,248,0.2);">${prodOrderNum}</div>` : ''}
                        ${isSaved && !isAccepted ? `<button onclick="event.stopPropagation(); deleteProductionOrder('${savedOrder.id}')" title="Usuń zlecenie" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:4px; cursor:pointer; padding:0.1rem 0.3rem; font-size:0.6rem; line-height:1; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.3)'" onmouseleave="this.style.background='rgba(239,68,68,0.1)'"><i data-lucide="trash-2"></i></button>` : ''}
                    </div>
                </div>
                ${isAccepted ? '<div style="font-size:0.55rem; color:#34d399; margin-top:0.2rem; font-weight:700;">Zaakceptowane — studnia zablokowana</div>' : isSaved ? '<div style="font-size:0.55rem; color:#fbbf24; margin-top:0.2rem; font-weight:700;">Wersja robocza</div>' : ''}
            </div>`;
        });

        html += `</div>`;
    });

    if (html === '') {
        let msg = 'Brak elementów (dennic / kręgów z otworem).';
        if (wells.length === 0) {
            msg = 'Najpierw dodaj studnię lub wczytaj zamówienie.';
        } else if (zleceniaElementsList.length === 0) {
            msg =
                'Brak elementów produkcyjnych (wymagana dennica lub krąg z otworem). Sprawdź czy produkty są w cenniku.';
        } else {
            msg = 'Brak elementów spełniających kryteria filtra.';
        }
        html = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.75rem;">${msg}</div>`;
    }

    // Usuń domyślne dopełnienie z kontenera, jeśli wprowadzamy własne opakowania
    container.style.padding = '0';
    container.innerHTML = html;

    if (countEl) countEl.textContent = visibleCount + ' elementów';
}

function filterZleceniaList() {
    renderZleceniaList();
}

function selectZleceniaElement(idx) {
    zleceniaSelectedIdx = idx;
    renderZleceniaList();
    const el = zleceniaElementsList[idx];
    if (!el) return;

    // Ustaw globalny kontekst studni na studnię z zamówienia
    if (currentWellIndex !== el.wellIndex) {
        currentWellIndex = el.wellIndex;
    }

    // Upewnij się, że diagram aktualizuje się z poprawnym indeksem i UI zostaje odświeżone
    renderWellDiagram();
    renderZleceniaWellConfig();

    populateZleceniaForm(el);
}

function renderZleceniaWellConfig() {
    const tbody = document.getElementById('zlecenia-well-config-body');
    if (!tbody) return;
    const well = getCurrentWell();

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.7rem;">Brak elementów</div>';
        return;
    }

    const typeBadge = {
        wlaz: { bg: '#374151', label: '<i data-lucide="circle-dot"></i>' },
        plyta_din: { bg: '#1e3a5f', label: '<i data-lucide="chevron-down" style="font-size:0.75rem;"></i>' },
        plyta_najazdowa: { bg: '#1e3a5f', label: '<i data-lucide="chevron-down" style="font-size:0.75rem;"></i>' },
        plyta_zamykajaca: { bg: '#1e3a5f', label: '<i data-lucide="chevron-down" style="font-size:0.75rem;"></i>' },
        pierscien_odciazajacy: { bg: '#1e3a5f', label: '<i data-lucide="settings"></i>' },
        konus: { bg: '#4c1d95', label: '<i data-lucide="diamond"></i>' },
        avr: { bg: '#44403c', label: '<i data-lucide="settings"></i>' },
        plyta_redukcyjna: { bg: '#4c1d95', label: '⬛' },
        krag: { bg: '#164e63', label: '<i data-lucide="square"></i>' },
        krag_ot: { bg: '#312e81', label: '<i data-lucide="square"></i>' },
        dennica: { bg: '#14532d', label: '<i data-lucide="square"></i>' },
        kineta: { bg: '#9d174d', label: '<i data-lucide="plug"></i>' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };
        const isLocked = isWellLocked();

        // Podświetl, jeśli jest to element aktualnie wybrany na liście Zleceń
        const isCurrentlyEdited =
            zleceniaSelectedIdx !== -1 &&
            zleceniaElementsList[zleceniaSelectedIdx] &&
            zleceniaElementsList[zleceniaSelectedIdx].elementIndex === index;

        html += `<div data-zl-idx="${index}" class="config-tile" draggable="${!isLocked}" ondragstart="handleZlCfgDragStart(event)" ondragover="handleZlCfgDragOver(event)" ondrop="handleZlCfgDrop(event)" ondragend="handleZlCfgDragEnd(event)" 
                      style="background:rgba(30,41,59,0.7); border:1px solid ${isCurrentlyEdited ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}; border-left:4px solid ${badge.bg}; border-radius:6px; padding:0.35rem 0.5rem; margin-bottom:0.25rem; cursor:${isLocked ? 'default' : 'grab'}; transition:all 0.15s; ${isCurrentlyEdited ? 'box-shadow: 0 0 10px rgba(99,102,241,0.2); border-color:#818cf8;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <div style="display:flex; flex-direction:column; gap:1px; align-items:center; background:rgba(0,0,0,0.2); padding:0.1rem; border-radius:3px;">
                  <button onclick="event.stopPropagation(); moveZleceniaComponent(${index}, -1)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0; display:${isLocked || index === 0 ? 'none' : 'block'};"><i data-lucide="chevron-up" style="font-size:0.75rem;"></i></button>
                  <span style="font-size:0.55rem; color:var(--text-primary); font-weight:700;">${index + 1}</span>
                  <button onclick="event.stopPropagation(); moveZleceniaComponent(${index}, 1)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0; display:${isLocked || index === well.config.length - 1 ? 'none' : 'block'};"><i data-lucide="chevron-down" style="font-size:0.75rem;"></i></button>
                </div>
                <div style="display:flex; flex-direction:column;">
                  <div style="font-weight:700; color:var(--text-primary); font-size:0.68rem; line-height:1.1;">${p.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}</div>
                  <div style="font-size:0.55rem; color:var(--text-muted);">${p.height ? 'H=' + p.height + 'mm' : '—'}</div>
                </div>
            </div>
            ${isCurrentlyEdited ? '<span style="font-size:0.6rem; color:#818cf8;"><i data-lucide="pencil"></i></span>' : ''}
          </div>
        </div>`;
    });

    tbody.innerHTML = html;
}

window.moveZleceniaComponent = function (index, dir) {
    if (isWellLocked()) return;
    const well = getCurrentWell();
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= well.config.length) return;

    // Wykonaj migawkę aktualnie edytowanego elementu, aby przywrócić fokus po zmianie kolejności
    const currentElObj =
        zleceniaSelectedIdx !== -1 ? zleceniaElementsList[zleceniaSelectedIdx].configItem : null;

    const temp = well.config[index];
    well.config[index] = well.config[newIdx];
    well.config[newIdx] = temp;

    well.configSource = 'MANUAL';
    well.autoLocked = true;

    // Po zmianie kolejności, jeśli edytowaliśmy element, musimy znaleźć, gdzie się przeniósł
    rebuildZleceniaListAndFocus(currentElObj);
    refreshZleceniaModal();
};

function rebuildZleceniaListAndFocus(targetObj) {
    // Wygeneruj ponownie dużą listę, ponieważ indeksy się zmieniły
    initializeZleceniaModal();

    if (targetObj) {
        // Znajdź, który indeks w NOWEJ zleceniaElementsList wskazuje na ten sam obiekt
        const newIdx = zleceniaElementsList.findIndex((el) => el.configItem === targetObj);
        if (newIdx !== -1) {
            zleceniaSelectedIdx = newIdx;
        }
    }
}

function refreshZleceniaModal() {
    renderZleceniaWellConfig();
    const well = getCurrentWell();
    const svg = document.getElementById('zlecenia-svg-preview');
    if (svg && well) {
        renderWellDiagram(svg, well);
    }
    renderZleceniaList(); // Odśwież również prawą listę (indeksy zaktualizowane)
}

/* Przeciągnij i upuść w modalu */
let draggedZlIdx = null;

window.handleZlCfgDragStart = function (e) {
    if (isWellLocked()) {
        e.preventDefault();
        return;
    }
    draggedZlIdx = parseInt(e.currentTarget.getAttribute('data-zl-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
};

window.handleZlCfgDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleZlCfgDrop = function (e) {
    e.preventDefault();
    const tile = e.target.closest('[data-zl-idx]');
    if (tile && draggedZlIdx !== null) {
        const dropIdx = parseInt(tile.getAttribute('data-zl-idx'));
        if (draggedZlIdx === dropIdx) return;

        const well = getCurrentWell();
        const currentElObj =
            zleceniaSelectedIdx !== -1
                ? zleceniaElementsList[zleceniaSelectedIdx].configItem
                : null;

        const item = well.config.splice(draggedZlIdx, 1)[0];
        well.config.splice(dropIdx, 0, item);

        well.configSource = 'MANUAL';
        well.autoLocked = true;

        rebuildZleceniaListAndFocus(currentElObj);
        refreshZleceniaModal();
    }
};

window.handleZlCfgDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    draggedZlIdx = null;
};

function renderZleceniaSvgPreview(well) {
    const svg = document.getElementById('zlecenia-svg-preview');
    const info = document.getElementById('zlecenia-well-info-mini');
    if (!svg) return;

    // Użyj PRAWDZIWEGO renderera diagramu studni z docelowym SVG
    renderWellDiagram(svg, well);
    renderZleceniaWellConfig();

    if (info) {
        const stats = calcWellStats(well);
        info.innerHTML = `<strong>${well.name}</strong> — DN${well.dn} — H: ${fmtInt(stats.height)}mm — ${fmtInt(stats.weight)}kg`;
    }
}

function populateZleceniaForm(el) {
    const { well, product, configItem, elementIndex, wellIndex } = el;
    const container = document.getElementById('zlecenia-form-content');
    if (!container) return;

    const parsed = parseWysokoscGlebokosc(product.name);

    // Niestandardowe obliczenia dla studni stycznych
    let displayDN = well.dn === 'styczna' ? 'Styczna' : 'DN' + well.dn;
    let displayGlebokosc = parsed.glebokosc || '—';
    let displayWysokosc = parsed.wysokosc || product.height || 0;
    let dnoKinetaVal = parsed.wysokosc - parsed.glebokosc;
    let displayDnoKineta = dnoKinetaVal > 0 ? dnoKinetaVal : '—';

    // Logika dennica na dennicy LUB tryb Psia buda
    let actualNextProduct = null;
    for (let i = elementIndex + 1; i < well.config.length; i++) {
        const _p = studnieProducts.find((p) => p.id === well.config[i].productId);
        if (_p && _p.componentType !== 'uszczelka') {
            actualNextProduct = _p;
            break;
        }
    }
    
    const shouldReduce = (product.componentType === 'dennica') && (
        (actualNextProduct && actualNextProduct.componentType === 'dennica') || 
        (well.psiaBuda && !actualNextProduct)
    );

    if (shouldReduce) {
        const reducedH = (product.height || 0) - 100;
        displayWysokosc = reducedH;
        displayGlebokosc = reducedH;
        displayDnoKineta = 0;
    }

    if (well.dn === 'styczna') {
        const dnMatch = (product.name || '').match(/DN\s*(\d+)/i);
        if (dnMatch) displayDN = `Styczna DN${dnMatch[1]}`;

        displayGlebokosc = product.height || '—';
        displayWysokosc = parsed.wysokosc || displayWysokosc;
        displayDnoKineta =
            parsed.wysokosc > 0 && parsed.glebokosc > 0 ? parsed.wysokosc - parsed.glebokosc : '—';
    }

    const din = getStudniaDIN(well.dn);
    const todayStr = new Date().toISOString().split('T')[0];
    const orderNumber = orderEditMode
        ? orderEditMode.order.number
        : document.getElementById('offer-number')?.value || '';

    // Pobierz nazwe uzytkownika
    const userName = currentUser
        ? ((currentUser.firstName || '') + ' ' + (currentUser.lastName || '')).trim() ||
          currentUser.username
        : '';
    // Pobierz firme z klienta oferty
    const clientName = document.getElementById('client-name')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';
    const investContractor = document.getElementById('invest-contractor')?.value || '';

    // Sprawdz istniejace zapisane zlecenie produkcyjne
    const existing = (productionOrders || []).find(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );
    const isAccepted = existing && existing.status === 'accepted';

    // Aktualizuj przyciski w nagłówku
    const btnAccept = document.getElementById('zl-btn-accept');
    const btnRevoke = document.getElementById('zl-btn-revoke');
    const btnDelete = document.getElementById('zl-btn-delete');
    const btnSave = document.getElementById('zl-btn-save');

    if (btnAccept) btnAccept.style.display = isAccepted ? 'none' : 'block';
    if (btnRevoke) btnRevoke.style.display = isAccepted ? 'block' : 'none';
    if (btnDelete) btnDelete.style.display = isAccepted ? 'none' : 'block';
    if (btnSave) btnSave.style.display = isAccepted ? 'none' : 'block';

    // Oblicz, który element otrzymuje które przejście, aby przefiltrować dla tego elementIndex
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const findProductFn = (id) => studnieProducts.find((pr) => pr.id === id);
    const configMap = buildConfigMap(well, findProductFn, true);

    // Filtruj przejścia przypisane do tego elementu
    const assignedPrzejscia = (well.przejscia || []).filter((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
        return assignedIndex === elementIndex;
    });
    const przejsciaCount = assignedPrzejscia.length;

    const stopnieOptions = [
        ['', 'Brak'],
        ['drabinka_a_stalowa', 'Drabinka Typ A/stalowa'],
        ['drabinka_a_szlachetna', 'Drabinka Typ A/stal szlachetna'],
        ['drabinka_b_stalowa', 'Drabinka Typ B/stalowa'],
        ['drabinka_b_szlachetna', 'Drabinka Typ B/stal szlachetna'],
        ['inne', 'Inne']
    ];

    let baseKatStopni = '';
    let baseRodzajStopni = '';
    const dennicaConfigIdx = well.config.findIndex(c => {
        const p = findProductFn(c.productId);
        return p && p.componentType === 'dennica';
    });
    
    if (dennicaConfigIdx >= 0 && elementIndex !== dennicaConfigIdx) {
        const dennicaPo = (productionOrders || []).find(po => po.wellId === well.id && po.elementIndex === dennicaConfigIdx);
        if (dennicaPo) {
            if (dennicaPo.katStopni) baseKatStopni = dennicaPo.katStopni;
            if (dennicaPo.rodzajStopni) baseRodzajStopni = dennicaPo.rodzajStopni;
        }
    }

    // Mapowanie ogólnych parametrów studni jeśli brak wartości dziedziczonej
    if (!baseRodzajStopni) {
        // Najpierw sprawdź czy użytkownik wybrał konkretny wariant (Typ A/B) w tym zleceniu
        if (well._selectedRodzajStopni) {
            baseRodzajStopni = well._selectedRodzajStopni;
        } else if (well.stopnie === 'drabinka') {
            baseRodzajStopni = 'drabinka_a_stalowa';
        } else if (well.stopnie === 'nierdzewna') {
            baseRodzajStopni = 'drabinka_a_szlachetna';
        } else if (well.stopnie === 'brak') {
            baseRodzajStopni = '';
        }
    }

    const katStopni = existing?.katStopni || baseKatStopni || '';
    const wykonanie = katStopni ? calcStopnieExecution(katStopni) : '';
    // Wybór stopni — wyprowadź bieżącą wartość z uwzględnieniem dziedziczenia
    const stopnieVal = existing?.rodzajStopni || baseRodzajStopni || '';

    // Wartości dla kafelków — kręgi wiercone domyślnie bez kinety/spocznika
    const isKragOt = product && product.componentType === 'krag_ot';
    const isAnyKrag = product && product.componentType && product.componentType.startsWith('krag');
    const shouldForceBrak = shouldReduce || isKragOt;
    const redKinetyVal =
        existing?.redukcjaKinety ?? (shouldForceBrak ? 'nie' : (well.redukcjaKinety ?? ''));
    const spocznikHVal = existing?.spocznikH ?? (shouldForceBrak ? 'brak' : (well.spocznikH ?? ''));
    const usytuowanieVal = existing?.usytuowanie ?? well.usytuowanie ?? '';
    const kinetaVal = existing?.kineta ?? (shouldForceBrak ? 'brak' : (well.kineta ?? ''));
    const klasaBetonuVal = existing?.klasaBetonu ?? well.klasaBetonu ?? '';

    // Szybkie kafelki dla kąta stopni
    const katOptions = ['90', '135', '180', '270'];

    const spocznikMatOptions = [
        ['brak', 'Brak'],
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton z GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'Preco Top'],
        ['unolith', 'UnoLith'],
        ['predl', 'Predl'],
        ['kamionka', 'Kamionka']
    ];

    const rodzajStudniOptions = [
        ['beton', 'Beton'],
        ['zelbet', 'Żelbet']
    ];

    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? (shouldForceBrak ? 'brak' : (well.spocznik ?? ''));

    let domyslnyRodzajStudni = '';
    if (product && product.componentType === 'dennica') {
        domyslnyRodzajStudni = well.dennicaMaterial === 'zelbetowa' ? 'zelbet' : 'beton';
    } else {
        domyslnyRodzajStudni = well.nadbudowa === 'zelbetowa' ? 'zelbet' : 'beton';
    }
    const rodzajStudniVal = existing?.rodzajStudni || domyslnyRodzajStudni;

    // Mapuj parametry studni na etykiety wyświetlania
    const kinetaOptions = [
        ['brak', 'Brak'],
        ['beton', 'Beton'],
        ['beton_gfk', 'Beton z GFK'],
        ['klinkier', 'Klinkier'],
        ['preco', 'Preco'],
        ['precotop', 'PrecoTop'],
        ['unolith', 'UnoLith'],
        ['predl', 'Predl'],
        ['kamionka', 'Kamionka']
    ];
    const spocznikOptions = [
        ['1/2', '1/2'],
        ['2/3', '2/3'],
        ['3/4', '3/4'],
        ['1/1', '1/1'],
        ['brak', 'Brak']
    ];
    const usytOptions = [
        ['linia_dolna', 'Linia dolna'],
        ['linia_gorna', 'Linia górna'],
        ['w_osi', 'W osi'],
        ['patrz_uwagi', 'Patrz uwagi']
    ];
    const redKinetyOptions = [
        ['tak', 'Tak'],
        ['nie', 'Nie']
    ];
    const klasaBetonuOptions = [
        ['C40/50', 'C40/50'],
        ['C40/50(HSR!!!!)', 'C40/50 HSR'],
        ['C45/55', 'C45/55'],
        ['C45/55(HSR!!!!)', 'C45/55 HSR'],
        ['C70/85', 'C70/85'],
        ['C70/80(HSR!!!!)', 'C70/80 HSR']
    ];

    // GENEROWANIE DOMYŚLNYCH UWAG NA PODSTAWIE PARAMETRÓW STUDNI (tylko dla nowych zleceń)
    let autoUwagi = [];

    // 1. Klasa betonu (usunięto z automatycznych uwag na życzenie)

    // 2. Agresja chemiczna
    if (well.agresjaChemiczna === 'XA2' || well.agresjaChemiczna === 'XA3')
        autoUwagi.push('Agresja chem. ' + well.agresjaChemiczna);

    // 3. Agresja mrozowa
    if (well.agresjaMrozowa === 'XF2' || well.agresjaMrozowa === 'XF3')
        autoUwagi.push('Agresja mroz. ' + well.agresjaMrozowa);

    // 4. Wkładka PEHD
    let wklUwagi = [];
    if (well.wkladkaDennica && well.wkladkaDennica !== 'brak') wklUwagi.push('Dennica ' + well.wkladkaDennica);
    if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak') wklUwagi.push('Nadbudowa ' + well.wkladkaNadbudowa);
    if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') wklUwagi.push('Zwieńczenie ' + well.wkladkaZwienczenie);
    if (wklUwagi.length > 0) autoUwagi.push('PEHD: ' + wklUwagi.join(', '));

    // 5. Malowanie wewnętrzne
    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'cale') malWDesc = 'Całość';
        if (malWDesc) {
            autoUwagi.push(
                'Malowanie wew. ' + malWDesc + (well.powlokaNameW ? ' ' + well.powlokaNameW : '')
            );
        }
    }

    // 6. Malowanie zewnętrzne
    if (well.malowanieZ === 'zewnatrz') {
        autoUwagi.push(
            'Malowanie zew. Zewnątrz' + (well.powlokaNameZ ? ' ' + well.powlokaNameZ : '')
        );
    }

    // 7. Studnia styczna
    if (well.dn === 'styczna') autoUwagi.push('STYCZNA');

    // 8. Klasa nośności korpusu
    if (well.klasaNosnosci_korpus === 'E600' || well.klasaNosnosci_korpus === 'F900') {
        autoUwagi.push('Kl. nośn. ' + well.klasaNosnosci_korpus);
    }

    // 9. Psia buda / Krąg na formie
    if (well.psiaBuda && !actualNextProduct) {
        autoUwagi.push('UWAGA ! PSIA BUDA');
    }
    if (product.componentType === 'dennica' && actualNextProduct && actualNextProduct.componentType === 'dennica') {
        autoUwagi.push('UWAGA ! KRĄG NA FORMIE STUDNI');
    }

    const defaultUwagiStr = autoUwagi.join(', ');
    const finalUwagi = existing?.uwagi !== undefined ? existing.uwagi : defaultUwagiStr;

    let bannerHtml = '';
    if (isAccepted) {
        bannerHtml = `
            <div style="background:rgba(239,68,68,0.15); border:2px solid rgba(239,68,68,0.4); border-radius:10px; padding:0.8rem 1rem; display:flex; align-items:center; gap:0.8rem; margin-bottom:0.5rem;">
                <span style="font-size:1.5rem;"><i data-lucide="lock"></i></span>
                <div style="flex:1;">
                    <div style="font-size:0.85rem; font-weight:800; color:#f87171; text-transform:uppercase; letter-spacing:0.5px;">Zlecenie zaakceptowane</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">Edycja jest zablokowana. Aby wprowadzić zmiany, najpierw cofnij akceptację przyciskiem na górze.</div>
                </div>
            </div>
        `;
    }

    // Dynamiczne obliczanie błędów konfiguracji studni (jak w konfiguratorze)
    recalculateWellErrors(well);
    const liveErrors = well.configErrors || [];
    let errorsHtml = '';
    if (liveErrors.length > 0) {
        errorsHtml = `
            <div style="
                margin-bottom: 0.5rem;
                padding: 0.4rem 0.6rem;
                background: rgba(239, 68, 68, 0.08);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 6px;
                color: #ef4444;
                font-size: 0.75rem;
                font-weight: 600;
                line-height: 1.4;
            ">
                <i data-lucide="alert-triangle"></i> Błędy w konfiguracji studni:<br>
                ${liveErrors.map(e => `• ${e}`).join('<br>')}
            </div>
        `;
    }

    // Zachowaj stany widoczności przed nadpisaniem
    let przejsciaAppVisible = false;
    const existingPrzejsciaContainer = document.getElementById('zl-inline-przejscia-app-container');
    if (existingPrzejsciaContainer && existingPrzejsciaContainer.style.display !== 'none') {
        przejsciaAppVisible = true;
    }

    let daneZleceniaVisible = false;
    const existingDaneZlecenia = document.getElementById('zl-dane-zlecenia-container');
    if (existingDaneZlecenia && existingDaneZlecenia.style.display !== 'none') {
        daneZleceniaVisible = true;
    }

    let daneElementuVisible = true;
    const existingDaneElementu = document.getElementById('zl-dane-elementu-content');
    if (existingDaneElementu) {
        daneElementuVisible = existingDaneElementu.style.display !== 'none';
    }

    container.innerHTML = `
    ${bannerHtml}
    ${errorsHtml}
    <!-- Dane zlecenia -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm" onclick="const b=this.nextElementSibling; b.style.display=b.style.display==='none'?'grid':'none'; this.querySelector('.zl-toggle').innerHTML=b.style.display==='none'?'<i data-lucide=\\'chevron-down\\'></i>':'<i data-lucide=\\'chevron-up\\'></i>'; if(window.lucide) window.lucide.createIcons();" style="cursor:pointer; user-select:none; display:flex; justify-content:space-between; align-items:center;">
            <span><i data-lucide="clipboard-list"></i> Dane zlecenia <span style="margin-left:8px; color:#818cf8; font-weight:800;">${existing?.productionOrderNumber || '— nowy —'}</span></span>
            <span class="zl-toggle" style="font-size:0.75rem;">${daneZleceniaVisible ? '<i data-lucide="chevron-up"></i>' : '<i data-lucide="chevron-down"></i>'}</span>
        </div>
        <div id="zl-dane-zlecenia-container" style="display:${daneZleceniaVisible ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:0.5rem; padding:0.2rem 0;">
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Obiekt</label>
                <input type="text" id="zl-obiekt" class="form-input form-input-sm" value="${existing?.obiekt || investName}" placeholder="Nazwa obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Data</label>
                <input type="text" id="zl-data" class="form-input form-input-sm" value="${existing?.data || todayStr}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Adres</label>
                <input type="text" id="zl-adres" class="form-input form-input-sm" value="${existing?.adres || investAddress}" placeholder="Adres obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Nazwisko (przygotował)</label>
                <input type="text" id="zl-nazwisko" class="form-input form-input-sm" value="${existing?.nazwisko || userName}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Wykonawca</label>
                <input type="text" id="zl-wykonawca" class="form-input form-input-sm" value="${existing?.wykonawca || investContractor}" placeholder="Wykonawca...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm ui-text-sec">Data produkcji</label>
                <input type="date" id="zl-data-produkcji" class="form-input form-input-sm" value="${existing?.dataProdukcji || ''}">
            </div>
            <div class="form-group-sm" style="grid-column: 1 / -1; margin:0;">
                <label class="form-label-sm ui-text-sec">Fakturowane na</label>
                <input type="text" id="zl-fakturowane" class="form-input form-input-sm" value="${existing?.fakturowane || clientName}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
        </div>
    </div>

    <!-- Dane studni i Przejścia obok siebie -->
    <div id="zl-dane-elementu-grid" style="display:grid; grid-template-columns:${daneElementuVisible ? '230px' : '36px'} 1fr; gap:0.5rem; margin-bottom:0.5rem; transition:grid-template-columns 0.25s ease;">
        <div class="card card-compact" style="overflow:hidden; min-width:0; transition:all 0.25s ease; position:relative;">
            <!-- Nagłówek widoczny gdy ROZWINIĘTY -->
            <div id="zl-dane-elementu-header-full" class="card-title-sm" onclick="window.toggleDaneElementu()" style="cursor:pointer; user-select:none; display:${daneElementuVisible ? 'flex' : 'none'}; justify-content:space-between; align-items:center;">
                <span><i data-lucide="hard-hat"></i> Dane elementu</span>
                <span style="font-size:0.75rem;"><i data-lucide="chevron-left"></i></span>
            </div>
            <!-- Nagłówek widoczny gdy ZWINIĘTY (pionowy tekst) -->
            <div id="zl-dane-elementu-header-collapsed" onclick="window.toggleDaneElementu()" style="cursor:pointer; user-select:none; display:${daneElementuVisible ? 'none' : 'flex'}; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:0.5rem; padding:0.5rem 0;">
                <span style="font-size:0.75rem;"><i data-lucide="chevron-right"></i></span>
                <span style="writing-mode:vertical-lr; text-orientation:mixed; font-size:0.7rem; font-weight:700; color:var(--text-secondary); letter-spacing:1px; text-transform:uppercase;">Dane elementu</span>
            </div>
            <div id="zl-dane-elementu-content" style="display:${daneElementuVisible ? 'flex' : 'none'}; flex-direction:column; gap:0.5rem; font-size:0.75rem;">
                <!-- Numer Studni -->
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase; font-weight:600;">Numer studni</span>
                    <span style="font-weight:bold; color:#818cf8; font-size:0.85rem;">${well.name || ''}</span>
                </div>
                
                <!-- Lista poniżej -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.2rem; background:#0d1520; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border-glass);">
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Średnica</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayDN}</span>
                        <input type="hidden" id="zl-srednica" value="${displayDN}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Głębokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayGlebokosc}${typeof displayGlebokosc === 'number' ? ' mm' : ''}</span>
                        <input type="hidden" id="zl-glebokosc" value="${displayGlebokosc}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Wysokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayWysokosc}${typeof displayWysokosc === 'number' ? ' mm' : ''}</span>
                        <input type="hidden" id="zl-wysokosc" value="${displayWysokosc}">
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Gr. dna</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${displayDnoKineta}</span>
                        <input type="hidden" id="zl-dno-kineta" value="${displayDnoKineta}">
                    </div>
                </div>
                
                <!-- Rodzaj studni -->
                <div class="form-group-sm" style="margin-top:0.3rem;">
                    <label class="form-label-sm ui-text-sec">Rodzaj studni</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.3rem;" class="zl-param-group">
                        ${rodzajStudniOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.6rem; font-size:0.85rem; font-weight:800; letter-spacing:0.5px; border-radius:8px;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>

            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.5rem; min-width:0;">
            <div class="card card-compact" style="padding:0.5rem 0.6rem;">
                <div class="card-title-sm"
                    style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; margin-bottom:0; font-size:0.78rem; padding:0.15rem 0;"
                    onclick="window.toggleCard('zl-inline-przejscia-app-container', 'zl-przejscia-app-icon')">
                    <span><i data-lucide="plus"></i> Dodaj Przejście Szczelne</span>
                    <span id="zl-przejscia-app-icon" style="font-size:0.75rem;"><i data-lucide="chevron-up"></i></span>
                </div>
                <div id="zl-inline-przejscia-app-container" class="card-content" style="margin-top:0.5rem; display:block;">
                    <div id="zl-inline-przejscia-app"></div>
                </div>
            </div>

            <div class="card card-compact" style="display:flex; flex-direction:column; box-sizing:border-box; overflow-x:auto; padding:0.5rem 0.6rem; flex:1;">
                <div class="card-title-sm" style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <span><i data-lucide="link"></i> Lista przejść</span>
                    <span id="zl-przejscia-count" style="color:var(--text-muted); font-size:0.7rem;">(${przejsciaCount})</span>
                </div>
                <div id="zl-przejscia-list" style="flex:1; border-radius:var(--radius-sm); font-size:0.72rem; color:var(--text-secondary); display:flex; flex-direction:column; overflow-y:auto; overflow-x:auto; min-width:100%;">
                </div>
            </div>
        </div>
    </div>

    <!-- Uwagi (Pełna szerokość pod spodem) -->
    <div class="card card-compact" style="margin-bottom:0.5rem; display:flex; flex-direction:column;">
        <div class="card-title-sm"><i data-lucide="edit"></i> Uwagi</div>
        <div class="form-group-sm" style="flex:1; display:flex; flex-direction:column; margin-bottom:0;">
            <textarea id="zl-uwagi" class="form-textarea" placeholder="Uwagi do zlecenia..." style="flex:1; min-height:80px; resize:none;">${finalUwagi}</textarea>
        </div>
    </div>

    <!-- Parametry studni w dwóch kolumnach -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm"><i data-lucide="settings"></i> Parametry studni</div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; align-items:start;">
            <!-- Kolumna 1 -->
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm" ${isAnyKrag ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Redukcja kinety</label>
                    <div class="ui-row-gap zl-param-group">
                        ${redKinetyOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === redKinetyVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Studnia wd. DIN</label>
                    <div class="ui-row-gap zl-param-group">
                        <input type="text" id="zl-din" class="form-input form-input-sm" value="${dinVal}" style="width:100%; color:#818cf8; font-weight:700;">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Rodzaj stopni</label>
                    <div class="ui-row-gap zl-param-group">
                        ${stopnieOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === stopnieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-stopni" value="${stopnieVal}">
                </div>

                <div id="zl-stopnie-inne-wrap" style="display:${stopnieVal === 'inne' ? 'block' : 'none'};">
                    <div class="form-group-sm">
                        <label class="form-label-sm">Inne (opis)</label>
                        <input type="text" id="zl-stopnie-inne" class="form-input form-input-sm" value="${existing?.stopnieInne || ''}" placeholder="Opis...">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Ustalanie kąta stopni / Wykonanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem; align-items:center;" class="zl-param-group">
                        <input type="number" id="zl-kat-stopni" class="form-input form-input-sm" value="${katStopni}" placeholder="np. 90" min="0" max="360" onfocus="this.value=''" oninput="onZleceniaKatChange()" style="width:70px;">
                        <span style="font-size:1.2rem; color:var(--text-muted); margin: 0 4px;">→</span>
                        <input type="text" id="zl-wykonanie" class="form-input form-input-sm" value="${wykonanie ? wykonanie + '°' : ''}" readonly style="width:70px; color:#818cf8; font-weight:700; margin-right:5px; pointer-events:none;">
                        ${katOptions
                            .map(
                                (v) =>
                                    `<button type="button" class="param-tile ui-badge" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                            )
                            .join('')}
                    </div>
                </div>
            </div>

            <!-- Kolumna 2 -->
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Wysokość spocznika</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikHVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Usytuowanie</label>
                    <div class="ui-row-gap zl-param-group">
                        ${usytOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === usytuowanieVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
                </div>

                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Kineta</label>
                    <div class="ui-row-gap zl-param-group">
                        ${kinetaOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === kinetaVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-kineta" value="${kinetaVal}">
                </div>

                <div class="form-group-sm" ${isKragOt ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <label class="form-label-sm">Spocznik</label>
                    <div class="ui-row-gap zl-param-group">
                        ${spocznikMatOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === spocznikMatVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-spocznik', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik" value="${spocznikMatVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Klasa betonu</label>
                    <div class="ui-row-gap zl-param-group">
                        ${klasaBetonuOptions
                            .map(
                                ([v, l]) =>
                                    `<button type="button" class="param-tile ui-badge ${v === klasaBetonuVal ? 'active' : ''}" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                            )
                            .join('')}
                    </div>
                    <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
                </div>
            </div>
        </div>
    </div>
    `;

    // Wyłącz wszystkie pola/przyciski, jeśli zaakceptowano
    if (isAccepted) {
        setTimeout(() => {
            container.querySelectorAll('input, textarea, button').forEach((el) => {
                el.disabled = true;
                if (el.tagName === 'BUTTON' && el.classList.contains('param-tile')) {
                    el.style.opacity = '0.7';
                    el.style.cursor = 'not-allowed';
                }
            });
            const transitionsApp = document.getElementById('zl-inline-przejscia-app-container');
            if (transitionsApp) {
                transitionsApp.style.pointerEvents = 'none';
                transitionsApp.style.opacity = '0.6';
            }
        }, 10);
    }

    // Użyj pełnego interaktywnego renderowania przejść (tak samo jak w konfiguratorze)
    renderInlinePrzejsciaApp('zl-inline-przejscia-app');
    renderWellPrzejscia({
        containerId: 'zl-przejscia-list',
        countElId: 'zl-przejscia-count',
        filterElementIndex: elementIndex
    });

    // Renderowanie ikon Lucide dla nowo wstrzykniętych elementów HTML
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function selectZleceniaTile(btn, targetId, val) {
    const group = btn.closest('.zl-param-group');
    if (group) {
        group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
    }
    btn.classList.add('active');

    const input = document.getElementById(targetId);
    if (input) {
        input.value = val;
    }

    if (targetId === 'zl-rodzaj-stopni') {
        onZleceniaStopnieChange();
    }

    if (
        [
            'zl-rodzaj-studni',
            'zl-rodzaj-stopni',
            'zl-red-kinety',
            'zl-spocznik-h',
            'zl-usytuowanie',
            'zl-kineta',
            'zl-spocznik',
            'zl-klasa-betonu'
        ].includes(targetId)
    ) {
        if (typeof zleceniaSelectedIdx === 'number' && zleceniaElementsList) {
            const el = zleceniaElementsList[zleceniaSelectedIdx];
            if (el && el.well && el.product) {
                // Zachowaj tymczasowe uwagi z okienka przed jego przeładowaniem
                const tempUwagi = document.getElementById('zl-uwagi')
                    ? document.getElementById('zl-uwagi').value
                    : '';

                // Pobierz ewentualne zapisane zlecenie, aby również je zaktualizować na żywo
                const existing = productionOrders.find(
                    (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
                );

                if (targetId === 'zl-rodzaj-studni') {
                    // Ustaw odpowiednią globalną cechę studni w zależności od edytowanego elementu
                    if (el.product.componentType === 'dennica') {
                        el.well.dennicaMaterial = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    } else {
                        el.well.nadbudowa = val === 'zelbet' ? 'zelbetowa' : 'betonowa';
                    }
                    if (existing) existing.rodzajStudni = val;
                } else if (targetId === 'zl-red-kinety') {
                    el.well.redukcjaKinety = val;
                    if (existing) existing.redukcjaKinety = val;
                } else if (targetId === 'zl-spocznik-h') {
                    el.well.spocznikH = val;
                    if (existing) existing.spocznikH = val;
                } else if (targetId === 'zl-usytuowanie') {
                    el.well.usytuowanie = val;
                    if (existing) existing.usytuowanie = val;
                } else if (targetId === 'zl-kineta') {
                    el.well.kineta = val;
                    if (existing) existing.kineta = val;

                    // Automatyczne dopasowanie spocznika do kinety (jeśli ma ten sam materiał)
                    const syncValues = ['beton', 'beton_gfk', 'klinkier', 'preco', 'precotop', 'unolith', 'predl', 'kamionka', 'brak'];
                    if (syncValues.includes(val)) {
                        const spocznikInput = document.getElementById('zl-spocznik');
                        if (spocznikInput) {
                            const group = spocznikInput.closest('.form-group-sm');
                            if (group) {
                                const targetBtn = group.querySelector(`.param-tile[onclick*="'zl-spocznik', '${val}'"]`);
                                if (targetBtn && !targetBtn.classList.contains('active')) {
                                    targetBtn.click();
                                }
                            }
                        }
                    }
                } else if (targetId === 'zl-spocznik') {
                    el.well.spocznik = val;
                    if (existing) existing.spocznik = val;
                } else if (targetId === 'zl-klasa-betonu') {
                    el.well.klasaBetonu = val;
                    if (existing) existing.klasaBetonu = val;
                } else if (targetId === 'zl-rodzaj-stopni') {
                    // Mapowanie rodzaju stopni na parametr studni well.stopnie
                    // Typ A/B nie zmienia indeksu (oba to ten sam produkt)
                    // 'inne' nie zmienia indeksu — zostawia oryginalny wybór użytkownika
                    let newStopnie = null;
                    if (val === '' || val === 'brak') {
                        newStopnie = 'brak';
                        el.well._selectedRodzajStopni = '';
                    } else if (val.includes('szlachetna')) {
                        newStopnie = 'nierdzewna';
                        el.well._selectedRodzajStopni = val;
                    } else if (val.includes('stalowa')) {
                        newStopnie = 'drabinka';
                        el.well._selectedRodzajStopni = val;
                    } else if (val === 'inne') {
                        el.well._selectedRodzajStopni = val;
                    }
                    // 'inne' → newStopnie = null → brak zmiany indeksów

                    const stopnieIndexChanged = newStopnie !== null && newStopnie !== el.well.stopnie;
                    if (stopnieIndexChanged) {
                        el.well.stopnie = newStopnie;
                    }
                    if (existing) existing.rodzajStopni = val;

                    // Jeśli indeks się nie zmienił (przełączenie A↔B lub 'inne'),
                    // nie przeładowuj formularza — kafelki i hidden input już ustawione
                    if (!stopnieIndexChanged) {
                        return;
                    }
                }

                // Synchronizuj kafelki parametrów głównego ekranu
                if (typeof window.updateParamTilesUI === 'function') window.updateParamTilesUI();

                const oldWellIdx = el.wellIndex;
                const oldCat = el.product.category;
                const oldElementIndex = el.elementIndex;

                if (targetId === 'zl-rodzaj-studni' || targetId === 'zl-rodzaj-stopni') {
                    if (typeof window.updateAutoLockUI === 'function') window.updateAutoLockUI();

                    // Zaktualizowanie komponentów by dobrać odpowiednie indeksy produktów
                    // Dla rodzaju studni: Żelbet/Beton, dla stopni: -D/-N-D/-B
                    if (typeof window.updateConfigToMatchParams === 'function') {
                        window.updateConfigToMatchParams(el.well);
                    }
                }

                // 2. Pełne odświeżenie całego interfejsu (łącznie z 'Parametry tej studni' i cenami na bieżąco)
                if (typeof window.refreshAll === 'function') {
                    window.refreshAll();
                } else {
                    if (typeof window.renderWellConfig === 'function') window.renderWellConfig();
                    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
                    if (typeof window.updateSummary === 'function') window.updateSummary();
                    if (typeof window.renderWellParams === 'function') window.renderWellParams();
                }

                // 3. Przebudowa Listy elementów w Zleceniu, tak by zaktualizować wewnętrzne obiekty Ceny/Produktów
                if (typeof window.buildZleceniaWellList === 'function') {
                    window.buildZleceniaWellList();
                }

                // 4. Spróbujmy znaleźć przeliczony index elementu i go wybrać powtórnie
                let newTargetIdx = zleceniaElementsList.findIndex(
                    (e) => e.wellIndex === oldWellIdx && e.elementIndex === oldElementIndex
                );
                if (newTargetIdx === -1) {
                    newTargetIdx = zleceniaElementsList.findIndex(
                        (e) => e.wellIndex === oldWellIdx && e.product && e.product.category === oldCat
                    );
                }
                if (newTargetIdx === -1) {
                    newTargetIdx = zleceniaElementsList.findIndex(
                        (e) => e.wellIndex === oldWellIdx
                    );
                }

                if (newTargetIdx >= 0 && typeof window.selectZleceniaElement === 'function') {
                    window.selectZleceniaElement(newTargetIdx);
                    // Odtworzenie wpisanych na sucho uwag
                    if (document.getElementById('zl-uwagi')) {
                        document.getElementById('zl-uwagi').value = tempUwagi;
                    }
                }
            }
        }
    }
}

/**
 * Przełącza widoczność panelu "Dane elementu" w trybie zwijania w lewo.
 * Zwija kolumnę grida z 230px do 36px, pokazując pionowy napis.
 */
window.toggleDaneElementu = function () {
    const grid = document.getElementById('zl-dane-elementu-grid');
    const content = document.getElementById('zl-dane-elementu-content');
    const headerFull = document.getElementById('zl-dane-elementu-header-full');
    const headerCollapsed = document.getElementById('zl-dane-elementu-header-collapsed');

    if (!grid || !content) return;

    const isVisible = content.style.display !== 'none';

    if (isVisible) {
        // Zwijanie w lewo
        content.style.display = 'none';
        if (headerFull) headerFull.style.display = 'none';
        if (headerCollapsed) headerCollapsed.style.display = 'flex';
        grid.style.gridTemplateColumns = '36px 1fr';
    } else {
        // Rozwijanie
        content.style.display = 'flex';
        if (headerFull) headerFull.style.display = 'flex';
        if (headerCollapsed) headerCollapsed.style.display = 'none';
        grid.style.gridTemplateColumns = '230px 1fr';
    }
};

function onZleceniaStopnieChange() {
    const hiddenInput = document.getElementById('zl-rodzaj-stopni');
    const wrap = document.getElementById('zl-stopnie-inne-wrap');
    if (hiddenInput && wrap) {
        wrap.style.display = hiddenInput.value === 'inne' ? 'block' : 'none';
    }
}

function onZleceniaKatChange() {
    const katInput = document.getElementById('zl-kat-stopni');
    const wykInput = document.getElementById('zl-wykonanie');
    if (katInput && wykInput) {
        const angle = parseFloat(katInput.value) || 0;
        const exec = angle > 0 ? calcStopnieExecution(angle) : '';
        wykInput.value = exec ? exec + '°' : '';
    }
}

async function saveProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const { well, product, elementIndex, wellIndex } = el;

    const existingIdx = productionOrders.findIndex(
        (po) => po.wellId === well.id && po.elementIndex === elementIndex
    );
    if (existingIdx >= 0 && productionOrders[existingIdx].status === 'accepted') {
        showToast(
            'Nie można zapisać zaakceptowanego zlecenia. Najpierw cofnij akceptację.',
            'error'
        );
        return;
    }

    let currentOrderNumber =
        existingIdx >= 0 ? productionOrders[existingIdx].productionOrderNumber || '' : '';

    // Pobierz numer zlecenia produkcyjnego natychmiast, aby wersja robocza go posiadała
    if (!currentOrderNumber) {
        try {
            // Użyj przypisanego użytkownika (właściciela) do numeracji, jeśli istnieje, w przeciwnym razie bieżącego użytkownika
            const targetUserId =
                typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
                    ? editingOfferAssignedUserId
                    : currentUser
                      ? currentUser.id
                      : null;

            if (targetUserId) {
                const claimResp = await fetch(
                    '/api/orders-studnie/claim-production-number/' + targetUserId,
                    {
                        method: 'POST',
                        headers: authHeaders()
                    }
                );
                if (claimResp.ok) {
                    const claimData = await claimResp.json();
                    if (claimData.number) {
                        currentOrderNumber = claimData.number;
                    }
                }
            }
        } catch (e) {
            console.error('Błąd poboru numeru zlecenia dla wersji roboczej', e);
        }
    }

    const order = {
        id: existingIdx >= 0 ? productionOrders[existingIdx].id : 'prodorder_' + Date.now(),
        productionOrderNumber: currentOrderNumber,
        userId:
            typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
                ? editingOfferAssignedUserId
                : currentUser
                  ? currentUser.id
                  : null,
        wellId: well.id,
        wellName: well.name,
        offerId: typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : '',
        salesOrderNumber:
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            typeof currentOrder !== 'undefined' &&
            currentOrder
                ? currentOrder.number
                : '',
        elementIndex: elementIndex,
        productName: product.name,
        productId: product.id,
        dn: well.dn,

        // Pola formularza
        obiekt: document.getElementById('zl-obiekt')?.value || '',
        data: document.getElementById('zl-data')?.value || '',
        adres: document.getElementById('zl-adres')?.value || '',
        nazwisko: document.getElementById('zl-nazwisko')?.value || '',
        wykonawca: document.getElementById('zl-wykonawca')?.value || '',
        dataProdukcji: document.getElementById('zl-data-produkcji')?.value || '',
        fakturowane: document.getElementById('zl-fakturowane')?.value || '',

        // Specyfikacja studni
        snr: well.numer || '',
        srednica: document.getElementById('zl-srednica')?.value || well.dn,
        wysokosc: document.getElementById('zl-wysokosc')?.value || '',
        glebokosc: document.getElementById('zl-glebokosc')?.value || '',
        dnoKineta: document.getElementById('zl-dno-kineta')?.value || '',
        rodzajStudni: document.getElementById('zl-rodzaj-studni')?.value || '',

        // Migawka przejść — tylko przejścia przypisane do TEGO elementu (wzbogacone o dane produktu)
        przejscia: (() => {
            const allPrzejscia = well.przejscia || [];
            const rzDna = parseFloat(well.rzednaDna) || 0;
            const findProductFn = (id) =>
                typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find((pr) => pr.id === id)
                    : null;
            const configMap =
                typeof buildConfigMap !== 'undefined'
                    ? buildConfigMap(well, findProductFn, true)
                    : [];

            // Filtruj przejścia tylko do tych przypisanych do tego elementu
            const assigned =
                configMap.length > 0
                    ? allPrzejscia.filter((p) => {
                          let pel = parseFloat(p.rzednaWlaczenia);
                          if (isNaN(pel)) pel = rzDna;
                          const mmFromBottom = (pel - rzDna) * 1000;
                          const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
                          return assignedIndex === elementIndex;
                      })
                    : allPrzejscia;

            // Wzbogać o kategorię produktu/DN
            return assigned.map((p) => {
                const clone = structuredClone(p);
                const prod = findProductFn(p.productId);
                if (prod) {
                    clone.productCategory = prod.category || '';
                    clone.productDn = prod.dn || '';
                }
                return clone;
            });
        })(),

        // Migawka elementów etykiety (do drukowania rejestru bez kontekstu studnieProducts)
        etykietaElementy: buildEtykietaElementsSnapshot(well),

        uwagi: document.getElementById('zl-uwagi')?.value || '',

        // Parametry
        redukcjaKinety: document.getElementById('zl-red-kinety')?.value || '',
        spocznikH: document.getElementById('zl-spocznik-h')?.value || '',
        din: document.getElementById('zl-din')?.value || getStudniaDIN(well.dn),
        rodzajStopni: document.getElementById('zl-rodzaj-stopni')?.value || '',
        stopnieInne: document.getElementById('zl-stopnie-inne')?.value || '',
        katStopni: document.getElementById('zl-kat-stopni')?.value || '',
        wykonanie: document.getElementById('zl-wykonanie')?.value || '',
        usytuowanie: document.getElementById('zl-usytuowanie')?.value || '',
        kineta: document.getElementById('zl-kineta')?.value || '',
        spocznik: document.getElementById('zl-spocznik')?.value || '',
        klasaBetonu: document.getElementById('zl-klasa-betonu')?.value || '',

        createdAt:
            existingIdx >= 0 ? productionOrders[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: existingIdx >= 0 ? productionOrders[existingIdx].status || 'draft' : 'draft'
    };

    if (existingIdx >= 0) {
        productionOrders[existingIdx] = order;
    } else {
        productionOrders.push(order);
    }

    try {
        await saveProductionOrdersData(productionOrders);

        // Synchronizacja: Zapisz również Ofertę i (jeśli dotyczy) Zamówienie
        const syncResult = await syncSourceData();
        const extraMsg = syncResult ? ' + ' + syncResult : '';

        // AKTUALIZACJA MIGAWKI - zapisano zmiany na studni, więc stają się nowym punktem odniesienia
        if (wellsSnapshotBeforeZlecenia) {
            wellsSnapshotBeforeZlecenia = structuredClone(wells);
        }

        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        showToast(`<i data-lucide="check-circle-2"></i> Zlecenie produkcyjne zapisane${extraMsg}`, 'success');
    } catch (err) {
        console.error('saveProductionOrder error:', err);
        showToast('<i data-lucide="x-circle"></i> Błąd zapisu: ' + err.message, 'error');
    }
}

async function deleteProductionOrder(id) {
    const po = productionOrders.find((p) => p.id === id);
    if (po && po.status === 'accepted') {
        showToast('Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.', 'error');
        return;
    }
    if (
        !(await appConfirm('Usunąć to zlecenie produkcyjne?', {
            title: 'Usuwanie zlecenia',
            type: 'danger'
        }))
    )
        return;
    try {
        const res = await fetch('/api/orders-studnie/production/' + id, {
            method: 'DELETE',
            headers: authHeaders()
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Błąd serwera podczas usuwania');
        }

        productionOrders = productionOrders.filter((po) => po.id !== id);
        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        refreshAll(); // odblokuj studnię wizualnie po usunięciu zlecenia
        await syncSourceData();
        showToast('Zlecenie usunięte', 'info');
    } catch (e) {
        console.error('deleteProductionOrder error:', e);
        showToast(e.message, 'error');
    }
}

async function acceptProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    // Auto-zapis przed akceptacją
    await saveProductionOrder();

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(
        (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
    );
    if (!po) {
        showToast('Najpierw zapisz zlecenie produkcyjne', 'error');
        return;
    }
    if (po.status === 'accepted') {
        showToast('Zlecenie już zaakceptowane', 'info');
        return;
    }
    if (
        !(await appConfirm('Zaakceptować zlecenie? Studnia zostanie zablokowana od edycji.', {
            title: 'Akceptacja zlecenia',
            type: 'warning',
            okText: 'Zaakceptuj'
        }))
    )
        return;

    // Pobierz numer zlecenia produkcyjnego, jeśli jeszcze nie został pobrany
    if (!po.productionOrderNumber) {
        try {
            const targetUserId =
                typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
                    ? editingOfferAssignedUserId
                    : currentUser
                      ? currentUser.id
                      : null;

            if (!targetUserId) {
                showToast('Brak przypisanego użytkownika', 'error');
                return;
            }
            const claimResp = await fetch(
                '/api/orders-studnie/claim-production-number/' + targetUserId,
                {
                    method: 'POST',
                    headers: authHeaders()
                }
            );
            const claimData = await claimResp.json();
            if (claimResp.ok && claimData.number) {
                po.productionOrderNumber = claimData.number;
            } else {
                showToast('Błąd pobierania numeru zlecenia z serwera', 'error');
                return;
            }
        } catch (e) {
            showToast('Błąd połączenia z serwerem przy numeracji', 'error');
            return;
        }
    }

    po.status = 'accepted';
    po.acceptedAt = new Date().toISOString();
    po.acceptedBy = currentUser ? currentUser.username : '';

    try {
        await saveProductionOrdersData(productionOrders);

        // Synchronizacja przy akceptacji
        await syncSourceData();

        renderZleceniaList();
        renderZleceniaWellConfig();
        if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
            populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
        }
        refreshGlobalMetrics();
        showToast('<i data-lucide="lock"></i> Zlecenie zaakceptowane — ' + po.productionOrderNumber, 'success');
    } catch (err) {
        console.error('acceptProductionOrder error:', err);
        showToast('<i data-lucide="x-circle"></i> Błąd akceptacji: ' + err.message, 'error');
    }
}

async function revokeProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    // Auto-zapis przed cofnięciem akceptacji
    await saveProductionOrder();

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(
        (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
    );
    if (!po) {
        showToast('Brak zlecenia do cofnięcia', 'error');
        return;
    }
    if (po.status !== 'accepted') {
        showToast('Zlecenie nie jest zaakceptowane', 'info');
        return;
    }
    if (
        !(await appConfirm('Cofnąć akceptację? Studnia zostanie odblokowana.', {
            title: 'Cofanie akceptacji',
            type: 'warning',
            okText: 'Cofnij'
        }))
    )
        return;
    po.status = 'draft';
    delete po.acceptedAt;
    delete po.acceptedBy;
    await saveProductionOrdersData(productionOrders);
    await syncSourceData();
    renderZleceniaList();
    refreshAll();
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
    }
    showToast('<i data-lucide="unlock"></i> Akceptacja cofnięta — studnia odblokowana', 'info');
}

/* ===== HURTOWE GENEROWANIE ZLECEŃ PRODUKCYJNYCH ===== */

/**
 * Zbiera wspólne dane z formularza oferty/zamówienia (nie z formularza zlecenia).
 * Używane przez hurtowe generowanie, aby nie polegać na DOM zlecenia.
 */
function collectSharedFormData() {
    const userName = currentUser
        ? ((currentUser.firstName || '') + ' ' + (currentUser.lastName || '')).trim() ||
          currentUser.username
        : '';
    const targetUserId =
        typeof editingOfferAssignedUserId !== 'undefined' && editingOfferAssignedUserId
            ? editingOfferAssignedUserId
            : currentUser
              ? currentUser.id
              : null;
    return {
        obiekt: document.getElementById('invest-name')?.value || '',
        adres: document.getElementById('invest-address')?.value || '',
        wykonawca: document.getElementById('invest-contractor')?.value || '',
        fakturowane: document.getElementById('client-name')?.value || '',
        nazwisko: userName,
        dataProdukcji: '',
        userId: targetUserId
    };
}

/**
 * Buduje obiekt zlecenia produkcyjnego programowo (bez DOM).
 * Replikuje logikę z populateZleceniaForm + saveProductionOrder.
 */
function buildAutoOrderData(el, sharedData) {
    const { well, product, elementIndex, wellIndex } = el;
    const parsed = parseWysokoscGlebokosc(product.name);
    const findProductFn = (id) =>
        typeof studnieProducts !== 'undefined' ? studnieProducts.find((pr) => pr.id === id) : null;

    // Oblicz wartości wyświetlania
    let displayDN = well.dn === 'styczna' ? 'Styczna' : 'DN' + well.dn;
    let displayGlebokosc = parsed.glebokosc || '—';
    let displayWysokosc = parsed.wysokosc || product.height || 0;
    let dnoKinetaVal = parsed.wysokosc - parsed.glebokosc;
    let displayDnoKineta = dnoKinetaVal > 0 ? dnoKinetaVal : '—';

    // Dennica na dennicy / psia buda
    let actualNextProduct = null;
    for (let i = elementIndex + 1; i < well.config.length; i++) {
        const _p = findProductFn(well.config[i].productId);
        if (_p && _p.componentType !== 'uszczelka') {
            actualNextProduct = _p;
            break;
        }
    }
    const shouldReduce =
        product.componentType === 'dennica' &&
        ((actualNextProduct && actualNextProduct.componentType === 'dennica') ||
            (well.psiaBuda && !actualNextProduct));

    if (shouldReduce) {
        const reducedH = (product.height || 0) - 100;
        displayWysokosc = reducedH;
        displayGlebokosc = reducedH;
        displayDnoKineta = 0;
    }

    if (well.dn === 'styczna') {
        const dnMatch = (product.name || '').match(/DN\s*(\d+)/i);
        if (dnMatch) displayDN = `Styczna DN${dnMatch[1]}`;
        displayGlebokosc = product.height || '—';
        displayWysokosc = parsed.wysokosc || displayWysokosc;
        displayDnoKineta =
            parsed.wysokosc > 0 && parsed.glebokosc > 0 ? parsed.wysokosc - parsed.glebokosc : '—';
    }

    // Wartości domyślne parametrów
    const isKragOt = product && product.componentType === 'krag_ot';
    const shouldForceBrak = shouldReduce || isKragOt;

    let domyslnyRodzajStudni =
        product.componentType === 'dennica'
            ? well.dennicaMaterial === 'zelbetowa'
                ? 'zelbet'
                : 'beton'
            : well.nadbudowa === 'zelbetowa'
              ? 'zelbet'
              : 'beton';

    // Dziedziczenie kąta stopni z dennicy (jeśli już wygenerowano)
    let baseKatStopni = '';
    let baseRodzajStopni = '';
    const dennicaConfigIdx = well.config.findIndex((c) => {
        const p = findProductFn(c.productId);
        return p && p.componentType === 'dennica';
    });
    if (dennicaConfigIdx >= 0 && elementIndex !== dennicaConfigIdx) {
        const dennicaPo = (productionOrders || []).find(
            (po) => po.wellId === well.id && po.elementIndex === dennicaConfigIdx
        );
        if (dennicaPo) {
            if (dennicaPo.katStopni) baseKatStopni = dennicaPo.katStopni;
            if (dennicaPo.rodzajStopni) baseRodzajStopni = dennicaPo.rodzajStopni;
        }
    }
    const katStopni = baseKatStopni || '';
    const wykonanie = katStopni ? calcStopnieExecution(katStopni) : '';

    // Auto-uwagi
    const autoUwagi = [];
    if (well.agresjaChemiczna === 'XA2' || well.agresjaChemiczna === 'XA3')
        autoUwagi.push('Agresja chem. ' + well.agresjaChemiczna);
    if (well.agresjaMrozowa === 'XF2' || well.agresjaMrozowa === 'XF3')
        autoUwagi.push('Agresja mroz. ' + well.agresjaMrozowa);
    let wklUwagi2 = [];
    if (well.wkladkaDennica && well.wkladkaDennica !== 'brak') wklUwagi2.push('Dennica ' + well.wkladkaDennica);
    if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak') wklUwagi2.push('Nadbudowa ' + well.wkladkaNadbudowa);
    if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') wklUwagi2.push('Zwieńczenie ' + well.wkladkaZwienczenie);
    if (wklUwagi2.length > 0) autoUwagi.push('PEHD: ' + wklUwagi2.join(', '));
    if (well.malowanieW && well.malowanieW !== 'brak') {
        let malWDesc = '';
        if (well.malowanieW === 'kineta') malWDesc = 'Kineta';
        else if (well.malowanieW === 'kineta_dennica') malWDesc = 'Kineta+denn.';
        else if (well.malowanieW === 'cale') malWDesc = 'Całość';
        if (malWDesc)
            autoUwagi.push(
                'Malowanie wew. ' + malWDesc + (well.powlokaNameW ? ' ' + well.powlokaNameW : '')
            );
    }
    if (well.malowanieZ === 'zewnatrz')
        autoUwagi.push(
            'Malowanie zew. Zewnątrz' + (well.powlokaNameZ ? ' ' + well.powlokaNameZ : '')
        );
    if (well.dn === 'styczna') autoUwagi.push('STYCZNA');
    if (well.klasaNosnosci_korpus === 'E600' || well.klasaNosnosci_korpus === 'F900')
        autoUwagi.push('Kl. nośn. ' + well.klasaNosnosci_korpus);
    if (well.psiaBuda && !actualNextProduct) autoUwagi.push('UWAGA ! PSIA BUDA');
    if (
        product.componentType === 'dennica' &&
        actualNextProduct &&
        actualNextProduct.componentType === 'dennica'
    )
        autoUwagi.push('UWAGA ! KRĄG NA FORMIE STUDNI');

    // Snapshot przejść przypisanych do tego elementu
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const configMap =
        typeof buildConfigMap !== 'undefined' ? buildConfigMap(well, findProductFn, true) : [];
    const allPrzejscia = well.przejscia || [];
    const assignedPrzejscia =
        configMap.length > 0
            ? allPrzejscia.filter((p) => {
                  let pel = parseFloat(p.rzednaWlaczenia);
                  if (isNaN(pel)) pel = rzDna;
                  const mmFromBottom = (pel - rzDna) * 1000;
                  const { assignedIndex } = findAssignedElement(mmFromBottom, configMap);
                  return assignedIndex === elementIndex;
              })
            : allPrzejscia;

    const przejsciaSnapshot = assignedPrzejscia.map((p) => {
        const clone = structuredClone(p);
        const prod = findProductFn(p.productId);
        if (prod) {
            clone.productCategory = prod.category || '';
            clone.productDn = prod.dn || '';
        }
        return clone;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    return {
        id: 'prodorder_' + Date.now() + '_' + wellIndex + '_' + elementIndex,
        productionOrderNumber: '',
        userId: sharedData.userId || null,
        wellId: well.id,
        wellName: well.name,
        offerId: typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : '',
        salesOrderNumber:
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            typeof currentOrder !== 'undefined' &&
            currentOrder
                ? currentOrder.number
                : '',
        elementIndex: elementIndex,
        productName: product.name,
        productId: product.id,
        dn: well.dn,
        obiekt: sharedData.obiekt || '',
        data: todayStr,
        adres: sharedData.adres || '',
        nazwisko: sharedData.nazwisko || '',
        wykonawca: sharedData.wykonawca || '',
        dataProdukcji: sharedData.dataProdukcji || '',
        fakturowane: sharedData.fakturowane || '',
        snr: well.numer || '',
        srednica: displayDN,
        wysokosc: String(displayWysokosc),
        glebokosc: String(displayGlebokosc),
        dnoKineta: String(displayDnoKineta),
        rodzajStudni: domyslnyRodzajStudni,
        przejscia: przejsciaSnapshot,
        etykietaElementy: buildEtykietaElementsSnapshot(well),
        uwagi: autoUwagi.join(', '),
        redukcjaKinety: shouldForceBrak ? 'nie' : (well.redukcjaKinety ?? ''),
        spocznikH: shouldForceBrak ? 'brak' : (well.spocznikH ?? ''),
        din: getStudniaDIN(well.dn),
        rodzajStopni: baseRodzajStopni || '',
        stopnieInne: '',
        katStopni: katStopni,
        wykonanie: wykonanie ? wykonanie + '°' : '',
        usytuowanie: well.usytuowanie ?? '',
        kineta: shouldForceBrak ? 'brak' : (well.kineta ?? ''),
        spocznik: shouldForceBrak ? 'brak' : (well.spocznik ?? ''),
        klasaBetonu: well.klasaBetonu ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft'
    };
}

/**
 * Pobiera numer zlecenia produkcyjnego i zapisuje zlecenie przez API.
 * Zwraca zapisany obiekt zlecenia z przydzielonym numerem.
 */
async function claimAndSaveSingleOrder(orderData, userId) {
    if (!orderData.productionOrderNumber && userId) {
        const claimResp = await fetch(
            '/api/orders-studnie/claim-production-number/' + userId,
            { method: 'POST', headers: authHeaders() }
        );
        if (claimResp.ok) {
            const claimData = await claimResp.json();
            if (claimData.number) orderData.productionOrderNumber = claimData.number;
        }
    }
    const res = await fetch('/api/orders-studnie/production', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(orderData)
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Server error');
    return orderData;
}



/**
 * Otwiera popup z drag & drop listą studni do ustalenia kolejności generowania.
 */
function openBulkOrderSequencePopup() {
    if (wells.length === 0) {
        showToast('Brak studni do wygenerowania zleceń', 'error');
        return;
    }
    buildZleceniaWellList();

    // Grupuj elementy po wellIndex
    const wellGroups = {};
    zleceniaElementsList.forEach((el) => {
        if (!wellGroups[el.wellIndex]) {
            wellGroups[el.wellIndex] = {
                wellIndex: el.wellIndex,
                wellName: el.well.name,
                wellDn: el.well.dn,
                totalCount: 0,
                openCount: 0
            };
        }
        wellGroups[el.wellIndex].totalCount++;
        if (getElementStatus(el) === 'open') wellGroups[el.wellIndex].openCount++;
    });

    const groupList = Object.values(wellGroups);
    const hasAnyOpen = groupList.some((g) => g.openCount > 0);
    if (!hasAnyOpen) {
        showToast('Wszystkie elementy mają już zlecenia produkcyjne', 'info');
        return;
    }

    // Zbuduj HTML popupu
    let itemsHtml = groupList
        .map((g) => {
            const disabled = g.openCount === 0;
            const dnLabel = g.wellDn === 'styczna' ? 'Styczna' : 'DN' + g.wellDn;
            return `<div class="bulk-seq-item ${disabled ? 'bulk-seq-disabled' : ''}"
                    draggable="${!disabled}" data-well-index="${g.wellIndex}"
                    style="display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.8rem;
                    background:${disabled ? 'rgba(255,255,255,0.02)' : 'rgba(139,92,246,0.08)'};
                    border:1px solid ${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.25)'};
                    border-radius:8px; cursor:${disabled ? 'default' : 'grab'};
                    opacity:${disabled ? '0.4' : '1'}; transition:all 0.15s; margin-bottom:0.3rem;">
                <input type="text" inputmode="numeric" class="bulk-seq-num" ${disabled ? 'disabled' : ''} value=""
                    onfocus="this.dataset.old = this.value; this.value = '';"
                    onblur="reorderBulkSeqList(this)"
                    onkeydown="if(event.key === 'Enter') this.blur();"
                    style="width:72px; height:28px; text-align:center; padding:0;
                    background:${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.15)'}; 
                    border:1px solid ${disabled ? 'transparent' : 'rgba(139,92,246,0.4)'}; border-radius:6px;
                    font-size:0.75rem; font-weight:800; color:${disabled ? 'var(--text-muted)' : '#c4b5fd'}; outline:none;">
                <span style="font-size:1rem; color:${disabled ? 'var(--text-muted)' : '#a78bfa'}; cursor:grab;">⠿</span>
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:0.8rem; color:var(--text-primary);">${g.wellName}</div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">${dnLabel} • ${g.openCount}/${g.totalCount} do wygenerowania</div>
                </div>
                ${!disabled ? `<button onclick="toggleBulkSeqItem(this)" class="btn btn-sm" style="background:transparent; border:none; color:#f87171; padding:0.2rem; cursor:pointer;" title="Pomiń studnię">
                    <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                </button>` : ''}
            </div>`;
        })
        .join('');

    // Utwórz overlay
    let overlay = document.getElementById('bulk-seq-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'bulk-seq-overlay';
    overlay.style.cssText =
        'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:100000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);';
    overlay.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid rgba(139,92,246,0.3); border-radius:14px; padding:1.5rem; width:420px; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                <div>
                    <div style="font-size:1rem; font-weight:800; color:#a78bfa;"><i data-lucide="list-ordered"></i> Kolejność generowania</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">Przeciągnij studnie, aby ustalić kolejność numerów produkcyjnych</div>
                </div>
                <button onclick="closeBulkOrderPopup()" class="btn btn-sm" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#f87171; padding:0.3rem 0.6rem;">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div id="bulk-seq-list" style="flex:1; overflow-y:auto; padding:0.3rem 0;">${itemsHtml}</div>
            <button onclick="executeBulkFromPopup()" class="btn btn-sm" style="margin-top:1rem; width:100%; background:rgba(139,92,246,0.2); border:1px solid rgba(139,92,246,0.4); color:#a78bfa; font-weight:800; padding:0.6rem; font-size:0.85rem; border-radius:8px;">
                <i data-lucide="zap"></i> Generuj w tej kolejności
            </button>
        </div>
    `;
    document.body.appendChild(overlay);

    // Aktualizuj numery kolejności
    updateBulkSeqNumbers();

    // Drag & drop na liście
    const list = document.getElementById('bulk-seq-list');
    let dragEl = null;
    list.addEventListener('dragstart', (e) => {
        dragEl = e.target.closest('.bulk-seq-item');
        if (dragEl) dragEl.style.opacity = '0.4';
    });
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.bulk-seq-item');
        if (target && target !== dragEl && !target.classList.contains('bulk-seq-disabled')) {
            const rect = target.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            if (after) target.after(dragEl);
            else target.before(dragEl);
        }
    });
    list.addEventListener('dragend', () => {
        if (dragEl) dragEl.style.opacity = '1';
        dragEl = null;
        updateBulkSeqNumbers();
    });

    if (window.lucide) window.lucide.createIcons();
}

/** Aktualizuje widoczne numery kolejności w popupie drag & drop */
function updateBulkSeqNumbers() {
    const items = document.querySelectorAll('#bulk-seq-list .bulk-seq-item');
    let counter = 1;
    items.forEach((item) => {
        const numEl = item.querySelector('.bulk-seq-num');
        if (!numEl) return;
        if (item.classList.contains('bulk-seq-disabled') || item.classList.contains('bulk-seq-excluded')) {
            numEl.value = '';
            numEl.placeholder = '—';
        } else {
            numEl.value = counter;
            counter++;
        }
    });
}

/** Przestawia element na liście na podstawie wpisanego numeru */
function reorderBulkSeqList(inputEl) {
    const newVal = parseInt(inputEl.value, 10);
    if (isNaN(newVal) || newVal < 1) {
        if (inputEl.dataset.old) {
            inputEl.value = inputEl.dataset.old;
        }
        updateBulkSeqNumbers();
        return;
    }
    
    const item = inputEl.closest('.bulk-seq-item');
    if (!item) return;
    
    const list = document.getElementById('bulk-seq-list');
    const items = Array.from(list.querySelectorAll('.bulk-seq-item:not(.bulk-seq-disabled):not(.bulk-seq-excluded)'));
    
    const oldIndex = items.indexOf(item);
    let newIndex = newVal - 1;
    
    if (newIndex >= items.length) newIndex = items.length - 1;
    if (newIndex < 0) newIndex = 0;
    
    if (oldIndex === newIndex) {
        updateBulkSeqNumbers();
        return;
    }
    
    items.splice(oldIndex, 1);
    items.splice(newIndex, 0, item);
    
    const excludedItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-excluded'));
    const disabledItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-disabled'));
    
    items.forEach(el => list.appendChild(el));
    excludedItems.forEach(el => list.appendChild(el));
    disabledItems.forEach(el => list.appendChild(el));
    
    updateBulkSeqNumbers();
}

/** Wyklucza/przywraca element z kolejki generowania */
function toggleBulkSeqItem(btn) {
    const item = btn.closest('.bulk-seq-item');
    if (!item) return;

    const isExcluded = item.classList.contains('bulk-seq-excluded');
    
    if (isExcluded) {
        item.classList.remove('bulk-seq-excluded');
        item.style.opacity = '1';
        item.setAttribute('draggable', 'true');
        
        const input = item.querySelector('.bulk-seq-num');
        input.removeAttribute('disabled');
        input.style.background = 'rgba(139,92,246,0.15)';
        
        btn.innerHTML = '<i data-lucide="trash-2" style="width:16px; height:16px;"></i>';
        btn.style.color = 'var(--danger-hover)';
        btn.title = "Pomiń studnię";
    } else {
        item.classList.add('bulk-seq-excluded');
        item.style.opacity = '0.4';
        item.setAttribute('draggable', 'false');
        
        const input = item.querySelector('.bulk-seq-num');
        input.setAttribute('disabled', 'true');
        input.value = '';
        input.placeholder = '—';
        input.style.background = 'rgba(255,255,255,0.05)';
        
        btn.innerHTML = '<i data-lucide="plus" style="width:16px; height:16px;"></i>';
        btn.style.color = '#34d399';
        btn.title = "Przywróć studnię";
    }
    
    if (window.lucide) window.lucide.createIcons();
    
    const list = document.getElementById('bulk-seq-list');
    const activeItems = Array.from(list.querySelectorAll('.bulk-seq-item:not(.bulk-seq-disabled):not(.bulk-seq-excluded)'));
    const excludedItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-excluded'));
    const disabledItems = Array.from(list.querySelectorAll('.bulk-seq-item.bulk-seq-disabled'));
    
    activeItems.forEach(el => list.appendChild(el));
    excludedItems.forEach(el => list.appendChild(el));
    disabledItems.forEach(el => list.appendChild(el));

    updateBulkSeqNumbers();
}

function closeBulkOrderPopup() {
    const overlay = document.getElementById('bulk-seq-overlay');
    if (overlay) overlay.remove();
}

/**
 * Wywołane z popupu kolejności — odczytuje kolejność studni z DOM i generuje.
 */
async function executeBulkFromPopup() {
    const items = document.querySelectorAll('#bulk-seq-list .bulk-seq-item:not(.bulk-seq-disabled):not(.bulk-seq-excluded)');
    const orderedIndexes = Array.from(items).map((el) => parseInt(el.dataset.wellIndex, 10));

    closeBulkOrderPopup();

    // Filtruj niezapisane elementy w podanej kolejności studni
    buildZleceniaWellList();
    const unsaved = [];
    orderedIndexes.forEach((wIdx) => {
        zleceniaElementsList
            .filter((el) => el.wellIndex === wIdx && getElementStatus(el) === 'open')
            .forEach((el) => unsaved.push(el));
    });

    if (unsaved.length === 0) {
        showToast('Brak elementów do wygenerowania', 'info');
        return;
    }

    const msg = `Wygenerować zlecenia dla ${unsaved.length} elementów w wybranej kolejności?`;
    if (!(await appConfirm(msg, { title: 'Generuj w kolejności', type: 'warning', okText: 'Generuj' })))
        return;

    await executeBulkGeneration(unsaved);
}

/**
 * Wspólna pętla generowania zleceń hurtowo dla podanej listy elementów.
 */
async function executeBulkGeneration(elements) {
    const sharedData = collectSharedFormData();
    const newOrders = [];
    let errorCount = 0;

    for (const el of elements) {
        try {
            const orderData = buildAutoOrderData(el, sharedData);
            const saved = await claimAndSaveSingleOrder(orderData, sharedData.userId);
            productionOrders.push(saved);
            newOrders.push(saved);
        } catch (e) {
            console.error('Błąd generowania zlecenia dla', el.product.name, ':', e);
            errorCount++;
        }
    }

    // Synchronizuj źródło danych
    await syncSourceData();

    // Odśwież UI
    buildZleceniaWellList();
    renderZleceniaList();
    if (zleceniaSelectedIdx >= 0 && zleceniaElementsList[zleceniaSelectedIdx]) {
        populateZleceniaForm(zleceniaElementsList[zleceniaSelectedIdx]);
    }
    refreshGlobalMetrics();

    if (wellsSnapshotBeforeZlecenia) {
        wellsSnapshotBeforeZlecenia = structuredClone(wells);
    }

    const errMsg = errorCount > 0 ? ` (${errorCount} błędów)` : '';
    showToast(
        `<i data-lucide="zap"></i> Wygenerowano ${newOrders.length} zleceń produkcyjnych${errMsg}`,
        newOrders.length > 0 ? 'success' : 'error'
    );
}

window.openZleceniaProdukcyjne = openZleceniaProdukcyjne;
window.closeZleceniaModal = closeZleceniaModal;
window.selectZleceniaElement = selectZleceniaElement;
window.filterZleceniaList = filterZleceniaList;
window.saveProductionOrder = saveProductionOrder;
window.deleteProductionOrder = deleteProductionOrder;
window.acceptProductionOrder = acceptProductionOrder;
window.revokeProductionOrder = revokeProductionOrder;
window.onZleceniaStopnieChange = onZleceniaStopnieChange;
window.onZleceniaKatChange = onZleceniaKatChange;
window.openBulkOrderSequencePopup = openBulkOrderSequencePopup;
window.closeBulkOrderPopup = closeBulkOrderPopup;
window.executeBulkFromPopup = executeBulkFromPopup;
window.reorderBulkSeqList = reorderBulkSeqList;
window.toggleBulkSeqItem = toggleBulkSeqItem;

/** Usuwa zlecenie produkcyjne dla aktualnie wybranego elementu */
async function deleteSelectedProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = (productionOrders || []).find(
        (p) => p.wellId === el.well.id && p.elementIndex === el.elementIndex
    );
    if (!po) {
        showToast('To zlecenie nie zostało jeszcze zapisane', 'info');
        return;
    }
    await deleteProductionOrder(po.id);
}
window.deleteSelectedProductionOrder = deleteSelectedProductionOrder;

/** Odśwież globalne metryki pulpitu nawigacyjnego, jeśli działa w SPA / oknie nadrzędnym */
function refreshGlobalMetrics() {
    try {
        if (window.parent && typeof window.parent.loadRecycledNumbers === 'function') {
            window.parent.loadRecycledNumbers();
        }
        if (
            window.parent &&
            window.parent.SpaRouter &&
            typeof window.parent.SpaRouter.refreshModule === 'function'
        ) {
            window.parent.SpaRouter.refreshModule('zlecenia');
        }
    } catch (e) {
        /* ignore cross-origin or missing parent */
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        loadProductionOrders();
    }, 500);
});

window.showKartaBudowyExportChoice = function() {
    if (!orderEditMode || !orderEditMode.orderId) {
        showToast('Brak aktywnego zamówienia', 'error');
        return;
    }
    const orderId = orderEditMode.orderId;
    const modalHtml = `
    <div id="karta-export-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(4px);">
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 350px; padding: 1.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #fff; font-weight: 700;">Wydruk Karty Budowy</h3>
            <p style="font-size: 0.8rem; color: #cbd5e1; margin-bottom: 1.5rem;">Wybierz format eksportu karty budowy zamówienia</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
                <button onclick="exportKartaToPDF_action('${orderId}')" style="flex: 1; background: rgba(239,68,68,0.2); color: #fca5a5; border: 2px solid rgba(239,68,68,0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                    <span style="font-size: 2rem;"><i data-lucide="file-text"></i></span> PDF
                </button>
                <button onclick="exportKartaToWord_action('${orderId}')" style="flex: 1; background: rgba(59,130,246,0.2); color: #93c5fd; border: 2px solid rgba(59,130,246,0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                    <span style="font-size: 2rem;"><i data-lucide="edit"></i></span> Word
                </button>
            </div>
            <button style="padding: 0.5rem 1rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); cursor: pointer;" onclick="document.getElementById('karta-export-modal').remove()">Anuluj</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

window.exportKartaToPDF_action = async function(orderId) {
    document.getElementById('karta-export-modal').remove();
    showToast('Generowanie Karty Budowy (PDF)...', 'info');
    fetch(`/api/orders-studnie/${orderId}/export-karta-pdf`, {
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    })
    .then((res) => {
        if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
        return res.blob();
    })
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `karta_budowy_${orderId.substring(0,8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast('Pobrano Kartę Budowy w PDF', 'success');
    })
    .catch((err) => {
        console.error('[Export Error]', err);
        showToast('Błąd eksportu: ' + err.message, 'error');
    });
};

window.exportKartaToWord_action = async function(orderId) {
    document.getElementById('karta-export-modal').remove();
    showToast('Generowanie Karty Budowy (DOCX)...', 'info');
    fetch(`/api/orders-studnie/${orderId}/export-karta-docx`, {
        headers: typeof authHeaders === 'function' ? authHeaders() : { 'Content-Type': 'application/json' }
    })
    .then((res) => {
        if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
        return res.blob();
    })
    .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `karta_budowy_${orderId.substring(0,8)}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast('Pobrano Kartę Budowy w DOCX', 'success');
    })
    .catch((err) => {
        console.error('[Export Error]', err);
        showToast('Błąd eksportu: ' + err.message, 'error');
    });
};
