// @ts-check
/* ===== DRAFT STORE (P1.1b) — lokalny draft formularzy, protokół docs/plans/e2-draft-review.md =====
 * Czysta warstwa danych BEZ zależności od DOM i sieci:
 * - klucz: sok_draft_v1_{userId}_{kind}_{docIdOrNew}, schemat v:1, jawny JSON (BEZ szyfrowania),
 * - allowlista pól (bez runtime, bez wellsExport), cap 4 000 000 B, TTL 14 dni sliding,
 * - SAVED zawsze wygrywa: ten moduł nigdy nie czyta draftu przy zapisie ani go nie wysyła.
 * Wszystkie funkcje przyjmują storage (localStorage lub zamiennik) — testowalne w izolacji.
 * Efekty uboczne (toast, banner, debounce) należą do draftAutosave.js, nie tutaj.
 */

/** Wersja schematu draftu. Niezgodne v odrzucane cicho (bez migracji w locie). */
var DRAFT_SCHEMA_VERSION = 1;

/** Prefiks klucza draftu w localStorage. */
var DRAFT_KEY_PREFIX = 'sok_draft_v1_';

/** Maksymalny rozmiar draftu w bajtach (długość stringu JSON przed setItem). */
var DRAFT_MAX_BYTES = 4000000;

/** TTL draftu (sliding, odświeżane przy każdym zapisie): 14 dni w ms. */
var DRAFT_TTL_MS = 14 * 24 * 3600 * 1000;

/** Dozwolone rodzaje dokumentów (osobne klucze dla rur i studni). */
var DRAFT_KINDS = ['offer_studnie', 'order_studnie', 'offer_rury', 'order_rury'];

/** 15 pól nagłówka oferty — dokładnie wyjście getOfferFormFields(), nic więcej. */
var DRAFT_FIELD_KEYS = [
    'number',
    'date',
    'clientName',
    'clientNumber',
    'clientNip',
    'clientAddress',
    'clientContact',
    'investName',
    'investAddress',
    'investContractor',
    'notes',
    'paymentTerms',
    'validity',
    'transportKm',
    'transportRate'
];

/** Lotne pola runtime studni — nigdy nie trafiają do draftu (jak przy SAVED). */
var DRAFT_WELL_RUNTIME_KEYS = [
    '_lastAutoConfig',
    '_lastAutoTelemetryId',
    '_aiRankInfo',
    '_lastSolveInputHash',
    '__resCache'
];

/** Pola formularza pomijane przy porównaniu (ulotne między sesjami). */
var DRAFT_VOLATILE_FIELD_KEYS = ['number', 'date'];

/**
 * Głęboki klon wartości JSON-owalnych (odcina referencje do obiektów live).
 * @param {*} value
 * @returns {*}
 */
function draftClone(value) {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_e) {
        return undefined;
    }
}

/**
 * Czy rodzaj dokumentu jest obsługiwany.
 * @param {*} kind
 * @returns {boolean}
 */
function isSupportedDraftKind(kind) {
    return DRAFT_KINDS.indexOf(kind) !== -1;
}

/**
 * Normalizuje docId do bezpiecznego fragmentu klucza.
 * @param {*} docId
 * @returns {string}
 */
function sanitizeDraftDocId(docId) {
    var s = String(docId === undefined || docId === null || docId === '' ? 'new' : docId);
    var clean = s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
    return clean || 'new';
}

/**
 * Buduje klucz draftu. Zwraca null przy braku userId/kind (brak klucza = brak draftu).
 * @param {*} userId
 * @param {*} kind
 * @param {*} docId
 * @returns {string|null}
 */
function buildDraftKey(userId, kind, docId) {
    if (userId === undefined || userId === null || String(userId) === '') return null;
    if (!isSupportedDraftKind(kind)) return null;
    var safeUser = String(userId)
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .slice(0, 120);
    if (!safeUser) return null;
    return DRAFT_KEY_PREFIX + safeUser + '_' + kind + '_' + sanitizeDraftDocId(docId);
}

/**
 * Usuwa pola runtime ze sklonowanych studni (mutuje przekazany klon, nie obiekty live).
 * @param {*} wells
 * @returns {Array}
 */
function stripDraftWellRuntime(wells) {
    if (!Array.isArray(wells)) return [];
    return wells.map(function (w) {
        if (!w || typeof w !== 'object') return w;
        var copy = w;
        DRAFT_WELL_RUNTIME_KEYS.forEach(function (k) {
            delete copy[k];
        });
        return copy;
    });
}

