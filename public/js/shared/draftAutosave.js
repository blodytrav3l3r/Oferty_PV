// @ts-check
/* ===== DRAFT AUTOSAVE (P1.1b) — wpięcie draftu w hooki zapisu, protokół docs/plans/e2-draft-review.md =====
 * Draft to ODRĘBNA warstwa obok SAVED: zapis draftu NIGDY nie woła sieci, a ścieżki
 * SAVED (saveOfferStudnie, saveCurrentOrder/saveOrderStudnie, saveOffer, saveRuryOrder)
 * NIGDY nie czytają draftu — łączy je tylko kasowanie klucza po sukcesie i jawny restore.
 * Zbieranie: delegowane zdarzenia input/change/click + debounce 2000 ms + zapis tylko
 * gdy snapshot różni się od ostatniego (bramka dirty dla studni: _excelDirty/_wizardDirty).
 * Flush synchroniczny: beforeunload/pagehide/visibilitychange + router SPA przy zmianie modułu.
 */

var DRAFT_AUTOSAVE_DEBOUNCE_MS = 2000;
var DRAFT_MODAL_ID = 'sok-draft-modal';

/** Zarejestrowane rodzaje w tym module/iframe (np. studnie: offer+order). */
var _draftInitedKinds = [];
/** Ostatnio zapisany kanoniczny JSON per klucz (bramka diff, brak zapisu bez zmian). */
var _draftLastWritten = {};
/** Karta w trybie zdegradowanym po quota (drafty wyłączone do końca sesji). */
var _draftSessionDisabled = false;
/** Flaga oversize per klucz (jeden toast na klucz, nie spam). */
var _draftOversizeNoted = {};
/** Ostatni sweep per userId (throttle 60 s). */
var _draftLastSweepAt = {};
/** Ostatni toast multi-tab per klucz (throttle 5 s). */
var _draftLastTabToastAt = {};
/** Czy globalne listenery już podpięte. */
var _draftListenersBound = false;
var _draftDebounceTimer = null;

/**
 * Bezpieczny dostęp do globali modułu (klasyczne skrypty, typeof-guard).
 * @param {string} name
 * @returns {*}
 */
function _draftG(name) {
    try {
        if (typeof window !== 'undefined' && window[name] !== undefined) return window[name];
    } catch (_e) {}
    return undefined;
}

/**
 * Toast gdy dostępny (nigdy nie rzuca).
 * @param {string} msg
 * @param {'info'|'warning'|'error'|'success'} [type]
 */
function _draftToast(msg, type) {
    try {
        if (typeof showToast === 'function') showToast(msg, type || 'info');
    } catch (_e) {}
}

/**
 * ID zalogowanego użytkownika (klucz namespaced per-user). Brak → brak draftu.
 * @returns {string|null}
 */
function _draftUserId() {
    var u = undefined;
    try {
        u = typeof currentUser !== 'undefined' ? currentUser : undefined;
    } catch (_e) {}
    if (!u) u = _draftG('currentUser');
    if (u && (u.id === 0 || u.id)) return String(u.id);
    return null;
}

/**
 * Czy moduł studni jest w podglądzie (read-only nie generuje draftu).
 * @returns {boolean}
 */
function _draftStudniePreview() {
    try {
        if (typeof isPreviewMode !== 'undefined') return !!isPreviewMode;
    } catch (_e) {}
    var w = _draftG('isPreviewMode');
    return !!w;
}

/** Konfiguracje rodzajów: aktywność, docId, źródła SAVED. */
var _draftKindConfig = {
    offer_studnie: {
        isActive: function () {
            var oe = undefined;
            try {
                oe = typeof orderEditMode !== 'undefined' ? orderEditMode : undefined;
            } catch (_e) {}
            if (oe === undefined) oe = _draftG('orderEditMode');
            return !oe && !_draftStudniePreview();
        },
        getDocId: function () {
            try {
                if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie)
                    return editingOfferIdStudnie;
            } catch (_e) {}
            return 'new';
        },
        getSavedDoc: function (docId) {
            try {
                if (typeof getOfferStudnieById === 'function' && docId && docId !== 'new')
                    return getOfferStudnieById(docId) || null;
            } catch (_e) {}
            try {
                if (typeof offersStudnie !== 'undefined' && Array.isArray(offersStudnie))
                    return (
                        offersStudnie.find(function (o) {
                            return o && o.id === docId;
                        }) || null
                    );
            } catch (_e2) {}
            return null;
        }
    },
    order_studnie: {
        isActive: function () {
            var oe = undefined;
            try {
                oe = typeof orderEditMode !== 'undefined' ? orderEditMode : undefined;
            } catch (_e) {}
            if (oe === undefined) oe = _draftG('orderEditMode');
            return !!oe && !_draftStudniePreview();
        },
        getDocId: function () {
            var oe = undefined;
            try {
                oe = typeof orderEditMode !== 'undefined' ? orderEditMode : undefined;
            } catch (_e) {}
            if (oe === undefined) oe = _draftG('orderEditMode');
            if (oe && oe.orderId) return oe.orderId;
            if (oe && oe.order && oe.order.id) return oe.order.id;
            return null;
        },
        getSavedDoc: function (docId) {
            // Świeży detail z bieżącej edycji wygrywa z tablicą listy (stale full:
            // saveCurrentOrder/saveOrderStudnie mutują orderEditMode.order i PATCHują,
            // a ordersStudnie nie jest odświeżana). Porównanie ze stale = wieczny popup.
            var oe2 = undefined;
            try {
                oe2 = typeof orderEditMode !== 'undefined' ? orderEditMode : undefined;
            } catch (_e0) {}
            if (oe2 === undefined) oe2 = _draftG('orderEditMode');
            try {
                if (oe2 && oe2.order && (oe2.orderId === docId || oe2.order.id === docId))
                    return oe2.order;
            } catch (_e1) {}
            try {
                if (typeof ordersStudnie !== 'undefined' && Array.isArray(ordersStudnie))
                    return (
                        ordersStudnie.find(function (o) {
                            return o && o.id === docId;
                        }) || null
                    );
            } catch (_e) {}
            return null;
        }
    },
    offer_rury: {
        isActive: function () {
            return !_draftG('orderEditMode');
        },
        getDocId: function () {
            try {
                if (typeof editingOfferId !== 'undefined' && editingOfferId) return editingOfferId;
            } catch (_e) {}
            var w = _draftG('editingOfferId');
            return w || 'new';
        },
        getSavedDoc: function (docId) {
            try {
                if (typeof getOfferRuryById === 'function' && docId && docId !== 'new')
                    return getOfferRuryById(docId) || null;
            } catch (_e) {}
            try {
                if (typeof offers !== 'undefined' && Array.isArray(offers))
                    return (
                        offers.find(function (o) {
                            return o && o.id === docId;
                        }) || null
                    );
            } catch (_e2) {}
            return null;
        }
    },
    order_rury: {
        isActive: function () {
            return !!_draftG('orderEditMode');
        },
        getDocId: function () {
            try {
                if (typeof editingRuryOrderId !== 'undefined' && editingRuryOrderId)
                    return editingRuryOrderId;
            } catch (_e) {}
            return _draftG('editingRuryOrderId') || null;
        },
        getSavedDoc: function (docId) {
            try {
                if (typeof ordersRury !== 'undefined' && Array.isArray(ordersRury))
                    return (
                        ordersRury.find(function (o) {
                            return o && o.id === docId;
                        }) || null
                    );
            } catch (_e) {}
            return null;
        }
    }
};

