// @ts-check
/* ===== DRAFT IDB — backend IndexedDB dla dużych draftów =====
 * Po co: localStorage ma sufit zależny od przeglądarki (QuotaExceededError ~50 MB),
 * więc drafty większe niż DRAFT_SYNC_MAX_BYTES trzymamy w IndexedDB (limit 200 MB
 * pilnuje draftStore). Klucz = ten sam co w localStorage, wartość = JSON koperty.
 *
 * API jest promise-based i wyłącznie przez `window.draftIdb`, żeby warstwa danych
 * (draftStore) była testowalna na podstawionym backendzie. Brak IndexedDB =
 * odrzucone promise'y, draftStore zostaje przy samym localStorage.
 */
(function () {
    'use strict';

    var DB_NAME = 'sok_drafts';
    var STORE_NAME = 'drafts';
    var DB_VERSION = 1;

    /** @type {Promise<IDBDatabase>|null} */
    var dbPromise = null;

    /** @returns {boolean} */
    function isSupported() {
        return typeof indexedDB !== 'undefined' && !!indexedDB;
    }

    /**
     * Otwiera (raz) bazę draftów. Odrzuca, gdy IndexedDB jest niedostępny.
     * @returns {Promise<IDBDatabase>}
     */
    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve, reject) {
            if (!isSupported()) {
                reject(new Error('idb-unsupported'));
                return;
            }
            var req;
            try {
                req = indexedDB.open(DB_NAME, DB_VERSION);
            } catch (err) {
                reject(err);
                return;
            }
            req.onupgradeneeded = function () {
                var db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
            };
            req.onsuccess = function () {
                resolve(req.result);
            };
            req.onerror = function () {
                reject(req.error || new Error('idb-open'));
            };
            req.onblocked = function () {
                reject(new Error('idb-blocked'));
            };
        }).catch(function (err) {
            // Kolejne wywołanie próbuje otworzyć bazę od nowa (przejściowe błędy).
            dbPromise = null;
            throw err;
        });
        return dbPromise;
    }

    /**
     * Jedna transakcja na wywołanie. `run` dostaje object store i może ustawiać
     * wynik przez `req.onsuccess`; promise rozwiązuje się po commicie.
     * @param {IDBTransactionMode} mode
     * @param {(store: IDBObjectStore) => void} run
     * @returns {Promise<void>}
     */
    function runTx(mode, run) {
        return openDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx;
                try {
                    tx = db.transaction(STORE_NAME, mode);
                } catch (err) {
                    reject(err);
                    return;
                }
                tx.oncomplete = function () {
                    resolve();
                };
                tx.onerror = function () {
                    reject(tx.error || new Error('idb-tx'));
                };
                tx.onabort = function () {
                    reject(tx.error || new Error('idb-abort'));
                };
                try {
                    run(tx.objectStore(STORE_NAME));
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    /**
     * Zapis koperty pod kluczem (nadpisuje poprzednią wartość).
     * @param {string} key
     * @param {string} json
     * @returns {Promise<void>}
     */
    function put(key, json) {
        return runTx('readwrite', function (store) {
            store.put(json, key);
        });
    }

    /**
     * Odczyt koperty; brak klucza → null.
     * @param {string} key
     * @returns {Promise<string|null>}
     */
    function get(key) {
        var value = null;
        return runTx('readonly', function (store) {
            var req = store.get(key);
            req.onsuccess = function () {
                value = req.result === undefined ? null : req.result;
            };
        }).then(function () {
            return value;
        });
    }

    /**
     * Wszystkie klucze w bazie.
     * @returns {Promise<Array<string>>}
     */
    function keys() {
        var out = [];
        return runTx('readonly', function (store) {
            var req = store.getAllKeys();
            req.onsuccess = function () {
                out = (req.result || []).map(String);
            };
        }).then(function () {
            return out;
        });
    }

    /**
     * Usuwa jeden klucz (brak klucza nie jest błędem).
     * @param {string} key
     * @returns {Promise<void>}
     */
    function del(key) {
        return runTx('readwrite', function (store) {
            store.delete(key);
        });
    }

    /**
     * Usuwa wszystkie klucze z prefiksem (logout / „Odrzuć wszystkie”).
     * @param {string} prefix
     * @returns {Promise<number>} liczba usuniętych
     */
    function delPrefix(prefix) {
        var removed = 0;
        return runTx('readwrite', function (store) {
            var req = store.getAllKeys();
            req.onsuccess = function () {
                (req.result || []).forEach(function (key) {
                    if (String(key).indexOf(prefix) === 0) {
                        store.delete(key);
                        removed++;
                    }
                });
            };
        }).then(function () {
            return removed;
        });
    }

    /** @type {any} */ (window).draftIdb = {
        isSupported: isSupported,
        put: put,
        get: get,
        keys: keys,
        del: del,
        delPrefix: delPrefix
    };
})();
