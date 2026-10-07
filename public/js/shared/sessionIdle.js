// @ts-check
/**
 * sessionIdle.js — strażnik sesji (idle 1h, absolute 7d).
 * Klasyczny skrypt (defer) + mostek `window.sessionIdle` dla legacy.
 *
 * Zasady S.O.K. (docs/UI_GUIDELINES.md §6):
 * - modale wyłącznie przez `window.showModal` (modalCore.js),
 * - style tokenami `var(--*)`, brak inline z-index (warstwy w modalCore/LAYERS),
 * - ikony Lucide + `lucide.createIcons({root})`, brak emoji,
 * - teksty przez escapeHtml, aria-label na przyciskach, focus na akcji.
 *
 * Logika:
 * - `lastUserActivity` = mousemove/keydown/click/scroll/touch (throttle 30 s).
 * - keepalive co 15 min TYLKO gdy user był aktywny <15 min i karta widoczna
 *   (GET /api/auth/me dotyka lastActivity serwera). Brak aktywności = brak
 *   requestów = serwer wygasza sesję po 1h — zgodnie z regułą.
 * - warn-modal 5 min przed przewidywanym końcem idle (55 min od ostatniej
 *   aktywności) z licznikiem; `Przedłuż` = touch serwera.
 * - `notifyUnauthorized(err)` — wołane przy 401 z zapisu/odczytu; pokazuje
 *   expired-modal RAZ (draft zostaje — przekierowanie dopiero po kliknięciu).
 */

