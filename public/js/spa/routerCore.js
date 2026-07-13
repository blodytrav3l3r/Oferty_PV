// @ts-check
/* ===== SPA Router — public API (IIFE) ===== */

const SpaRouter = (() => {
    function showSection(sectionId) {
        if (!_routerState.currentModule || !_routerState.iframes[_routerState.currentModule])
            return;

        try {
            const iframeWin = _routerState.iframes[_routerState.currentModule].contentWindow;
            if (iframeWin && typeof iframeWin.showSection === 'function') {
                iframeWin.showSection(sectionId);
            }
        } catch (e) {
            logger.warn('router', '[SpaRouter] Cannot call showSection in iframe:', e);
        }

        document.querySelectorAll('#spa-section-nav .nav-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
    }

    async function navigate() {
        const { module, params } = _parseHash();

        if (!MODULES[module]) {
            window.location.hash = '#/rury';
            return;
        }

        const transition = _startViewTransition();
        _updateAppNav(module);
        document.body.classList.toggle('module-studnie', module === 'studnie');

        if (_routerState.currentModule !== module) {
            _renderSectionNav(module);
        }

        Object.values(_routerState.iframes).forEach((f) => {
            f.style.display = 'none';
        });

        const iframe = _getOrCreateIframe(module);
        let readyPromise = _waitForIframeReady(iframe);

        if (params.edit || params.order) {
            let newSrc = MODULES[module].src;
            Object.entries(params).forEach(([k, v]) => {
                newSrc += (newSrc.includes('?') ? '&' : '?') + `${k}=${v}`;
            });
            newSrc += (newSrc.includes('?') ? '&' : '?') + 'v=' + Date.now();
            readyPromise = _waitForNextIframeLoad(iframe, 1800);
            iframe.src = newSrc;
        }

        iframe.style.display = 'block';
        _routerState.currentModule = module;

        try {
            _refreshModule(module);
        } catch (e) {}

        if (params.edit || params.order) {
            await readyPromise;
            _finishViewTransition(transition);
            return;
        }

        let tabToShow = params.tab;
        if (!tabToShow && MODULES[module].sections && MODULES[module].sections.length > 0) {
            tabToShow = MODULES[module].sections[0].id;
        }

        if (tabToShow) {
            if (iframe.contentDocument?.readyState === 'complete') {
                showSection(tabToShow);
            } else {
                iframe.addEventListener(
                    'load',
                    () => {
                        setTimeout(() => showSection(tabToShow), 200);
                    },
                    { once: true }
                );
            }
        }

        await readyPromise;
        _finishViewTransition(transition);
    }

    async function init() {
        try {
            const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
            const authData = await authRes.json();
            if (!authData.user) {
                window.location.href = 'index.html';
                return;
            }

            const userEl = document.getElementById('header-username');
            const roleEl = document.getElementById('header-role-badge');
            const displayName =
                authData.user.firstName && authData.user.lastName
                    ? `${authData.user.firstName} ${authData.user.lastName}`
                    : authData.user.username;
            if (userEl) {
                userEl.textContent = '';
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', 'user');
                userEl.appendChild(icon);
                userEl.appendChild(document.createTextNode(' ' + displayName));
            }
            if (roleEl) {
                const role = authData.user.role;
                roleEl.textContent = role === 'admin' ? 'ADMIN' : role === 'pro' ? 'PRO' : 'USER';
                const colorMap = {
                    admin: {
                        bg: 'rgba(var(--warn-rgb),0.15)',
                        fg: 'var(--warn)',
                        border: 'rgba(var(--warn-rgb),0.3)'
                    },
                    pro: {
                        bg: 'rgba(var(--success-rgb),0.15)',
                        fg: 'var(--success)',
                        border: 'rgba(var(--success-rgb),0.3)'
                    },
                    user: {
                        bg: 'rgba(var(--blue-rgb),0.15)',
                        fg: 'var(--blue-hover)',
                        border: 'rgba(var(--blue-rgb),0.3)'
                    }
                };
                const c = colorMap[role] || colorMap.user;
                roleEl.style.background = c.bg;
                roleEl.style.color = c.fg;
                roleEl.style.border = '1px solid ' + c.border;
            }

            window.currentUser = authData.user;
        } catch (e) {
            window.location.href = 'index.html';
            return;
        }

        if (
            !window.location.hash ||
            window.location.hash === '#' ||
            window.location.hash === '#/'
        ) {
            window.location.hash = '#/rury';
        }

        window.addEventListener('hashchange', navigate);

        document.querySelectorAll('.nav-apps a.nav-tile').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#/') && window.location.hash === href) {
                    e.preventDefault();
                    navigate();
                }
            });
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => window.appLogout());
        }

        await navigate();
    }

    function openOfferInModule(type, offerId, action = 'edit') {
        const targetModule = type === 'studnia_oferta' ? 'studnie' : 'rury';
        const param = action === 'order' ? 'order' : 'edit';
        window.location.hash = `#/${targetModule}?${param}=${offerId}`;
    }

    function _refreshModule(module) {
        const iframe = _routerState.iframes[module];
        if (!iframe) return;
        try {
            const win = iframe.contentWindow;
            if (
                module === 'zlecenia' &&
                win.AppZlecenia &&
                typeof win.AppZlecenia.loadOrders === 'function'
            ) {
                win.AppZlecenia.loadOrders();
            } else if (module === 'kartoteka') {
                if (win.AppKartoteka && typeof win.AppKartoteka.loadOffers === 'function') {
                    win.AppKartoteka.loadOffers();
                } else if (win.pvSalesUI && typeof win.pvSalesUI.loadLocalOffers === 'function') {
                    win.pvSalesUI.loadLocalOffers();
                }
            }
        } catch (e) {
            logger.warn('router', '[SpaRouter] Could not refresh module:', module, e);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    const api = { showSection, navigate, openOfferInModule, refreshModule: _refreshModule };
    window.SpaRouter = api;
    return api;
})();

if (typeof registerCspAction === 'function') {
    registerCspAction('spaNavLink', function (t) {
        window.location.hash = t.dataset.href;
    });
    registerCspAction('spaShowSection', function (t) {
        SpaRouter.showSection(t.dataset.section);
    });
}