/**
 * Bieżący snapshot live dla rodzaju (surowe źródła, klonuje pickDraftPayload).
 * @param {string} kind
 * @returns {object}
 */
function _draftCollectLive(kind) {
    var snap = {};
    try {
        if (typeof getOfferFormFields === 'function') snap.fields = getOfferFormFields();
    } catch (_e) {}
    if (kind === 'offer_studnie' || kind === 'order_studnie') {
        try {
            if (typeof wells !== 'undefined' && Array.isArray(wells)) snap.wells = wells;
        } catch (_e2) {}
        try {
            if (typeof wellDiscounts !== 'undefined' && wellDiscounts)
                snap.wellDiscounts = wellDiscounts;
        } catch (_e3) {}
        try {
            if (typeof visiblePrzejsciaTypes !== 'undefined' && visiblePrzejsciaTypes)
                snap.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
        } catch (_e4) {}
        try {
            if (typeof currentTransportMode !== 'undefined')
                snap.transportMode = currentTransportMode;
        } catch (_e5) {}
        try {
            if (typeof getWizardGlobalParams === 'function')
                snap.wizardGlobalParams = getWizardGlobalParams();
        } catch (_e6) {}
        try {
            if (typeof currentWizardStep !== 'undefined') snap.wizardStep = currentWizardStep;
        } catch (_e7) {}
    } else {
        try {
            if (kind === 'offer_rury' && typeof currentOfferItems !== 'undefined')
                snap.items = currentOfferItems;
            else if (kind === 'order_rury' && typeof orderCurrentItems !== 'undefined')
                snap.items = orderCurrentItems;
        } catch (_e8) {}
        if (!snap.items) {
            var wItems =
                kind === 'offer_rury' ? _draftG('currentOfferItems') : _draftG('orderCurrentItems');
            if (Array.isArray(wItems)) snap.items = wItems;
        }
        var tm = _draftG('currentRuryTransportMode');
        if (tm !== undefined) snap.transportMode = tm;
    }
    return window.draftStore.pickDraftPayload(snap);
}

/**
 * Payload kanoniczny z dokumentu SAVED (te same klucze co live → porównywalne).
 * @param {string} kind
 * @param {object|null} doc
 * @returns {object|null}
 */
function _draftSavedPayload(kind, doc) {
    if (!doc) return null;
    var raw = {};
    if (doc.number !== undefined || doc.clientName !== undefined) {
        raw.fields = {};
        window.draftStore.FIELD_KEYS.forEach(function (k) {
            if (doc[k] !== undefined) raw.fields[k] = doc[k];
        });
    }
    if (Array.isArray(doc.wells)) raw.wells = doc.wells;
    else if (Array.isArray(doc.items)) raw.items = doc.items;
    if (doc.wellDiscounts) raw.wellDiscounts = doc.wellDiscounts;
    if (doc.visiblePrzejsciaTypes) raw.visiblePrzejsciaTypes = doc.visiblePrzejsciaTypes;
    if (doc.transportMode !== undefined) raw.transportMode = doc.transportMode;
    if (doc.wizard && typeof doc.wizard === 'object') {
        if (doc.wizard.globalParams) raw.wizardGlobalParams = doc.wizard.globalParams;
        if (doc.wizard.currentStep !== undefined) raw.wizardStep = doc.wizard.currentStep;
    }
    if (kind === 'order_rury' && !raw.items && Array.isArray(doc.items)) raw.items = doc.items;
    return window.draftStore.pickDraftPayload(raw);
}

/**
 * Pusty payload SAVED dla nowych dokumentów (porównanie ignoruje pola ulotne i wizard).
 * Domyślne pól jak w clearOfferFormFields.
 * @param {string} kind
 * @returns {object}
 */
function _draftEmptySavedPayload(kind) {
    var raw = {
        fields: {
            number: '',
            date: '',
            clientName: '',
            clientNumber: '',
            clientNip: '',
            clientAddress: '',
            clientContact: '',
            investName: '',
            investAddress: '',
            investContractor: '',
            notes: '',
            paymentTerms: 'Do uzgodnienia lub według indywidualnych warunków handlowych.',
            validity: '7 dni',
            transportKm: 100,
            transportRate: 10
        },
        wellDiscounts: {},
        visiblePrzejsciaTypes: [],
        transportMode: 'full'
    };
    if (kind === 'offer_rury' || kind === 'order_rury') raw.items = [];
    else raw.wells = [];
    return window.draftStore.pickDraftPayload(raw);
}

