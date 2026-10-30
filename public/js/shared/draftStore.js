// @ts-check
/* ===== DRAFT STORE (P1.1b) — lokalny draft formularzy, protokół docs/plans/e2-draft-review.md =====
 * Czysta warstwa danych BEZ zależności od DOM i sieci:
 * - klucz: sok_draft_v1_{userId}_{kind}_{docIdOrNew}, schemat v:1, jawny JSON (BEZ szyfrowania),
 * - allowlista pól (bez runtime, bez wellsExport, bez pól osobowych), cap 200 MB, TTL 14 dni sliding,
 * - SAVED zawsze wygrywa: ten moduł nigdy nie czyta draftu przy zapisie ani go nie wysyła.
 * Wszystkie funkcje przyjmują storage (localStorage lub zamiennik) — testowalne w izolacji.
 * Efekty uboczne (toast, popup recovery, debounce) należą do draftAutosave.js, nie tutaj.
 */

/** Wersja schematu draftu. Niezgodne v odrzucane cicho (bez migracji w locie). */
var DRAFT_SCHEMA_VERSION = 1;

/** Prefiks klucza draftu w localStorage. */
var DRAFT_KEY_PREFIX = 'sok_draft_v1_';

/** Maksymalny rozmiar draftu w bajtach (długość stringu JSON przed zapisem): 200 MB. */
var DRAFT_MAX_BYTES = 200 * 1024 * 1024;

/**
 * Do tego rozmiaru draft idzie do localStorage: zapis synchroniczny, pewny także
 * w `pagehide`. Większe drafty trafiają do IndexedDB (localStorage odrzuca zapis
 * przy ~50 MB zależnie od przeglądarki — QuotaExceededError).
 */
var DRAFT_SYNC_MAX_BYTES = 4000000;

/** TTL draftu (sliding, odświeżane przy każdym zapisie): 14 dni w ms. */
var DRAFT_TTL_MS = 14 * 24 * 3600 * 1000;

/** Dozwolone rodzaje dokumentów (osobne klucze dla rur i studni). */
var DRAFT_KINDS = ['offer_studnie', 'order_studnie', 'offer_rury', 'order_rury'];

/** 19 pól nagłówka oferty — dokładnie wyjście getOfferFormFields(), nic więcej. */
var DRAFT_FIELD_KEYS = [
    'number',
    'date',
    'clientName',
    'clientNumber',
    'clientNip',
    'clientAddress',
    'clientContact',
    'clientContacts',
    'contactPerson',
    'clientPhone',
    'clientEmail',
    'investName',
    'investAddress',
    'investContractor',
    'notes',
    'paymentTerms',
    'validity',
    'transportKm',
    'transportRate'
];

/**
 * Pola OSOBOWE wykluczone z PERSYSTOWANEGO draftu (localStorage = plaintext,
 * czytelny dla każdego skryptu tej samej origin i każdego, kto ma dostęp do
 * profilu przeglądarki). Draft niesie tylko stan nietożsamościowy: studnie/
 * pozycje, transport, warunki płatności, ważność, numer/datę.
 *
 * WAŻNE: strip jest na granicy ZAPISU (`buildDraft`), nie w `pickDraftPayload`.
 * Projekcja pól musi zostać pełna — `collectLive`/`canonicalPayloadJson` liczą
 * z niej flagę „niezapisane zmiany" (dirty) i diff live↔SAVED; wycięcie PII
 * w projekcji gasiło ostrzeżenie przed utratą wpisanej nazwy klienta
 * (regresja klasy błędu #22, pokryta testami sokDirty/draftLifecycle).
 *
 * Cena (świadoma): po odtworzeniu draftu dane klienta/inwestora i notatki trzeba
 * wpisać ponownie.
 *
 * Upgrade path: gdyby odtwarzanie pól osobowych było twardą potrzebą, zapisz nie
 * wartość, a boolean „pola osobowe różnią się od SAVED" (bez treści).
 */
