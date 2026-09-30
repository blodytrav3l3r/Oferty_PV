/**
 * CSP-B2/B3: delegowane handlery zamiast inline on* w HTML/partialach/szablonach JS.
 * Partiale ladują się przez innerHTML (partialLoader) — bezpośrednie bindowanie
 * po DOMContentLoaded nie działa (race), delegacja na document tak.
 *
 * Atrybuty:
 *   data-csp="fnName"            — window.fnName(...args)
 *   data-csp-scope="kartotekaUI" — window[kartotekaUI].fnName(...args)
 *   data-csp-on="change|input|keydown|focus|blur|mouseover|mouseout|mousedown|drag*"
 *                                — zdarzenie (domyślnie click; focus/blur przez
 *                                  focusin/focusout; mouseover/out emulują
 *                                  enter/leave przez relatedTarget)
 *   data-csp-key="Enter"         — filtr klawisza (keydown)
 *   data-csp-args="[1,&quot;x&quot;,true]" — JSON; wartości dynamiczne renderuj jako
 *       ${escapeHtmlAttr(JSON.stringify([id, type]))} (getAttribute dekoduje encje)
 *   specjalne wartości w args: "$el" (element), "$event", "$checked", "$value"
 *   data-csp-stop="1"            — stopPropagation przed wywołaniem
 *   data-csp="$select"           — el.select() (inputy)
 *   data-csp-2..-6 (+ -on/-args/-key/-stop/-scope) — kolejne handlery tego elementu
 *   $kompozyty                   — wieloinstrukcyjne handlery bez nowych window.*
 *       ($gotoOrder, $clearTmSearch, $orderSave, $showSectionSelect, $dom,
 *        $closePreview, $parentSaveAllDefaults, $hashLink, $resetColumnsAndClose,
 *        $notesRow, $warnToggle, $resolveElevations, $resolveDoplata, $stashValue,
 *        $digitsOnly, $updatePrecoGrupaKey, $dragWell, $styleSet, $stylePair,
 *        $hoverBg, $activeHover, $userBtnLeave, $tileHover, $paramValidate,
 *        $orderPipeCheck, $anglesSync, $tmSearch, $updateWellParamF, $summaryPipeCheck,
 *        $selectWrapKey, $selectLabel, $excelCellFocus, $keyToggleCard, $prevent,
 *        $showUniversalPrintModalRury)
 */
