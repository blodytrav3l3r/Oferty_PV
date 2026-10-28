// @ts-check
/* ===== DRAFT SYNC (L2) — serwerowa kopia draftu roboczego, offline-first =====
 * Kontrakt: docs/plans/2026-10-25-draft-l2-server-review.md (§5.2–§5.4).
 *
 * Zasada nadrzędna: zapis LOKALNY nigdy nie zależy od sieci. Ten moduł jest
 * best-effort kopią cross-device — każdy jego błąd kończy się statusem, nigdy
 * wyjątkiem i nigdy zmianą formularza ani localStorage.
 *
 * CAS: `If-Match: "<drafts.version>"` z meta w localStorage. Brak meta =
 * pierwszy zapis (bez nagłówka). 412/409 = draft zmienił ktoś inny → jawny
 * wybór użytkownika (serwer / lokalny / zachowaj oba), zero auto-merge.
 *
 * Dlaczego `fetch(keepalive)` zamiast `navigator.sendBeacon` na pagehide:
 * beacon nie pozwala ustawić `If-Match`, więc omijałby CAS i mógł nadpisać
 * cudzą pracę. `fetch` z `keepalive: true` niesie nagłówki i ten sam limit
 * 64 KB — dlatego większe payloady są JAWNIE pomijane, nie wysyłane bez CAS.
 *
 * Warstwa bez DOM i bez zależności od draftStore (draftStore wstrzykiwany przy
 * „zachowaj oba"). Wszystko testowalne w izolacji (fetch/storage/time w args).
 */

/** Prefiks klucza meta synchronizacji (wersja serwerowa draftu). */
var DRAFT_SYNC_META_PREFIX = 'sok_draft_srv_v1_';

/** Limit payloadu po stronie serwera (spójny z DRAFT_MAX_BYTES w backendzie). */
var DRAFT_SYNC_MAX_BYTES = 256 * 1024;

/** Limit body dla `fetch(keepalive)` — powyżej przeglądarka odrzuca żądanie. */
var DRAFT_SYNC_KEEPALIVE_MAX_BYTES = 64 * 1024;

/** Marker docId kopii konfliktu (localStorage only, nigdy serwer). */
var DRAFT_SYNC_CONFLICT_MARK = '-konflikt-';

/**
 * Liczba bajtów UTF-8 stringu (zgodna z Buffer.byteLength dla poprawnych
 * stringów). Samotny surogat liczony jak U+FFFD (3 B) — tak samo robi Node.
 * @param {string} str
 * @returns {number}
 */
function draftSyncUtf8Bytes(str) {
    var bytes = 0;
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 0x80) bytes += 1;
        else if (c < 0x800) bytes += 2;
        else if (c >= 0xd800 && c <= 0xdbff) {
            var next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
            if (next >= 0xdc00 && next <= 0xdfff) {
                bytes += 4;
                i++;
            } else {
                bytes += 3;
            }
        } else bytes += 3;
    }
    return bytes;
}

/**
 * Rozmiar payloadu w bajtach UTF-8. `null` = nie da się zserializować.
 * @param {*} payload
 * @returns {number|null}
 */
function draftSyncPayloadBytes(payload) {
    try {
        var json = JSON.stringify(payload);
        if (typeof json !== 'string') return null;
        return draftSyncUtf8Bytes(json);
    } catch (_e) {
        return null;
    }
}

/**
 * Bezpieczny fragment klucza (identyczna normalizacja jak draftStore).
 * @param {*} value
 * @returns {string}
 */
function draftSyncSafePart(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .slice(0, 120);
}

/**
 * Klucz meta synchronizacji. `null` gdy brak userId/kind (brak klucza = brak CAS).
 * @param {*} userId
 * @param {*} kind
 * @param {*} docId
 * @returns {string|null}
 */
function draftSyncMetaKey(userId, kind, docId) {
    var user = draftSyncSafePart(userId);
    if (!user || !kind) return null;
    var doc = draftSyncSafePart(docId) || 'new';
    return DRAFT_SYNC_META_PREFIX + user + '_' + String(kind) + '_' + doc;
}