/**
 * Klucze live studni nigdy niezapisywane w zamówieniu (DTO allowlist, nie denylist).
 * Fallback gdy orderDto.js niedostępny — pełna lista w orderDto.js (ORDER_WELL_FIELDS
 * + ORDER_CONFIG_ITEM_FIELDS + ORDER_PRZEJSCIE_FIELDS + komentarz o pominiętych).
 */
var _DRAFT_ORDER_WELL_DROP = [
    '_lastAutoConfig',
    '_lastAutoTelemetryId',
    '_aiRankInfo',
    '_lastSolveInputHash',
    '__resCache',
    '_psiaBudaBackup',
    'configErrors',
    'configStatus',
    'wellHeight',
    'warehouse'
];

/**
 * Rzutuje wells live do przestrzeni SAVED dla zamówień studni.
 * SAVED order.wells to DTO (toOrderWellsDTO, SSoT w orderDto.js) — porównanie
 * full↔DTO zawsze widziałoby różnicę (solver dopisuje configStatus/configErrors).
 * @param {string} kind
 * @param {*} wells
 * @returns {*}
 */
function _draftProjectWells(kind, wells) {
    if (kind !== 'order_studnie' || !Array.isArray(wells)) return wells;
    var proj = _draftG('toOrderWellsDTO');
    if (typeof toOrderWellsDTO === 'function') proj = toOrderWellsDTO;
    if (typeof proj === 'function') {
        try {
            var dto = proj(wells);
            if (Array.isArray(dto)) return dto;
        } catch (_e) {}
    }
    return wells.map(function (w) {
        if (!w || typeof w !== 'object') return w;
        var copy = {};
        Object.keys(w).forEach(function (k) {
            if (_DRAFT_ORDER_WELL_DROP.indexOf(k) === -1) copy[k] = w[k];
        });
        return copy;
    });
}

/**
 * Pola efemeryczne studni (load/solver/derived) — nigdy tresc uzytkownika.
 * Load dokleja je po odczycie (ensureElemIds/recalc/sync), wiec live po wejsciu
 * zawsze roznilby sie od SAVED. Payload draftu ich NIE traci (restore w calosci),
 * czysci je tylko warstwa porownywalna.
 */
var _DRAFT_WELL_EPHEMERAL = [
    '_lastAutoConfig',
    '_lastAutoTelemetryId',
    '_aiRankInfo',
    '_lastSolveInputHash',
    '__resCache',
    '_psiaBudaBackup',
    'configErrors',
    'configStatus',
    'wellHeight'
];

/**
 * Pola efemeryczne pozycji config/przejscia (_elemId to tozsamosc PZ, nie tresc;
 * reszta to cache/solver). Czyszczone tylko w porownaniu, nie w payladzie.
 */
var _DRAFT_ITEM_EPHEMERAL = ['_elemId', '__resCache', '_addedAt', '_xp', 'isPlaceholder'];

/**
 * Czyści kopię pozycji config/przejscia z pól efemerycznych (nie mutuje wejścia).
 * @param {*} item
 * @returns {*}
 */
function _draftStripEphemeralItem(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    var copy = {};
    Object.keys(item).forEach(function (k) {
        if (_DRAFT_ITEM_EPHEMERAL.indexOf(k) === -1) copy[k] = item[k];
    });
    return copy;
}

/**
 * Czyści kopię studni z pól efemerycznych well-level + item-level (nie mutuje).
 * @param {*} well
 * @returns {*}
 */
function _draftStripEphemeralWell(well) {
    if (!well || typeof well !== 'object') return well;
    var copy = {};
    Object.keys(well).forEach(function (k) {
        if (_DRAFT_WELL_EPHEMERAL.indexOf(k) !== -1) return;
        if (k === 'config' && Array.isArray(well.config))
            copy.config = well.config.map(_draftStripEphemeralItem);
        else if (k === 'przejscia' && Array.isArray(well.przejscia))
            copy.przejscia = well.przejscia.map(_draftStripEphemeralItem);
        else copy[k] = well[k];
    });
    return copy;
}

/**
 * Fallbacki pól nagłówka — 1:1 z getOfferFormFields/setOfferFormFields
 * (offerCrudCommon.js) i enterOrderEditMode (orderCrud.js:829-835).
 * Dokumenty legacy/z kreacji (zamówienie bez validity...) nie niosą kluczy,
 * a live zawsze — bez normalizacji braki to wieczny ghost.
 */
var _DRAFT_FIELD_FALLBACKS = {
    transportKm: 100,
    transportRate: 10,
    validity: '7 dni',
    paymentTerms: 'Do uzgodnienia lub według indywidualnych warunków handlowych.'
};

/**
 * Payload w przestrzeni porównywalnej (obie strony tą samą projekcją).
 * order_studnie: DTO (allowlist SSoT) + strip _elemId w pozycjach (PZ-id to nie
 * tresc zmiany); offer_studnie: strip efemerycznych (DTO nie obowiazuje ofert);
 * transportMode undefined traktuj jak 'full' (default load, legacy SAVED).
 * Zamówienia: wizard to szum (tiles z oferty, step wymuszony 5, restore go nie
 * czyta) — obie strony bez kluczy wizarda. Pola: brak klucza = fallback UI.
 * @param {string} kind
 * @param {*} payload
 * @returns {object}
 */
