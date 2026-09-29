// @ts-check
/**
 * CSP-B2: jeden delegowany click zamiast setek onclick w partialach i szablonach JS.
 * Partiale ladują się przez innerHTML (partialLoader) — bezposrednie bindowanie
 * po DOMContentLoaded nie dziala (race), delegacja na document tak.
 *
 * Atrybuty:
 *   data-csp="fnName"            — window.fnName(...args)
 *   data-csp-scope="kartotekaUI" — window[kartotekaUI].fnName(...args)
 *   data-csp-args='[1,"x",true]' — JSON; wartosci dynamiczne renderuj jako
 *       ${escapeHtmlAttr(JSON.stringify([id, type]))} (getAttribute dekoduje encje)
 *   specjalne wartosci w args: "$el" (element), "$event", "$checked", "$value"
 *   data-csp-stop="1"            — stopPropagation przed wywolaniem
 *   data-csp="$select"           — el.select() (inputy, 40+ miejsc)
 *   data-csp="$gotoOrder|$clearTmSearch|$orderSave|$showSectionSelect" — kompozyty
 *       wieloinstrukcyjnych handlerow (bez nowych globali window.*)
 */
(function () {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
        return;
    }

    function composites(name, el, args) {
        if (name === '$gotoOrder') {
            window.location.href = 'studnie.html?order=' + args[0];
        } else if (name === '$clearTmSearch') {
            const input = document.getElementById('tm-filter-search');
            if (input) input.value = '';
            if (typeof window.tmApplyFilters === 'function') window.tmApplyFilters();
            if (typeof window.tmToggleSearchClear === 'function') window.tmToggleSearchClear();
            const again = document.getElementById('tm-filter-search');
            if (again && typeof again.focus === 'function') again.focus();
        } else if (name === '$orderSave') {
            if (window.orderEditMode) {
                if (typeof window.saveCurrentOrder === 'function') window.saveCurrentOrder();
            } else if (typeof window.saveOrderStudnie === 'function') {
                window.saveOrderStudnie();
            }
        } else if (name === '$showSectionSelect') {
            if (typeof window.showSection === 'function') window.showSection('builder');
            if (typeof window.selectWell === 'function') window.selectWell(args[0]);
        } else if (name === '$showUniversalPrintModalRury') {
            if (typeof window.showUniversalPrintModalRury === 'function') {
                window.showUniversalPrintModalRury(window.editingOfferId);
            }
        } else if (name === '$parentSaveAllDefaults') {
            if (window.parent && typeof window.parent.saveAllDefaults === 'function') {
                window.parent.saveAllDefaults();
            }
        }
    }

    document.addEventListener('click', (event) => {
        const el = event.target && event.target.closest ? event.target.closest('[data-csp]') : null;
        if (!el) return;
        const name = el.getAttribute('data-csp');
        if (!name) return;
        if (el.hasAttribute('data-csp-stop')) event.stopPropagation();
        if (name === '$select') {
            if (typeof el.select === 'function') el.select();
            return;
        }
        let args = [];
        try {
            args = JSON.parse(el.getAttribute('data-csp-args') || '[]');
        } catch (_e) {
            return;
        }
        if (!Array.isArray(args)) return;
        args = args.map((a) =>
            a === '$el'
                ? el
                : a === '$event'
                  ? event
                  : a === '$checked'
                    ? el.checked
                    : a === '$value'
                      ? el.value
                      : a
        );
        if (name.charAt(0) === '$') {
            composites(name, el, args);
            return;
        }
        const scope = el.getAttribute('data-csp-scope');
        const target = scope ? window[scope] : window;
        const fn = target && target[name];
        if (typeof fn === 'function') fn.apply(target, args);
    });
})();
