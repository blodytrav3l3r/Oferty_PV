// @ts-check
/* ===== Motyw jasny/ciemny (light/dark) =====
   Prawdą jest backend (GET/PUT /api/users/me/preferences, klucz "theme"),
   localStorage to tylko cache dla natychmiastowego malowania (anti-FOUC)
   i pracy offline — wzorzec jak displayUnits.js.
   Ciemny motyw to brak atrybutu data-theme (status quo). */
var SOK_THEME_KEY = 'sok-theme';
var SOK_THEME_MSG = 'sok-theme-changed';
var _sokThemeUserId = '';
var _sokThemePushTimer = null;

function _sokThemeSuffix() {
    try {
        var u =
            typeof currentUser !== 'undefined'
                ? currentUser
                : typeof window !== 'undefined'
                  ? window.currentUser
                  : null;
        if (u && u.id) return '_' + String(u.id);
        if (_sokThemeUserId) return '_' + String(_sokThemeUserId);
    } catch (_e) {}
    return '';
}

function _sokThemeValid(v) {
    return v === 'light' || v === 'dark' ? v : null;
}

function _sokThemeReadCache() {
    try {
        var suffix = _sokThemeSuffix();
        if (suffix) {
            var perUser = _sokThemeValid(localStorage.getItem(SOK_THEME_KEY + suffix));
            if (perUser) return perUser;
        }
        var global = _sokThemeValid(localStorage.getItem(SOK_THEME_KEY));
        if (global) return global;
    } catch (_e) {}
    return 'dark';
}

function _sokThemeSaveCache(mode) {
    try {
        localStorage.setItem(SOK_THEME_KEY, mode);
        var suffix = _sokThemeSuffix();
        if (suffix) localStorage.setItem(SOK_THEME_KEY + suffix, mode);
    } catch (_e) {}
}

function _sokThemeIcon(mode) {
    return mode === 'light' ? 'moon' : 'sun';
}

function _sokThemeRefreshToggle(mode) {
    try {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        var current = mode || _sokThemeReadCache();
        var next = current === 'light' ? 'ciemny' : 'jasny';
        btn.setAttribute('aria-pressed', current === 'light' ? 'true' : 'false');
        btn.setAttribute('title', 'Przełącz na motyw ' + next);
        btn.setAttribute('aria-label', 'Przełącz na motyw ' + next);
        btn.innerHTML = '<i data-lucide="' + _sokThemeIcon(current) + '"></i>';
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: btn });
    } catch (_e) {}
}

function _sokThemeApply(mode) {
    try {
        if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light');
        else document.documentElement.removeAttribute('data-theme');
    } catch (_e) {}
    _sokThemeRefreshToggle(mode);
}

function _sokThemePushBackend(mode) {
    try {
        if (_sokThemePushTimer) clearTimeout(_sokThemePushTimer);
    } catch (_e) {}
    _sokThemePushTimer = setTimeout(function () {
        try {
            fetch('/api/users/me/preferences', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'theme', value: mode })
            }).catch(function () {});
        } catch (_e) {}
    }, 400);
}

function _sokThemeBroadcast(mode) {
    // Powiadom osadzone iframe (SPA) i rodzica — storage event pokrywa
    // same-origin, postMessage dobija resztę (np. świeży iframe bez focusa).
    try {
        var msg = { type: SOK_THEME_MSG, theme: mode };
        if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
            var frame = frames[i];
            if (frame instanceof HTMLIFrameElement && frame.contentWindow) {
                try {
                    frame.contentWindow.postMessage(msg, '*');
                } catch (_e) {}
            }
        }
    } catch (_e) {}
}

function getSokTheme() {
    return _sokThemeReadCache();
}

function setSokTheme(mode) {
    var clean = _sokThemeValid(mode);
    if (!clean) return;
    _sokThemeSaveCache(clean);
    _sokThemeApply(clean);
    _sokThemePushBackend(clean);
    _sokThemeBroadcast(clean);
}

function toggleSokTheme() {
    setSokTheme(getSokTheme() === 'light' ? 'dark' : 'light');
}

function initSokTheme(user) {
    try {
        if (user && user.id) _sokThemeUserId = String(user.id);
    } catch (_e) {}
    // Natychmiast cache (bez FOUC), potem synchronizacja z backendu.
    _sokThemeApply(_sokThemeReadCache());
    try {
        fetch('/api/users/me/preferences', { credentials: 'same-origin' })
            .then(function (res) {
                if (!res.ok) return null;
                return res.json();
            })
            .then(function (data) {
                if (!data || !data.preferences) return;
                var server = _sokThemeValid(data.preferences.theme);
                if (server && server !== _sokThemeReadCache()) {
                    _sokThemeSaveCache(server);
                    _sokThemeApply(server);
                }
            })
            .catch(function () {});
    } catch (_e) {}
}

window.sokTheme = {
    get: getSokTheme,
    set: setSokTheme,
    toggle: toggleSokTheme,
    init: initSokTheme,
    refreshToggle: _sokThemeRefreshToggle
};

// Synchronizacja między kartami/iframe: cudzy zapis w localStorage i postMessage.
try {
    window.addEventListener('storage', function (ev) {
        if (!ev || ev.key !== SOK_THEME_KEY) return;
        var mode = _sokThemeValid(ev.newValue);
        if (mode) _sokThemeApply(mode);
    });
    window.addEventListener('message', function (ev) {
        if (!ev || !ev.data || ev.data.type !== SOK_THEME_MSG) return;
        var mode = _sokThemeValid(ev.data.theme);
        if (mode) {
            _sokThemeSaveCache(mode);
            _sokThemeApply(mode);
        }
    });
} catch (_e) {}