function _draftComparablePayload(kind, payload) {
    var src = payload && typeof payload === 'object' ? payload : {};
    var out = {};
    Object.keys(src).forEach(function (k) {
        out[k] = src[k];
    });
    if (out.transportMode === undefined) out.transportMode = 'full';
    if (kind === 'order_studnie' || kind === 'order_rury') {
        delete out.wizardGlobalParams;
        delete out.wizardStep;
    }
    if (out.fields && typeof out.fields === 'object') {
        var fields = {};
        Object.keys(out.fields).forEach(function (k) {
            fields[k] = out.fields[k];
        });
        Object.keys(_DRAFT_FIELD_FALLBACKS).forEach(function (k) {
            if (fields[k] === undefined || fields[k] === null)
                fields[k] = _DRAFT_FIELD_FALLBACKS[k];
        });
        // Puste stringi: brak klucza w legacy = '' w live (collect zwraca ''
        // dla pustych inputów). Liczby/daty/numeru to nie dotyczy.
        window.draftStore.FIELD_KEYS.forEach(function (k) {
            if (k === 'transportKm' || k === 'transportRate' || k === 'date' || k === 'number')
                return;
            if (fields[k] === undefined || fields[k] === null) fields[k] = '';
        });
        out.fields = fields;
    }
    if (!Array.isArray(src.wells)) return out;
    if (kind === 'order_studnie') {
        var dto = _draftProjectWells(kind, src.wells);
        out.wells = dto.map(function (w) {
            if (!w || typeof w !== 'object') return w;
            var copy = {};
            Object.keys(w).forEach(function (k) {
                if (k === 'config' && Array.isArray(w.config))
                    copy.config = w.config.map(_draftStripEphemeralItem);
                else if (k === 'przejscia' && Array.isArray(w.przejscia))
                    copy.przejscia = w.przejscia.map(_draftStripEphemeralItem);
                else copy[k] = w[k];
            });
            return copy;
        });
        return out;
    }
    out.wells = src.wells.map(_draftStripEphemeralWell);
    return out;
}

/**
 * Jedyny komparator draft↔SAVED (SSoT recovery i autosave-write).
 * @param {string} kind
 * @param {*} draftPayload
 * @param {*} savedPayload
 * @param {boolean} isNewDoc
 * @returns {boolean} true = równoważne (brak recovery, brak zapisu)
 */
function _draftEquivalent(kind, draftPayload, savedPayload, isNewDoc) {
    if (!draftPayload) return true;
    if (!savedPayload) return false;
    var opts = isNewDoc ? { ignoreVolatile: true, ignoreWizard: true } : undefined;
    var a = _draftComparablePayload(kind, draftPayload);
    var b = _draftComparablePayload(kind, savedPayload);
    // date/number: brak po którejkolwiek stronie (legacy, kreacja) = drop obu.
    // Bez tego live (dzisiejsza data z inputa) dryfuje codziennie vs brak.
    ['date', 'number'].forEach(function (k) {
        if (
            a.fields &&
            b.fields &&
            (a.fields[k] === undefined ||
                a.fields[k] === null ||
                a.fields[k] === '' ||
                b.fields[k] === undefined ||
                b.fields[k] === null ||
                b.fields[k] === '')
        ) {
            delete a.fields[k];
            delete b.fields[k];
        }
    });
    var ca = window.draftStore.canonicalPayloadJson(a, opts);
    var cb = window.draftStore.canonicalPayloadJson(b, opts);
    return !!ca && ca === cb;
}

/**
 * Bieżący SAVED w przestrzeni porównywalnej dla rodzaju i docId.
 * Zwraca null (defensive, z logiem) gdy istniejący dokument jest slim
 * (lista bez wells/items — brak danych = brak decyzji recovery).
 * @param {string} kind
 * @param {object} cfg
 * @param {string} docId
 * @returns {{payload: object|null, savedDoc: object|null, isNew: boolean, slim: boolean}}
 */
function _draftCurrentSaved(kind, cfg, docId) {
    var savedDoc = null;
    try {
        savedDoc = docId === 'new' ? null : cfg.getSavedDoc(docId);
    } catch (_e) {}
    var isNew = docId === 'new' || savedDoc === null;
    if (isNew)
        return {
            payload: _draftEmptySavedPayload(kind),
            savedDoc: savedDoc,
            isNew: true,
            slim: false
        };
    var hasRows = Array.isArray(savedDoc.wells) || Array.isArray(savedDoc.items);
    if (!hasRows) {
        try {
            var log = _draftG('logger');
            if (log && typeof log.warn === 'function')
                log.warn('draft', 'SAVED slim — pomijam decyzję recovery', {
                    kind: kind,
                    docId: docId
                });
        } catch (_e2) {}
        return { payload: null, savedDoc: savedDoc, isNew: false, slim: true };
    }
    return {
        payload: _draftSavedPayload(kind, savedDoc),
        savedDoc: savedDoc,
        isNew: false,
        slim: false
    };
}
/** Early-hint dirty (nie źródło prawdy — rozstrzyga _draftEquivalent w _draftWriteKind). */
function _draftIsDirty(kind) {
    if (kind === 'offer_rury' || kind === 'order_rury') return true;
    try {
        if (typeof _excelDirty !== 'undefined' && _excelDirty) return true;
    } catch (_e) {}
    if (_draftG('_excelDirty')) return true;
    if (_draftG('_wizardDirty')) return true;
    return true; // diff poniżej i tak odrzuci brak zmian
}

/**
 * Self-heal martwego ghosta: klucz istnieje, ale jego draft jest równoważny
 * SAVED (duch po mutacjach load / wycofanej edycji). Kasuje TYLKO wtedy —
 * draft z obcą treścią (porzucona edycja) zostaje i czeka na Odrzuć.
 * @param {string} key
 * @param {string} kind
 * @param {{payload: object|null, isNew: boolean, slim: boolean}} cur
 * @returns {boolean} true = skasowano martwy klucz
 */
function _draftRemoveIfDead(key, kind, cur) {
    try {
        if (!key || !window.draftStore || !cur || cur.slim || !cur.payload) return false;
        var loaded = window.draftStore.loadDraft(window.localStorage, key);
        if (loaded.status !== 'ok' || !loaded.draft) return false;
        if (!_draftEquivalent(kind, loaded.draft.payload, cur.payload, cur.isNew)) return false;
        window.draftStore.removeDraft(window.localStorage, key);
        delete _draftLastWritten[key];
        delete _draftOversizeNoted[key];
        return true;
    } catch (_e) {
        return false;
    }
}

/**
 * Jednorazowy sweep przed zapisem (throttle 60 s per user).
 * @param {string} userId
 */
