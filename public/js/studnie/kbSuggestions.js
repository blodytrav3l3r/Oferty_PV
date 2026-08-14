// @ts-check
/**
 * kbSuggestions.js — Sugestie z bazy wiedzy (Learning Engine).
 *
 * Podpowiedzi AI na podstawie wzorców ai_knowledge_base (dennica_swap,
 * ring_pattern, reduction_choice) dla DN aktywnej studni. Czysto suggestywne:
 * użytkownik decyduje (Zastosuj / Odrzuć), solver pozostaje niezmieniony.
 *
 * Reward:
 *  - Zastosuj  → ACCEPT (wasAiRanked) — pozytywny sygnał dla wzorca.
 *  - Odrzuć    → REJECT tylko gdy studnia pochodzi z auto-doboru AI (AUTO_AI),
 *                inaczej sugestia znika lokalnie bez sygnału ML.
 */

(function () {
    'use strict';

    const SUGGESTIONS_URL = '/api/telemetry/ai/kb-suggestions';

    let _lastDn = null;
    let _suppressedDn = null;
    let _inFlight = false;
    let _lastSuggestions = [];

    function refreshWell() {
        if (typeof refreshAll === 'function') refreshAll();
        if (typeof window.renderWellConfig === 'function') window.renderWellConfig();
        if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
        if (typeof window.renderWellsList === 'function') window.renderWellsList();
        if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();
    }

    function getProductName(productId) {
        const products = window.studnieProducts || [];
        const p = products.find(function (pr) {
            return pr.id === productId;
        });
        return p ? p.name : productId;
    }

    function buildActionLabel(s) {
        const rec = s.recommendation || {};
        if (rec.type === 'substitution' && rec.removed && rec.added) {
            return (
                'Zamień: ' + getProductName(rec.removed) + ' \u2192 ' + getProductName(rec.added)
            );
        }
        if (rec.type === 'addition' && rec.added) {
            return 'Dodaj: ' + getProductName(rec.added);
        }
        if (rec.type === 'removal' && rec.removed) {
            return 'Usu\u0144: ' + getProductName(rec.removed);
        }
        return s.description || 'Sugestia konfiguracji';
    }

    function buildSuggestionHtml(s) {
        const pct = Math.round((s.confidence || 0) * 100);
        const label = buildActionLabel(s);
        return (
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.5rem 0.6rem;border:1px solid rgba(var(--accent-rgb,99,102,241),0.25);border-radius:8px;background:rgba(var(--accent-rgb,99,102,241),0.08);">' +
            '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:0.72rem;font-weight:700;color:var(--accent,#6366f1);">' +
            '<i data-lucide="sparkles"></i> Podpowied\u017a AI \u00b7 ' +
            pct +
            '% pewno\u015b\u0107</div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted,#9ca3af);word-wrap:break-word;">' +
            escapeHtml(label) +
            '</div>' +
            '</div>' +
            '<div style="display:flex;gap:0.3rem;flex-shrink:0;">' +
            '<button type="button" class="pehd-btn" style="padding:0.2rem 0.55rem;font-size:0.72rem;" onclick="window.applyKbSuggestion(\'' +
            s.patternKey +
            '\')">Zastosuj</button>' +
            '<button type="button" style="padding:0.2rem 0.55rem;font-size:0.72rem;background:transparent;border:1px solid var(--border-color,rgba(255,255,255,0.15));border-radius:6px;color:var(--text-muted,#9ca3af);cursor:pointer;" onclick="window.rejectKbSuggestion()">Odrzu\u0107</button>' +
            '</div>' +
            '</div>'
        );
    }

    function renderSuggestions(well, list) {
        const box = document.getElementById('kb-suggestions-box');
        if (!box) return;
        if (!well || !well.dn || !Array.isArray(list) || list.length === 0) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        box.style.display = 'block';
        box.innerHTML =
            '<div style="display:flex;flex-direction:column;gap:0.4rem;margin:0.3rem 0;">' +
            list.map(buildSuggestionHtml).join('') +
            '</div>';
        if (window.lucide && window.lucide.createIcons) {
            window.lucide.createIcons({ root: box });
        }
    }

    async function fetchSuggestions(dn) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, 4000);
            const res = await fetch(SUGGESTIONS_URL + '?dn=' + encodeURIComponent(dn), {
                method: 'GET',
                credentials: 'same-origin',
                headers: authHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) return [];
            const data = await res.json();
            return (data && data.suggestions) || [];
        } catch (_e) {
            return [];
        }
    }

    /**
     * Odświeża podpowiedzi dla aktywnej studni (guard po DN — jeden fetch na zmianę studni).
     * @param {Object} well
     */
    async function refreshKbSuggestions(well) {
        const dn = well && well.dn ? String(well.dn) : null;
        if (!dn) {
            renderSuggestions(null, []);
            return;
        }
        if (dn === _lastDn && !_inFlight) return;
        if (dn === _suppressedDn) {
            renderSuggestions(null, []);
            return;
        }
        _lastDn = dn;
        _inFlight = true;
        try {
            const list = await fetchSuggestions(dn);
            _lastSuggestions = list;
            renderSuggestions(well, list);
        } finally {
            _inFlight = false;
        }
    }

    function applySuggestion(patternKey) {
        const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
        if (!well || !Array.isArray(well.config)) return;
        const s = _lastSuggestions.find(function (x) {
            return x.patternKey === patternKey;
        });
        if (!s) return;

        const rec = s.recommendation || {};
        if (rec.type === 'substitution' && rec.removed && rec.added) {
            const idx = well.config.findIndex(function (c) {
                return c.productId === rec.removed;
            });
            if (idx >= 0) {
                well.config[idx].productId = rec.added;
                well.config[idx]._addedAt = Date.now();
            }
        } else if (rec.type === 'addition' && rec.added) {
            well.config.push({ productId: rec.added, quantity: 1, _addedAt: Date.now() });
        } else if (rec.type === 'removal' && rec.removed) {
            well.config = well.config.filter(function (c) {
                return c.productId !== rec.removed;
            });
        } else {
            return;
        }

        _suppressedDn = String(well.dn || '');

        if (typeof window.mlRewardHooks !== 'undefined' && window.mlRewardHooks.onWellAccepted) {
            window.mlRewardHooks.onWellAccepted({ wasAiRanked: true, well: well });
        }

        refreshWell();
        if (typeof showToast === 'function') {
            showToast('Zastosowano podpowied\u017a AI', 'success');
        }
    }

    function rejectSuggestion() {
        const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
        if (well && well.dn) {
            _suppressedDn = String(well.dn);
        }
        renderSuggestions(null, []);
        if (well && well.configSource === 'AUTO_AI' && window.mlRewardHooks) {
            window.mlRewardHooks.onWellRejected({ wasAiRanked: true, well: well });
        }
        if (typeof showToast === 'function') {
            showToast('Odrzucono podpowied\u017a', 'info');
        }
    }

    window.refreshKbSuggestions = refreshKbSuggestions;
    window.applyKbSuggestion = applySuggestion;
    window.rejectKbSuggestion = rejectSuggestion;
})();
