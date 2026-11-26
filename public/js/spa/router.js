// @ts-check
/**
 * SPA Router — Router oparty na iframe dla S.O.K.
 *
 * Każdy moduł (rury, studnie) działa we własnym iframe,
 * zapewniając PEŁNĄ izolację JS, CSS i stanu DOM.
 * Oryginalne pliki HTML działają bez ŻADNYCH modyfikacji.
 *
 * Trasy:
 *   #/rury      → rury.html (iframe)
 *   #/studnie   → studnie.html (iframe)
 *   #/kartoteka → kartoteka.html (iframe)
 *   (domyślnie) → #/rury
 */

(() => {
    // ── Stan ──
    let currentModule = null;
    /** @type {Record<string, HTMLIFrameElement>} */
    const iframes = {};
    let transitionToken = 0;
    const IFRAME_READY_TIMEOUT_MS = 12000;
    let transitionTimer = null;

    // ── Ochrona niezapisanych zmian przy zmianie modułu (popup aplikacji) ──
    // Hash SPA nie wywołuje beforeunload — guard appConfirm. Native beforeunload w ui.js to safety-net dla X/mouse Reload.
    let _navForceOnce = false; // nawigacja potwierdzona przez użytkownika
    let _navReverting = false; // cofanie hasha po anulowaniu — przepuść echo hashchange
    let _lastCleanHash = null; // ostatni hash bez niezapisanych zmian
    // Parametry sterujące panelem/modalem: nie trafiają do src iframe ani klucza reloadu.
    const _TRANSIENT_PARAMS = new Set(['panel', 'pvtype', 'version', 'against', 'newOffer']);

    function _isDirtyNow() {
        // SPA-GUARD-PRO P0.1: SSoT w shared/sokDirty.js (flagi + diff draft-vs-SAVED).
        try {
            if (typeof window.__sokIsDirty === 'function') return window.__sokIsDirty() === true;
        } catch (_e0) {}
        try {
            if (typeof window._isWizardDirty === 'function' && window._isWizardDirty() === true)
                return true;
            for (const key of Object.keys(iframes)) {
                try {
                    const w = iframes[key]?.contentWindow;
                    if (!w) continue;
                    if (w._excelDirty) return true;
                    if (typeof w._isWizardDirty === 'function' && w._isWizardDirty()) return true;
                } catch {}
            }
            for (const iframe of document.querySelectorAll('iframe.spa-module-iframe')) {
                try {
                    if (!(iframe instanceof HTMLIFrameElement)) continue;
                    const w = iframe.contentWindow;
                    // @ts-ignore — legacy check, iframe already tracked via contentWindow
                    if (!w || /** @type {any} */ (iframes)[w]) continue;
                    if (w._excelDirty) return true;
                    if (typeof w._isWizardDirty === 'function' && w._isWizardDirty()) return true;
                } catch {}
            }
        } catch (_e) {}
        return false;
    }
    try {
        Object.defineProperty(window, '_navForceOnce', {
            get() {
                return _navForceOnce;
            },
            set(v) {
                _navForceOnce = !!v;
                window._bypassBeforeUnload = !!v;
            },
            configurable: true
        });
    } catch {}
    function _getConfirmLock() {
        try {
            return !!window._confirmLock;
        } catch {
            return false;
        }
    }
    function _setConfirmLock(v) {
        try {
            window._confirmLock = !!v;
        } catch {}
    }

    function _moduleFromHash(hash) {
        try {
            const h = String(hash || '').replace('#/', '');
            const mod = h.split('?')[0] || 'rury';
            return MODULES[mod] ? mod : 'rury';
        } catch (_e) {
            return 'rury';
        }
    }

    function _offerIdFromHash(hash) {
        try {
            const h = String(hash || '');
            const qs = h.indexOf('?') !== -1 ? h.slice(h.indexOf('?') + 1) : '';
            const usp = new URLSearchParams(qs);
            return usp.get('edit') || usp.get('order') || '';
        } catch (_e) {
            return '';
        }
    }
    // Komunikat guarda z kontekstem (P1.1): która oferta, dokąd idziesz.
    // Fallback do generycznego tekstu gdy brak SSoT (mieszany deploy).
    // canSave=false: bez obietnicy zapisu (2-btn) — tekst tylko o porzuceniu.
    function _dirtyLeaveMessage(targetHash, canSave) {
        const base = 'Wprowadzone zmiany mogą nie zostać zapisane.';
        try {
            const targetMod = _moduleFromHash(targetHash);
            const targetName = (MODULES[targetMod] && MODULES[targetMod].logo) || targetMod;
            const targetOffer = _offerIdFromHash(targetHash);
            if (typeof window.__sokDescribeDirty === 'function') {
                const d = window.__sokDescribeDirty();
                if (d && (d.kind || d.module || d.number || d.docId)) {
                    const label =
                        typeof window.__sokKindLabel === 'function' && d.kind
                            ? window.__sokKindLabel(d.kind)
                            : d.module
                              ? 'Dokument (' + d.module + ')'
                              : 'Dokument';
                    const num = d.number || (d.docId && d.docId !== 'new' ? d.docId : '') || '';
                    const what = num ? label + ' ' + num : label;
                    // P1.2: oferta B nad brudną A — nazwij obie strony.
                    if (targetOffer && d.docId && targetOffer !== d.docId)
                        return canSave === false
                            ? `${what} ma niezapisane zmiany.\nPrzejść do ${targetOffer} (${targetName}) bez zapisywania?`
                            : what +
                                  ' ma niezapisane zmiany.\nPorzucić je i wczytać ' +
                                  targetOffer +
                                  ' (' +
                                  targetName +
                                  ')?';
                    return canSave === false
                        ? `${what} ma niezapisane zmiany.\nPrzejść do: ${targetName} bez zapisywania?`
                        : what +
                              ' ma niezapisane zmiany.\nZapisać przed przejściem do: ' +
                              targetName +
                              '?';
                }
            }
            return base + '\nPrzejść do: ' + targetName + '?';
        } catch (_e) {
            return base;
        }
    }

    async function _saveDirtyPrev() {
        try {
            if (typeof window.__sokSaveDirty !== 'function') {
                try {
                    if (typeof console !== 'undefined' && console.debug)
                        console.debug('[router] save-skip: brak __sokSaveDirty');
                } catch (_e0) {}
                return false;
            }
            const prevWin =
                currentModule && iframes[currentModule]
                    ? iframes[currentModule].contentWindow
                    : null;
            // Fallback: brak żywego iframe (np. kontekst testowy) — próba na sobie,
            // w rodzicu SPA saverów nie ma więc kończy się szybkim false.
            if (!prevWin) {
                try {
                    if (typeof console !== 'undefined' && console.debug)
                        console.debug('[router] save-skip: brak contentWindow modulu', {
                            currentModule: currentModule
                        });
                } catch (_e1) {}
            }
            const saved = (await window.__sokSaveDirty(prevWin || window)) === true;
            try {
                if (typeof console !== 'undefined' && console.debug)
                    console.debug('[router] save-result', {
                        currentModule: currentModule,
                        saved: saved
                    });
            } catch (_e2) {}
            return saved;
        } catch (_e) {
            return false;
        }
    }

    async function _confirmLeaveModule(targetHash) {
        if (_getConfirmLock()) return;
        _setConfirmLock(true);
        try {
            // Pusta oferta (0 pozycji) niezapisywalna — 2-btn zamiast ślepego „Zapisz".
            let canSavePrev = true;
            try {
                if (typeof window.__sokCanSave === 'function') {
                    const _pw =
                        currentModule && iframes[currentModule]
                            ? iframes[currentModule].contentWindow
                            : null;
                    canSavePrev = window.__sokCanSave(_pw || window) === true;
                }
            } catch (_eCS) {}
            const msg = _dirtyLeaveMessage(targetHash, canSavePrev);
            let choice = 'stay';
            if (canSavePrev && typeof window.appConfirm3 === 'function') {
                choice = await window.appConfirm3(msg, {
                    title: 'Niezapisane zmiany',
                    type: 'warning',
                    saveText: 'Zapisz i przejdź',
                    okText: 'Opuść bez zapisu',
                    cancelText: 'Zostań'
                });
            } else {
                const ok = await window.appConfirm(msg, {
                    title: 'Niezapisane zmiany',
                    type: 'warning',
                    okText: 'Opuść bez zapisu',
                    cancelText: 'Zostań'
                });
                choice = ok ? 'leave' : 'stay';
            }
            if (choice === 'stay') return;
            if (choice === 'save') {
                const saved = await _saveDirtyPrev();
                if (!saved) {
                    try {
                        if (typeof console !== 'undefined' && console.warn)
                            console.warn('[router] save-failed: szczegoly w logach [sokDirty]', {
                                currentModule: currentModule,
                                targetHash: targetHash
                            });
                    } catch (_eW) {}
                    if (typeof window.showToast === 'function')
                        window.showToast(
                            'Nie udało się zapisać automatycznie — zapisz ręcznie i spróbuj ponownie.',
                            'warning'
                        );
                    return;
                }
            } else {
                // „Opuść bez zapisu" = świadome porzucenie: guard milczy dopóki
                // nic nowego nie wpiszesz (sygnatura w __sokAbandonCurrent).
                try {
                    if (typeof window.__sokAbandonCurrent === 'function')
                        window.__sokAbandonCurrent();
                } catch (_eAb) {}
            }
            _navForceOnce = true;
            window._bypassBeforeUnload = true;
            if (window.location.hash === targetHash) navigate();
            else window.location.hash = targetHash;
        } finally {
            _setConfirmLock(false);
        }
    }

    // Typy hostowane przez #/cennik (cennik.html przełącza ramki bez reloadu)
    const CENNIK_TYPES = ['rury', 'studnie', 'preco'];

    // ── Konfiguracja ──
    const MODULES = {
        rury: {
            src: 'rury.html',
            logo: 'Oferty rury',
            sections: [
                {
                    id: 'builder',
                    icon: '<i data-lucide="pencil"></i>',
                    label: 'Konfiguracja'
                },
                { id: 'offer', icon: '<i data-lucide="bar-chart-2"></i>', label: 'Oferta' },
                { id: 'pricelist', icon: '<i data-lucide="clipboard-list"></i>', label: 'Cennik' }
            ]
        },
        studnie: {
            src: 'studnie.html',
            logo: 'Oferty studnie',
            sections: [
                {
                    id: 'builder',
                    icon: '<i data-lucide="cylinder"></i>',
                    label: 'Konfiguracja'
                },
                { id: 'offer', icon: '<i data-lucide="bar-chart-2"></i>', label: 'Oferta' },
                { id: 'pricelist', icon: '<i data-lucide="clipboard-list"></i>', label: 'Cennik' }
            ]
        },
        kartoteka: {
            src: 'kartoteka.html',
            logo: 'Kartoteka Ofert',
            sections: []
        },
        zlecenia: {
            src: 'zlecenia.html',
            logo: 'Kartoteka Zleceń',
            sections: []
        },
        cennik: {
            src: 'cennik.html',
            logo: 'Cennik',
            sections: []
        },
        pulpit: {
            // Pulpit = moduł tej samej granicy co reszta (ADR-014); index.html
            // dostaje tryb osadzony przez `host=pulpit` (bez loginu i nagłówka).
            src: 'index.html?host=pulpit',
            logo: 'Pulpit',
            sections: []
        }
    };

    // ── Pomocnicy ──

    function parseHash() {
        const hash = window.location.hash || '#/rury';
        const [path, queryString] = hash.replace('#/', '').split('?');
        const [modulePath, subView] = (path || 'rury').split('/');
        const module = modulePath || 'rury';
        const params = {};
        if (queryString) {
            new URLSearchParams(queryString).forEach((v, k) => {
                params[k] = v;
            });
        }
        if (subView && !params.tab) params.tab = subView;
        return { module, params };
    }

    function _consumeNewOfferIntent(module, params) {
        if (
            params.newOffer !== '1' ||
            (module !== 'rury' && module !== 'studnie') ||
            params.edit ||
            params.order
        )
            return false;

        delete params.newOffer;
        try {
            const hash = window.location.hash || '';
            const [path, queryString] = hash.slice(2).split('?');
            const cleanParams = new URLSearchParams(queryString || '');
            cleanParams.delete('newOffer');
            const cleanQuery = cleanParams.toString();
            const cleanHash = '#/' + path + (cleanQuery ? '?' + cleanQuery : '');
            window.history.replaceState(window.history.state, '', cleanHash);
        } catch (error) {
            logger.warn('router', '[SpaRouter] Nie udało się zużyć intencji nowej oferty', {
                error: error && error.name ? error.name : 'Error'
            });
            if (typeof window.showToast === 'function')
                window.showToast(
                    'Nie udało się rozpocząć nowej oferty. Bieżący dokument pozostał otwarty.',
                    'error'
                );
            return false;
        }
        return true;
    }

    function syncCennikNavigation(user) {
        const link = document.getElementById('spa-app-cennik');
        if (!link) return;
        const isAdmin = user?.role === 'admin';
        link.hidden = !isAdmin;
        link.classList.toggle('hidden', !isAdmin);
    }

    function redirectNonAdminCennik(module) {
        if (module !== 'cennik' || window.currentUser?.role === 'admin') return false;
        window.location.hash = _lastCleanHash || '#/' + (currentModule || 'pulpit');
        return true;
    }

    function updateAppNav(module) {
        const navIds = {
            rury: 'spa-app-rury',
            studnie: 'spa-app-studnie',
            kartoteka: 'spa-app-kartoteka',
            zlecenia: 'spa-app-zlecenia',
            cennik: 'spa-app-cennik',
            pulpit: 'spa-app-pulpit'
        };
        Object.entries(navIds).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const isActive = module === key;
            el.classList.toggle('active', isActive);
            if (isActive) el.setAttribute('aria-current', 'page');
            else el.removeAttribute('aria-current');
        });

        const config = MODULES[module];
        if (!config) return;

        const logoText = document.getElementById('spa-logo-text');
        if (logoText) logoText.textContent = config.logo;

        // Kolor nazwy modułu pod logo (zielony/niebieski/bursztynowy/różowy)
        const logoApp = document.querySelector('.logo-app');
        if (logoApp) {
            logoApp.classList.remove(
                'logo-rury',
                'logo-studnie',
                'logo-kartoteka',
                'logo-zlecenia',
                'logo-cennik'
            );
            logoApp.classList.add('logo-' + module);
        }
    }

    function renderSectionNav(module) {
        const nav = document.getElementById('spa-section-nav');
        if (!nav) return;
        const sections = MODULES[module]?.sections || [];
        nav.innerHTML = sections
            .map(
                (s, i) => `
            <button class="nav-btn nav-tile${i === 0 ? ' active' : ''}"
                data-section="${s.id}" id="nav-${s.id}"
                aria-label="${escapeHtmlAttr(s.label)}"
                ${i === 0 ? 'aria-current="page"' : ''}
                ${
                    s.isLink
                        ? `data-csp="$hashLink" data-csp-args="${escapeHtmlAttr(JSON.stringify([s.href]))}"`
                        : `data-csp="showSection" data-csp-scope="SpaRouter" data-csp-args="${escapeHtmlAttr(JSON.stringify([s.id]))}"`
                }>
                <span class="nav-tile-icon">${s.icon}</span>
                <span class="nav-tile-text">${escapeHtml(s.label)}</span>
            </button>
        `
            )
            .join('');
        if (module === 'rury' || module === 'studnie') {
            nav.insertAdjacentHTML(
                'beforeend',
                '<button type="button" class="nav-tile nav-tile--oferta" ' +
                    'data-csp="startNewOffer" data-csp-scope="SpaRouter" ' +
                    'aria-label="Rozpocznij nową ofertę" title="Rozpocznij nową ofertę">' +
                    '<span class="nav-tile-icon"><i data-lucide="plus" aria-hidden="true"></i></span>' +
                    '<span class="nav-tile-text">Nowa oferta</span></button>'
            );
        }
        if (window.lucide) window.lucide.createIcons({ root: nav });
    }

    function getTransitionLayer() {
        const main = document.getElementById('spa-main');
        if (!main) return null;

        let layer = document.getElementById('spa-transition-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'spa-transition-layer';
            layer.className = 'spa-transition-layer';
            layer.setAttribute('aria-hidden', 'true');
            layer.innerHTML = `
                <div class="spa-transition-box">
                    <span class="spa-transition-spinner"></span>
                    <span>Wczytywanie widoku</span>
                </div>
            `;
            main.appendChild(layer);
        }
        return layer;
    }

    function startViewTransition() {
        const token = ++transitionToken;
        const layer = getTransitionLayer();
        window.clearTimeout(transitionTimer);
        document.body.classList.add('spa-view-loading');
        if (layer) {
            layer.classList.remove('is-error');
            layer.classList.add('is-visible');
            layer.setAttribute('aria-hidden', 'false');
            layer.innerHTML = `
                <div class="spa-transition-box">
                    <span class="spa-transition-spinner"></span>
                    <span>Wczytywanie widoku</span>
                </div>`;
        }
        return token;
    }

    function finishViewTransition(token, delay = 180) {
        if (token !== transitionToken) return;
        const layer = getTransitionLayer();
        window.clearTimeout(transitionTimer);
        transitionTimer = window.setTimeout(() => {
            if (token !== transitionToken) return;
            document.body.classList.remove('spa-view-loading');
            if (layer) {
                layer.classList.remove('is-visible', 'is-error');
                layer.setAttribute('aria-hidden', 'true');
            }
        }, delay);
    }

    function inspectIframeDocument(iframe, expectedSrc = iframe.src) {
        try {
            const frameWindow = iframe.contentWindow;
            const frameDocument = iframe.contentDocument || frameWindow?.document;
            const frameLocation = new URL(frameWindow.location.href);
            const expectedLocation = new URL(expectedSrc, window.location.href);
            if (frameLocation.href === 'about:blank') return { ok: false, reason: 'blank' };
            if (frameLocation.origin !== window.location.origin)
                return { ok: false, reason: 'origin' };
            if (frameLocation.pathname !== expectedLocation.pathname)
                return { ok: false, reason: 'path' };
            const actualParams = new URLSearchParams(frameLocation.search);
            const expectedParams = new URLSearchParams(expectedLocation.search);
            actualParams.delete('_ts');
            expectedParams.delete('_ts');
            const module = iframe.id.replace('spa-iframe-', '');
            const moduleTab = actualParams.get('tab');
            const isModuleManagedTab = MODULES[module]?.sections?.some(
                (section) => section.id === moduleTab
            );
            if (module === 'rury' && !expectedParams.has('tab') && isModuleManagedTab)
                actualParams.delete('tab');
            actualParams.sort();
            expectedParams.sort();
            if (actualParams.toString() !== expectedParams.toString())
                return { ok: false, reason: 'query' };
            if (!frameDocument.documentElement) return { ok: false, reason: 'missing-document' };
            if (frameDocument.readyState !== 'complete' || !frameDocument.body)
                return { ok: false, reason: 'pending' };
            const hasReadyMarker =
                module === 'cennik'
                    ? frameDocument.querySelector('#section-cennik')
                    : frameDocument.documentElement.classList?.contains('is-loaded');
            if (!hasReadyMarker) return { ok: false, reason: 'pending' };
            return { ok: true, reason: '' };
        } catch (_e) {
            return { ok: false, reason: 'inaccessible-document' };
        }
    }

    function waitForIframeDocument(iframe, expectedSrc, timeout, waitForNextLoad) {
        return new Promise((resolve) => {
            let done = false;
            const timers = { timeout: undefined, readiness: undefined };
            const finish = (result) => {
                if (done) return;
                done = true;
                window.clearTimeout(timers.timeout);
                window.clearTimeout(timers.readiness);
                iframe.removeEventListener('load', onLoad);
                iframe.removeEventListener('error', onError);
                resolve(result);
            };
            const checkReadiness = () => {
                if (done) return;
                const result = inspectIframeDocument(iframe, expectedSrc);
                if (result.ok) {
                    finish(result);
                    return;
                }
                if (result.reason === 'pending') {
                    timers.readiness = window.setTimeout(checkReadiness, 50);
                    return;
                }
                if (waitForNextLoad && ['origin', 'path', 'query'].includes(result.reason)) {
                    timers.readiness = window.setTimeout(checkReadiness, 50);
                    return;
                }
                if (result.reason !== 'blank') finish(result);
            };
            const onLoad = () => checkReadiness();
            const onError = () => finish({ ok: false, reason: 'load' });

            iframe.addEventListener('load', onLoad);
            iframe.addEventListener('error', onError);
            timers.timeout = window.setTimeout(
                () => finish({ ok: false, reason: 'timeout' }),
                timeout
            );
            const current = inspectIframeDocument(iframe, expectedSrc);
            if (waitForNextLoad) {
                if (current.ok) window.setTimeout(() => finish(current), 16);
                else if (current.reason === 'pending') checkReadiness();
                return;
            }
            if (current.ok) {
                window.setTimeout(() => finish(current), 16);
                return;
            }
            if (current.reason === 'pending') {
                checkReadiness();
                return;
            }
            if (current.reason !== 'blank' && iframe.contentDocument?.readyState === 'complete')
                finish(current);
        });
    }

    function waitForIframeReady(iframe, timeout = IFRAME_READY_TIMEOUT_MS) {
        return waitForIframeDocument(iframe, iframe.src, timeout, false);
    }

    /** Deep-link odporny na spóźnione skrypty modułu (timeout load ≠ gotowość API). */
    function waitForFunction(win, name, attempts = 6, delay = 150) {
        return new Promise((resolve) => {
            const check = (left) => {
                let ok = false;
                try {
                    ok = typeof win[name] === 'function';
                } catch (_e) {
                    ok = false;
                }
                if (ok || left <= 0) {
                    resolve(ok);
                    return;
                }
                window.setTimeout(() => check(left - 1), delay);
            };
            check(attempts);
        });
    }

    function waitForNextIframeLoad(
        iframe,
        timeout = IFRAME_READY_TIMEOUT_MS,
        expectedSrc = iframe.src
    ) {
        return waitForIframeDocument(iframe, expectedSrc, timeout, true);
    }

    function showNavigationFailure(token, targetHash, returnHash, reason, iframe, restoreSrc) {
        if (token !== transitionToken) return;
        const layer = getTransitionLayer();
        if (!layer) return;
        document.body.classList.remove('spa-view-loading');
        const messages = {
            timeout: 'Widok nie odpowiedział na czas.',
            load: 'Nie udało się pobrać dokumentu widoku.',
            origin: 'Widok został otwarty z nieprawidłowego adresu.',
            path: 'Załadowano inną stronę niż oczekiwany widok.',
            query: 'Załadowano widok z innymi parametrami.',
            'missing-document': 'Dokument widoku jest niekompletny.',
            'inaccessible-document': 'Nie można odczytać dokumentu widoku.'
        };
        const message = messages[reason] || 'Dokument widoku jest nieprawidłowy.';
        layer.classList.add('is-error');
        layer.setAttribute('aria-hidden', 'false');
        layer.innerHTML = `
            <div class="spa-transition-box spa-transition-error" role="alert">
                <strong>Nie udało się wczytać widoku</strong>
                <span>${message}</span>
                <div class="spa-transition-actions">
                    <button type="button" class="btn btn-primary" data-spa-retry>Ponów</button>
                    ${returnHash ? '<button type="button" class="btn btn-secondary" data-spa-back>Wróć</button>' : ''}
                </div>
            </div>`;
        layer.querySelector('[data-spa-retry]')?.addEventListener('click', () => {
            if (window.location.hash !== targetHash) window.location.hash = targetHash;
            const { module, params } = parseHash();
            const retrySrc =
                restoreSrc && iframe.dataset.spaAwaitingRestore === 'true'
                    ? restoreSrc
                    : _buildModuleSrc(module, params) + '&_ts=' + Date.now();
            iframe.dataset.spaRetrying = 'true';
            iframe.src = retrySrc;
            if (window.location.hash === targetHash) void navigate();
        });
        layer.querySelector('[data-spa-back]')?.addEventListener('click', () => {
            if (!returnHash) return;
            if (restoreSrc) {
                const returnModule = _moduleFromHash(returnHash);
                if (iframes[returnModule] === iframe) {
                    iframe.dataset.spaAwaitingRestore = 'true';
                    iframe.src = restoreSrc;
                }
            }
            if (window.location.hash === returnHash) void navigate();
            else window.location.hash = returnHash;
        });
    }

    /**
     * Rozdziela src modułu na ścieżkę i query. Moduł może mieć własne,
     * stałe parametry (np. `index.html?host=pulpit`) — bez tego `?` z
     * `_buildModuleSrc` dawał `?host=pulpit?v=2.0` i psuł wartość `host`.
     */
    function _moduleSrcParts(module) {
        const raw = MODULES[module]?.src || module + '.html';
        const q = raw.indexOf('?');
        return q === -1
            ? { base: raw, query: '' }
            : { base: raw.slice(0, q), query: raw.slice(q + 1) };
    }

    /**
     * Parametry trasy dopisuje się do query modułu, ale nigdy nie nadpisują
     * jego stałych parametrów (`host=pulpit` decyduje o trybie osadzonym).
     */
    function _applyRouteParams(usp, params) {
        Object.entries(params || {}).forEach(([k, v]) => {
            if (k === 'v' || _TRANSIENT_PARAMS.has(k)) return;
            if (usp.has(k)) return;
            if (v != null && v !== '') usp.set(k, String(v));
        });
    }

    function _buildModuleSrc(module, params) {
        const { base, query } = _moduleSrcParts(module);
        const usp = new URLSearchParams(query);
        _applyRouteParams(usp, params);
        usp.set('v', '2.0');
        const qs = usp.toString();
        return qs ? base + '?' + qs : base;
    }

    function _logicalSrcKey(module, params) {
        // Klucz bez cache-bust — decyduje czy reload faktycznie potrzebny
        const { base, query } = _moduleSrcParts(module);
        const usp = new URLSearchParams(query);
        _applyRouteParams(usp, params);
        usp.sort();
        const qs = usp.toString();
        return base + (qs ? '?' + qs : '');
    }

    function _getSpaLogicalSrc(iframe) {
        try {
            if (iframe.dataset && iframe.dataset.spaLogicalSrc) return iframe.dataset.spaLogicalSrc;
            if (iframe.getAttribute) {
                const v = iframe.getAttribute('data-spa-logical-src');
                if (v) return v;
            }
            if (/** @type {any} */ (iframe)._spaLogicalSrc)
                return /** @type {any} */ (iframe)._spaLogicalSrc;
        } catch {}
        return '';
    }

    function _setSpaLogicalSrc(iframe, val) {
        try {
            if (iframe.dataset) iframe.dataset.spaLogicalSrc = val;
        } catch {}
        try {
            if (iframe.setAttribute) iframe.setAttribute('data-spa-logical-src', val);
        } catch {}
        try {
            /** @type {any} */ (iframe)._spaLogicalSrc = val;
        } catch {}
    }

    /** Tworzy lub pobiera iframe dla modułu */
    function getOrCreateIframe(module) {
        if (iframes[module]) return iframes[module];

        const config = MODULES[module];
        const iframe = document.createElement('iframe');
        iframe.id = 'spa-iframe-' + module;
        iframe.className = 'spa-module-iframe';
        iframe.title = config.logo;

        const { params } = parseHash();
        const src = _buildModuleSrc(module, params);
        _setSpaLogicalSrc(iframe, _logicalSrcKey(module, params));

        iframe.src = src;
        iframe.classList.remove('spa-iframe-visible');

        // Ukryj nagłówek modułu wewnątrz iframe (jest zbędny — nagłówek SPA obsługuje nawigację)
        iframe.addEventListener('load', () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                // Ukryj nagłówek w iframe
                const isolationStyle = iframeDoc.createElement('style');
                isolationStyle.id = 'spa-iframe-isolation-style';
                isolationStyle.textContent =
                    'header.header, .header.header { display: none !important; }';
                iframeDoc.head.appendChild(isolationStyle);

                // Dopasuj główną treść, aby nie miała przesunięcia nagłówka
                const main = iframeDoc.querySelector('main.main');
                if (main) {
                    main.style.paddingTop = 'var(--tile-gap-xs-plus)';
                    main.style.marginTop = '0';
                }

                // Ustaw przezroczyste tło body, aby tło rodzica było widoczne.
                iframeDoc.body.style.background = 'transparent';
                iframeDoc.documentElement.style.background = 'transparent';
            } catch (e) {
                // Ograniczenie cross-origin — nie powinno wystąpić, bo ta sama domena
                logger.warn('router', '[SpaRouter] Could not modify iframe content:', e);
            }
        });

        document.getElementById('spa-main').appendChild(iframe);
        iframes[module] = iframe;
        return iframe;
    }

    // ── Publiczne API ──

    /**
     * Zbiera istniejące możliwości modułu w prywatny mostek powłoki.
     * Mostek nie jest publikowany do iframe i nie zmienia kontraktu SpaRouter.
     */
    function getModuleBridge(module) {
        const win = iframes[module]?.contentWindow;
        if (!win) return null;

        const call = (owner, method, args = []) => {
            const fn = owner && owner[method];
            if (typeof fn !== 'function') return false;
            fn.apply(owner, args);
            return true;
        };
        const sectionBridge = { showSection: (sectionId) => call(win, 'showSection', [sectionId]) };

        if (module === 'zlecenia') {
            return { ...sectionBridge, refresh: () => call(win.AppZlecenia, 'loadOrders') };
        }
        if (module === 'kartoteka') {
            return {
                ...sectionBridge,
                isReady: () => win.kartotekaUI?.initialized === true,
                refresh: () =>
                    call(win.AppKartoteka, 'loadOffers') || call(win.kartotekaUI, 'loadLocalOffers')
            };
        }
        if (module === 'studnie') {
            return {
                ...sectionBridge,
                refreshProductionOrders: async () => {
                    if (typeof win.loadProductionOrders !== 'function') return false;
                    const orders = await win.loadProductionOrders(false, true);
                    if (!Array.isArray(orders))
                        throw new Error('Nieprawidłowy indeks zleceń produkcyjnych');
                    call(win, 'auditPzElementKeyMismatch');
                    call(win, 'renderZleceniaList');
                    call(win, 'renderZleceniaWellConfig');
                    call(win, 'refreshAll');
                    return true;
                }
            };
        }

        return sectionBridge;
    }

    function showSection(sectionId) {
        if (!currentModule || !iframes[currentModule]) return;

        try {
            getModuleBridge(currentModule)?.showSection?.(sectionId);
        } catch (e) {
            logger.warn('router', '[SpaRouter] Cannot call showSection in iframe:', e);
        }

        // Aktualizacja stanów aktywności przycisków nawigacji w rodzicu
        document.querySelectorAll('#spa-section-nav .nav-btn').forEach((btn) => {
            const isActive = btn.dataset.section === sectionId;
            btn.classList.toggle('active', isActive);
            if (isActive) btn.setAttribute('aria-current', 'page');
            else btn.removeAttribute('aria-current');
        });
    }

    function _isOfferModuleInProtectedMode(module, frameWindow) {
        if (frameWindow.isPreviewMode) return true;
        try {
            const versions = frameWindow.pricelistVersions;
            return (
                !!versions &&
                typeof versions.isPricelistEditing === 'function' &&
                versions.isPricelistEditing(module)
            );
        } catch (_e) {
            return true;
        }
    }

    async function _confirmStartNewOffer(frameWindow) {
        let canSave = true;
        try {
            if (typeof window.__sokCanSave === 'function')
                canSave = window.__sokCanSave(frameWindow) === true;
        } catch (_e) {
            canSave = false;
        }

        const isOrder = !!frameWindow.orderEditMode;
        const subject = isOrder ? 'Bieżące zamówienie' : 'Bieżąca oferta';
        const message = `${subject} ma niezapisane zmiany. Rozpoczęcie nowej oferty zakończy bieżący tryb i wyczyści jego formularz oraz szkic.`;
        if (canSave && typeof window.appConfirm3 === 'function')
            return window.appConfirm3(message, {
                title: 'Rozpocząć nową ofertę?',
                type: 'warning',
                saveText: isOrder
                    ? 'Zapisz zamówienie i rozpocznij nową'
                    : 'Zapisz i rozpocznij nową',
                okText: 'Usuń zmiany i rozpocznij nową',
                cancelText: 'Wróć do edycji'
            });

        const confirmed = await window.appConfirm(message, {
            title: 'Rozpocząć nową ofertę?',
            type: 'warning',
            okText: 'Usuń zmiany i rozpocznij nową',
            cancelText: 'Wróć do edycji'
        });
        return confirmed ? 'leave' : 'stay';
    }

    function _abandonChangesForNewOffer() {
        try {
            if (typeof window.__sokAbandonCurrent !== 'function')
                throw new Error('Abandon handler unavailable');
            window.__sokAbandonCurrent();
            return true;
        } catch (error) {
            logger.warn('router', '[SpaRouter] Nie udało się oznaczyć zmian do usunięcia', {
                currentModule: currentModule,
                error: error && error.name ? error.name : 'Error'
            });
            if (typeof window.showToast === 'function')
                window.showToast(
                    'Nie udało się bezpiecznie odrzucić zmian. Bieżący dokument pozostał otwarty.',
                    'error'
                );
            return false;
        }
    }

    function _discardOrderDraftForNewOffer(module, frameWindow) {
        if (!frameWindow.orderEditMode) return true;
        const order = frameWindow.orderEditMode;
        const orderId =
            module === 'studnie'
                ? order.orderId || order.order?.id
                : frameWindow.editingRuryOrderId || order.orderId || order.order?.id;
        const autosave = frameWindow.draftAutosave;
        if (!orderId || !autosave || typeof autosave.clearContext !== 'function') {
            if (typeof window.showToast === 'function')
                window.showToast(
                    'Nie udało się usunąć szkicu zamówienia. Bieżący dokument pozostał otwarty.',
                    'error'
                );
            return false;
        }
        try {
            autosave.clearContext(module === 'studnie' ? 'order_studnie' : 'order_rury', orderId);
            return true;
        } catch (error) {
            logger.warn('router', '[SpaRouter] Nie udało się usunąć szkicu zamówienia', {
                currentModule: module,
                error: error && error.name ? error.name : 'Error'
            });
            if (typeof window.showToast === 'function')
                window.showToast(
                    'Nie udało się usunąć szkicu zamówienia. Bieżący dokument pozostał otwarty.',
                    'error'
                );
            return false;
        }
    }

    async function _exitOrderModeForNewOffer(module, frameWindow) {
        if (!frameWindow.orderEditMode) return true;
        try {
            if (module === 'rury' && typeof frameWindow.exitOrderEditMode === 'function') {
                await frameWindow.exitOrderEditMode();
            } else if (
                module === 'studnie' &&
                typeof frameWindow.exitWizardOrderMode === 'function'
            ) {
                await frameWindow.exitWizardOrderMode(0, { silent: true });
            } else {
                throw new Error('Order exit handler unavailable');
            }
            if (frameWindow.orderEditMode) throw new Error('Order mode remains active');
            return true;
        } catch (error) {
            logger.warn('router', '[SpaRouter] Nie udało się zakończyć trybu zamówienia', {
                currentModule: module,
                error: error && error.name ? error.name : 'Error'
            });
            if (typeof window.showToast === 'function')
                window.showToast(
                    'Nie udało się bezpiecznie zakończyć zamówienia. Bieżący dokument pozostał otwarty.',
                    'error'
                );
            return false;
        }
    }

    function _resetDocumentRouteForNewOffer(module) {
        const iframe = iframes[module];
        if (!iframe || !window.history || typeof window.history.replaceState !== 'function')
            return false;

        try {
            window.history.replaceState(window.history.state, '', `#/${module}`);
            _lastCleanHash = `#/${module}`;
            _setSpaLogicalSrc(iframe, _logicalSrcKey(module, {}));
            try {
                if (window.lastRoute && typeof window.lastRoute.save === 'function')
                    window.lastRoute.save(_lastCleanHash);
            } catch (_error) {
                logger.warn('router', '[SpaRouter] Nie udało się zapisać trasy nowej oferty');
            }
            return true;
        } catch (error) {
            logger.warn('router', '[SpaRouter] Nie udało się wyczyścić trasy dokumentu', {
                currentModule: module,
                error: error && error.name ? error.name : 'Error'
            });
            return false;
        }
    }

    async function startNewOffer() {
        const module = currentModule;
        if (module !== 'rury' && module !== 'studnie') return false;
        if (_getConfirmLock()) return false;

        const frameWindow = iframes[module]?.contentWindow;
        if (!frameWindow || typeof frameWindow.clearOfferForm !== 'function') {
            if (typeof window.showToast === 'function')
                window.showToast(
                    'Nie można rozpocząć nowej oferty — moduł nie jest gotowy.',
                    'error'
                );
            return false;
        }
        if (_isOfferModuleInProtectedMode(module, frameWindow)) {
            if (typeof window.showToast === 'function')
                window.showToast('Zamknij najpierw podgląd lub edycję cennika.', 'warning');
            return false;
        }

        _setConfirmLock(true);
        try {
            if (_isDirtyNow()) {
                const choice = await _confirmStartNewOffer(frameWindow);
                if (choice === 'stay') return false;
                if (choice === 'save') {
                    const saved = await _saveDirtyPrev();
                    if (!saved) {
                        if (typeof window.showToast === 'function')
                            window.showToast(
                                'Nie udało się zapisać. Bieżąca oferta pozostała otwarta.',
                                'warning'
                            );
                        return false;
                    }
                } else {
                    if (!_discardOrderDraftForNewOffer(module, frameWindow)) return false;
                    if (!_abandonChangesForNewOffer()) return false;
                }
            }

            if (!(await _exitOrderModeForNewOffer(module, frameWindow))) return false;
            if (!_resetDocumentRouteForNewOffer(module)) {
                if (typeof window.showToast === 'function')
                    window.showToast(
                        'Nie udało się bezpiecznie rozpocząć nowej oferty. Bieżący dokument pozostał otwarty.',
                        'error'
                    );
                return false;
            }

            frameWindow.clearOfferForm();
            showSection('builder');
            return true;
        } finally {
            _setConfirmLock(false);
        }
    }

    async function navigate() {
        const { module, params } = parseHash();

        if (!MODULES[module]) {
            window.location.hash = '#/rury';
            return;
        }

        if (redirectNonAdminCennik(module)) return;

        // Guard: zmiana modułu przy niezapisanych zmianach → popup aplikacji (Z-30 SPA)
        if (_navForceOnce) {
            _navForceOnce = false; // nawigacja potwierdzona — przepuść
        } else if (
            !_navReverting &&
            currentModule !== null &&
            module !== currentModule &&
            _isDirtyNow()
        ) {
            const targetHash = window.location.hash;
            _navReverting = true;
            window.location.hash = _lastCleanHash || '#/' + currentModule; // echo hashchange przepuści
            await _confirmLeaveModule(targetHash);
            return;
        }
        _navReverting = false;

        // Deep-link panelu wersji cennika przy brudnej ofercie: confirm przed otwarciem.
        if (
            !_navForceOnce &&
            currentModule !== null &&
            module === currentModule &&
            params.panel === 'versions' &&
            _isDirtyNow()
        ) {
            const targetHash = window.location.hash;
            _navReverting = true;
            window.location.hash = _lastCleanHash || '#/' + currentModule;
            await _confirmLeaveModule(targetHash);
            return;
        }

        // P1.2: ten sam moduł, inne ?edit/?order — oferta B nad brudną edycją A.
        // Reload wyrzuciłby widok A bez słowa (gdy A czyste — poprawnie, gdy brudne — guard).
        // Sam ?tab= nie przeładowuje (sekcja w żywym iframe) — poza guardem.
        if (
            !_navForceOnce &&
            currentModule !== null &&
            module === currentModule &&
            (params.edit || params.order) &&
            _isDirtyNow()
        ) {
            try {
                const probeKey = _logicalSrcKey(module, params);
                const prevKey = iframes[module] ? _getSpaLogicalSrc(iframes[module]) : probeKey;
                if (probeKey !== prevKey) {
                    const targetHash = window.location.hash;
                    _navReverting = true;
                    window.location.hash = _lastCleanHash || '#/' + currentModule;
                    await _confirmLeaveModule(targetHash);
                    return;
                }
            } catch (_eAB) {}
        }

        const shouldStartNewOffer = _consumeNewOfferIntent(module, params);

        const targetHash = window.location.hash;
        const returnHash = _lastCleanHash;

        const transition = startViewTransition();

        const isModuleSwitch = currentModule !== module;
        if (isModuleSwitch) {
            // P1.1b: synchroniczny flush draftu opuszczanego modułu (hash nie woła beforeunload).
            try {
                const _prevWin = iframes[currentModule] && iframes[currentModule].contentWindow;
                if (_prevWin && _prevWin.draftAutosave) _prevWin.draftAutosave.flushAll('route');
            } catch (_e) {}
        }

        // Docelowy iframe — lifecycle: keep old visible under overlay → wait ready → atomically swap
        const isNewIframe = !iframes[module];
        const iframe = getOrCreateIframe(module);
        // Tytuł iframe dla a11y (SR) — aktualizuj przy każdym navigate (reuse iframe)
        if (MODULES[module]?.logo) {
            iframe.title = MODULES[module].logo;
            iframe.setAttribute('title', MODULES[module].logo);
        }

        // Guard reload edit/order: tylko gdy logiczny src się zmienił (edit/order id)
        // Porównanie przez znormalizowany URL — odporne na absolutne/względne src i kolejność ?v
        let needsReload = false;
        let newLogicalKey = null;
        if (params.edit || params.order) {
            newLogicalKey = _logicalSrcKey(module, params);
            const prevKey = _getSpaLogicalSrc(iframe);
            if (newLogicalKey !== prevKey) needsReload = true;
        }
        const isRestoringIframe = iframe.dataset.spaAwaitingRestore === 'true';
        const isRetryingIframe = iframe.dataset.spaRetrying === 'true';

        let readyPromise;
        if (needsReload || isRestoringIframe || isRetryingIframe) {
            const newSrc = _buildModuleSrc(module, params) + '&_ts=' + Date.now();
            const expectedSrc = needsReload ? newSrc : iframe.src;
            readyPromise = waitForNextIframeLoad(iframe, IFRAME_READY_TIMEOUT_MS, expectedSrc);
            if (needsReload) iframe.src = newSrc;
        } else {
            readyPromise = waitForIframeReady(iframe);
        }

        // Odsłoń iframe dopiero gdy gotowy — eliminuje biały błysk pustego iframe
        const readiness = await readyPromise;
        // Sprawdź czy navigate nie została wyprzedzona przez kolejny hashchange
        if (transition !== transitionToken) return;
        if (!readiness.ok) {
            const failureDetails = {
                module,
                reason: readiness.reason,
                expectedSrc: needsReload ? _buildModuleSrc(module, params) : iframe.src
            };
            try {
                failureDetails.actualSrc = iframe.contentWindow.location.href;
                failureDetails.readyState = iframe.contentDocument?.readyState;
                failureDetails.hasReadyMarker =
                    iframe.contentDocument?.documentElement?.classList?.contains('is-loaded');
            } catch (_e) {
                // Zablokowany odczyt cross-origin nie może przerwać obsługi błędu nawigacji.
            }
            logger.error('router', '[SpaRouter] Iframe navigation failed', failureDetails);
            showNavigationFailure(
                transition,
                targetHash,
                returnHash,
                readiness.reason,
                iframe,
                iframe.dataset.spaLastGoodSrc || ''
            );
            return;
        }
        if (needsReload) _setSpaLogicalSrc(iframe, /** @type {string} */ (newLogicalKey));
        delete iframe.dataset.spaAwaitingRestore;
        delete iframe.dataset.spaRetrying;
        iframe.dataset.spaLastGoodSrc = iframe.src;

        _lastCleanHash = targetHash;
        try {
            if (window.lastRoute && typeof window.lastRoute.save === 'function')
                window.lastRoute.save(targetHash);
        } catch (_eLR) {}
        updateAppNav(module);
        document.body.classList.toggle('module-studnie', module === 'studnie');
        if (isModuleSwitch) renderSectionNav(module);

        // Atomowa zamiana: ukryj pozostałe, pokaż docelowy — zero czasu z pustym tłem
        Object.values(iframes).forEach((f) => {
            if (f !== iframe) f.classList.remove('spa-iframe-visible');
        });
        iframe.classList.add('spa-iframe-visible');
        currentModule = module;

        // Auto-odświeżanie danych, jeśli moduł ma funkcję odświeżania
        try {
            const bridge = getModuleBridge(module);
            const kartotekaReady = module !== 'kartoteka' || bridge?.isReady?.() === true;
            if (!isNewIframe && kartotekaReady) refreshModule(module);
        } catch (_e) {
            // Problemy z kontekstem - ignoruj
        }

        // Pomiń domyślną nawigację sekcji podczas edycji/zamawiania — iframe obsługuje to sam
        if (params.edit || params.order) {
            finishViewTransition(transition);
            document.getElementById('spa-main')?.focus();
            return;
        }

        // Określ, którą sekcję pokazać (domyślnie pierwsza, jeśli brak parametru tab)
        let tabToShow = params.tab;
        if (!tabToShow && MODULES[module].sections && MODULES[module].sections.length > 0) {
            tabToShow = MODULES[module].sections[0].id;
        }

        // Iframe już gotowy (await wyżej) — nawigacja sekcji synchronicznie
        if (tabToShow) showSection(tabToShow);

        // #/cennik: hash z innym typem (rury/studnie/preco) przełącza moduł bez
        // reloadu iframe — inaczej `?tab=` z adresu zostaje na starym typie.
        // CennikHost to obiekt (nie funkcja), więc waitForFunction tu nie pasuje.
        if (module === 'cennik' && CENNIK_TYPES.includes(params.tab)) {
            const cennikWin = iframe.contentWindow;
            const hostReady = await new Promise((resolve) => {
                const check = (left) => {
                    let host = null;
                    try {
                        host = cennikWin.CennikHost;
                    } catch (_e) {
                        host = null;
                    }
                    if (host && typeof host.activate === 'function') {
                        resolve(host);
                        return;
                    }
                    if (left <= 0) {
                        resolve(null);
                        return;
                    }
                    window.setTimeout(() => check(left - 1), 150);
                };
                check(8);
            });
            if (transition !== transitionToken) return;
            if (hostReady) {
                try {
                    hostReady.activate(params.tab);
                } catch (e) {
                    logger.warn('router', '[SpaRouter] Nie udało się przełączyć typu cennika:', e);
                }
            }
        }

        // Deep link „Edytuj" PRECO: cennik PRECO to zakładka wewnątrz cennika studni.
        if (module === 'studnie' && params.pvtype === 'preco') {
            const iframeWin = iframe.contentWindow;
            void waitForFunction(iframeWin, 'selectCennikTab').then((ok) => {
                if (!ok || transition !== transitionToken) return;
                try {
                    iframeWin.selectCennikTab('preco');
                } catch (e) {
                    logger.warn('router', '[SpaRouter] Nie udało się otworzyć zakładki PRECO:', e);
                }
            });
        }

        if (params.panel === 'versions') {
            const panelType =
                module === 'rury' ? 'rury' : params.pvtype === 'preco' ? 'preco' : 'studnie';
            const asVersionId = (value) =>
                typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : '';
            const versionId = asVersionId(params.version);
            const againstId = asVersionId(params.against);
            try {
                const iframeWin = iframe.contentWindow;
                const opener =
                    module === 'rury' ? 'openRuryVersionsPanel' : 'openStudnieVersionsPanel';
                const hasOpener = await waitForFunction(iframeWin, opener);
                if (transition !== transitionToken) return;
                if (!hasOpener) {
                    logger.warn('router', '[SpaRouter] Moduł nie wystawił ' + opener);
                    if (typeof window.showToast === 'function') {
                        window.showToast('Nie udało się otworzyć panelu wersji cennika', 'error');
                    }
                    finishViewTransition(transition);
                    document.getElementById('spa-main')?.focus();
                    return;
                }
                const opened =
                    module === 'rury'
                        ? iframeWin.openRuryVersionsPanel()
                        : iframeWin.openStudnieVersionsPanel(panelType);
                const openPreview = (attempt = 0) => {
                    if (transition !== transitionToken) return;
                    try {
                        const pv = iframeWin.pricelistVersions;
                        if (pv && typeof pv.openFromDeepLink === 'function') {
                            pv.openFromDeepLink({
                                type: panelType,
                                versionId,
                                againstId
                            });
                        } else if (attempt < 6) {
                            window.setTimeout(() => openPreview(attempt + 1), 150);
                        } else {
                            logger.warn('router', '[SpaRouter] Brak openFromDeepLink w module');
                        }
                    } catch (e) {
                        logger.warn('router', '[SpaRouter] Podgląd z deep-linku:', e);
                    }
                };
                if (versionId) Promise.resolve(opened).then(openPreview, openPreview);
            } catch (e) {
                logger.warn(
                    'router',
                    '[SpaRouter] Nie udało się otworzyć panelu wersji cennika:',
                    e
                );
            }
        }

        finishViewTransition(transition);
        document.getElementById('spa-main')?.focus();
        if (shouldStartNewOffer) await startNewOffer();
    }

    function showAuthUnavailable() {
        const container = document.getElementById('spa-main');
        if (!container) return;
        container.innerHTML =
            '<div class="empty-state" role="alert"><h3>Nie można połączyć się z serwerem</h3>' +
            '<p>Sprawdź połączenie i spróbuj ponownie.</p>' +
            '<button type="button" class="btn btn-primary" data-auth-retry>Spróbuj ponownie</button></div>';
        const retryButton = container.querySelector('[data-auth-retry]');
        if (retryButton) retryButton.addEventListener('click', init);
    }

    function rememberAuthReturnRoute() {
        try {
            const hash = window.location.hash;
            const moduleName = hash.slice(2).split(/[/?#]/, 1)[0];
            if (!hash.startsWith('#/') || hash.length > 2048 || !MODULES[moduleName]) return;
            window.sessionStorage.setItem('sok.auth.returnHash', hash);
        } catch (_e) {}
    }

    async function init() {
        // `meProbe()` współdzieli żądanie /api/auth/me, ale zachowuje status
        // odpowiedzi. Dzięki temu awaria serwera nie wygląda jak wylogowanie.
        let authProbe;
        try {
            if (typeof window.meProbe === 'function') {
                authProbe = await window.meProbe();
            } else {
                const authRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
                const authData = await authRes.json();
                authProbe = {
                    status: authRes.status,
                    ok: authRes.ok,
                    user: (authData && authData.user) || null
                };
            }
        } catch (_e) {
            showAuthUnavailable();
            return;
        }

        if (authProbe.status === 401 || authProbe.status === 403) {
            rememberAuthReturnRoute();
            if (typeof window.navigateToLogin === 'function') window.navigateToLogin();
            else window.location.href = 'index.html';
            return;
        }
        if (!authProbe.ok) {
            showAuthUnavailable();
            return;
        }
        const user = authProbe.user || null;
        if (!user) {
            rememberAuthReturnRoute();
            if (typeof window.navigateToLogin === 'function') window.navigateToLogin();
            else window.location.href = 'index.html';
            return;
        }

        // Wyświetl użytkownika w nagłówku
        if (window.headerUser) {
            window.headerUser.render(user);
        }

        window.currentUser = user;
        syncCennikNavigation(user);

        // Domyślny hash
        if (
            !window.location.hash ||
            window.location.hash === '#' ||
            window.location.hash === '#/'
        ) {
            window.location.hash = '#/rury';
        }

        window.addEventListener('hashchange', navigate);

        // Pozwala kliknąć ikonę aktywnego modułu, aby zresetować jego stan
        document.querySelectorAll('.nav-apps a.nav-tile').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#/') && window.location.hash === href) {
                    e.preventDefault(); // Prevent default since we're already there
                    navigate(); // Force a fresh navigate (it will land on the default section)
                }
            });
        });

        await navigate();
    }

    /**
     * Otwiera ofertę w odpowiednim module (rury lub studnie).
     * Wywoływane z iframe kartoteki przez window.parent.SpaRouter.openOfferInModule(...).
     */
    function openOfferInModule(type, offerId, action = 'edit') {
        const targetModule = type === 'studnia_oferta' ? 'studnie' : 'rury';
        const param = action === 'order' ? 'order' : 'edit';

        // Przejdź do docelowego modułu z parametrem edycji
        window.location.hash = `#/${targetModule}?${param}=${offerId}`;
    }

    /**
     * Odświeża dane konkretnego modułu, jeśli jego iframe istnieje.
     */
    function refreshModule(module) {
        const bridge = getModuleBridge(module);
        if (!bridge?.refresh) return;
        try {
            bridge.refresh();
        } catch (e) {
            logger.warn('router', '[SpaRouter] Could not refresh module:', module, e);
        }
    }

    /** Odświeża indeks PZ w zachowanym iframe Studni po zmianie z kartoteki. */
    async function refreshProductionOrders() {
        const bridge = getModuleBridge('studnie');
        if (!bridge) return true;

        try {
            return await bridge.refreshProductionOrders();
        } catch (e) {
            logger.error('router', '[SpaRouter] Nie udało się odświeżyć zleceń produkcyjnych:', e);
            return false;
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    const api = {
        showSection,
        startNewOffer,
        navigate,
        openOfferInModule,
        refreshModule,
        refreshProductionOrders
    };
    window.SpaRouter = api;
    return api;
})();