/**
 * Ciachnij payload do allowlisty protokołu (§2). Wszystko inne (wellsExport,
 * historia, PZ, obiekty userów, totals) odpada. Zwraca nowy obiekt (klon).
 * @param {*} raw
 * @returns {object}
 */
function pickDraftPayload(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var payload = {};
    if (src.fields && typeof src.fields === 'object') {
        var fields = {};
        DRAFT_FIELD_KEYS.forEach(function (k) {
            if (src.fields[k] !== undefined) fields[k] = draftClone(src.fields[k]);
        });
        payload.fields = fields;
    }
    // Wells albo items (nigdy wellsExport — przeliczalne po stronie SAVED).
    if (Array.isArray(src.wells)) {
        payload.wells = stripDraftWellRuntime(draftClone(src.wells) || []);
    } else if (Array.isArray(src.items)) {
        payload.items = draftClone(src.items) || [];
    }
    if (src.wellDiscounts && typeof src.wellDiscounts === 'object') {
        payload.wellDiscounts = draftClone(src.wellDiscounts) || {};
    }
    if (src.visiblePrzejsciaTypes !== undefined) {
        var vpt = Array.isArray(src.visiblePrzejsciaTypes) ? src.visiblePrzejsciaTypes.slice() : [];
        payload.visiblePrzejsciaTypes = vpt;
    }
    if (src.transportMode !== undefined) {
        payload.transportMode = draftClone(src.transportMode);
    }
    if (src.wizardGlobalParams && typeof src.wizardGlobalParams === 'object') {
        payload.wizardGlobalParams = draftClone(src.wizardGlobalParams) || {};
    }
    if (src.wizardStep !== undefined) {
        payload.wizardStep = src.wizardStep;
    }
    return payload;
}

/**
 * Buduje kopertę draftu (expiresAt = updatedAt + 14 dni, sliding).
 * @param {object} spec {userId, kind, docId, baseVersion, payload, now?}
 * @returns {object|null} koperta lub null przy niepoprawnym wejściu
 */
function buildDraft(spec) {
    var s = spec || {};
    if (!isSupportedDraftKind(s.kind)) return null;
    if (s.userId === undefined || s.userId === null || String(s.userId) === '') return null;
    var now = typeof s.now === 'number' ? s.now : Date.now();
    return {
        v: DRAFT_SCHEMA_VERSION,
        kind: s.kind,
        userId: String(s.userId),
        docId: sanitizeDraftDocId(s.docId),
        baseVersion: typeof s.baseVersion === 'number' ? s.baseVersion : null,
        updatedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + DRAFT_TTL_MS).toISOString(),
        payload: pickDraftPayload(s.payload)
    };
}

/**
 * Rozmiar draftu w bajtach (długość stringu JSON, zgodnie z protokołem).
 * @param {object} draft
 * @returns {number} -1 przy błędzie serializacji
 */
function draftByteSize(draft) {
    try {
        return JSON.stringify(draft).length;
    } catch (_e) {
        return -1;
    }
}

/**
 * Czy błąd oznacza przepełniony storage.
 * @param {*} err
 * @returns {boolean}
 */
function isDraftQuotaError(err) {
    if (!err || typeof err !== 'object') return false;
    if (err.name === 'QuotaExceededError' || err.code === 'QUOTA_EXCEEDED') return true;
    // Starsze przeglądarki zgłaszają NS_ERROR_DOM_QUOTA_REACHED lub kod 22.
    if (err.code === 22 || err.number === -2147024882) return true;
    return false;
}

/**
 * Wszystkie klucze draftów danego użytkownika w storage.
 * @param {*} storage
 * @param {*} userId
 * @returns {Array<string>}
 */
function listUserDraftKeys(storage, userId) {
    var out = [];
    if (!storage || String(userId || '') === '') return out;
    var prefix = DRAFT_KEY_PREFIX + String(userId).replace(/[^A-Za-z0-9_-]/g, '_') + '_';
    var len = 0;
    try {
        len = storage.length;
    } catch (_e) {
        return out;
    }
    for (var i = 0; i < len; i++) {
        var k = null;
        try {
            k = storage.key(i);
        } catch (_e2) {
            continue;
        }
        if (typeof k === 'string' && k.indexOf(prefix) === 0) out.push(k);
    }
    return out;
}

