// @ts-check
/* ===== ZAPIS OFERTY (STUDNIE) ===== */

// SSoT zaokrągleń: shared/formatters.js → roundMoney (2 miejsca, half-up).
// Fallback wyłącznie dla sandboxów vm/testów bez formatters.js.
const _moneyRoundOfferSave =
    typeof roundMoney === 'function'
        ? roundMoney
        : (/** @type {number} */ v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return 0;
              const sign = n < 0 ? -1 : 1;
              return sign * (Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100);
          };

/**
 * Usuwa lotne pola runtime ze studni przed wysyłką do backendu.
 * Działa na klonie (structuredClone) — obiekty live w sesji nietknięte.
 * @param {Array} wellsArr - sklonowana tablica studni z offerDoc
 */
function stripWellRuntimeFields(wellsArr) {
    if (!Array.isArray(wellsArr)) return;
    const runtimeKeys = [
        '_lastAutoConfig',
        '_lastAutoTelemetryId',
        '_aiRankInfo',
        '_lastSolveInputHash',
        '_excelLoading',
        '__resCache'
    ];
    wellsArr.forEach(function (w) {
        if (!w) return;
        runtimeKeys.forEach(function (k) {
            delete w[k];
        });
    });
}

/**
 * F2.5: czy dla bieżącej oferty istnieje zapisany draft. Komunikaty „zmiany
 * zachowane w drafcie" są prawdziwe tylko wtedy; dla ofert >4 MB (cap
 * `DRAFT_MAX_BYTES`) draftu nie ma i użytkownik musi wiedzieć, że grozi utrata.
 * SSoT klucza: draftStore.buildDraftKey (ten sam co draftAutosave._draftWriteKind).
 * @returns {boolean}
 */
function _draftAvailableForOffer() {
    try {
        const ds = window.draftStore;
        const da = window.draftAutosave;
        if (
            !ds ||
            !da ||
            typeof ds.buildDraftKey !== 'function' ||
            typeof ds.loadDraft !== 'function'
        )
            return false;
        const uid = typeof da.currentUserId === 'function' ? da.currentUserId() : null;
        if (!uid) return false;
        const docId =
            typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie
                ? editingOfferIdStudnie
                : 'new';
        const key = ds.buildDraftKey(uid, 'offer_studnie', docId);
        if (!key) return false;
        const res = ds.loadDraft(window.localStorage, key);
        return !!(res && res.status === 'ok');
    } catch (_e) {
        return false;
    }
}