/**
 * Odczyt meta. Uszkodzone/wersja niepoprawna → `null` (traktowane jak brak
 * meta, czyli pierwszy zapis: 412 zamiast cichego nadpisania).
 * @param {*} storage
 * @param {*} userId
 * @param {*} kind
 * @param {*} docId
 * @returns {{version: number, updatedAt: string|null}|null}
 */
function draftSyncLoadMeta(storage, userId, kind, docId) {
    var key = draftSyncMetaKey(userId, kind, docId);
    if (!key || !storage) return null;
    var raw = null;
    try {
        raw = storage.getItem(key);
    } catch (_e) {
        return null;
    }
    if (raw === null || raw === undefined) return null;
    var parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (_e2) {
        return null;
    }
    if (!parsed || typeof parsed.version !== 'number' || parsed.version < 1) return null;
    return {
        version: parsed.version,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
    };
}

/**
 * Zapis meta po potwierdzonym zapisie serwerowym.
 * @param {*} storage
 * @param {*} userId
 * @param {*} kind
 * @param {*} docId
 * @param {{version: number, updatedAt?: string|null}} meta
 * @param {boolean} [force] pozwól cofnąć wersję (tylko jawne rozstrzygnięcie konfliktu)
 * @returns {boolean} czy udało się zapisać (false = następny zapis dostanie 428)
 */
function draftSyncSaveMeta(storage, userId, kind, docId, meta, force) {
    var key = draftSyncMetaKey(userId, kind, docId);
    if (!key || !storage || !meta || typeof meta.version !== 'number') return false;
    // Monotoniczność: spóźniona odpowiedź (push/pull starszej wersji) nie może
    // cofnąć meta — inaczej kolejny push wysyła nieaktualny If-Match i dostaje
    // fałszywy 409 „zmieniony na innym urządzeniu” bez żadnej konkurencji.
    if (force !== true) {
        var current = draftSyncLoadMeta(storage, userId, kind, docId);
        if (current && current.version > meta.version) return true;
    }
    try {
        storage.setItem(
            key,
            JSON.stringify({
                version: meta.version,
                updatedAt: meta.updatedAt || null
            })
        );
        return true;
    } catch (_e) {
        return false;
    }
}

/**
 * Usunięcie meta (po DELETE draftu lub jawnym odrzuceniu).
 * @param {*} storage
 * @param {*} userId
 * @param {*} kind
 * @param {*} docId
 */
function draftSyncClearMeta(storage, userId, kind, docId) {
    var key = draftSyncMetaKey(userId, kind, docId);
    if (!key || !storage) return;
    try {
        storage.removeItem(key);
    } catch (_e) {}
}

/** @param {string} kind @param {string} docId @returns {string} */
function draftSyncUrl(kind, docId) {
    return (
        '/api/drafts/' + encodeURIComponent(String(kind)) + '/' + encodeURIComponent(String(docId))
    );
}

/** @returns {*} wstrzyknięty fetch albo globalny (null gdy brak) */
function draftSyncFetch(fetchImpl) {
    if (typeof fetchImpl === 'function') return fetchImpl;
    try {
        if (typeof fetch === 'function') return fetch;
    } catch (_e) {}
    return null;
}

/**
 * Odczyt JSON z odpowiedzi; nigdy nie rzuca (puste/niepoprawne body → null).
 * @param {*} res
 * @returns {Promise<*>}
 */
async function draftSyncJson(res) {
    try {
        return await res.json();
    } catch (_e) {
        return null;
    }
}

/**
 * PUT draftu z CAS. Zwraca status bez rzucania:
 * `ok` | `conflict` | `too_large` | `limit` | `forbidden` | `offline` | `error` | `invalid`.
 *
 * `keepalive` = ścieżka wyjścia z karty: body > 64 KB jest JAWNIE pomijane
 * (status `skipped_keepalive`), bo przeglądarka odrzuciłaby żądanie.
 *
 * @param {object} args `{storage, userId, kind, docId, payload, baseVersion?, fetchImpl?, keepalive?}`
 * @returns {Promise<{status: string, reason?: string, version?: number, bytes?: number, limit?: number, serverVersion?: number, serverUpdatedAt?: string, count?: number, httpStatus?: number}>}
 */
