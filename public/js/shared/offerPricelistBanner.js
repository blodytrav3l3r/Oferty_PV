// @ts-check
/* ===== BANNER WERSJI CENNIKA W EDYTORZE OFERTY (shared: rury + studnie) ===== */
/* Pokazuje pasek tylko gdy pieczątka oferty != ACTIVE (max seq z /labels).
 * Brak pieczątki, brak ACTIVE albo błąd fetch → cisza (brak paska).
 * Zależności (globalne): pricelistVersions.fetchLabels/fetchLabelsByIds,
 * escapeHtml, appConfirm, showToast, lucide (ikony alert-triangle, refresh-cw
 * z iconsSlim). Bez zmian endpointów BE. */

(function () {
    'use strict';

    function esc(s) {
        return typeof window.escapeHtml === 'function' ? window.escapeHtml(s) : String(s ?? '');
    }

    function typeLabel(type) {
        if (type === 'studnie') return 'Studnie';
        if (type === 'rury') return 'Rury';
        return type || '';
    }

    /** Aktywna = najwyższy seq (jak pickActiveLabel w pricelistVersions.js). */
    function pickActive(labels) {
        var best = null;
        Object.keys(labels || {}).forEach(function (id) {
            var v = labels[id];
            if (!best || (v.seq || 0) > (best.seq || 0)) best = v;
        });
        return best;
    }

    function containerId(type) {
        return 'pv-offer-banner-' + type;
    }

    function ensureContainer(type, anchorId) {
        var id = containerId(type);
        var existing = document.getElementById(id);
        if (existing) return existing;
        var anchor = anchorId ? document.getElementById(anchorId) : null;
        var host =
            anchor && typeof anchor.closest === 'function'
                ? anchor.closest('.wizard-card, .card')
                : null;
        var div = document.createElement('div');
        div.id = id;
        div.setAttribute('data-pv-offer-banner', type);
        div.style.marginBottom = '0.75rem';
        if (host && typeof host.insertBefore === 'function') {
            host.insertBefore(div, host.firstChild || null);
        } else if (anchor && anchor.parentElement) {
            anchor.parentElement.insertBefore(div, anchor);
        } else if (document.body) {
            document.body.insertBefore(div, document.body.firstChild || null);
        }
        return div;
    }

    function icons(root) {
        if (window.lucide) window.lucide.createIcons(root ? { root: root } : undefined);
    }

    function hideBanner(type) {
        if (typeof document === 'undefined' || !document.getElementById) return;
        var el = document.getElementById(containerId(type));
        if (el && typeof el.remove === 'function') el.remove();
    }

    /**
     * @param {{type: string, stampId?: string|null, anchorId?: string,
     *   onRecalc?: (activeId?: string) => (boolean|Promise<boolean>)}} opts
     * @returns {Promise<boolean>} true gdy pasek widoczny
     */
    async function refreshBanner(opts) {
        var type = (opts && opts.type) || '';
        if (!type || typeof document === 'undefined') return false;
        var pv = window.pricelistVersions;
        if (!pv || typeof pv.fetchLabels !== 'function') return false;
        var stampId = (opts && opts.stampId) || null;
        // Brak pieczątki → cisza.
        if (!stampId) {
            hideBanner(type);
            return false;
        }
        var labels;
        try {
            labels = await pv.fetchLabels(type);
        } catch (_e) {
            hideBanner(type);
            return false;
        }
        var active = pickActive(labels);
        // Brak ACTIVE albo zgodność → cisza.
        if (!active || stampId === active.id) {
            hideBanner(type);
            return false;
        }
        // Pieczątka archiwalna spoza cache /labels — dopytaj raz po id.
        var stamp = labels[stampId];
        if (!stamp && typeof pv.fetchLabelsByIds === 'function') {
            try {
                labels = await pv.fetchLabelsByIds(type, [stampId]);
                stamp = labels[stampId];
            } catch (_e2) {
                /* cisza poniżej */
            }
        }
        // Nieznana pieczątka → cisza (nie strasz legacy fałszywym alarmem).
        if (!stamp) {
            hideBanner(type);
            return false;
        }
        var box = ensureContainer(type, opts && opts.anchorId);
        var label = typeLabel(type);
        box.innerHTML =
            '<div class="card" role="status" style="padding:0.5rem 0.75rem;display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap">' +
            '<i data-lucide="alert-triangle"></i>' +
            '<span>Oferta na cenniku ' +
            esc(stamp.version) +
            (label ? ' · ' + esc(label) : '') +
            '; aktywny ' +
            esc(active.version) +
            '. Ceny zamrożone.</span>' +
            '<button type="button" class="btn btn-sm btn-primary" data-pv-recalc>' +
            '<i data-lucide="refresh-cw"></i> Przelicz do aktywnego</button>' +
            '</div>';
        icons(box);
        var btn = box.querySelector ? box.querySelector('[data-pv-recalc]') : null;
        if (btn && typeof btn.addEventListener === 'function') {
            btn.addEventListener('click', async function () {
                var ok =
                    typeof window.appConfirm === 'function'
                        ? await window.appConfirm(
                              'Przeliczyć ofertę do aktywnego cennika ' +
                                  active.version +
                                  '? Ceny jednostkowe zostaną pobrane z aktywnej wersji.',
                              {
                                  title: 'Przelicz do aktywnego',
                                  type: 'warning',
                                  okText: 'Przelicz'
                              }
                          )
                        : true;
                if (!ok) return;
                var done = true;
                var recalc = opts && opts.onRecalc;
                // active.id do zapisania pieczątki przy zapisie (stare
                // onRecalc bez parametru działają jak dziś).
                if (typeof recalc === 'function') done = await recalc(active.id);
                if (done === false) return;
                hideBanner(type);
                if (typeof window.showToast === 'function')
                    window.showToast('Przeliczono do aktywnego cennika', 'success');
            });
        }
        return true;
    }

    window.offerPricelistBanner = {
        refresh: refreshBanner,
        hide: hideBanner
    };
})();
