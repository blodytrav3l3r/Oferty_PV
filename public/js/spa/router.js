/**
 * SPA Router — Router oparty na iframe dla WITROS.
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

const SpaRouter = (() => {
    // ── Stan ──
    let currentModule = null;
    const iframes = {};
    let transitionToken = 0;
    let transitionTimer = null;

    // ── Konfiguracja ──
    const MODULES = {
        rury: {
            src: 'rury.html',
            logo: 'Oferty rury',
            sections: [
                {
                    id: 'builder',
                    icon: '<i data-lucide="edit"></i>',
                    label: 'Konfiguracja',
                },
                { id: 'offer', icon: '<i data-lucide="bar-chart-2"></i>', label: 'Oferta' },
                { id: 'pricelist', icon: '<i data-lucide="clipboard-list"></i>', label: 'Cennik' }
            ]
        },
        studnie: {
            src: 'studnie.html',
            logo: 'Kalkulator Studni',
            sections: [
                {
                    id: 'builder',
                    icon: '<i data-lucide="cylinder"></i>',
                    label: 'Konfiguracja',
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
        }
    };

    // ── Pomocnicy ──

    function escapeHtml(str) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
    if (typeof window.escapeHtml !== 'function') window.escapeHtml = escapeHtml;

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
        if (logoText) logoText.innerHTML = config.logo;

        const lgSpa = document.getElementById('lg-spa');
        if (lgSpa) {
            lgSpa.className = 'logo logo-' + module;
        }
    }

    function renderSectionNav(module) {
        const nav = document.getElementById('spa-section-nav');
        if (!nav) return;
        const sections = MODULES[module]?.sections || [];
        nav.innerHTML = sections
            .map(
                (s, i) => `
            <button class="nav-btn nav-tile nav-accent-${s.id}${i === 0 ? ' active' : ''}"
                data-section="${s.id}" id="nav-${s.id}"
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
            layer.classList.add('is-visible');
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
            if (layer) layer.classList.remove('is-visible');
        }, delay);
    }

    function waitForIframeReady(iframe, timeout = 1200) {
        return new Promise((resolve) => {
            let done = false;
            const complete = () => {
                if (done) return;
                done = true;
                iframe.removeEventListener('load', complete);
                resolve();
            };

            try {
                if (iframe.contentDocument?.readyState === 'complete') {
                    window.setTimeout(complete, 120);
                    return;
                }
            } catch (e) {
                // Oczekiwano iframe tej samej domeny, ale nawigacja pozostaje odporna.
            }

            iframe.addEventListener('load', complete);
            window.setTimeout(complete, timeout);
        });
    }

    function waitForNextIframeLoad(iframe, timeout = 1800) {
        return new Promise((resolve) => {
            let done = false;
            const complete = () => {
                if (done) return;
                done = true;
                iframe.removeEventListener('load', complete);
                resolve();
            };

            iframe.addEventListener('load', complete);
            window.setTimeout(complete, timeout);
        });
    }

    /** Tworzy lub pobiera iframe dla modułu */
    function getOrCreateIframe(module) {
        if (iframes[module]) return iframes[module];

        const config = MODULES[module];
        const iframe = document.createElement('iframe');
        iframe.id = 'spa-iframe-' + module;
        iframe.className = 'spa-module-iframe';

        const { params } = parseHash();
        let src = config.src;
        // Dołącz wszystkie parametry z hasha SPA do adresu URL iframe
        Object.entries(params).forEach(([k, v]) => {
            src += (src.includes('?') ? '&' : '?') + `${k}=${v}`;
        });
        // Wymuś pominięcie pamięci podręcznej dla samego modułu
        src += (src.includes('?') ? '&' : '?') + 'v=2.0';

        iframe.src = src;
        iframe.style.display = 'none';

        // Ukryj nagłówek modułu wewnątrz iframe (jest zbędny — nagłówek SPA obsługuje nawigację)
        iframe.addEventListener('load', () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                // Ukryj nagłówek w iframe
                const header = iframeDoc.querySelector('.header, header.header');
                if (header) header.style.display = 'none';

                // Dopasuj główną treść, aby nie miała przesunięcia nagłówka
                const main = iframeDoc.querySelector('main.main');
                if (main) {
                    main.style.paddingTop = '0.5rem';
                    main.style.marginTop = '0';
                }

                // Ustaw przezroczyste tło body, aby tło rodzica było widoczne
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

    function showSection(sectionId) {
        if (!currentModule || !iframes[currentModule]) return;

        try {
            const iframeWin = iframes[currentModule].contentWindow;
            if (iframeWin && typeof iframeWin.showSection === 'function') {
                iframeWin.showSection(sectionId);
            }
        } catch (e) {
            logger.warn('router', '[SpaRouter] Cannot call showSection in iframe:', e);
        }

        // Aktualizacja stanów aktywności przycisków nawigacji w rodzicu
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

        const transition = startViewTransition();

        // Aktualizuj nagłówek
        updateAppNav(module);
        toggleBackendIndicator(module);

        // Renderuj nawigację sekcji tylko przy przełączaniu modułów
        if (currentModule !== module) {
            renderSectionNav(module);
        }

        // Ukryj wszystkie iframe'y
        Object.values(iframes).forEach((f) => {
            f.style.display = 'none';
        });

        // Pokaż lub utwórz docelowy iframe
        const iframe = getOrCreateIframe(module);
        let readyPromise = waitForIframeReady(iframe);

        // Wymuś przeładowanie przy edycji/otwieraniu zamówienia, aby zagwarantować czysty stan
        if (params.edit || params.order) {
            let newSrc = MODULES[module].src;
            Object.entries(params).forEach(([k, v]) => {
                newSrc += (newSrc.includes('?') ? '&' : '?') + `${k}=${v}`;
            });
            newSrc += (newSrc.includes('?') ? '&' : '?') + 'v=' + Date.now(); // Wymuszenie pominięcia cache
            readyPromise = waitForNextIframeLoad(iframe, 1800);
            iframe.src = newSrc;
        }

        iframe.style.display = 'block';
        currentModule = module;

        // Auto-odświeżanie danych, jeśli moduł ma funkcję odświeżania
        try {
            refreshModule(module);
        } catch (e) {
            // Problemy z kontekstem - ignoruj
        }

        // Pomiń domyślną nawigację sekcji podczas edycji/zamawiania — iframe obsługuje to sam
        if (params.edit || params.order) {
            await readyPromise;
            finishViewTransition(transition);
            return;
        }

        // Określ, którą sekcję pokazać (domyślnie pierwsza, jeśli brak parametru tab)
        let tabToShow = params.tab;
        if (!tabToShow && MODULES[module].sections && MODULES[module].sections.length > 0) {
            tabToShow = MODULES[module].sections[0].id;
        }

        // Przejdź do sekcji, jeśli określona
        if (tabToShow) {
            // Poczekaj na załadowanie iframe'a, jeśli jest nowy
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
        finishViewTransition(transition);
    }

    async function init() {
        // Sprawdzenie autoryzacji
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

            // Wyświetl użytkownika w nagłówku
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
        } catch (e) {
            window.location.href = 'index.html';
            return;
        }

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
            logger.warn('router', '[SpaRouter] Could not refresh module:', module, e);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    const api = { showSection, navigate, openOfferInModule, refreshModule };
    window.SpaRouter = api;
    return api;
})();
