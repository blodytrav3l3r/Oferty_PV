// Słownik kodów MAGAZYN (dennica/nadbudowa) — SSoT dla import/eksport studni.
// Kody edytowalne na Pulpicie (Konfiguracja Systemu), przechowywane w settings `magazyn_codes`.
// Fallback = historyczne twarde WL/M0. Nieznany/pusty kod w imporcie → Kluczbork.
(function () {
    'use strict';

    var DEFAULTS = {
        dennicaWl: 'WL',
        dennicaKlb: 'M0',
        nadbudowaWl: 'WL',
        nadbudowaKlb: 'M0'
    };

    // Szeroki zbiór "spodu" — spójny z rabatami dennica/nadbudowa (externalExportTemplate).
    // Celowo NIE isDennicaLikeProduct (węższy: bez kinety).
    var DENNICA_TYPES = ['dennica', 'kineta', 'styczna'];

    var _cache = null;
    var _promise = null;

    function withDefaults(codes) {
        var out = {};
        for (var k in DEFAULTS) {
            out[k] =
                codes && typeof codes[k] === 'string' && codes[k].trim() !== ''
                    ? codes[k].trim().toUpperCase()
                    : DEFAULTS[k];
        }
        return out;
    }

    async function get() {
        if (_cache) return _cache;
        if (!_promise) {
            _promise = fetch('/api/settings/magazyn-codes', { credentials: 'same-origin' })
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(function (json) {
                    _cache = withDefaults(json);
                    return _cache;
                })
                .catch(function () {
                    _cache = withDefaults(null);
                    return _cache;
                })
                .finally(function () {
                    _promise = null;
                });
        }
        return _promise;
    }

    function normalizeCode(code) {
        return (code == null ? '' : String(code)).trim().toUpperCase();
    }

    function isWloclawek(warehouse) {
        var m = warehouse == null ? '' : String(warehouse);
        return m.includes('oc') || m.includes('Włoc') || m.includes('WLO');
    }

    function isDennicaType(componentType) {
        return DENNICA_TYPES.includes(componentType);
    }

    // Kod dla wiersza: part wynika z TYPU produktu (warunek: deterministyczne).
    function codeForPart(part, warehouse, codes) {
        var c = withDefaults(codes || _cache);
        var wl = isWloclawek(warehouse);
        if (part === 'dennica') return wl ? c.dennicaWl : c.dennicaKlb;
        return wl ? c.nadbudowaWl : c.nadbudowaKlb;
    }

    // Magazyn z kodu w wierszu. Nieznany/pusty → Kluczbork (bezpieczny fallback).
    function warehouseForCode(code, part, codes) {
        var c = withDefaults(codes || _cache);
        var n = normalizeCode(code);
        if (!n) return 'Kluczbork';
        var wlCode = part === 'dennica' ? c.dennicaWl : c.nadbudowaWl;
        return n === wlCode ? 'Włocławek' : 'Kluczbork';
    }

    window.MagazynCodes = {
        DEFAULTS: DEFAULTS,
        DENNICA_TYPES: DENNICA_TYPES,
        get: get,
        clear: function () {
            _cache = null;
        },
        normalizeCode: normalizeCode,
        isWloclawek: isWloclawek,
        isDennicaType: isDennicaType,
        codeForPart: codeForPart,
        warehouseForCode: warehouseForCode
    };
})();