function _draftMaybeSweep(userId) {
    var now = Date.now();
    if (_draftLastSweepAt[userId] && now - _draftLastSweepAt[userId] < 60000) return;
    _draftLastSweepAt[userId] = now;
    try {
        window.draftStore.sweepDrafts(window.localStorage, userId, { now: now });
    } catch (_e) {}
}

/**
 * Właściwy zapis draftu dla rodzaju. Zwraca false gdy pominięto/zablokowano.
 * @param {string} kind
 * @param {boolean} isFlush wywołanie synchroniczne przy wyjściu (bez toastów-spamu)
 * @returns {boolean}
 */
function _draftWriteKind(kind, isFlush) {
    if (_draftSessionDisabled) return false;
    var cfg = _draftKindConfig[kind];
    if (!cfg || !cfg.isActive()) return false;
    var userId = _draftUserId();
    if (!userId) return false;
    var docId = cfg.getDocId();
    if (!docId) return false;
    if (!_draftIsDirty(kind)) return false;
    var key = window.draftStore.buildDraftKey(userId, kind, docId);
    if (!key) return false;
    var payload = _draftCollectLive(kind);
    var canon = window.draftStore.canonicalPayloadJson(payload);
    if (!canon) return false;
    if (_draftLastWritten[key] === canon) return false;
    // Idempotency guard (SSoT z recovery): live równoważny SAVED → brak zapisu.
    // Bez tego flush po czystym SAVED wskrzeszał draft-ducha (slim/DTO robiły resztę).
    // Slim (payload null): brak podstaw do bramki — zapis według _draftLastWritten.
    var cur = _draftCurrentSaved(kind, cfg, docId);
    if (cur && !cur.slim && _draftEquivalent(kind, payload, cur.payload, cur.isNew)) {
        // Self-heal: live czysty, a pod kluczem lezy martwy ghost → sprzatnij.
        _draftRemoveIfDead(key, kind, cur);
        return false;
    }
    _draftMaybeSweep(userId);
    var savedDoc = cur ? cur.savedDoc : null;
    var baseVersion = savedDoc && typeof savedDoc.version === 'number' ? savedDoc.version : null;
    var draft = window.draftStore.buildDraft({
        userId: userId,
        kind: kind,
        docId: docId,
        baseVersion: baseVersion,
        payload: payload
    });
    if (!draft) return false;
    var res = window.draftStore.saveDraft(window.localStorage, draft);
    if (res.ok) {
        _draftLastWritten[key] = canon;
        return true;
    }
    if (res.reason === 'oversize' && !_draftOversizeNoted[key]) {
        _draftOversizeNoted[key] = true;
        if (!isFlush)
            _draftToast(
                '<i data-lucide="alert-triangle"></i> Draft zbyt duży — chroń się jawnym zapisem',
                'warning'
            );
    } else if (res.reason === 'quota' && !_draftSessionDisabled) {
        _draftSessionDisabled = true;
        if (!isFlush)
            _draftToast(
                '<i data-lucide="alert-triangle"></i> Brak miejsca na draft — zapis jawny działa dalej',
                'warning'
            );
    }
    return false;
}

/**
 * Zapis wszystkich aktywnych rodzajów (debounce 2000 ms).
 */
function _draftScheduleSave() {
    if (_draftSessionDisabled) return;
    if (_draftInitedKinds.length === 0) return;
    if (_draftDebounceTimer) clearTimeout(_draftDebounceTimer);
    _draftDebounceTimer = setTimeout(function () {
        _draftDebounceTimer = null;
        _draftInitedKinds.forEach(function (kind) {
            try {
                _draftWriteKind(kind, false);
            } catch (_e) {}
        });
    }, DRAFT_AUTOSAVE_DEBOUNCE_MS);
}

/**
 * Synchroniczny flush wszystkich aktywnych rodzajów (wyjście z modułu/karty).
 */
function _draftFlushAll() {
    _draftInitedKinds.forEach(function (kind) {
        try {
            _draftWriteKind(kind, true);
        } catch (_e) {}
    });
}

/**
 * Anuluje pending debounce (wyścig save/discard → timer sprzed operacji).
 */
function _draftCancelPending() {
    try {
        if (_draftDebounceTimer) {
            clearTimeout(_draftDebounceTimer);
            _draftDebounceTimer = null;
        }
    } catch (_e0) {}
}

/**
 * Kasuje draft kontekstu (sukces SAVED / nowa oferta / DELETE). Kasowanie TYLKO
 * po potwierdzonym sukcesie woła caller — ta funkcja sama nie ocenia wyniku.
 * @param {string} kind
 * @param {*} oldDocId
 * @param {*} [newDocId]
 */
function _draftClearContext(kind, oldDocId, newDocId) {
    // Wyścig save→debounce: timer sprzed zapisu nie może pisać po sukcesie SAVED.
    _draftCancelPending();
    var userId = _draftUserId();
    if (!userId) return;
    [oldDocId, newDocId].forEach(function (d) {
        if (d === undefined || d === null) return;
        var key = window.draftStore.buildDraftKey(userId, kind, d);
        if (key) {
            window.draftStore.removeDraft(window.localStorage, key);
            delete _draftLastWritten[key];
            delete _draftOversizeNoted[key];
        }
    });
    try {
        _draftHideDraftModal();
    } catch (_e) {}
}

/**
 * Format daty draftu do popupa (pl-PL, nigdy nie rzuca).
 * @param {string} iso
 * @returns {string}
 */
function _draftFmtDate(iso) {
    try {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso || '');
        return d.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (_e) {
        return String(iso || '');
    }
}

/**
 * Pobranie helpera escapującego (legacy bridge z escapeHtml.js).
 * @param {string} name
 * @returns {function(string): string}
 */
function _draftEscaper(name) {
    try {
        if (typeof window !== 'undefined' && typeof window[name] === 'function')
            return window[name];
    } catch (_e) {}
    return function (s) {
        return String(s === null || s === undefined ? '' : s);
    };
}