async function draftSyncPush(args) {
    var a = args || {};
    var bytes = draftSyncPayloadBytes(a.payload);
    if (bytes === null) return { status: 'invalid' };
    if (bytes > DRAFT_SYNC_MAX_BYTES) return { status: 'too_large', bytes: bytes };
    if (a.keepalive && bytes > DRAFT_SYNC_KEEPALIVE_MAX_BYTES)
        return { status: 'skipped_keepalive', bytes: bytes };

    var fetchFn = draftSyncFetch(a.fetchImpl);
    if (!fetchFn) return { status: 'offline' };

    var meta = draftSyncLoadMeta(a.storage, a.userId, a.kind, a.docId);
    var headers = { 'Content-Type': 'application/json' };
    if (meta) headers['If-Match'] = '"' + meta.version + '"';

    var body = null;
    try {
        body = JSON.stringify({
            payload: a.payload,
            baseVersion: typeof a.baseVersion === 'number' ? a.baseVersion : null
        });
    } catch (_e) {
        return { status: 'invalid' };
    }

    var res = null;
    try {
        res = await fetchFn(draftSyncUrl(a.kind, a.docId), {
            method: 'PUT',
            headers: headers,
            credentials: 'same-origin',
            body: body,
            keepalive: a.keepalive === true
        });
    } catch (_e2) {
        return { status: 'offline' };
    }
    if (!res) return { status: 'offline' };

    var data = await draftSyncJson(res);

    if (res.status === 200 && data && typeof data.version === 'number') {
        draftSyncSaveMeta(a.storage, a.userId, a.kind, a.docId, {
            version: data.version,
            updatedAt: data.updatedAt
        });
        return { status: 'ok', version: data.version, bytes: data.bytes };
    }
    if (res.status === 412 || res.status === 428) {
        return {
            status: 'conflict',
            reason: 'precondition_required',
            serverVersion:
                data && typeof data.serverVersion === 'number' ? data.serverVersion : null
        };
    }
    if (res.status === 409 && data && data.code === 'DRAFT_CONFLICT') {
        return {
            status: 'conflict',
            reason: 'version_mismatch',
            serverVersion: typeof data.serverVersion === 'number' ? data.serverVersion : null,
            serverUpdatedAt: typeof data.serverUpdatedAt === 'string' ? data.serverUpdatedAt : null
        };
    }
    if (res.status === 409 && data && data.code === 'DRAFT_LIMIT') {
        return { status: 'limit', count: data.count, limit: data.limit };
    }
    if (res.status === 413) {
        return { status: 'too_large', bytes: data && data.bytes, limit: data && data.limit };
    }
    if (res.status === 401 || res.status === 403) {
        return { status: 'forbidden', httpStatus: res.status };
    }
    // Wiersz serwerowy zniknął (TTL/DELETE z innego urządzenia), a meta została.
    // Bez tego push kończy się 404 i synchronizacja tego klucza umiera na zawsze.
    if (res.status === 404 && meta && a.retryNoMatch !== true) {
        draftSyncClearMeta(a.storage, a.userId, a.kind, a.docId);
        var retryArgs = {};
        for (var prop in a) {
            if (Object.prototype.hasOwnProperty.call(a, prop)) retryArgs[prop] = a[prop];
        }
        retryArgs.retryNoMatch = true;
        return draftSyncPush(retryArgs);
    }
    return { status: 'error', httpStatus: res.status };
}

/**
 * Pobranie draftu z serwera. `null` = brak/nieosiągalny (bez rozróżniania
 * 404 od błędu sieci na poziomie API modułu — trasa i tak nie ujawnia cudzych).
 * @param {object} args `{storage, userId, kind, docId, fetchImpl?}`
 * @returns {Promise<{status: string, payload?: *, version?: number, updatedAt?: string, baseVersion?: number|null, httpStatus?: number}>}
 */