/**
 * Odczytuje i waliduje draft spod klucza. Uszkodzone/przeterminowane/niezgodne
 * wersje są usuwane (cicho + zwracany powód), formularz zawsze zostaje na SAVED.
 * @param {*} storage
 * @param {string} key
 * @param {object} [opts] {now?}
 * @returns {{status: string, draft?: object}} status: ok|missing|expired|invalid|version
 */
function loadDraft(storage, key, opts) {
    var now = opts && typeof opts.now === 'number' ? opts.now : Date.now();
    var raw = null;
    try {
        raw = storage ? storage.getItem(key) : null;
    } catch (_e) {
        return { status: 'missing' };
    }
    if (raw === null || raw === undefined) return { status: 'missing' };
    var parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (_e2) {
        try {
            storage.removeItem(key);
        } catch (_e3) {}
        return { status: 'invalid' };
    }
    if (!parsed || typeof parsed !== 'object' || parsed.v !== DRAFT_SCHEMA_VERSION) {
        try {
            storage.removeItem(key);
        } catch (_e4) {}
        return { status: parsed && parsed.v !== undefined ? 'version' : 'invalid' };
    }
    var exp = Date.parse(parsed.expiresAt);
    if (isNaN(exp) || exp <= now) {
        try {
            storage.removeItem(key);
        } catch (_e5) {}
        return { status: 'expired' };
    }
    if (!parsed.payload || typeof parsed.payload !== 'object') {
        try {
            storage.removeItem(key);
        } catch (_e6) {}
        return { status: 'invalid' };
    }
    return { status: 'ok', draft: parsed };
}

/**
 * Zapisuje draft (koperta zbudowana przez buildDraft). Cap 4 MB: powyżej —
 * odrzucenie bez zapisu. QuotaExceeded: usuwa największy draft użytkownika,
 * ponawia raz, potem zgłasza quota (SAVED nigdy nie jest blokowany).
 * @param {*} storage
 * @param {object} draft
 * @returns {{ok: boolean, reason?: string}}
 */
function saveDraft(storage, draft) {
    if (!draft || draft.v !== DRAFT_SCHEMA_VERSION || !draft.payload) {
        return { ok: false, reason: 'invalid' };
    }
    var key = buildDraftKey(draft.userId, draft.kind, draft.docId);
    if (!key) return { ok: false, reason: 'invalid' };
    var size = draftByteSize(draft);
    if (size < 0) return { ok: false, reason: 'invalid' };
    if (size > DRAFT_MAX_BYTES) return { ok: false, reason: 'oversize' };
    var json = null;
    try {
        json = JSON.stringify(draft);
    } catch (_e) {
        return { ok: false, reason: 'invalid' };
    }
    try {
        storage.setItem(key, json);
        return { ok: true };
    } catch (err) {
        if (!isDraftQuotaError(err)) return { ok: false, reason: 'error' };
        // Największy draft użytkownika out, jedna ponowna próba.
        try {
            var victim = largestUserDraftKey(storage, draft.userId, key);
            if (victim) storage.removeItem(victim);
            storage.setItem(key, json);
            return { ok: true };
        } catch (err2) {
            if (isDraftQuotaError(err2)) return { ok: false, reason: 'quota' };
            return { ok: false, reason: 'error' };
        }
    }
}

/**
 * Klucz największego draftu użytkownika (pomijając klucz chroniony).
 * @param {*} storage
 * @param {*} userId
 * @param {string} [protectedKey]
 * @returns {string|null}
 */
function largestUserDraftKey(storage, userId, protectedKey) {
    var keys = listUserDraftKeys(storage, userId);
    var best = null;
    var bestLen = -1;
    keys.forEach(function (k) {
        if (k === protectedKey) return;
        var len = -1;
        try {
            var v = storage.getItem(k);
            len = v === null || v === undefined ? -1 : String(v).length;
        } catch (_e) {
            return;
        }
        if (len > bestLen) {
            bestLen = len;
            best = k;
        }
    });
    return best;
}

/**
 * Usuwa jeden draft.
 * @param {*} storage
 * @param {string} key
 */
function removeDraft(storage, key) {
    try {
        if (storage && key) storage.removeItem(key);
    } catch (_e) {}
}

/**
 * Usuwa WSZYSTKIE drafty użytkownika (logout). Zwraca liczbę usuniętych.
 * @param {*} storage
 * @param {*} userId
 * @returns {number}
 */
function removeUserDrafts(storage, userId) {
    var keys = listUserDraftKeys(storage, userId);
    keys.forEach(function (k) {
        removeDraft(storage, k);
    });
    return keys.length;
}