/** F2.5: komunikat o losie niezapisanych zmian — zależny od realnej dostępności draftu. */
function _lostWorkMessage(prefix) {
    return _draftAvailableForOffer()
        ? prefix + ' Niezapisane zmiany zachowane w drafcie.'
        : prefix +
              ' Draft NIEDOSTĘPNY (oferta zbyt duża) — SKOPIUJ zmiany ręcznie, inaczej przepadną.';
}

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
    let simpleId = editingOfferIdStudnie || null;
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

        simpleId = editingOfferIdStudnie || 'offer_studnie_' + Date.now();
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
            transportSeparate: !!currentTransportSeparate,
            wellDiscounts:
                typeof wellDiscounts !== 'undefined' ? structuredClone(wellDiscounts || {}) : {},
            totalWeight: pricing.totalWeight,
            totalNetto: _moneyRoundOfferSave(
                pricing.totalNetto + pricing.totalTransportCostForOffer
            ),
            totalBrutto: _moneyRoundOfferSave(
                _moneyRoundOfferSave(pricing.totalNetto + pricing.totalTransportCostForOffer) * 1.23
            ),
            wizard: {
                globalParams: getWizardGlobalParams(),
                currentStep: typeof currentWizardStep !== 'undefined' ? currentWizardStep : 3,
                version: 1
            }
        });

        // Lotne pola runtime (cache/solver/telemetry) są używane wyłącznie live
        // w sesji — backend ich nie czyta, a przy ~3k studni to kilka MB
        // zbędnego payloadu, które potrafiło przekroczyć limit express.json
        // (500 PayloadTooLargeError). Czyścimy klon, obiekty live nietknięte
        // (telemetria po zapisie czyta właśnie z nich).
        stripWellRuntimeFields(offerDoc.wells);
        // Pieczątka po „Przelicz do aktywnego" — tylko gdy recalc ją ustawił
        // (serwer weryfikuje zgodność z ACTIVE, 409 w przeciwnym razie).
        if (window.pendingStudnieStampId)
            offerDoc.pricelistVersionId = window.pendingStudnieStampId;

        if (!offerDoc.wells || offerDoc.wells.length === 0) {
            showToast('Błąd: Nie można zapisać pustej oferty.', 'error');
            return false;
        }
        if (typeof validatePrzejsciaForSave === 'function') {
            const v = validatePrzejsciaForSave(offerDoc.wells);
            if (!v.valid) {
                if (typeof showPrzejsciaValidationPopup === 'function')
                    showPrzejsciaValidationPopup(v.errors);
                else showToast(v.errors[0], 'error');
                return false;
            }
        }
        const result = await storageService.saveOffer(offerDoc);
        window.pendingStudnieStampId = null;
        showToast('Oferta zapisana <i data-lucide="check"></i>', 'success');
        const savedId = result.id || offerDoc.id;
        editingOfferIdStudnie = savedId;
        // P1.1b: sukces SAVED kasuje draft (zapis draftu ≠ zapis SAVED).
        if (window.draftAutosave)
            window.draftAutosave.clearContext('offer_studnie', 'new', savedId);

        // Aktualizuj lokalną tablicę dla natychmiastowego renderowania przy użyciu potwierdzonego ID
        const idx = offersStudnie.findIndex((o) => o.id === editingOfferIdStudnie);
        const updatedOffer = { ...offerDoc, id: editingOfferIdStudnie };

        if (idx >= 0) offersStudnie[idx] = updatedOffer;
        else offersStudnie.push(updatedOffer);
        if (typeof _rebuildOffersStudnieById === 'function') _rebuildOffersStudnieById();

        renderSavedOffersStudnie();
        // Badge na pieczątkę z zapisu (pending już wyczyszczony).
        if (window.offerPricelistBanner)
            window.offerPricelistBanner.badge({
                type: 'studnie',
                stampId: offerDoc.pricelistVersionId || null,
                anchorId: 'offer-form-title-studnie'
            });

        // Pasywne uczenie — cichy POST (fire-and-forget, bez blokowania UI).
        // Przy edycji istniejącej oferty wysyłamy tylko studnie zmienione od
        // ostatniego zapisu — duplikaty identycznych studni zakłamują wzorce
        // (hitCount/confidence) i zbiór treningowy ML.
        const telemetryWells = editingOfferIdStudnie
            ? _filterChangedWells(wells, existingDoc)
            : wells;
        _sendAcceptanceTelemetry(telemetryWells, 'OFFER_SAVE');

        // Auto-acceptance — rejestruj akceptację w ML pipeline jednym batchem
        // zamiast N requestów (jak ORDER_CONFIRM w orderCrud.js). Batch wysyła
        // tylko studnie z potwierdzonym wierszem telemetry
        // (_lastAutoTelemetryId) — resztę backend i tak odrzuciłby
        // 400 WELL_NOT_FOUND (spam w konsoli przy każdym zapisie oferty).
        // Studnia ręcznie zmodyfikowana (configSource MANUAL*) dostaje NEGATYW
        // wcześniej (reward MODIFY na sugestii AUTO + wzorce substitution/addition/
        // removal w LearningEngine), a pozytyw dopiero przy ORDER_CONFIRM (wasAccepted).
        // Nie wysyłamy dla niej acceptance-full z accepted:false — recordAcceptance
        // oznaczałby NAJNOWSZY rekord studni (świeży manualny config) jako REJECTED,
        // czyli finalny wybór użytkownika zyskiwał −1.0 zamiast NO_FEEDBACK.
        const acceptanceSample = (wells.length > 50 ? wells.slice(0, 50) : wells).filter(
            function (w) {
                return (
                    w &&
                    w.config &&
                    w.config.length > 0 &&
                    !(w.configSource && w.configSource.indexOf('MANUAL') === 0)
                );
            }
        );
        if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.sendRewardBatch) {
            window.mlRewardHooks
                .sendRewardBatch(acceptanceSample, {
                    action: 'ACCEPT',
                    eventType: 'OFFER_SAVED',
                    wasAiRanked: function (w) {
                        return w.configSource === 'AUTO_AI';
                    }
                })
                .catch(function () {
                    // pasywnie
                });
        } else if (
            typeof window.mlRewardHooks !== 'undefined' &&
            window.mlRewardHooks.onWellAccepted
        ) {
            acceptanceSample.forEach(function (w) {
                window.mlRewardHooks.onWellAccepted({
                    eventType: 'OFFER_SAVED',
                    wasAiRanked: w.configSource === 'AUTO_AI',
                    well: w
                });
            });
        }
        // Batch: 1 POST acceptance zamiast N (fallback na single w bridge).
        const acceptanceBatch = [];
        acceptanceSample.forEach(function (w) {
            // Wyślij acceptance-full do backendu tylko dla studni zaakceptowanych
            // (AUTO/AI bez modyfikacji). Dla MANUAL pomijamy — patrz komentarz wyżej.
            acceptanceBatch.push({
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
        });
        if (typeof window.telemetryRecordAcceptanceFullBatch === 'function') {
            try {
                window.telemetryRecordAcceptanceFullBatch(acceptanceBatch);
            } catch (_e) {
                // silent
            }
        } else if (typeof window.telemetryRecordAcceptanceFull === 'function') {
            acceptanceBatch.forEach(function (opts) {
                try {
                    window.telemetryRecordAcceptanceFull(opts);
                } catch (_e) {
                    // silent
                }
            });
        }

        return true;
    } catch (err) {
        logger.error('offerManager', '[OfferManager] Save error:', err);
        // 423: zapis odrzucony — ktos inny trzyma blokade. Formularza NIE
        // podmieniac (ochrona niezapisanych zmian uzytkownika).
        if (window.lockService && window.lockService.isLocked(err)) {
            const info = window.lockService.describeHolder(err.holder);
            showToast(
                _lostWorkMessage('Zapis odrzucony — dokument edytuje ' + info.name + '.'),
                'warning'
            );
            return false;
        }
        // Cennik obowiązujący zmienił się (pin w innym oknie) — to nie konflikt
        // edycji: nie podmieniamy formularza, tylko unieważniamy cache etykiet.
        if (err && err.code === 'STALE_PRICELIST') {
            if (window.pricelistVersions && window.pricelistVersions.clearSummaryCache)
                window.pricelistVersions.clearSummaryCache();
            showToast(
                'Cennik obowiązujący się zmienił — odśwież stronę i przelicz ofertę ponownie.',
                'warning'
            );
            return false;
        }
        // P0-D2: konflikt wersji — serwer wygrywa, formularz zastąpiony świeżą
        // kopią. Bez auto-merge. Bezpieczne: loadSavedOfferStudnie nie woła save.
        const conflict =
            typeof isVersionConflict === 'function'
                ? isVersionConflict(err)
                : err?.status === 409 || err?.code === 'VERSION_CONFLICT';
        if (conflict) {
            const _hasDraft = _draftAvailableForOffer();
            showToast(
                _hasDraft
                    ? 'Oferta zmieniona przez innego użytkownika — wczytano aktualną wersję. Niezapisane zmiany zachowane w drafcie.'
                    : 'Oferta zmieniona przez innego użytkownika. Draft NIEDOSTĘPNY (oferta zbyt duża) — formularza NIE podmieniam; SKOPIUJ zmiany ręcznie.',
                'warning'
            );
            // F2.5: bez draftu podmiana formularza = cicha utrata pracy → nie robito.
            if (!_hasDraft) return false;
            try {
                const { storageService: ss } = await import('../shared/StorageService.js');
                const fresh = await ss.getOfferById(simpleId);
                if (fresh) {
                    const idx = offersStudnie.findIndex((o) => o.id === simpleId);
                    if (idx >= 0) offersStudnie[idx] = { ...fresh, id: fresh.id };
                    else offersStudnie.push({ ...fresh, id: fresh.id });
                    if (typeof _rebuildOffersStudnieById === 'function')
                        _rebuildOffersStudnieById();
                    renderSavedOffersStudnie();
                    // Badge na pieczątkę świeżej kopii (konflikt → load niżej i tak przemaluje).
                    if (window.offerPricelistBanner)
                        window.offerPricelistBanner.badge({
                            type: 'studnie',
                            stampId: fresh.pricelistVersionId || null,
                            anchorId: 'offer-form-title-studnie'
                        });
                    if (typeof loadSavedOfferStudnie === 'function')
                        await loadSavedOfferStudnie(fresh, fresh.id);
                }
            } catch (_e) {
                /* toast powyżej już poinformował */
            }
            return false;
        }
        // A1: offline/network — draft zachowany (clearContext tylko po sukcesie),
        // użytkownik dostaje jasny komunikat zamiast generyka.
        var _kind = typeof saveErrorKind === 'function' ? saveErrorKind(err) : 'unknown';
        var _off = typeof saveOfflineMessage === 'function' ? saveOfflineMessage(_kind) : null;
        if (_off) {
            showToast(_off, 'warning');
            return false;
        }
        // P1-idle: 401 po 1h bezczynnosci / 7d absolute — draft zachowany,
        // modal zamiast cichego redirectu.
        if (_kind === 'session-idle' || _kind === 'session-expired') {
            var _msg =
                typeof saveSessionIdleMessage === 'function'
                    ? saveSessionIdleMessage(_kind)
                    : 'Sesja wygasła — zaloguj się ponownie. Zmiany zachowane w drafcie.';
            if (!_draftAvailableForOffer())
                _msg += ' UWAGA: draft niedostępny (oferta zbyt duża) — skopiuj zmiany ręcznie.';
            showToast(_msg, 'warning');
            try {
                if (
                    window.sessionIdle &&
                    typeof window.sessionIdle.notifyUnauthorized === 'function'
                )
                    window.sessionIdle.notifyUnauthorized(err);
            } catch (_e) {}
            return false;
        }
        if (_kind === 'server' && err && err.status === 413)
            showToast(
                'Oferta za duża dla serwera (limit 50 MB) — podziel ją lub zgłoś problem.',
                'error'
            );
        else showToast('Błąd zapisu oferty', 'error');
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
    // Próbka max 50 studni przy hurtowych ofertach — zapobiega nadmiarowemu próbowaniu
    // i głodzeniu sieci/backendu.
    const sample = wellsArr.length > 50 ? wellsArr.slice(0, 50) : wellsArr;
    const batch = [];
    sample.forEach(function (w) {
        if (!w.config || w.config.length === 0) return;
        batch.push({
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
    });
    if (batch.length === 0) return;
    // Batch: 1 POST zamiast N (fallback na single w bridge przy starym BE).
    if (typeof window.telemetryRecordConfigBatch === 'function') {
        try {
            window.telemetryRecordConfigBatch(batch);
        } catch (_e) {
            // silent
        }
        return;
    }
    if (typeof window.telemetryRecordConfig !== 'function') return;
    batch.forEach(function (opts) {
        try {
            window.telemetryRecordConfig(opts);
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
    const prevMap = new Map(
        existingDoc.wells.map(function (w) {
            return [w.id, JSON.stringify(_wellSnapshot(w))];
        })
    );
    return wellsArr.filter(function (w) {
        const prev = prevMap.get(w.id);
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
                    price: _moneyRoundOfferSave(stats.price),
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
        magazynDennica: well.magazynDennica,
        magazynNadbudowa: well.magazynNadbudowa,
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
window.stripWellRuntimeFields = stripWellRuntimeFields;
window.saveOfferStudnie = saveOfferStudnie;
