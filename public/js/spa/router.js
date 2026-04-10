/**
 * SPA Router — Iframe-based router for WITROS.
 *
 * Each module (rury, studnie) runs inside its own iframe,
 * providing COMPLETE isolation of JS, CSS, and DOM state.
 * The original HTML files work without ANY modification.
 *
 * Routes:
 *   #/rury      → rury.html (iframe)
 *   #/studnie   → studnie.html (iframe)
 *   #/kartoteka → kartoteka.html (iframe)
 *   (default)   → #/rury
 */

const SpaRouter = (() => {
    // ── State ──
    let currentModule = null;
    const iframes = {};

    // ── Config ──
    const MODULES = {
        rury: {
            src: 'rury.html',
            logo: 'Oferty rury',
            logoColors: ['#6366f1', '#8b5cf6'],
            sections: [
                {
                    id: 'offer',
                    icon: '📝',
                    label: 'Nowa Oferta',
                    accent: '#10b981',
                    glow: '#0d2a20'
                },
                { id: 'pricelist', icon: '📋', label: 'Cennik', accent: '#8b5cf6', glow: '#1e1540' }
            ]
        },
        studnie: {
            src: 'studnie.html',
            logo: 'Kalkulator Studni',
            logoColors: ['#10b981', '#34d399'],
            sections: [
                {
                    id: 'builder',
                    icon: '🏗️',
                    label: 'Konfiguracja',
                    accent: '#10b981',
                    glow: '#0d2b22'
                },
                { id: 'offer', icon: '📊', label: 'Oferta', accent: '#3b82f6', glow: '#152040' },
                { id: 'pricelist', icon: '📋', label: 'Cennik', accent: '#8b5cf6', glow: '#1e1540' }
            ]
        },
        kartoteka: {
            src: 'kartoteka.html',
            logo: 'Kartoteka Ofert',
            logoColors: ['#f59e0b', '#fbbf24'],
            sections: []
        },
        zlecenia: {
            src: 'zlecenia.html',
            logo: 'Kartoteka Zleceń',
            logoColors: ['#ec4899', '#f472b6'],
            sections: []
        }
    };

    // ── Helpers ──

    function parseHash() {
        const hash = window.location.hash || '#/rury';
        const [path, queryString] = hash.replace('#/', '').split('?');
        const module = path || 'rury';
        const params = {};
        if (queryString) {
            new URLSearchParams(queryString).forEach((v, k) => {
                params[k] = v;
            });
        }
        return { module, params };
    }

    function updateAppNav(module) {
        document.getElementById('spa-app-rury')?.classList.toggle('active', module === 'rury');
        document
            .getElementById('spa-app-studnie')
            ?.classList.toggle('active', module === 'studnie');
        document
            .getElementById('spa-app-kartoteka')
            ?.classList.toggle('active', module === 'kartoteka');
        document
            .getElementById('spa-app-zlecenia')
            ?.classList.toggle('active', module === 'zlecenia');

        const config = MODULES[module];
        if (!config) return;

        const logoText = document.getElementById('spa-logo-text');
        if (logoText) logoText.textContent = config.logo;

        const lgSpa = document.getElementById('lg-spa');
        if (lgSpa) {
            const stops = lgSpa.querySelectorAll('stop');
            if (stops.length >= 2) {
                stops[0].setAttribute('stop-color', config.logoColors[0]);
                stops[1].setAttribute('stop-color', config.logoColors[1]);
            }
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
                style="--nav-accent:${s.accent}; --nav-glow:${s.glow}"
                onclick="${s.isLink ? `window.location.hash='${s.href}'` : `SpaRouter.showSection('${s.id}')`}">
                <span class="nav-tile-icon">${s.icon}</span>
                <span class="nav-tile-text">${s.label}</span>
            </button>
        `
            )
            .join('');
    }

    function toggleBackendIndicator(module) {
        const el = document.getElementById('backend-status-indicator');
        if (el) el.style.display = module === 'studnie' ? 'flex' : 'none';
    }

    /** Create or get an iframe for a module */
    function getOrCreateIframe(module) {
        if (iframes[module]) return iframes[module];

        const config = MODULES[module];
        const iframe = document.createElement('iframe');
        iframe.id = 'spa-iframe-' + module;
        iframe.className = 'spa-module-iframe';

        const { params } = parseHash();
        let src = config.src;
        // Append all parameters from SPA hash to iframe URL
        Object.entries(params).forEach(([k, v]) => {
            src += (src.includes('?') ? '&' : '?') + `${k}=${v}`;
        });
        // Force cache-busting on the module itself
        src += (src.includes('?') ? '&' : '?') + 'v=2.0';

        iframe.src = src;
        iframe.style.display = 'none';

        // Hide the module's own header inside the iframe (it's redundant — the SPA header handles navigation)
        iframe.addEventListener('load', () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                // Hide the header in the iframe
                const header = iframeDoc.querySelector('.header, header.header');
                if (header) header.style.display = 'none';

                // Adjust main content to not have the header offset
                const main = iframeDoc.querySelector('main.main');
                if (main) {
                    main.style.paddingTop = '0.5rem';
                    main.style.marginTop = '0';
                }

                // Make the body background transparent so the parent background shows through
                iframeDoc.body.style.background = 'transparent';
                iframeDoc.documentElement.style.background = 'transparent';
            } catch (e) {
                // Cross-origin restriction — should not happen since same domain
                console.warn('[SpaRouter] Could not modify iframe content:', e);
            }
        });

        document.getElementById('spa-main').appendChild(iframe);
        iframes[module] = iframe;
        return iframe;
    }

    // ── Public API ──

    function showSection(sectionId) {
        if (!currentModule || !iframes[currentModule]) return;

        try {
            const iframeWin = iframes[currentModule].contentWindow;
            if (iframeWin && typeof iframeWin.showSection === 'function') {
                iframeWin.showSection(sectionId);
            }
        } catch (e) {
            console.warn('[SpaRouter] Cannot call showSection in iframe:', e);
        }

        // Update nav button active states in parent
        document.querySelectorAll('#spa-section-nav .nav-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
    }

    async function navigate() {
        const { module, params } = parseHash();

        if (!MODULES[module]) {
            window.location.hash = '#/rury';
            return;
        }

        // Update header
        updateAppNav(module);
        toggleBackendIndicator(module);

        // Render section nav only when switching modules
        if (currentModule !== module) {
            renderSectionNav(module);
        }

        // Hide all iframes
        Object.values(iframes).forEach((f) => {
            f.style.display = 'none';
        });

        // Show or create the target iframe
        const iframe = getOrCreateIframe(module);

        // Force reload if editing or opening an order, to guarantee clean state
        if (params.edit || params.order) {
            let newSrc = MODULES[module].src;
            Object.entries(params).forEach(([k, v]) => {
                newSrc += (newSrc.includes('?') ? '&' : '?') + `${k}=${v}`;
            });
            newSrc += (newSrc.includes('?') ? '&' : '?') + 'v=' + Date.now(); // Wymuszenie pominięcia cache
            iframe.src = newSrc;
        }

        iframe.style.display = 'block';
        currentModule = module;

        // Auto-refresh data if module has a refresh function
        try {
            refreshModule(module);
        } catch (e) {
            // Context issues - ignore
        }

        // Skip default section navigation when editing/ordering — the iframe handles it
        if (params.edit || params.order) return;

        // Determine which section to show (default to first section if no tab param)
        let tabToShow = params.tab;
        if (!tabToShow && MODULES[module].sections && MODULES[module].sections.length > 0) {
            tabToShow = MODULES[module].sections[0].id;
        }

        // Navigate to section if specified
        if (tabToShow) {
            // Wait for iframe to load if it's new
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
    }

    async function init() {
        // Auth check
        const token = getAuthToken();
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
            const authData = await authRes.json();
            if (!authData.user) {
                window.location.href = 'index.html';
                return;
            }

            // Display user in header
            const userEl = document.getElementById('header-username');
            const roleEl = document.getElementById('header-role-badge');
            const displayName =
                authData.user.firstName && authData.user.lastName
                    ? `${authData.user.firstName} ${authData.user.lastName}`
                    : authData.user.username;
            if (userEl) userEl.textContent = '👤 ' + displayName;
            if (roleEl) {
                const role = authData.user.role;
                roleEl.textContent = role === 'admin' ? 'ADMIN' : role === 'pro' ? 'PRO' : 'USER';
                const colorMap = {
                    admin: {
                        bg: 'rgba(245,158,11,0.15)',
                        fg: '#f59e0b',
                        border: 'rgba(245,158,11,0.3)'
                    },
                    pro: {
                        bg: 'rgba(16,185,129,0.15)',
                        fg: '#10b981',
                        border: 'rgba(16,185,129,0.3)'
                    },
                    user: {
                        bg: 'rgba(59,130,246,0.15)',
                        fg: '#60a5fa',
                        border: 'rgba(59,130,246,0.3)'
                    }
                };
                const c = colorMap[role] || colorMap.user;
                roleEl.style.background = c.bg;
                roleEl.style.color = c.fg;
                roleEl.style.border = '1px solid ' + c.border;
            }
        } catch (e) {
            window.location.href = 'index.html';
            return;
        }

        // Default hash
        if (
            !window.location.hash ||
            window.location.hash === '#' ||
            window.location.hash === '#/'
        ) {
            window.location.hash = '#/rury';
        }

        window.addEventListener('hashchange', navigate);

        // Allow clicking the current active module icon to reset its state
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
     * Opens an offer in the appropriate module (rury or studnie).
     * Called from kartoteka iframe via window.parent.SpaRouter.openOfferInModule(...).
     */
    function openOfferInModule(type, offerId, action = 'edit') {
        const targetModule = type === 'studnia_oferta' ? 'studnie' : 'rury';
        const param = action === 'order' ? 'order' : 'edit';

        // Navigate to target module with edit param
        window.location.hash = `#/${targetModule}?${param}=${offerId}`;
    }

    /**
     * Refreshes a specific module's data if its iframe exists.
     */
    function refreshModule(module) {
        const iframe = iframes[module];
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
            console.warn('[SpaRouter] Could not refresh module:', module, e);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    const api = { showSection, navigate, openOfferInModule, refreshModule };
    window.SpaRouter = api;
    return api;
})();