(function () {
    var IDLE_MS = 60 * 60 * 1000; // 1h — lustro SESSION_IDLE_TIMEOUT_MS
    var WARN_BEFORE_MS = 5 * 60 * 1000; // ostrzeżenie 5 min przed
    var KEEPALIVE_MS = 15 * 60 * 1000; // keepalive max co 15 min
    var ACTIVITY_THROTTLE_MS = 30 * 1000;

    var lastUserActivity = Date.now();
    var lastActivityWrite = 0;
    var lastKeepalive = 0;
    var warnOverlayId = 'session-idle-warn-overlay';
    var expiredShown = false;
    var warnShownForCycle = false;
    var countdownTimer = null;

    function esc(s) {
        try {
            if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
        } catch (_e) {}
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function icons(root) {
        try {
            if (window.lucide && typeof window.lucide.createIcons === 'function')
                window.lucide.createIcons({ root: root || document });
        } catch (_e) {}
    }

    function markActivity() {
        var now = Date.now();
        lastUserActivity = now;
        if (now - lastActivityWrite < ACTIVITY_THROTTLE_MS) return;
        lastActivityWrite = now;
    }

    function closeWarn() {
        try {
            var el = document.getElementById(warnOverlayId);
            if (el) {
                if (typeof window.untrapFocus === 'function') window.untrapFocus(el);
                el.remove();
            }
            if (typeof window.restoreBodyScroll === 'function') window.restoreBodyScroll();
        } catch (_e) {}
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
    }

    function remainingMs() {
        return lastUserActivity + IDLE_MS - Date.now();
    }

    function fmtCountdown(ms) {
        var s = Math.max(0, Math.ceil(ms / 1000));
        var m = Math.floor(s / 60);
        var r = s % 60;
        return (m < 10 ? '0' + m : '' + m) + ':' + (r < 10 ? '0' + r : '' + r);
    }

    function touchServer() {
        return fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (res) {
            if (res.ok) {
                lastUserActivity = Date.now();
                lastKeepalive = Date.now();
                warnShownForCycle = false;
            }
            return res;
        });
    }

    function showWarn() {
        if (warnShownForCycle) return;
        if (typeof window.showModal !== 'function') return;
        warnShownForCycle = true;
        var html =
            '<div class="modal">' +
            '<div class="app-confirm-modal">' +
            '<div class="app-confirm-icon"><i data-lucide="alert-triangle" class="icon-32-warn"></i></div>' +
            '<div class="app-confirm-title" id="session-idle-warn-title">Sesja wkrótce wygaśnie</div>' +
            '<div class="app-confirm-message" id="session-idle-warn-msg">' +
            'Brak aktywności od dłuższego czasu. Sesja wygasa po <strong>1 godzinie bezczynności</strong>.<br>' +
            'Pozostało: <strong id="session-idle-countdown">' +
            esc(fmtCountdown(remainingMs())) +
            '</strong><br>' +
            '<span class="text-muted">Niezapisane zmiany są w drafcie — przedłuż sesję, żeby je spokojnie zapisać.</span>' +
            '</div>' +
            '<div class="app-confirm-actions">' +
            '<button class="app-confirm-btn" id="session-idle-logout">Wyloguj</button>' +
            '<button class="app-confirm-btn" id="session-idle-extend" style="background:var(--warn)">Przedłuż sesję</button>' +
            '</div>' +
            '</div>' +
            '</div>';
        var overlay = window.showModal({
            id: warnOverlayId,
            titleId: 'session-idle-warn-title',
            html: html,
            onClose: function () {
                if (countdownTimer) {
                    clearInterval(countdownTimer);
                    countdownTimer = null;
                }
            }
        });
        icons(overlay);
        var cd = overlay.querySelector('#session-idle-countdown');
        countdownTimer = setInterval(function () {
            var left = remainingMs();
            if (cd) cd.textContent = fmtCountdown(left);
            if (left <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                closeWarn();
                showExpired('idle');
            }
        }, 1000);
        var extendBtn = overlay.querySelector('#session-idle-extend');
        var logoutBtn = overlay.querySelector('#session-idle-logout');
        if (extendBtn)
            extendBtn.addEventListener('click', function () {
                touchServer()
                    .then(function (res) {
                        if (res.status === 401) {
                            closeWarn();
                            showExpired('idle');
                            return;
                        }
                        closeWarn();
                        try {
                            if (typeof window.showToast === 'function')
                                window.showToast('Sesja przedłużona.', 'success');
                        } catch (_e) {}
                    })
                    .catch(function () {
                        closeWarn();
                    });
            });
        if (logoutBtn)
            logoutBtn.addEventListener('click', function () {
                closeWarn();
                try {
                    if (typeof window.appLogout === 'function') window.appLogout();
                    else window.location.href = 'index.html';
                } catch (_e) {
                    window.location.href = 'index.html';
                }
            });
        try {
            if (extendBtn) extendBtn.focus();
        } catch (_e) {}
    }

    function showExpired(kind) {
        if (expiredShown) return;
        expiredShown = true;
        closeWarn();
        if (typeof window.showModal !== 'function') {
            window.location.href = 'index.html';
            return;
        }
        var msg =
            kind === 'absolute'
                ? 'Sesja osiągnęła maksymalny czas (7 dni).'
                : 'Zostałeś wylogowany po <strong>1 godzinie bezczynności</strong>.';
        var html =
            '<div class="modal">' +
            '<div class="app-confirm-modal">' +
            '<div class="app-confirm-icon"><i data-lucide="log-out" class="icon-32-warn"></i></div>' +
            '<div class="app-confirm-title" id="session-idle-expired-title">Sesja wygasła</div>' +
            '<div class="app-confirm-message">' +
            msg +
            '<br><span class="text-muted">Niezapisane zmiany zostały w lokalnym drafcie — po ponownym zalogowaniu wróć do dokumentu.</span>' +
            '</div>' +
            '<div class="app-confirm-actions">' +
            '<button class="app-confirm-btn" id="session-idle-login" style="background:var(--warn);flex:1">Zaloguj ponownie</button>' +
            '</div>' +
            '</div>' +
            '</div>';
        var overlay = window.showModal({
            id: 'session-idle-expired-overlay',
            titleId: 'session-idle-expired-title',
            html: html,
            onClose: function () {
                return false;
            }
        });
        icons(overlay);
        var loginBtn = overlay.querySelector('#session-idle-login');
        function goLogin() {
            try {
                if (typeof window._bypassBeforeUnload !== 'undefined')
                    window._bypassBeforeUnload = true;
            } catch (_e) {}
            window.location.href = 'index.html';
        }
        if (loginBtn) loginBtn.addEventListener('click', goLogin);
        try {
            if (loginBtn) loginBtn.focus();
        } catch (_e) {}
        try {
            if (typeof window.showToast === 'function')
                window.showToast(
                    'Sesja wygasła — zaloguj się ponownie. Draft zachowany.',
                    'warning'
                );
        } catch (_e) {}
    }

    function notifyUnauthorized(err) {
        var code = err && err.code;
        var status = err && err.status;
        if (status !== 401) return false;
        if (code === 'SESSION_IDLE_EXPIRED') {
            showExpired('idle');
            return true;
        }
        if (code === 'SESSION_EXPIRED' || code === undefined || code === null) {
            showExpired(status === 401 && code === 'SESSION_IDLE_EXPIRED' ? 'idle' : 'absolute');
            return true;
        }
        return false;
    }

    function tick() {
        try {
            if (typeof document !== 'undefined' && document.hidden) return;
            var now = Date.now();
            var left = remainingMs();
            // Warn 5 min przed końcem idle — tylko gdy karta żyje.
            if (!warnShownForCycle && left <= WARN_BEFORE_MS && left > 0) showWarn();
            // Samoczynne wygaszenie timera po stronie klienta nie wylogowuje —
            // źródłem prawdy jest 401 serwera; expired-modal pokaże się z
            // notifyUnauthorized albo z odliczania warn-modal.
            // Keepalive tylko przy realnej aktywności użytkownika.
            if (now - lastUserActivity < KEEPALIVE_MS && now - lastKeepalive > KEEPALIVE_MS) {
                if (!document.hidden) {
                    touchServer().catch(function () {});
                }
            }
        } catch (_e) {}
    }

    function init() {
        if (typeof document === 'undefined' || typeof window === 'undefined') return;
        // Strona logowania nie pilnuje sesji.
        try {
            if (/index\.html$|\/$/.test(window.location.pathname)) {
                var onLogin =
                    document.getElementById('login-form') || document.querySelector('.login-box');
                if (onLogin) return;
            }
        } catch (_e) {}
        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (ev) {
            try {
                document.addEventListener(ev, markActivity, { passive: true });
            } catch (_e2) {
                try {
                    document.addEventListener(ev, markActivity);
                } catch (_e3) {}
            }
        });
        try {
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) markActivity();
            });
        } catch (_e) {}
        if (!window._sessionIdleInterval) {
            window._sessionIdleInterval = setInterval(tick, 30000);
        }
        try {
            window.addEventListener('pagehide', function () {
                if (window._sessionIdleInterval) {
                    clearInterval(window._sessionIdleInterval);
                    window._sessionIdleInterval = null;
                }
            });
        } catch (_e2) {}
    }

    window.sessionIdle = {
        notifyUnauthorized: notifyUnauthorized,
        showExpired: showExpired,
        touch: function () {
            markActivity();
            return touchServer();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