var DRAFT_PII_FIELD_KEYS = [
    'clientName',
    'clientNumber',
    'clientNip',
    'clientAddress',
    'clientContact',
    'clientContacts',
    'contactPerson',
    'clientPhone',
    'clientEmail',
    'investName',
    'investAddress',
    'investContractor',
    'notes'
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
 * Dozwolone wyzwalacze zakończenia pracy (`exit.trigger` w kopercie).
 * Wartości są stabilne — czyta je pulpit, nie zmieniaj ich bez migracji.
 */
var DRAFT_EXIT_TRIGGERS = ['pagehide', 'unload', 'hidden', 'route'];

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
 * Zdejmuje pola osobowe z payloadu przed zapisem (granica persystencji).
 * Płytka kopia: nie mutuje wejścia. `fields` zostaje jako obiekt (schemat v:1).
 * @param {object} payload
 * @returns {object}
 */
function stripDraftPiiFields(payload) {
    var src = payload && typeof payload === 'object' ? payload : {};
    var out = {};
    Object.keys(src).forEach(function (k) {
        out[k] = src[k];
    });
    if (out.fields && typeof out.fields === 'object') {
        var fields = {};
        Object.keys(out.fields).forEach(function (k) {
            if (DRAFT_PII_FIELD_KEYS.indexOf(k) !== -1) return;
            fields[k] = out.fields[k];
        });
        out.fields = fields;
    }
    return out;
}

/**
 * Normalizuje znacznik wyjścia (`exit`). Nieznany wyzwalacz → null, żeby
 * uszkodzona wartość nie trafiła do koperty ani do UI.
 * @param {*} raw
 * @returns {{trigger: string}|null}
 */
function normalizeDraftExit(raw) {
    var r = raw && typeof raw === 'object' ? raw : null;
    if (!r || typeof r.trigger !== 'string') return null;
    if (DRAFT_EXIT_TRIGGERS.indexOf(r.trigger) === -1) return null;
    return { trigger: r.trigger };
}

/**
 * Buduje kopertę draftu (expiresAt = updatedAt + 14 dni, sliding).
 * @param {object} spec {userId, kind, docId, baseVersion, payload, exit?, now?}
 * @returns {object|null} koperta lub null przy niepoprawnym wejściu
 */
function buildDraft(spec) {
    var s = spec || {};
    if (!isSupportedDraftKind(s.kind)) return null;
    if (s.userId === undefined || s.userId === null || String(s.userId) === '') return null;
    var now = typeof s.now === 'number' ? s.now : Date.now();
    var draft = {
        v: DRAFT_SCHEMA_VERSION,
        kind: s.kind,
        userId: String(s.userId),
        docId: sanitizeDraftDocId(s.docId),
        baseVersion: typeof s.baseVersion === 'number' ? s.baseVersion : null,
        updatedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + DRAFT_TTL_MS).toISOString(),
        payload: stripDraftPiiFields(pickDraftPayload(s.payload))
    };
    // Pole opcjonalne: walidator toleruje nadmiarowe klucze, więc stare
    // koperty bez `exit` czytają się bez migracji schematu.
    var exit = normalizeDraftExit(s.exit);
    if (exit) draft.exit = exit;
    return draft;
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
 * Prefiks kluczy draftów użytkownika (wspólny dla localStorage i IndexedDB).
 * @param {*} userId
 * @returns {string}
 */
function draftUserPrefix(userId) {
    return DRAFT_KEY_PREFIX + String(userId).replace(/[^A-Za-z0-9_-]/g, '_') + '_';
}

/**
 * Backend IndexedDB dla dużych draftów (`draftIdb.js`). Brak wsparcia → null.
 * @returns {{put: Function, get: Function, keys: Function, del: Function, delPrefix: Function}|null}
 */
function draftIdbBackend() {
    var win = /** @type {any} */ (typeof window !== 'undefined' ? window : null);
    var idb = win ? win.draftIdb : null;
    if (!idb || typeof idb.get !== 'function' || typeof idb.put !== 'function') return null;
    return /** @type {any} */ (idb);
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
    var prefix = draftUserPrefix(userId);
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
 * Waliduje surową kopertę draftu. Uszkodzone/przeterminowane/niezgodne wersje
 * są usuwane przez `remove` (cicho) i zwracany jest powód.
 * @param {*} raw
 * @param {number} now
 * @param {(key: string) => void} [remove]
 * @param {string} [key]
 * @returns {{status: string, draft?: object}} status: ok|missing|expired|invalid|version
 */
function normalizeDraftRaw(raw, now, remove, key) {
    /**
     * @param {string} status
     * @returns {{status: string}}
     */
    function drop(status) {
        if (typeof remove === 'function' && key) remove(key);
        return { status: status };
    }
    if (raw === null || raw === undefined) return { status: 'missing' };
    var parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (_e) {
        return drop('invalid');
    }
    if (!parsed || typeof parsed !== 'object' || parsed.v !== DRAFT_SCHEMA_VERSION) {
        return drop(parsed && parsed.v !== undefined ? 'version' : 'invalid');
    }
    var exp = Date.parse(parsed.expiresAt);
    if (isNaN(exp) || exp <= now) return drop('expired');
    if (!parsed.payload || typeof parsed.payload !== 'object') return drop('invalid');
    return { status: 'ok', draft: parsed };
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
    return normalizeDraftRaw(
        raw,
        now,
        function (k) {
            removeDraft(storage, k);
        },
        key
    );
}

/**
 * Odczyt z obu backendów: kopia lokalna ma priorytet, potem IndexedDB (duże drafty).
 * @param {*} storage
 * @param {string} key
 * @param {object} [opts] {now?}
 * @returns {Promise<{status: string, draft?: object}>}
 */
function loadDraftAuto(storage, key, opts) {
    var now = opts && typeof opts.now === 'number' ? opts.now : Date.now();
    var local = loadDraft(storage, key, opts);
    var idb = key ? draftIdbBackend() : null;
    if (local.status === 'ok' || !idb) return Promise.resolve(local);
    return Promise.resolve(idb.get(key))
        .then(function (raw) {
            if (raw === null || raw === undefined) return local;
            return normalizeDraftRaw(
                raw,
                now,
                function (k) {
                    removeDraft(storage, k);
                },
                key
            );
        })
        .catch(function () {
            return local;
        });
}

/**
 * Zapisuje draft w localStorage (koperta zbudowana przez buildDraft). Powyżej
 * DRAFT_SYNC_MAX_BYTES — odrzucenie bez zapisu (duże drafty: saveDraftAuto →
 * IndexedDB). QuotaExceeded: usuwa największy draft użytkownika, ponawia raz,
 * potem zgłasza quota (SAVED nigdy nie jest blokowany).
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
    if (size > DRAFT_SYNC_MAX_BYTES) return { ok: false, reason: 'oversize' };
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
        // Brak miejsca: sprzątamy WYŁĄCZNIE wygasłe drafty użytkownika, potem
        // jedna ponowna próba. Niewygasłych nie ruszamy — usunięcie wymaga
        // jawnej zgody użytkownika (warstwa UI, largestUserDraftKey jako propozycja).
        try {
            sweepDrafts(storage, draft.userId);
        } catch (_e) {}
        try {
            storage.setItem(key, json);
            return { ok: true };
        } catch (err2) {
            if (isDraftQuotaError(err2)) return { ok: false, reason: 'quota' };
            return { ok: false, reason: 'error' };
        }
    }
}

/**
 * Zapis z wyborem backendu: do DRAFT_SYNC_MAX_BYTES → localStorage (synchronicznie,
 * pewne w pagehide), większe → IndexedDB (asynchronicznie, do DRAFT_MAX_BYTES).
 * Przy `storage: 'idb'` wynik zapisu przychodzi w `write`; wołający musi go użyć
 * do ustawienia stanu zapisu (samo `ok: true` znaczy „przyjęte do zapisu”).
 * @param {*} storage
 * @param {object} draft
 * @returns {{ok: boolean, reason?: string, storage?: 'local'|'idb', write?: Promise<{ok: boolean, reason?: string}>}}
 */
function saveDraftAuto(storage, draft) {
    if (!draft || draft.v !== DRAFT_SCHEMA_VERSION || !draft.payload) {
        return { ok: false, reason: 'invalid' };
    }
    var key = buildDraftKey(draft.userId, draft.kind, draft.docId);
    if (!key) return { ok: false, reason: 'invalid' };
    var size = draftByteSize(draft);
    if (size < 0) return { ok: false, reason: 'invalid' };
    if (size > DRAFT_MAX_BYTES) return { ok: false, reason: 'oversize' };
    if (size <= DRAFT_SYNC_MAX_BYTES) {
        var local = saveDraft(storage, draft);
        return { ok: local.ok, reason: local.reason, storage: 'local' };
    }
    var idb = draftIdbBackend();
    if (!idb) return { ok: false, reason: 'oversize' };
    var json = null;
    try {
        json = JSON.stringify(draft);
    } catch (_e) {
        return { ok: false, reason: 'invalid' };
    }
    // Stara, mniejsza kopia lokalna pod tym kluczem byłaby nieaktualna.
    try {
        if (storage && key) storage.removeItem(key);
    } catch (_e2) {}
    var write = Promise.resolve(idb.put(key, json))
        .then(function () {
            return { ok: true };
        })
        .catch(function (err) {
            return { ok: false, reason: isDraftQuotaError(err) ? 'quota' : 'error' };
        });
    return { ok: true, storage: 'idb', write: write };
}

/**
 * Lista poprawnych draftów użytkownika (najnowsze pierwsze). Uszkodzone
 * i wygasłe są usuwane przez loadDraft, więc nie trafiają na listę.
 * @param {*} storage
 * @param {string} userId
 * @param {object} [opts] {now?}
 * @returns {Array<{key: string, kind: string, docId: string, updatedAt: string, bytes: number, draft: object}>}
 */
function listUserDrafts(storage, userId, opts) {
    var out = [];
    listUserDraftKeys(storage, userId).forEach(function (key) {
        var res = loadDraft(storage, key, opts);
        if (res.status !== 'ok' || !res.draft) return;
        out.push({
            key: key,
            kind: res.draft.kind,
            docId: res.draft.docId,
            updatedAt: res.draft.updatedAt,
            bytes: draftByteSize(res.draft),
            draft: res.draft
        });
    });
    return out.sort(function (a, b) {
        return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
    });
}

/**
 * Lista draftów z obu backendów (localStorage + IndexedDB). Kopia lokalna
 * wygrywa przy tym samym kluczu; wynik sortowany jak `listUserDrafts`.
 * @param {*} storage
 * @param {string} userId
 * @param {object} [opts] {now?}
 * @returns {Promise<Array<{key: string, kind: string, docId: string, updatedAt: string, bytes: number, draft: object}>>}
 */
function listUserDraftsAuto(storage, userId, opts) {
    var local = listUserDrafts(storage, userId, opts);
    var idb = String(userId || '') !== '' ? draftIdbBackend() : null;
    if (!idb) return Promise.resolve(local);
    var now = opts && typeof opts.now === 'number' ? opts.now : Date.now();
    var prefix = draftUserPrefix(userId);
    var seen = {};
    local.forEach(function (item) {
        seen[item.key] = true;
    });
    return Promise.resolve(idb.keys())
        .then(function (keys) {
            var wanted = keys.filter(function (k) {
                return k.indexOf(prefix) === 0 && !seen[k];
            });
            return Promise.all(
                wanted.map(function (k) {
                    return Promise.resolve(idb.get(k)).then(
                        function (raw) {
                            return { key: k, raw: raw };
                        },
                        function () {
                            return { key: k, raw: null };
                        }
                    );
                })
            );
        })
        .then(function (rows) {
            var out = local.slice();
            rows.forEach(function (row) {
                if (row.raw === null || row.raw === undefined) return;
                var res = normalizeDraftRaw(
                    row.raw,
                    now,
                    function (k) {
                        removeDraft(storage, k);
                    },
                    row.key
                );
                if (res.status !== 'ok' || !res.draft) return;
                out.push({
                    key: row.key,
                    kind: res.draft.kind,
                    docId: res.draft.docId,
                    updatedAt: res.draft.updatedAt,
                    bytes: draftByteSize(res.draft),
                    draft: res.draft
                });
            });
            return out.sort(function (a, b) {
                return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
            });
        })
        .catch(function () {
            return local;
        });
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
 * Usuwa jeden draft w obu backendach (IndexedDB best-effort, bez czekania).
 * @param {*} storage
 * @param {string} key
 */
function removeDraft(storage, key) {
    try {
        if (storage && key) storage.removeItem(key);
    } catch (_e) {}
    var idb = key ? draftIdbBackend() : null;
    if (!idb) return;
    try {
        Promise.resolve(idb.del(key)).catch(function () {});
    } catch (_e2) {}
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
        try {
            if (storage) storage.removeItem(k);
        } catch (_e) {}
    });
    var idb = String(userId || '') !== '' ? draftIdbBackend() : null;
    if (idb && typeof idb.delPrefix === 'function') {
        try {
            Promise.resolve(idb.delPrefix(draftUserPrefix(userId))).catch(function () {});
        } catch (_e2) {}
    }
    return keys.length;
}

/**
 * Sprzątanie kopii w IndexedDB (TTL/wersja). Best-effort: bez wyniku zwrotnego,
 * nigdy nie blokuje zapisu.
 * @param {*} userId
 * @param {object} [opts] {now?}
 */
function sweepIdbDrafts(userId, opts) {
    var idb = String(userId || '') !== '' ? draftIdbBackend() : null;
    if (!idb) return;
    var now = opts && typeof opts.now === 'number' ? opts.now : Date.now();
    var prefix = draftUserPrefix(userId);
    try {
        Promise.resolve(idb.keys())
            .then(function (keys) {
                return Promise.all(
                    keys
                        .filter(function (k) {
                            return k.indexOf(prefix) === 0;
                        })
                        .map(function (k) {
                            return Promise.resolve(idb.get(k)).then(
                                function (raw) {
                                    return normalizeDraftRaw(
                                        raw,
                                        now,
                                        function (dead) {
                                            removeDraft(null, dead);
                                        },
                                        k
                                    );
                                },
                                function () {
                                    return null;
                                }
                            );
                        })
                );
            })
            .catch(function () {});
    } catch (_e) {}
}

/**
 * Leniwe sprzątanie: usuwa przeterminowane/niezgodne drafty użytkownika
 * (licznik dotyczy localStorage; IndexedDB sprzątane jest w tle).
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
    sweepIdbDrafts(userId, opts);
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
    SYNC_MAX_BYTES: DRAFT_SYNC_MAX_BYTES,
    TTL_MS: DRAFT_TTL_MS,
    KINDS: DRAFT_KINDS,
    FIELD_KEYS: DRAFT_FIELD_KEYS,
    WELL_RUNTIME_KEYS: DRAFT_WELL_RUNTIME_KEYS,
    EXIT_TRIGGERS: DRAFT_EXIT_TRIGGERS,
    normalizeDraftExit: normalizeDraftExit,
    isSupportedDraftKind: isSupportedDraftKind,
    sanitizeDraftDocId: sanitizeDraftDocId,
    buildDraftKey: buildDraftKey,
    stripDraftWellRuntime: stripDraftWellRuntime,
    pickDraftPayload: pickDraftPayload,
    stripDraftPiiFields: stripDraftPiiFields,
    buildDraft: buildDraft,
    draftByteSize: draftByteSize,
    isDraftQuotaError: isDraftQuotaError,
    listUserDraftKeys: listUserDraftKeys,
    listUserDrafts: listUserDrafts,
    listUserDraftsAuto: listUserDraftsAuto,
    loadDraft: loadDraft,
    loadDraftAuto: loadDraftAuto,
    saveDraft: saveDraft,
    saveDraftAuto: saveDraftAuto,
    largestUserDraftKey: largestUserDraftKey,
    removeDraft: removeDraft,
    removeUserDrafts: removeUserDrafts,
    sweepDrafts: sweepDrafts,
    sweepIdbDrafts: sweepIdbDrafts,
    canonicalPayloadJson: canonicalPayloadJson,
    draftDiffersFromSaved: draftDiffersFromSaved,
    summarizeDraftCounts: summarizeDraftCounts
};
