// @ts-check
/* ===== SPA Router — helpers + config ===== */

const _routerState = {
    currentModule: null,
    iframes: {},
    transitionToken: 0,
    transitionTimer: null
};

const MODULES = {
    rury: {
        src: 'rury.html',
        logo: 'Oferty rury',
        sections: [
            { id: 'builder', icon: '<i data-lucide="edit"></i>', label: 'Konfiguracja' },
            { id: 'offer', icon: '<i data-lucide="bar-chart-2"></i>', label: 'Oferta' },
            { id: 'pricelist', icon: '<i data-lucide="clipboard-list"></i>', label: 'Cennik' }
        ]
    },
    studnie: {
        src: 'studnie.html',
        logo: 'Kalkulator Studni',
        sections: [
            { id: 'builder', icon: '<i data-lucide="cylinder"></i>', label: 'Konfiguracja' },
            { id: 'offer', icon: '<i data-lucide="bar-chart-2"></i>', label: 'Oferta' },
            { id: 'pricelist', icon: '<i data-lucide="clipboard-list"></i>', label: 'Cennik' }
        ]
    },
    kartoteka: { src: 'kartoteka.html', logo: 'Kartoteka Ofert', sections: [] },
    zlecenia: { src: 'zlecenia.html', logo: 'Kartoteka Zleceń', sections: [] }
};

function _escapeHtml(str) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
if (typeof window.escapeHtml !== 'function') window.escapeHtml = _escapeHtml;

function _parseHash() {
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

function _updateAppNav(module) {
    document.getElementById('spa-app-rury')?.classList.toggle('active', module === 'rury');
    document.getElementById('spa-app-studnie')?.classList.toggle('active', module === 'studnie');
    document
        .getElementById('spa-app-kartoteka')
        ?.classList.toggle('active', module === 'kartoteka');
    document.getElementById('spa-app-zlecenia')?.classList.toggle('active', module === 'zlecenia');

    const config = MODULES[module];
    if (!config) return;

    const logoText = document.getElementById('spa-logo-text');
    if (logoText) logoText.innerHTML = config.logo;

    const lgSpa = document.getElementById('lg-spa');
    if (lgSpa) lgSpa.className = 'logo logo-' + module;
}

function _renderSectionNav(module) {
    const nav = document.getElementById('spa-section-nav');
    if (!nav) return;
    const sections = MODULES[module]?.sections || [];
    nav.innerHTML = sections
        .map(
            (s, i) => `
        <button class="nav-btn nav-tile nav-accent-${s.id}${i === 0 ? ' active' : ''}"
            data-section="${s.id}" id="nav-${s.id}"
            data-action="${s.isLink ? 'spaNavLink' : 'spaShowSection'}"${s.isLink ? ` data-href="${s.href}"` : ` data-section="${s.id}"`}">
            <span class="nav-tile-icon">${s.icon}</span>
            <span class="nav-tile-text">${s.label}</span>
        </button>`
        )
        .join('');
}

function _getTransitionLayer() {
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
            </div>`;
        main.appendChild(layer);
    }
    return layer;
}

function _startViewTransition() {
    const token = ++_routerState.transitionToken;
    const layer = _getTransitionLayer();
    window.clearTimeout(_routerState.transitionTimer);
    document.body.classList.add('spa-view-loading');
    if (layer) layer.classList.add('is-visible');
    return token;
}

function _finishViewTransition(token, delay = 180) {
    if (token !== _routerState.transitionToken) return;
    const layer = _getTransitionLayer();
    window.clearTimeout(_routerState.transitionTimer);
    _routerState.transitionTimer = window.setTimeout(() => {
        if (token !== _routerState.transitionToken) return;
        document.body.classList.remove('spa-view-loading');
        if (layer) layer.classList.remove('is-visible');
    }, delay);
}

function _waitForIframeReady(iframe, timeout = 1200) {
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
        } catch (e) {}

        iframe.addEventListener('load', complete);
        window.setTimeout(complete, timeout);
    });
}

function _waitForNextIframeLoad(iframe, timeout = 1800) {
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

function _getOrCreateIframe(module) {
    if (_routerState.iframes[module]) return _routerState.iframes[module];

    const config = MODULES[module];
    const iframe = document.createElement('iframe');
    iframe.id = 'spa-iframe-' + module;
    iframe.className = 'spa-module-iframe';
    iframe.loading = 'lazy';

    const { params } = _parseHash();
    let src = config.src;
    Object.entries(params).forEach(([k, v]) => {
        src += (src.includes('?') ? '&' : '?') + `${k}=${v}`;
    });
    src += (src.includes('?') ? '&' : '?') + 'v=2.0';

    iframe.src = src;
    iframe.style.display = 'none';

    iframe.addEventListener('load', () => {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const header = iframeDoc.querySelector('.header, header.header');
            if (header) header.style.display = 'none';

            const main = iframeDoc.querySelector('main.main');
            if (main) {
                main.style.paddingTop = '0.5rem';
                main.style.marginTop = '0';
            }

            iframeDoc.body.style.background = 'transparent';
            iframeDoc.documentElement.style.background = 'transparent';
        } catch (e) {
            logger.warn('router', '[SpaRouter] Could not modify iframe content:', e);
        }
    });

    document.getElementById('spa-main').appendChild(iframe);
    _routerState.iframes[module] = iframe;
    return iframe;
}
