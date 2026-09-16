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
var DRAFT_BANNER_ID = 'sok-draft-banner';

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
 * Bramka dirty dla studni: zapis tylko gdy _excelDirty/_wizardDirty lub zmiana
 * względem ostatniego zapisu (wizard nie ma jawnej flagi — diff ją zastępuje).
 * Rury nie mają flag dirty — sama bramka diff.
 * @param {string} kind
 * @returns {boolean}
 */
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
    _draftMaybeSweep(userId);
    var savedDoc = null;
    try {
        savedDoc = cfg.getSavedDoc(docId);
    } catch (_e) {}
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
 * Kasuje draft kontekstu (sukces SAVED / nowa oferta / DELETE). Kasowanie TYLKO
 * po potwierdzonym sukcesie woła caller — ta funkcja sama nie ocenia wyniku.
 * @param {string} kind
 * @param {*} oldDocId
 * @param {*} [newDocId]
 */
function _draftClearContext(kind, oldDocId, newDocId) {
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
        _draftHideBanner();
    } catch (_e) {}
}

/**
 * Format daty draftu do bannera (pl-PL, nigdy nie rzuca).
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
 * Usuwa banner recovery z DOM.
 */
function _draftHideBanner() {
    try {
        var el = document.getElementById(DRAFT_BANNER_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (_e) {}
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
 * Pokazuje nieblokujący banner recovery (Przywróć / Odrzuć / Pobierz JSON).
 * @param {string} kind
 * @param {object} draft
 * @param {object|null} savedDoc
 */
function _draftShowBanner(kind, draft, savedDoc) {
    _draftHideBanner();
    var escapeHtml = _draftEscaper('escapeHtml');
    var escapeHtmlAttr = _draftEscaper('escapeHtmlAttr');
    var host = null;
    try {
        host = document.querySelector('main') || document.querySelector('.main') || document.body;
    } catch (_e) {
        return;
    }
    if (!host) return;
    var counts = window.draftStore.summarizeDraftCounts(draft.payload);
    var n =
        kind === 'offer_rury' || kind === 'order_rury'
            ? counts.items + ' poz.'
            : counts.wells + ' stud.';
    var banner = document.createElement('div');
    banner.id = DRAFT_BANNER_ID;
    banner.className = 'card border-warn-subtle bg-accent-subtle';
    banner.setAttribute('role', 'status');
    try {
        banner.style.position = 'sticky';
        banner.style.top = '0';
        var layers = _draftG('LAYERS');
        banner.style.zIndex = String((layers && layers.BANNER) || 5100);
        banner.style.marginBottom = 'var(--section-gap)';
    } catch (_e2) {}
    // Tekst przez escapeHtml, atrybuty przez escapeHtmlAttr (reguła P0.3).
    banner.innerHTML =
        '<div class="flex-between flex-gap-3 flex-wrap-start">' +
        '<div class="flex-1-240">' +
        '<div class="card-title-sm"><i data-lucide="history" aria-hidden="true"></i> ' +
        escapeHtml('Znaleziono niezapisany draft') +
        '</div>' +
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
        '</div>' +
        '<div class="flex-gap-2 flex-wrap-start">' +
        '<button type="button" class="btn btn-primary btn-sm" data-draft-act="restore"><i data-lucide="history" aria-hidden="true"></i> ' +
        escapeHtml('Przywróć') +
        '</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-draft-act="download"><i data-lucide="download" aria-hidden="true"></i> ' +
        escapeHtml('Pobierz JSON') +
        '</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-draft-act="discard" aria-label="' +
        escapeHtmlAttr('Odrzuć draft') +
        '"><i data-lucide="x" aria-hidden="true"></i> ' +
        escapeHtml('Odrzuć') +
        '</button>' +
        '</div>' +
        '</div>';
    banner.addEventListener('click', function (ev) {
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
            var userId = _draftUserId();
            if (userId) {
                var key = window.draftStore.buildDraftKey(userId, kind, draft.docId);
                if (key) window.draftStore.removeDraft(window.localStorage, key);
            }
            _draftHideBanner();
            _draftToast('Draft odrzucony (zapisana wersja nietknięta)', 'info');
        } else if (act === 'restore') {
            _draftRestoreFlow(kind, draft, savedDoc);
        }
    });
    try {
        if (host === document.body) document.body.insertBefore(banner, document.body.firstChild);
        else host.insertBefore(banner, host.firstChild);
    } catch (_e4) {
        return;
    }
    try {
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: banner });
    } catch (_e5) {}
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
 * Sprawdza recovery dla rodzaju: banner tylko gdy draft istnieje i różni się od SAVED.
 * @param {string} kind
 */
function _draftCheckRecovery(kind) {
    try {
        _draftHideBanner();
        var cfg = _draftKindConfig[kind];
        if (!cfg) return;
        var userId = _draftUserId();
        if (!userId) return;
        var docId = cfg.getDocId() || 'new';
        var key = window.draftStore.buildDraftKey(userId, kind, docId);
        if (!key) return;
        var loaded = window.draftStore.loadDraft(window.localStorage, key);
        if (loaded.status !== 'ok' || !loaded.draft) return;
        var savedDoc = null;
        try {
            savedDoc = docId === 'new' ? null : cfg.getSavedDoc(docId);
        } catch (_e) {}
        var savedPayload =
            savedDoc !== null && savedDoc !== undefined
                ? _draftSavedPayload(kind, savedDoc)
                : _draftEmptySavedPayload(kind);
        var isNew = docId === 'new' || savedDoc === null;
        if (!window.draftStore.draftDiffersFromSaved(loaded.draft.payload, savedPayload, isNew))
            return;
        _draftShowBanner(kind, loaded.draft, savedDoc);
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
    initKind: _draftInitKind,
    scheduleSave: _draftScheduleSave,
    flushAll: _draftFlushAll,
    clearContext: _draftClearContext,
    checkRecovery: _draftCheckRecovery,
    hideBanner: _draftHideBanner,
    currentUserId: _draftUserId
};