async function draftSyncPull(args) {
    var a = args || {};
    var fetchFn = draftSyncFetch(a.fetchImpl);
    if (!fetchFn) return { status: 'offline' };
    var res = null;
    try {
        res = await fetchFn(draftSyncUrl(a.kind, a.docId), {
            method: 'GET',
            credentials: 'same-origin'
        });
    } catch (_e) {
        return { status: 'offline' };
    }
    if (!res) return { status: 'offline' };
    if (res.status === 404) return { status: 'missing' };
    if (res.status === 401 || res.status === 403)
        return { status: 'forbidden', httpStatus: res.status };
    if (res.status !== 200) return { status: 'error', httpStatus: res.status };
    var data = await draftSyncJson(res);
    var d = data && data.data ? data.data : null;
    if (!d || typeof d.version !== 'number') return { status: 'error', httpStatus: res.status };
    draftSyncSaveMeta(a.storage, a.userId, a.kind, a.docId, {
        version: d.version,
        updatedAt: d.updatedAt
    });
    return {
        status: 'ok',
        payload: d.payload,
        version: d.version,
        updatedAt: d.updatedAt,
        baseVersion: typeof d.baseVersion === 'number' ? d.baseVersion : null
    };
}

/**
 * Lista metadanych draftów serwerowych (bez payloadu) — do odzysku cross-device.
 * @param {object} args `{fetchImpl?}`
 * @returns {Promise<{status: string, items?: Array<object>, httpStatus?: number}>}
 */
async function draftSyncList(args) {
    var a = args || {};
    var fetchFn = draftSyncFetch(a.fetchImpl);
    if (!fetchFn) return { status: 'offline' };
    var res = null;
    try {
        res = await fetchFn('/api/drafts', { method: 'GET', credentials: 'same-origin' });
    } catch (_e) {
        return { status: 'offline' };
    }
    if (!res) return { status: 'offline' };
    if (res.status !== 200) return { status: 'error', httpStatus: res.status };
    var data = await draftSyncJson(res);
    var items = data && Array.isArray(data.data) ? data.data : [];
    return { status: 'ok', items: items };
}

/**
 * Jawne usunięcie draftu serwerowego (+ meta). `false` = nie udało się.
 * @param {object} args `{storage, userId, kind, docId, fetchImpl?}`
 * @returns {Promise<boolean>}
 */