/**
 * Zamyka popup recovery (modalCore.closeModal gdy dostępny, inaczej usuwa overlay).
 * Escape / click-outside modalCore zamyka sam — draft zostaje do TTL / jawnego Odrzuć.
 */
function _draftHideDraftModal() {
    try {
        var closer = _draftG('closeModal');
        if (typeof closeModal === 'function') closer = closeModal;
        if (typeof closer === 'function') {
            try {
                closer(DRAFT_MODAL_ID);
            } catch (_e2) {}
        }
        var el = document.getElementById(DRAFT_MODAL_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (_e) {}
}

/** Alias wstecznej kompatybilności (eksport window.draftAutosave.hideBanner). */
function _draftHideBanner() {
    _draftHideDraftModal();
}

/**
 * Pobiera draft do pliku JSON (awaryjny eksport).
 * @param {object} draft
 * @param {string} kind
 */
function _draftDownloadJson(draft, kind) {
    try {
        var docId = (draft && draft.docId) || 'new';
        var json = JSON.stringify(draft, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download =
            'draft_' + String(kind) + '_' + String(docId).replace(/[^A-Za-z0-9_-]/g, '_') + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (_e) {
        _draftToast('Nie udało się pobrać draftu', 'error');
    }
}

/**
 * Wypełnia formularz draftem jako NIEZAPISANE zmiany (restore nigdy nie zapisuje).
 * @param {string} kind
 * @param {object} draft
 */
function _draftApply(kind, draft) {
    var payload = (draft && draft.payload) || {};
    if (typeof setOfferFormFields === 'function' && payload.fields) {
        try {
            setOfferFormFields(payload.fields);
        } catch (_e) {}
    }
    if (kind === 'offer_studnie' || kind === 'order_studnie') {
        if (Array.isArray(payload.wells)) {
            var wellsClone =
                window.draftStore.pickDraftPayload({ wells: payload.wells }).wells || [];
            try {
                wells = wellsClone;
            } catch (_e2) {}
        }
        if (payload.wellDiscounts && typeof payload.wellDiscounts === 'object') {
            var dwClone =
                window.draftStore.pickDraftPayload({ wellDiscounts: payload.wellDiscounts })
                    .wellDiscounts || {};
            try {
                wellDiscounts = dwClone;
            } catch (_e3) {}
            var wWd = _draftG('wellDiscounts');
            if (wWd === undefined) {
                try {
                    window.wellDiscounts = dwClone;
                } catch (_e4) {}
            }
        }
        if (Array.isArray(payload.visiblePrzejsciaTypes)) {
            try {
                visiblePrzejsciaTypes = new Set(payload.visiblePrzejsciaTypes);
            } catch (_e5) {}
        }
        if (payload.transportMode !== undefined) {
            try {
                currentTransportMode = payload.transportMode;
            } catch (_e6) {}
        }
        if (
            (payload.wizardGlobalParams || payload.wizardStep !== undefined) &&
            typeof restoreWizardState === 'function'
        ) {
            try {
                restoreWizardState(
                    {
                        globalParams: payload.wizardGlobalParams || {},
                        currentStep: payload.wizardStep
                    },
                    true
                );
            } catch (_e7) {}
        }
        try {
            window._wizardDirty = true;
        } catch (_e8) {}
        try {
            _excelDirty = true;
        } catch (_e9) {}
        if (typeof refreshAll === 'function') {
            try {
                refreshAll();
            } catch (_e10) {}
        }
        if (typeof renderOfferSummary === 'function') {
            try {
                renderOfferSummary();
            } catch (_e11) {}
        }
    } else {
        var itemsClone =
            window.draftStore.pickDraftPayload({ items: payload.items || [] }).items || [];
        if (kind === 'offer_rury') {
            try {
                currentOfferItems = itemsClone;
            } catch (_e12) {}
            try {
                window.currentOfferItems = itemsClone;
            } catch (_e13) {}
        } else {
            try {
                orderCurrentItems = itemsClone;
            } catch (_e14) {}
            try {
                window.orderCurrentItems = itemsClone;
            } catch (_e15) {}
        }
        // Zabezpieczenie transportu odtwarzalne z pozycji (jak przy loadOffer).
        try {
            window.zabezpieczenieTransportuEnabled = itemsClone.some(function (i) {
                return i && i.productId && String(i.productId).indexOf('ZT-') === 0;
            });
        } catch (_e16) {}
        if (typeof updateZabezpieczenieTransportuUI === 'function') {
            try {
                updateZabezpieczenieTransportuUI();
            } catch (_e17) {}
        }
        if (payload.transportMode !== undefined) {
            try {
                currentRuryTransportMode = payload.transportMode;
            } catch (_e18) {}
            try {
                window.currentRuryTransportMode = payload.transportMode;
            } catch (_e19) {}
        }
        if (typeof renderOfferItems === 'function') {
            try {
                renderOfferItems();
            } catch (_e20) {}
        }
        if (typeof updateTransportCostSummary === 'function') {
            try {
                updateTransportCostSummary();
            } catch (_e21) {}
        }
    }
    _draftToast(
        '<i data-lucide="history"></i> Draft przywrócony jako niezapisane zmiany — zapisz jawnie',
        'warning'
    );
}

/**
 * Pokazuje popup recovery (Przywróć / Pobierz JSON / Odrzuć) w stylu projektu
 * (window.showModal + .modal, jak reszta popupów — patrz docs/UI_GUIDELINES.md §6).
 * Escape / click-outside zamyka bez usuwania draftu (draft żyje do TTL / Odrzuć).
 * @param {string} kind
 * @param {object} draft
 * @param {object|null} savedDoc
 */
function _draftShowDraftModal(kind, draft, savedDoc) {
    _draftHideDraftModal();
    var escapeHtml = _draftEscaper('escapeHtml');
    var escapeHtmlAttr = _draftEscaper('escapeHtmlAttr');
    var showModalFn = _draftG('showModal');
    if (typeof showModal === 'function') showModalFn = showModal;
    if (typeof showModalFn !== 'function') {
        _draftToast('Znaleziono niezapisany draft — otwórz moduł ponownie', 'warning');
        return;
    }
    var counts = window.draftStore.summarizeDraftCounts(draft.payload);
    var n =
        kind === 'offer_rury' || kind === 'order_rury'
            ? counts.items + ' poz.'
            : counts.wells + ' stud.';
    // Tekst przez escapeHtml, atrybuty przez escapeHtmlAttr (reguła P0.3).
    var html =
        '<div class="modal">' +
        '<div class="modal-header"><h3 id="sok-draft-modal-title"><i data-lucide="history" aria-hidden="true"></i> ' +
        escapeHtml('Znaleziono niezapisany draft') +
        '</h3><button type="button" class="btn-icon" data-draft-act="close" aria-label="' +
        escapeHtmlAttr('Zamknij') +
        '"><i data-lucide="x" aria-hidden="true"></i></button></div>' +
        '<div class="text-muted fs-xs-muted" title="' +
        escapeHtmlAttr(draft.updatedAt || '') +
        '">' +
        escapeHtml(
            'Draft z ' +
                _draftFmtDate(draft.updatedAt) +
                ' (' +
                n +
                ') różni się od zapisanej wersji. Przywrócenie nie zapisuje — wymagany jawny zapis.'
        ) +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-primary btn-sm" data-draft-act="restore"><i data-lucide="history" aria-hidden="true"></i> ' +
        escapeHtml('Przywróć') +
        '</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-draft-act="download"><i data-lucide="download" aria-hidden="true"></i> ' +
        escapeHtml('Pobierz JSON') +
        '</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-draft-act="discard"><i data-lucide="x" aria-hidden="true"></i> ' +
        escapeHtml('Odrzuć') +
        '</button>' +
        '</div>' +
        '</div>';
    var overlay = null;
    try {
        overlay = showModalFn({
            id: DRAFT_MODAL_ID,
            titleId: 'sok-draft-modal-title',
            html: html,
            onClose: function () {
                _draftHideDraftModal();
            }
        });
    } catch (_e) {
        return;
    }
    if (!overlay) return;
    overlay.addEventListener('click', function (ev) {
        var t = ev.target;
        var btn = null;
        try {
            btn = t && typeof t.closest === 'function' ? t.closest('[data-draft-act]') : null;
        } catch (_e3) {}
        if (!btn) return;
        var act = btn.getAttribute('data-draft-act');
        if (act === 'download') {
            _draftDownloadJson(draft, kind);
        } else if (act === 'discard') {
            // Odrzuć = pełny reset stanu draftu: kasuj klucz i zabij pending
            // debounce sprzed kliknięcia (inaczej timer wskrzesza draft po Odśwież).
            _draftCancelPending();
            var discarded = false;
            var userId = _draftUserId();
            if (userId) {
                var key = window.draftStore.buildDraftKey(userId, kind, draft.docId);
                if (key) {
                    window.draftStore.removeDraft(window.localStorage, key);
                    discarded = true;
                }
            }
            _draftHideDraftModal();
            if (discarded) _draftToast('Draft odrzucony (zapisana wersja nietknięta)', 'info');
            else _draftToast('Nie udało się odrzucić draftu (brak użytkownika)', 'error');
        } else if (act === 'restore') {
            _draftHideDraftModal();
            _draftRestoreFlow(kind, draft, savedDoc);
        } else if (act === 'close') {
            _draftHideDraftModal();
        }
    });
    try {
        var lucideG = _draftG('lucide');
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            lucide.createIcons({ root: overlay });
        else if (lucideG && lucideG.createIcons) lucideG.createIcons({ root: overlay });
    } catch (_e5) {}
}

/** Alias wstecznej kompatybilności. */
function _draftShowBanner(kind, draft, savedDoc) {
    _draftShowDraftModal(kind, draft, savedDoc);
}

/**
 * Przywracanie z kontrolą konfliktu: SAVED nowszy niż baza draftu → appConfirm
 * (liczba pozycji), restore ZAWSZE jako niezapisane. Draft zostaje do jawnego SAVED.
 * @param {string} kind
 * @param {object} draft
 * @param {object|null} savedDoc
 */
function _draftRestoreFlow(kind, draft, savedDoc) {
    var doApply = function () {
        _draftApply(kind, draft);
    };
    var savedVersion = savedDoc && typeof savedDoc.version === 'number' ? savedDoc.version : null;
    var baseVersion = typeof draft.baseVersion === 'number' ? draft.baseVersion : null;
    if (baseVersion !== null && savedVersion !== null && baseVersion !== savedVersion) {
        var counts = window.draftStore.summarizeDraftCounts(draft.payload);
        var n =
            kind === 'offer_rury' || kind === 'order_rury'
                ? counts.items + ' pozycji'
                : counts.wells + ' studni';
        var confirmFn = _draftG('appConfirm');
        if (typeof appConfirm === 'function') confirmFn = appConfirm;
        if (typeof confirmFn !== 'function') {
            doApply();
            return;
        }
        try {
            var res = confirmFn(
                'Serwer ma nowszą wersję (v' +
                    baseVersion +
                    ' → v' +
                    savedVersion +
                    '). Draft: ' +
                    n +
                    '. Przywrócić draft jako NIEZAPISANE zmiany?',
                {
                    title: 'Draft a nowsza wersja',
                    type: 'warning',
                    okText: 'Przywróć jako niezapisane',
                    cancelText: 'Odrzuć draft'
                }
            );
            if (res && typeof res.then === 'function') {
                res.then(function (ok) {
                    if (ok) doApply();
                    else {
                        var userId = _draftUserId();
                        if (userId) {
                            var key = window.draftStore.buildDraftKey(userId, kind, draft.docId);
                            if (key) window.draftStore.removeDraft(window.localStorage, key);
                        }
                        _draftHideBanner();
                    }
                });
            } else if (res) {
                doApply();
            }
            return;
        } catch (_e) {
            doApply();
            return;
        }
    }
    doApply();
}

/**
 * Sekcje różniące draft od SAVED (diagnostyka wiecznego popupa — tylko nazwy
 * sekcji i długości tablic, nigdy treść). Wołane przed pokazaniem modala.
 * @param {string} kind
 * @param {*} draftPayload
 * @param {*} savedPayload
 * @param {boolean} isNewDoc
 */
function _draftLogRecoveryDiff(kind, draftPayload, savedPayload, isNewDoc) {
    try {
        var log = _draftG('logger');
        if (!log || typeof log.warn !== 'function') return;
        var opts = isNewDoc ? { ignoreVolatile: true, ignoreWizard: true } : undefined;
        var a = _draftComparablePayload(kind, draftPayload);
        var b = _draftComparablePayload(kind, savedPayload);
        var keys = {};
        Object.keys(a).forEach(function (k) {
            keys[k] = 1;
        });
        Object.keys(b).forEach(function (k) {
            keys[k] = 1;
        });
        var diffs = [];
        Object.keys(keys).forEach(function (k) {
            var x = window.draftStore.canonicalPayloadJson({ v: a[k] }, opts);
            var y = window.draftStore.canonicalPayloadJson({ v: b[k] }, opts);
            if (x !== y) {
                var extra = '';
                if (Array.isArray(a[k]) || Array.isArray(b[k]))
                    extra =
                        ' len ' + ((a[k] || []).length || 0) + ' vs ' + ((b[k] || []).length || 0);
                diffs.push(k + extra);
            }
        });
        log.warn('draft', 'recovery modal — rozniące sekcje', {
            kind: kind,
            diff: diffs.join(', ') || '(puste)'
        });
    } catch (_e) {}
}

/**
 * Sprawdza recovery dla rodzaju: popup tylko gdy draft istnieje i NIE jest
 * równoważny SAVED (ten sam komparator co bramka zapisu — _draftEquivalent).
 * @param {string} kind
 */
function _draftCheckRecovery(kind) {
    try {
        _draftHideDraftModal();
        var cfg = _draftKindConfig[kind];
        if (!cfg) return;
        var userId = _draftUserId();
        if (!userId) return;
        var docId = cfg.getDocId() || 'new';
        var key = window.draftStore.buildDraftKey(userId, kind, docId);
        if (!key) return;
        var loaded = window.draftStore.loadDraft(window.localStorage, key);
        if (loaded.status !== 'ok' || !loaded.draft) return;
        var cur = _draftCurrentSaved(kind, cfg, docId);
        if (!cur || cur.slim) return;
        if (_draftEquivalent(kind, loaded.draft.payload, cur.payload, cur.isNew)) {
            // Martwy ghost (payload jak SAVED) — ciche sprzatniecie, bez modala.
            try {
                window.draftStore.removeDraft(window.localStorage, key);
                delete _draftLastWritten[key];
            } catch (_e4) {}
            return;
        }
        // Wariant (v): live po solverze deterministycznie różni się od serwera
        // (domyślne kinety/uszczelki, auto-dobór) — draft równy temu, co formularz
        // już pokazuje, nie ma nic do odzyskania. Modal tylko gdy draft różni się
        // ZARÓWNO od serwera, JAK i od live-at-entry.
        var livePayload = null;
        try {
            livePayload = _draftCollectLive(kind);
        } catch (_e3) {
            livePayload = null;
        }
        if (livePayload && _draftEquivalent(kind, loaded.draft.payload, livePayload, cur.isNew))
            return;
        _draftLogRecoveryDiff(kind, loaded.draft.payload, cur.payload, cur.isNew);
        _draftShowDraftModal(kind, loaded.draft, cur.savedDoc);
    } catch (_e2) {}
}

/**
 * Rejestruje rodzaj w module. Idempotentne. Sweep przy starcie, listenery globalnie raz.
 * @param {string} kind
 */
function _draftInitKind(kind) {
    if (!window.draftStore || !_draftKindConfig[kind]) return;
    if (_draftInitedKinds.indexOf(kind) === -1) _draftInitedKinds.push(kind);
    var userId = _draftUserId();
    if (userId) {
        try {
            window.draftStore.sweepDrafts(window.localStorage, userId);
        } catch (_e) {}
    }
    if (_draftListenersBound) return;
    _draftListenersBound = true;
    try {
        ['input', 'change', 'click'].forEach(function (evt) {
            document.addEventListener(evt, function () {
                _draftScheduleSave();
            });
        });
    } catch (_e2) {}
    try {
        window.addEventListener('pagehide', _draftFlushAll);
        window.addEventListener('beforeunload', _draftFlushAll);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') _draftFlushAll();
        });
        // Multi-tab: last-write-wins + jeden toast (bez przeładowania formularza).
        window.addEventListener('storage', function (ev) {
            try {
                if (!ev || typeof ev.key !== 'string') return;
                if (ev.key.indexOf(window.draftStore.KEY_PREFIX) !== 0) return;
                if (ev.newValue === ev.oldValue) return;
                var now = Date.now();
                if (_draftLastTabToastAt[ev.key] && now - _draftLastTabToastAt[ev.key] < 5000)
                    return;
                _draftLastTabToastAt[ev.key] = now;
                _draftToast('Draft zmieniony w innej karcie', 'info');
            } catch (_e3) {}
        });
    } catch (_e4) {}
}

window.draftAutosave = {
    DEBOUNCE_MS: DRAFT_AUTOSAVE_DEBOUNCE_MS,
    MODAL_ID: DRAFT_MODAL_ID,
    initKind: _draftInitKind,
    scheduleSave: _draftScheduleSave,
    flushAll: _draftFlushAll,
    clearContext: _draftClearContext,
    checkRecovery: _draftCheckRecovery,
    hideBanner: _draftHideBanner,
    hideModal: _draftHideDraftModal,
    showModal: _draftShowDraftModal,
    areEquivalent: _draftEquivalent,
    currentSaved: _draftCurrentSaved,
    currentUserId: _draftUserId
};