/**
 * Leniwe sprzątanie: usuwa przeterminowane/niezgodne drafty użytkownika.
 * @param {*} storage
 * @param {*} userId
 * @param {object} [opts] {now?}
 * @returns {number} liczba usuniętych
 */
function sweepDrafts(storage, userId, opts) {
    var keys = listUserDraftKeys(storage, userId);
    var removed = 0;
    keys.forEach(function (k) {
        var res = loadDraft(storage, k, opts);
        if (res.status !== 'ok') removed++;
    });
    return removed;
}

/**
 * Kanoniczny JSON payloadu (sortowanie kluczy + tablicy typów przejść).
 * @param {*} payload
 * @param {object} [opts] {ignoreVolatile?: boolean, ignoreWizard?: boolean}
 * @returns {string}
 */
function canonicalPayloadJson(payload, opts) {
    var o = opts || {};
    var src = payload && typeof payload === 'object' ? payload : {};
    function sortVal(v) {
        if (Array.isArray(v)) return v.map(sortVal);
        if (v && typeof v === 'object') {
            var sorted = {};
            Object.keys(v)
                .sort()
                .forEach(function (k) {
                    sorted[k] = sortVal(v[k]);
                });
            return sorted;
        }
        return v;
    }
    var canon = sortVal(draftClone(src) || {});
    if (canon.visiblePrzejsciaTypes && Array.isArray(canon.visiblePrzejsciaTypes)) {
        canon.visiblePrzejsciaTypes = canon.visiblePrzejsciaTypes.slice().sort();
    }
    if (o.ignoreWizard) {
        delete canon.wizardGlobalParams;
        delete canon.wizardStep;
    }
    if (o.ignoreVolatile && canon.fields && typeof canon.fields === 'object') {
        DRAFT_VOLATILE_FIELD_KEYS.forEach(function (k) {
            delete canon.fields[k];
        });
    }
    try {
        return JSON.stringify(canon);
    } catch (_e) {
        return '';
    }
}

/**
 * Czy draft różni się od SAVED (banner recovery tylko przy różnicy).
 * Dla nowych dokumentów ignorowane pola ulotne (number/date) i wizard.
 * @param {*} draftPayload
 * @param {*} savedPayload
 * @param {boolean} isNewDoc
 * @returns {boolean}
 */
function draftDiffersFromSaved(draftPayload, savedPayload, isNewDoc) {
    if (!draftPayload) return false;
    if (!savedPayload) return true;
    var opts = isNewDoc ? { ignoreVolatile: true, ignoreWizard: true } : undefined;
    return canonicalPayloadJson(draftPayload, opts) !== canonicalPayloadJson(savedPayload, opts);
}

/**
 * Liczy pozycje draftu do komunikatu konfliktu (liczba studni/pozycji).
 * @param {*} payload
 * @returns {{wells: number, items: number}}
 */
function summarizeDraftCounts(payload) {
    var p = payload && typeof payload === 'object' ? payload : {};
    return {
        wells: Array.isArray(p.wells) ? p.wells.length : 0,
        items: Array.isArray(p.items) ? p.items.length : 0
    };
}

window.draftStore = {
    SCHEMA_VERSION: DRAFT_SCHEMA_VERSION,
    KEY_PREFIX: DRAFT_KEY_PREFIX,
    MAX_BYTES: DRAFT_MAX_BYTES,
    TTL_MS: DRAFT_TTL_MS,
    KINDS: DRAFT_KINDS,
    FIELD_KEYS: DRAFT_FIELD_KEYS,
    WELL_RUNTIME_KEYS: DRAFT_WELL_RUNTIME_KEYS,
    isSupportedDraftKind: isSupportedDraftKind,
    sanitizeDraftDocId: sanitizeDraftDocId,
    buildDraftKey: buildDraftKey,
    stripDraftWellRuntime: stripDraftWellRuntime,
    pickDraftPayload: pickDraftPayload,
    buildDraft: buildDraft,
    draftByteSize: draftByteSize,
    isDraftQuotaError: isDraftQuotaError,
    listUserDraftKeys: listUserDraftKeys,
    loadDraft: loadDraft,
    saveDraft: saveDraft,
    largestUserDraftKey: largestUserDraftKey,
    removeDraft: removeDraft,
    removeUserDrafts: removeUserDrafts,
    sweepDrafts: sweepDrafts,
    canonicalPayloadJson: canonicalPayloadJson,
    draftDiffersFromSaved: draftDiffersFromSaved,
    summarizeDraftCounts: summarizeDraftCounts
};