(function () {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
        return;
    }

    function composites(name, el, args, event) {
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
        } else if (name === '$dom') {
            // Jednolinijkowe operacje DOM: [op, idLubSelektor].
            const op = args[0];
            const sel = args[1];
            const byId = typeof sel === 'string' && sel.charAt(0) === '#';
            const tgt = byId
                ? document.getElementById(sel.slice(1))
                : sel === '$el'
                  ? el
                  : typeof sel === 'string'
                    ? el.closest(sel)
                    : null;
            if (!tgt) return;
            if (op === 'remove' && typeof tgt.remove === 'function') tgt.remove();
            else if (op === 'click' && typeof tgt.click === 'function') tgt.click();
            else if (op === 'focus' && typeof tgt.focus === 'function') tgt.focus();
            else if (op === 'blur' && typeof tgt.blur === 'function') tgt.blur();
            else if (op === 'stepDown' && typeof tgt.stepDown === 'function') tgt.stepDown();
            else if (op === 'stepUp' && typeof tgt.stepUp === 'function') tgt.stepUp();
            else if (op === 'select' && typeof tgt.select === 'function') tgt.select();
        } else if (name === '$showUniversalPrintModalRury') {
            if (typeof window.showUniversalPrintModalRury === 'function') {
                window.showUniversalPrintModalRury(window.editingOfferId);
            }
        } else if (name === '$closePreview') {
            if (typeof window.closeModal === 'function') window.closeModal();
            if (typeof window.activatePreviewPanel === 'function') {
                window.activatePreviewPanel();
            }
        } else if (name === '$parentSaveAllDefaults') {
            if (window.parent && typeof window.parent.saveAllDefaults === 'function') {
                window.parent.saveAllDefaults();
            }
        } else if (name === '$hashLink') {
            window.location.hash = args[0];
        } else if (name === '$resetColumnsAndClose') {
            if (typeof window._excelResetColumnVisibility === 'function') {
                window._excelResetColumnVisibility();
            }
            const overlay = el.closest('.modal-overlay');
            if (overlay && typeof overlay.remove === 'function') overlay.remove();
        } else if (name === '$notesRow') {
            if (typeof window.excelSelectRow === 'function') window.excelSelectRow(args[0]);
            if (typeof window.openWellNotesModal === 'function') {
                window.openWellNotesModal(args[0]);
            }
        } else if (name === '$stashValue') {
            const k = args[0] || 'old';
            el.dataset[k] = el.value;
            el.value = '';
        } else if (name === '$discountBlur') {
            if (!el.value) {
                el.value = el.dataset.oldValue || '';
            } else if (typeof window.handleOfferDiscountChange === 'function') {
                window.handleOfferDiscountChange(args[0], args[1], el.value);
            }
        } else if (name === '$wellParamRefresh') {
            const v = args[3] ? parseFloat(el.value) || 0 : el.value;
            if (typeof window._excelUpdateWellParam === 'function') {
                window._excelUpdateWellParam(args[0], args[1], v);
            }
            if (typeof window.excelRefreshParamsPopup === 'function') {
                window.excelRefreshParamsPopup(args[0]);
            }
        } else if (name === '$excelCellFocus') {
            if (typeof window.excelCellFocus === 'function') window.excelCellFocus(el);
            if (typeof window._excelSelWrapFocus === 'function') window._excelSelWrapFocus(el);
        } else if (name === '$orderPipeCheck') {
            if (typeof window.updateOrderSelectionCount === 'function') {
                window.updateOrderSelectionCount();
            }
            if (typeof window.onPipeCheckboxChange === 'function') {
                window.onPipeCheckboxChange(el);
            }
        } else if (name === '$anglesSync') {
            if (typeof window.editUpdateAngles === 'function') {
                window.editUpdateAngles(args[0]);
            }
            if (typeof window.syncEditState === 'function') window.syncEditState();
        } else if (name === '$tmSearch') {
            if (typeof window.tmApplyFiltersDebounced === 'function') {
                window.tmApplyFiltersDebounced();
            }
            if (typeof window.tmToggleSearchClear === 'function') {
                window.tmToggleSearchClear();
            }
        } else if (name === '$updateWellParamF') {
            if (typeof window.updateWellParam === 'function') {
                window.updateWellParam(args[0], parseFloat(el.value) || 0);
            }
        } else if (name === '$summaryPipeCheck') {
            if (typeof window.updateOfferSummarySelectionCount === 'function') {
                window.updateOfferSummarySelectionCount();
            }
            if (args[0] && typeof window.onPipeCheckboxChange === 'function') {
                window.onPipeCheckboxChange(el);
            }
        } else if (name === '$selectWrapKey') {
            // Ctrl+Enter nalezy do fill-down (excelCellNavigation), nie do selecta.
            if (!event.ctrlKey && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                const s = el.querySelector ? el.querySelector('select') : null;
                if (s) {
                    if (typeof s.showPicker === 'function') s.showPicker();
                    else {
                        if (typeof s.focus === 'function') s.focus();
                        if (typeof s.click === 'function') s.click();
                    }
                }
            }
        } else if (name === '$selectLabel') {
            const sib = el.nextElementSibling;
            if (sib && el.options && el.selectedIndex >= 0 && el.options[el.selectedIndex]) {
                sib.textContent = el.options[el.selectedIndex].text;
            }
        } else if (name === '$digitsOnly') {
            el.value = String(el.value).replace(/[^0-9]/g, '');
        } else if (name === '$updatePrecoGrupaKey') {
            if (typeof window.updatePrecoGrupaKey === 'function') {
                window.updatePrecoGrupaKey(args[0], args[1], decodeURIComponent(args[2]), args[3]);
            }
        } else if (name === '$toggleInne') {
            // Pokaz input "Inne" gdy select == 'Inne' (karta budowy, obie strony).
            const t = document.getElementById(args[0]);
            if (t) t.style.display = el.value === 'Inne' ? 'block' : 'none';
        } else if (name === '$keyToggleCard') {
            // Karta dostepna z klawiatury: Enter/Spacja przelacza (nie w buttonie).
            if (el.closest && el.closest('button')) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (typeof window.toggleCard === 'function') {
                    window.toggleCard(args[0], args[1]);
                }
            }
        } else if (name === '$resolveElevations') {
            if (typeof window.resolveFieldValue === 'function') {
                window.resolveFieldValue(el);
            }
            if (typeof window.updateElevations === 'function') window.updateElevations();
        } else if (name === '$resolveDoplata') {
            if (typeof window.resolveFieldValue === 'function') {
                window.resolveFieldValue(el);
            }
            if (typeof window.updateDoplata === 'function') window.updateDoplata();
        } else if (name === '$paramValidate') {
            if (typeof window.updateParamInput === 'function') {
                window.updateParamInput(args[0], el.value);
            }
            if (typeof window.validateWizardStep2 === 'function') {
                window.validateWizardStep2();
            }
        } else if (name === '$dragWell') {
            if (args[1]) {
                event.preventDefault();
            } else if (typeof window.dragWellComponent === 'function') {
                window.dragWellComponent(event, args[0]);
            }
        } else if (name === '$styleSet') {
            el.style[args[0]] = args[1];
        } else if (name === '$prevent') {
            event.preventDefault();
        } else if (name === '$kartotekaSearch') {
            const ui = window.kartotekaUI;
            if (ui && typeof ui.onSearchInput === 'function') ui.onSearchInput();
        } else if (name === '$stylePair') {
            el.style[args[0]] = args[1];
            el.style[args[2]] = args[3];
        } else if (name === '$hoverBg') {
            // Tlo z wlasnego atrybutu (excel: data-hover-bg / data-orig-bg).
            const v = el.getAttribute(args[0]);
            if (v !== null) el.style.background = v;
        } else if (name === '$activeHover') {
            // Hover tylko gdy brak klasy aktywnosci (sidebar styczna i podobne).
            if (el.classList && el.classList.contains(args[0])) return;
            el.style[args[1]] = args[2];
            el.style[args[3]] = args[4];
        } else if (name === '$tileHover') {
            // Hover kafelka przejscia: filtr + highlight SVG (+ cfg gdy przypisane).
            if (args[2] === 'in') {
                el.style.filter = 'brightness(1.1)';
                if (typeof window.highlightSvg === 'function') {
                    window.highlightSvg('prz', args[0]);
                }
                if (args[1] >= 0 && typeof window.highlightSvg === 'function') {
                    window.highlightSvg('cfg', args[1]);
                }
            } else {
                el.style.filter = 'brightness(1)';
                if (typeof window.unhighlightSvg === 'function') {
                    window.unhighlightSvg('prz', args[0]);
                }
                if (args[1] >= 0 && typeof window.unhighlightSvg === 'function') {
                    window.unhighlightSvg('cfg', args[1]);
                }
            }
        } else if (name === '$userBtnLeave') {
            // Powrot do styli domyslnych, chyba ze przycisk wybrany (user-select).
            if (el.classList && el.classList.contains('selected')) return;
            el.style.borderColor = args[0];
            el.style.background = args[1];
        } else if (name === '$warnToggle') {
            // Ostrzezenie raz + przelaczenie inputa "Inne" + update(opcjonalny).
            const prefix = args[0];
            const target = args[1];
            const updateFn = args[2];
            if (args[3] && !el.dataset.warned) {
                if (typeof window.appConfirm === 'function') {
                    window.appConfirm('Zmieniasz przejście przepisane z oferty!', {
                        title: 'Ostrzeżenie',
                        type: 'warning',
                        okText: 'Rozumiem',
                        cancelText: 'OK'
                    });
                }
                el.dataset.warned = '1';
            }
            if (target) {
                const t = document.getElementById(prefix + '-' + target);
                if (t) {
                    t.style.display = el.value === 'Inne' ? 'block' : 'none';
                    if (el.value !== 'Inne') t.value = el.value;
                }
            }
            if (updateFn && typeof window[updateFn] === 'function') {
                window[updateFn](prefix, el.value);
            }
        }
    }

    // data-csp-on: click (domyslnie) | mousedown | change | input | keydown | focus | blur |
    //               mouseover | mouseout | dragstart | dragover | dragleave | drop | dragend | scroll.
    // focus/blur ida przez focusin/focusout (bubluja). keydown filtruje data-csp-key.
    const EVENTS = [
        ['click', 'click'],
        ['mousedown', 'mousedown'],
        ['scroll', 'scroll'],
        ['change', 'change'],
        ['input', 'input'],
        ['keydown', 'keydown'],
        ['focus', 'focusin'],
        ['blur', 'focusout'],
        ['mouseover', 'mouseover'],
        ['mouseout', 'mouseout'],
        ['dragstart', 'dragstart'],
        ['dragover', 'dragover'],
        ['dragleave', 'dragleave'],
        ['drop', 'drop'],
        ['dragend', 'dragend']
    ];
    function handle(event, domEvent) {
        const el =
            event.target && event.target.closest
                ? event.target.closest(
                      '[data-csp], [data-csp-2], [data-csp-3], [data-csp-4], [data-csp-5], [data-csp-6], [data-csp-stop]'
                  )
                : null;
        if (!el) return;
        // Warianty zapasowe: element z wieloma handlerami (focus + blur + keydown + drag).
        const variants = ['', '-2', '-3', '-4', '-5', '-6'];
        let name = null;
        let want = null;
        let argSrc = 'data-csp-args';
        let keySrc = 'data-csp-key';
        let stopSrc = 'data-csp-stop';
        let scopeSrc = 'data-csp-scope';
        for (const suffix of variants) {
            const n = el.getAttribute('data-csp' + suffix);
            const w =
                el.getAttribute('data-csp' + suffix + '-on') ||
                (suffix === '' ? el.getAttribute('data-csp-on') : null) ||
                'click';
            if (w !== domEvent) continue;
            name = n;
            argSrc = 'data-csp' + suffix + '-args';
            keySrc = 'data-csp' + suffix + '-key';
            stopSrc = 'data-csp' + suffix + '-stop';
            scopeSrc = 'data-csp' + suffix + '-scope';
            want = w;
            break;
        }
        if (!want || want !== domEvent) return;
        // Emulacja mouseenter/mouseleave: ignoruj ruch wewnatrz elementu (dzieci).
        if (
            (domEvent === 'mouseover' || domEvent === 'mouseout') &&
            event.relatedTarget &&
            el.contains &&
            el.contains(event.relatedTarget)
        ) {
            return;
        }
        if (domEvent === 'keydown') {
            const key = el.getAttribute(keySrc);
            if (key && event.key !== key) return;
        }
        if (el.hasAttribute(stopSrc)) event.stopPropagation();
        if (!name) return;
        if (name === '$select') {
            if (typeof el.select === 'function') el.select();
            return;
        }
        let args = [];
        try {
            args = JSON.parse(el.getAttribute(argSrc) || '[]');
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
            composites(name, el, args, event);
            return;
        }
        const scope = el.getAttribute(scopeSrc);
        const w = window;
        const target = !scope ? w : scope === 'parent' ? w.parent : w[scope];
        const fn = target && target[name];
        if (typeof fn === 'function') fn.apply(target, args);
    }
    for (const [on, domEvent] of EVENTS) {
        document.addEventListener(domEvent, (event) => handle(event, on));
    }
})();