async function draftSyncRemove(args) {
    var a = args || {};
    var fetchFn = draftSyncFetch(a.fetchImpl);
    draftSyncClearMeta(a.storage, a.userId, a.kind, a.docId);
    if (!fetchFn) return false;
    try {
        var res = await fetchFn(draftSyncUrl(a.kind, a.docId), {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        return !!res && (res.status === 204 || res.status === 404);
    } catch (_e) {
        return false;
    }
}

/**
 * Kopia lokalna payloadu pod osobnym docId („zachowaj oba").
 * Tylko localStorage — nigdy serwer (nie jest dokumentem).
 * @param {object} args `{storage, draftStore, userId, kind, docId, payload, baseVersion?, now?}`
 * @returns {{ok: boolean, key?: string, docId?: string, reason?: string}}
 */
function draftSyncSaveConflictCopy(args) {
    var a = args || {};
    var store = a.draftStore;
    if (!store || typeof store.buildDraft !== 'function' || typeof store.saveDraft !== 'function')
        return { ok: false, reason: 'no_store' };
    var now = typeof a.now === 'number' ? a.now : Date.now();
    var copyDocId = draftSyncSafePart(a.docId) + DRAFT_SYNC_CONFLICT_MARK + now;
    var draft = store.buildDraft({
        userId: a.userId,
        kind: a.kind,
        docId: copyDocId,
        baseVersion: typeof a.baseVersion === 'number' ? a.baseVersion : null,
        payload: a.payload,
        now: now
    });
    if (!draft) return { ok: false, reason: 'invalid' };
    var res = store.saveDraft(a.storage, draft);
    if (!res || !res.ok) return { ok: false, reason: (res && res.reason) || 'error' };
    return {
        ok: true,
        docId: copyDocId,
        key: store.buildDraftKey(a.userId, a.kind, copyDocId)
    };
}

/**
 * Rozstrzygnięcie konfliktu. Wybór jest ZAWSZE jawny — brak wartości domyślnej.
 * - `server`: pobierz serwer i zwróć jego payload (lokalny draft zostaje, dopóki
 *   użytkownik nie zapisze/nie odrzuci — nic nie ginie po cichu),
 * - `local`: wyślij lokalny z `If-Match` na wersję serwera (nadpisuje serwer),
 * - `both`: zapisz lokalny pod `docId-konflikt-<ts>` (localStorage), potem `server`.
 *
 * @param {object} args `{choice, storage, draftStore, userId, kind, docId, payload, baseVersion?, serverVersion?, fetchImpl?, now?}`
 * @returns {Promise<{status: string, reason?: string, payload?: *, version?: number, updatedAt?: string, conflictCopyKey?: string, conflictCopyDocId?: string, httpStatus?: number}>}
 */
async function draftSyncResolveConflict(args) {
    var a = args || {};
    var choice = a.choice;
    if (choice !== 'server' && choice !== 'local' && choice !== 'both')
        return { status: 'invalid_choice' };

    var copy = null;
    if (choice === 'both') {
        copy = draftSyncSaveConflictCopy({
            storage: a.storage,
            draftStore: a.draftStore,
            userId: a.userId,
            kind: a.kind,
            docId: a.docId,
            payload: a.payload,
            baseVersion: a.baseVersion,
            now: a.now
        });
        if (!copy.ok) return { status: 'error', reason: 'copy_failed' };
    }

    if (choice === 'local') {
        var meta = draftSyncLoadMeta(a.storage, a.userId, a.kind, a.docId);
        var expected =
            typeof a.serverVersion === 'number'
                ? a.serverVersion
                : meta && typeof meta.version === 'number'
                  ? meta.version
                  : null;
        if (expected === null) return { status: 'error', reason: 'no_server_version' };
        // Wymuszamy CAS na wersję serwera: meta ustawiona na tę wersję.
        // `force` — świadomie obniżamy wersję do tej, którą podał serwer w 409.
        draftSyncSaveMeta(a.storage, a.userId, a.kind, a.docId, { version: expected }, true);
        var pushed = await draftSyncPush({
            storage: a.storage,
            userId: a.userId,
            kind: a.kind,
            docId: a.docId,
            payload: a.payload,
            baseVersion: a.baseVersion,
            fetchImpl: a.fetchImpl
        });
        var out = { status: pushed.status, version: pushed.version };
        if (copy && copy.ok) {
            out.conflictCopyKey = copy.key;
            out.conflictCopyDocId = copy.docId;
        }
        return out;
    }

    var pulled = await draftSyncPull({
        storage: a.storage,
        userId: a.userId,
        kind: a.kind,
        docId: a.docId,
        fetchImpl: a.fetchImpl
    });
    var res = {
        status: pulled.status,
        payload: pulled.payload,
        version: pulled.version,
        updatedAt: pulled.updatedAt
    };
    if (copy && copy.ok) {
        res.conflictCopyKey = copy.key;
        res.conflictCopyDocId = copy.docId;
    }
    return res;
}

window.draftSync = {
    META_PREFIX: DRAFT_SYNC_META_PREFIX,
    MAX_BYTES: DRAFT_SYNC_MAX_BYTES,
    KEEPALIVE_MAX_BYTES: DRAFT_SYNC_KEEPALIVE_MAX_BYTES,
    CONFLICT_MARK: DRAFT_SYNC_CONFLICT_MARK,
    utf8Bytes: draftSyncUtf8Bytes,
    payloadBytes: draftSyncPayloadBytes,
    metaKey: draftSyncMetaKey,
    loadMeta: draftSyncLoadMeta,
    saveMeta: draftSyncSaveMeta,
    clearMeta: draftSyncClearMeta,
    url: draftSyncUrl,
    push: draftSyncPush,
    pull: draftSyncPull,
    list: draftSyncList,
    remove: draftSyncRemove,
    saveConflictCopy: draftSyncSaveConflictCopy,
    resolveConflict: draftSyncResolveConflict
};
