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

    /* ===== STAŁY BADGE „Cennik: vX" W NAGŁÓWKU EDYTORA ===== */
    /* Zawsze widoczny: pieczątka oferty, „legacy" bez pieczątki albo aktywny
     * dla nowej oferty. Kotwica główna: #wizard-indicator (stały we wszystkich
     * krokach); fallback: tytuł kroku. Jawny brak body-append — badge w body
     * był niewidoczny (fabryka cichych faili). Bez fetchy na piechotę. */

    /* Pasek kroków — jeden per edytor, widoczny w każdym kroku. */
    var WIZARD_ANCHOR = 'wizard-indicator';

    function isShown(el) {
        if (!el || typeof el.getAttribute !== 'function') return true;
        var style = typeof el.getAttribute === 'function' ? el.getAttribute('style') || '' : '';
        if (/display\s*:\s*none/i.test(style)) return false;
        if (typeof el.offsetParent !== 'undefined' && el.offsetParent === null) return false;
        return true;
    }

    function resolveBadgeHost(anchorId) {
        if (typeof document === 'undefined' || !document.getElementById) return null;
        var ids = [WIZARD_ANCHOR];
        if (anchorId && anchorId !== WIZARD_ANCHOR) ids.push(anchorId);
        for (var i = 0; i < ids.length; i++) {
            var anchor = document.getElementById(ids[i]);
            if (!anchor || !isShown(anchor)) continue;
            if (ids[i] === WIZARD_ANCHOR) {
                if (typeof anchor.appendChild === 'function')
                    return { mode: 'append', node: anchor };
                continue;
            }
            if (anchor.parentElement && typeof anchor.parentElement.insertBefore === 'function')
                return { mode: 'sibling', node: anchor };
            if (typeof anchor.after === 'function') return { mode: 'after', node: anchor };
        }
        return null;
    }

    function waitForBadgeHost(anchorId, tries, delayMs) {
        var host = resolveBadgeHost(anchorId);
        if (host) return Promise.resolve(host);
        if (tries <= 0 || typeof setTimeout !== 'function') return Promise.resolve(null);
        return new Promise(function (resolve) {
            setTimeout(function () {
                resolve(waitForBadgeHost(anchorId, tries - 1, delayMs));
            }, delayMs);
        });
    }

    function badgeId(type) {
        return 'pv-offer-badge-' + type;
    }

    function hideBadge(type) {
        if (typeof document === 'undefined' || !document.getElementById) return;
        var el = document.getElementById(badgeId(type));
        if (el && typeof el.remove === 'function') el.remove();
    }

    function paintBadge(type, anchorId, text, title) {
        if (typeof document === 'undefined' || !document.getElementById) return false;
        if (!text) {
            hideBadge(type);
            return false;
        }
        var host = resolveBadgeHost(anchorId);
        if (!host) {
            if (typeof console !== 'undefined' && typeof console.debug === 'function')
                console.debug('[pv-badge] brak kotwicy dla typu ' + type);
            return false;
        }
        var el = document.getElementById(badgeId(type));
        if (!el) {
            if (typeof document.createElement !== 'function') return false;
            el = document.createElement('span');
            el.id = badgeId(type);
            el.className = 'badge-info text-nowrap pv-offer-badge';
            el.setAttribute('data-pv-offer-badge', type);
            if (host.mode === 'append') {
                host.node.appendChild(el);
            } else if (host.mode === 'sibling') {
                host.node.parentElement.insertBefore(el, host.node.nextSibling || null);
            } else {
                host.node.after(el);
            }
        }
        el.setAttribute('title', title || 'Wersja cennika');
        el.innerHTML = '<i data-lucide="tag"></i><span>' + esc(text) + '</span>';
        icons(el);
        return true;
    }

    /**
     * Stały badge cennika w nagłówku edytora.
     * @param {{type: string, stampId?: string|null, anchorId?: string,
     *   waitTries?: number, waitDelayMs?: number}} opts
     * @returns {Promise<boolean>} true gdy badge widoczny
     */
    async function refreshBadge(opts) {
        var type = (opts && opts.type) || '';
        if (!type || typeof document === 'undefined') return false;
        var pv = window.pricelistVersions;
        if (!pv || typeof pv.fetchLabels !== 'function') return false;
        var stampId = (opts && opts.stampId) || null;
        var labels;
        try {
            labels = await pv.fetchLabels(type);
        } catch (_e) {
            hideBadge(type);
            return false;
        }
        // Partial z #wizard-indicator może być jeszcze niewstrzyknięty.
        var waitTries = opts && typeof opts.waitTries === 'number' ? opts.waitTries : 3;
        var waitMs = opts && typeof opts.waitDelayMs === 'number' ? opts.waitDelayMs : 300;
        var ready = await waitForBadgeHost((opts && opts.anchorId) || null, waitTries, waitMs);
        if (!ready) {
            if (typeof console !== 'undefined' && typeof console.debug === 'function')
                console.debug('[pv-badge] brak kotwicy dla typu ' + type);
            return false;
        }
        var active = pickActive(labels);
        var label = typeLabel(type);
        var suffix = label ? ' · ' + label : '';
        if (stampId) {
            var stamp = labels[stampId];
            if (!stamp && typeof pv.fetchLabelsByIds === 'function') {
                try {
                    var extra = await pv.fetchLabelsByIds(type, [stampId]);
                    stamp = extra[stampId];
                } catch (_e2) {
                    /* legacy poniżej */
                }
            }
            if (stamp) {
                return paintBadge(
                    type,
                    opts && opts.anchorId,
                    'Cennik: ' + stamp.version + suffix,
                    'Wersja cennika oferty'
                );
            }
            return paintBadge(
                type,
                opts && opts.anchorId,
                'Cennik: legacy' + suffix,
                'Oferta sprzed wersjonowania cenników'
            );
        }
        if (!active) {
            hideBadge(type);
            return false;
        }
        return paintBadge(
            type,
            opts && opts.anchorId,
            'Cennik: ' + active.version + ' (aktywny)' + suffix,
            'Aktywny cennik — nowa oferta liczy po nim'
        );
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
        hide: hideBanner,
        badge: refreshBadge
    };
})();
