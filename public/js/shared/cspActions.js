var __cspActions = Object.create(null);
var __cspCounts = null;
var __cspUnknown = null;
var __cspFailures = null;
var __cspLogTimer = null;

function _cspIsDev() {
    try {
        return localStorage && localStorage.getItem('csp_dev') === '1';
    } catch (e) {
        return false;
    }
}

function _cspInitCounters() {
    if (__cspCounts) return;
    __cspCounts = Object.create(null);
    __cspUnknown = Object.create(null);
    __cspFailures = [];
    if (_cspIsDev() && !__cspLogTimer) {
        __cspLogTimer = setInterval(function () {
            var total = 0;
            for (var k in __cspCounts) total += __cspCounts[k];
            var top10 = Object.entries(__cspCounts)
                .sort(function (a, b) {
                    return b[1] - a[1];
                })
                .slice(0, 10)
                .map(function (e) {
                    return e[0] + ': ' + e[1];
                });
            console.log('[CSP] ' + total + ' dispatches | Top 10:', top10);
            var uk = Object.keys(__cspUnknown);
            if (uk.length > 0)
                console.log('[CSP] Unknown actions (' + uk.length + '):', __cspUnknown);
            if (__cspFailures.length > 0)
                console.log(
                    '[CSP] Failures (' + __cspFailures.length + '):',
                    __cspFailures.slice(-10)
                );
        }, 30000);
    }
}

window.__cspStats = function () {
    if (!__cspCounts) return { status: 'not_initialized' };
    var entries = Object.entries(__cspCounts);
    entries.sort(function (a, b) {
        return b[1] - a[1];
    });
    var top10 = entries.slice(0, 10).map(function (e) {
        return { action: e[0], count: e[1] };
    });
    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        totalDispatches: entries.reduce(function (s, e) {
            return s + e[1];
        }, 0),
        uniqueActions: entries.length,
        top10: top10,
        unknown: Object.entries(__cspUnknown).map(function (e) {
            return { action: e[0], count: e[1] };
        }),
        failures: __cspFailures ? __cspFailures.slice(-50) : [],
        registeredActions: Object.keys(__cspActions).length
    };
};

function _cspTrackFailure(name, type, detail) {
    if (!__cspFailures) return;
    __cspFailures.push({ ts: new Date().toISOString(), action: name, type: type, detail: detail });
    if (__cspFailures.length > 200) __cspFailures.splice(0, __cspFailures.length - 200);
}

function registerCspAction(name, config) {
    if (typeof config === 'function') {
        config = { handler: config, params: [] };
    }
    if (typeof config !== 'object' || config === null) {
        console.warn('[CSP] registerCspAction: invalid config for "' + name + '" — noop');
        __cspActions[name] = { handler: function () {}, params: [] };
        return;
    }
    if (!config.params) config.params = [];
    __cspActions[name] = config;
}

function extractActionParams(target, paramNames) {
    var params = {};
    for (var i = 0; i < paramNames.length; i++) {
        var pname = paramNames[i];
        var attr = 'data-' + pname.replace(/([A-Z])/g, '-$1').toLowerCase();
        params[pname] = target.getAttribute(attr);
    }
    return params;
}

function dispatchCspAction(e) {
    var target =
        e.target && typeof e.target.closest === 'function'
            ? e.target.closest('[data-action]')
            : null;
    if (!target) return;
    var name = target.dataset.action;
    // Przyciski i linki z data-action nie mogą odpalać się na focusin/focusout,
    // bo pojedyncze kliknięcie generuje focusin -> click -> focusout, co wywołuje
    // akcję wielokrotnie (podwójnie dla 'click' or 'change', potrójnie z focusout).
    // Ta zasada dotyczy wszystkich przycisków i linków, nie tylko nawigacji kreatora.
    if (
        (e.type === 'focusin' || e.type === 'focusout') &&
        (target.tagName === 'BUTTON' || target.tagName === 'A')
    ) {
        return;
    }
    _cspInitCounters();
    if (__cspCounts) {
        __cspCounts[name] = (__cspCounts[name] || 0) + 1;
        if (!__cspActions[name]) __cspUnknown[name] = (__cspUnknown[name] || 0) + 1;
    }
    var entry = __cspActions[name];
    if (!entry) {
        _cspTrackFailure(name, 'missing_handler', 'No registered action for "' + name + '"');
        return;
    }
    if (typeof entry === 'function') {
        try {
            entry(target);
        } catch (ex) {
            _cspTrackFailure(name, 'handler_exception', ex.message || String(ex));
        }
        return;
    }
    var params = extractActionParams(target, entry.params || []);
    var hasParams = entry.params && entry.params.length > 0;
    if (hasParams) {
        var missing = entry.params.filter(function (p) {
            return params[p] == null;
        });
        if (missing.length > 0) {
            _cspTrackFailure(name, 'missing_params', 'Missing: ' + missing.join(', '));
        }
    }
    try {
        if (hasParams) {
            entry.handler(params, target, e);
        } else {
            entry.handler(target);
        }
    } catch (ex) {
        _cspTrackFailure(name, 'handler_exception', ex.message || String(ex));
    }
}

document.addEventListener('click', dispatchCspAction);
document.addEventListener('change', dispatchCspAction);
document.addEventListener('input', dispatchCspAction);
document.addEventListener('focusin', dispatchCspAction);
document.addEventListener('focusout', dispatchCspAction);
document.addEventListener('keydown', dispatchCspAction);
document.addEventListener('dragstart', dispatchCspAction);
document.addEventListener('dragover', dispatchCspAction);
document.addEventListener('drop', dispatchCspAction);
document.addEventListener('dragend', dispatchCspAction);

// Delegated select-on-click for inputs
document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('[data-select-on-click="true"]')) {
        t.select();
    }
});

window.registerCspAction = registerCspAction;
