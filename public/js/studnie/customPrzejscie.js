// @ts-check
/* ===== Przejścia niestandardowe (poza cennikiem) — UI + zapis ===== */
/* SSoT modelu: wellTransitionsHelpers.js (walidacja, limity, etykiety). */

const CUSTOM_PRZEJSCIE_MODAL_ID = 'custom-przejscie-modal';

function _customPrzejscieEl(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function _customPrzejscieEscape(value) {
    const s = value == null ? '' : String(value);
    if (typeof escapeHtmlAttr === 'function') return escapeHtmlAttr(s);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/** Studnia dla panelu (current) albo wiersza Excel (wellIndex). */
/** @param {CustomPrzejscieOpts} [opts] */
function resolveCustomPrzejscieWell(opts) {
    const o = opts || /** @type {CustomPrzejscieOpts} */ ({});
    if (o.well) return o.well;
    if (o.wellIndex != null && typeof wells !== 'undefined' && Array.isArray(wells))
        return wells[o.wellIndex] || null;
    return typeof getCurrentWell === 'function' ? getCurrentWell() : null;
}

function _customPrzejscieNewId() {
    if (typeof newPrzejscieId === 'function') return newPrzejscieId();
    return 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

function _customPrzejscieComputeAngle(angleRaw) {
    const angle = Number(angleRaw);
    const safe = Number.isFinite(angle) ? Math.min(360, Math.max(0, angle)) : 0;
    const exec = safe === 0 || safe === 360 ? 0 : 360 - safe;
    return { angle: safe, angleExecution: exec, angleGony: ((safe * 400) / 360).toFixed(2) };
}

function _customPrzejscieNormalizeRzedna(value, well) {
    if (value == null || value === '') return null;
    let parsed = null;
    if (typeof parseCalcExpression === 'function') parsed = parseCalcExpression(value);
    else parsed = parseFloat(String(value).replace(',', '.'));
    if (parsed === null || isNaN(parsed)) return null;
    if (well && typeof clampRzednaWlaczenia === 'function') {
        const c = clampRzednaWlaczenia(parsed, well);
        if ((c.clampedLow || c.clampedHigh) && typeof announceRzednaClamp === 'function')
            announceRzednaClamp(c);
        return Number(c.value).toFixed(3);
    }
    return Number(parsed).toFixed(3);
}

/**
 * Buduje/zapisuje pozycję custom przejścia. Zwraca {ok, item, errors}.
 * @param {{name:string,dn:string,price:string|number,rzedna?:string,angle?:string|number}} values
 * @param {Object} well
 * @param {Object|null} existing
 */
function buildCustomPrzejscieItem(values, well, existing) {
    const v = validateCustomPrzejscie(values);
    if (!v.ok) return { ok: false, item: null, errors: v.errors };
    const isFirst = !well || !Array.isArray(well.przejscia) || well.przejscia.length === 0;
    const angleInfo = _customPrzejscieComputeAngle(values.angle);
    const item = existing ? Object.assign({}, existing) : { id: _customPrzejscieNewId() };

    item.isCustom = true;
    item.productId = '';
    item.tempCategory = '';
    item.customName = v.value.name;
    item.customPrice = v.value.price;
    item.dn = v.value.dn;
    item.rzednaWlaczenia = _customPrzejscieNormalizeRzedna(values.rzedna, well);
    item.angle = angleInfo.angle;
    item.angleExecution = angleInfo.angleExecution;
    item.angleGony = angleInfo.angleGony;
    if (!existing) {
        item.flowType =
            isFirst && angleInfo.angle === 0
                ? typeof FLOW_TYPES !== 'undefined'
                    ? FLOW_TYPES.WYLOT
                    : 'WYLOT'
                : typeof FLOW_TYPES !== 'undefined'
                  ? FLOW_TYPES.WLOT
                  : 'WLOT';
    }
    // Cena custom jest źródłem prawdy — stare zamrożenie musi zniknąć.
    delete item.frozenPrice;
    delete item.frozenPriceBase;
    delete item.frozenName;
    delete item.frozenTransitionPrice;
    delete item.frozenDrillingPrice;
    delete item.frozenDrillingName;
    delete item.frozenDrillingDn;
    return { ok: true, item, errors: {} };
}

function _customPrzejscieRefresh(opts, item) {
    const o = opts || {};
    if (typeof o.onSaved === 'function') {
        o.onSaved(item);
        return;
    }
    if (typeof window.refreshPrzejsciaViews === 'function') window.refreshPrzejsciaViews();
    else if (typeof refreshActiveWell === 'function') refreshActiveWell();
    else if (typeof refreshAll === 'function') refreshAll();
    if (typeof autoSelectComponents === 'function') autoSelectComponents(true);
    if (typeof window.refreshZleceniaModalIfActive === 'function')
        window.refreshZleceniaModalIfActive();
}

/**
 * Dodaje kopię zapamiętanego custom przejścia (preset z bieżącej oferty).
 * @param {{name:string, dn?:string, price:string|number}} preset
 */
function addCustomPrzejsciePreset(preset) {
    if (typeof isOfferLocked === 'function' && isOfferLocked()) {
        showToast(
            typeof OFFER_LOCKED_MSG === 'string' ? OFFER_LOCKED_MSG : 'Oferta zablokowana',
            'error'
        );
        return;
    }
    if (typeof isWellLocked === 'function' && isWellLocked()) {
        showToast(
            typeof WELL_LOCKED_MSG === 'string' ? WELL_LOCKED_MSG : 'Studnia zablokowana',
            'error'
        );
        return;
    }
    const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const result = buildCustomPrzejscieItem(
        { name: preset.name, dn: preset.dn, price: preset.price },
        well,
        null
    );
    if (!result.ok) {
        const msg = result.errors.name || result.errors.price || 'Nie można dodać przejścia';
        showToast(msg, 'error');
        return;
    }
    if (!Array.isArray(well.przejscia)) well.przejscia = [];
    well.przejscia.push(result.item);
    if (typeof ensurePrzejsciaIds === 'function') ensurePrzejsciaIds(well.przejscia);
    if (typeof invalidateFrozenPricesForWell === 'function') invalidateFrozenPricesForWell(well);
    showToast('Dodano przejście niestandardowe', 'success');
    _customPrzejscieRefresh({}, result.item);
}

function _customPrzejscieModalHtml(opts, initial) {
    const isEdit = opts.mode === 'edit';
    const err = (field) =>
        `<div class="cp-error" data-cp-error="${field}" role="alert" style="color:var(--danger); font-size:var(--fs-xs);"></div>`;
    return `
    <div class="modal modal--prz">
      <div class="modal-header">
        <h3 id="custom-przejscie-title">${isEdit ? 'Edytuj przejście niestandardowe' : 'Nowe przejście niestandardowe'}</h3>
        <button class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; gap:0.55rem;">
        <div class="form-hint" style="font-size:var(--fs-xs); color:var(--text-muted);">
          Pozycja poza cennikiem — tylko w tej ofercie. Cena bazowa netto, rabat studni nalicza się automatycznie.
        </div>
        <label class="form-label" for="cp-name">Nazwa przejścia *</label>
        <input id="cp-name" class="form-input" type="text" maxlength="${CUSTOM_PRZEJSCIE_LIMITS.NAME_MAX}" value="${_customPrzejscieEscape(initial.name)}" placeholder="np. Przejście specjalne 315" />
        ${err('name')}
        <div style="display:flex; gap:0.55rem;">
          <div style="display:flex; flex-direction:column; gap:0.25rem; flex:1;">
            <label class="form-label" for="cp-dn">DN (opcjonalnie)</label>
            <input id="cp-dn" class="form-input" type="text" maxlength="${CUSTOM_PRZEJSCIE_LIMITS.DN_MAX}" value="${_customPrzejscieEscape(initial.dn)}" placeholder="np. 315" />
            ${err('dn')}
          </div>
          <div style="display:flex; flex-direction:column; gap:0.25rem; flex:1;">
            <label class="form-label" for="cp-price">Cena netto * [PLN]</label>
            <input id="cp-price" class="form-input" type="number" min="0" step="0.01" value="${_customPrzejscieEscape(initial.price)}" placeholder="0,00" />
            ${err('price')}
          </div>
        </div>
        <div style="display:flex; gap:0.55rem;">
          <div style="display:flex; flex-direction:column; gap:0.25rem; flex:1;">
            <label class="form-label" for="cp-rzedna">Rzędna włączenia [m]</label>
            <input id="cp-rzedna" class="form-input" type="text" inputmode="decimal" value="${_customPrzejscieEscape(initial.rzedna)}" placeholder="—" />
          </div>
          <div style="display:flex; flex-direction:column; gap:0.25rem; flex:1;">
            <label class="form-label" for="cp-angle">Kąt [°]</label>
            <input id="cp-angle" class="form-input" type="number" min="0" max="360" step="1" value="${_customPrzejscieEscape(initial.angle)}" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="closeModal">Anuluj</button>
        <button type="button" class="btn btn-primary" id="cp-save"><i data-lucide="${isEdit ? 'check' : 'plus'}" aria-hidden="true"></i> ${isEdit ? 'Zapisz' : 'Dodaj'}</button>
      </div>
    </div>`;
}

function _customPrzejscieShowErrors(errors) {
    const overlay = _customPrzejscieEl(CUSTOM_PRZEJSCIE_MODAL_ID);
    if (!overlay) return;
    overlay.querySelectorAll('[data-cp-error]').forEach((el) => {
        el.textContent = '';
    });
    overlay.querySelectorAll('.form-input').forEach((el) => {
        el.style.borderColor = '';
    });
    const map = { name: 'cp-name', dn: 'cp-dn', price: 'cp-price' };
    Object.keys(errors).forEach((key) => {
        const errEl = overlay.querySelector('[data-cp-error="' + key + '"]');
        if (errEl) errEl.textContent = errors[key];
        const input = _customPrzejscieEl(map[key]);
        if (input) input.style.borderColor = 'var(--danger)';
    });
    const firstKey = ['name', 'price', 'dn'].find((k) => errors[k]);
    if (firstKey) {
        const first = _customPrzejscieEl(map[firstKey]);
        if (first) first.focus();
    }
}

function _customPrzejscieClose() {
    const overlay = _customPrzejscieEl(CUSTOM_PRZEJSCIE_MODAL_ID);
    if (!overlay) return;
    if (typeof closeModal === 'function') {
        closeModal();
        return;
    }
    overlay.remove();
    if (typeof restoreBodyScroll === 'function') restoreBodyScroll();
}

/**
 * @typedef {{mode:'create'|'edit', index?:number, insertIndex?:number, wellIndex?:number,
 *            well?:Object, onSaved?:Function, onCancel?:Function}} CustomPrzejscieOpts
 */

/**
 * Otwiera modal dodania/edycji custom przejścia.
 * @param {CustomPrzejscieOpts} [opts]
 */
function openCustomPrzejscieModal(opts) {
    const o = opts || /** @type {CustomPrzejscieOpts} */ ({});
    if (o.wellIndex == null) {
        if (typeof isOfferLocked === 'function' && isOfferLocked()) {
            showToast(
                typeof OFFER_LOCKED_MSG === 'string' ? OFFER_LOCKED_MSG : 'Oferta zablokowana',
                'error'
            );
            return;
        }
        if (typeof isWellLocked === 'function' && isWellLocked()) {
            showToast(
                typeof WELL_LOCKED_MSG === 'string' ? WELL_LOCKED_MSG : 'Studnia zablokowana',
                'error'
            );
            return;
        }
    }
    const well = resolveCustomPrzejscieWell(o);
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const existing =
        o.mode === 'edit' && well.przejscia && o.index != null ? well.przejscia[o.index] : null;

    const initial = {
        name: existing ? existing.customName || '' : '',
        dn: existing ? existing.dn || '' : '',
        price: existing && existing.customPrice != null ? existing.customPrice : '',
        rzedna:
            existing && existing.rzednaWlaczenia != null
                ? existing.rzednaWlaczenia
                : well.rzednaDna != null && well.rzednaDna !== ''
                  ? Number(well.rzednaDna).toFixed(3)
                  : '',
        angle: existing && existing.angle != null ? existing.angle : 0
    };

    const fn =
        typeof window.showModal === 'function'
            ? window.showModal
            : typeof showModal === 'function'
              ? showModal
              : null;
    if (!fn) {
        showToast('Nie można otworzyć formularza przejścia', 'error');
        return;
    }
    const overlay = fn({
        id: CUSTOM_PRZEJSCIE_MODAL_ID,
        titleId: 'custom-przejscie-title',
        html: _customPrzejscieModalHtml(o, initial),
        onClose: function () {
            if (typeof o.onCancel === 'function') o.onCancel();
            return true;
        }
    });

    const submit = function () {
        const values = {
            name: _customPrzejscieEl('cp-name') ? _customPrzejscieEl('cp-name').value : '',
            dn: _customPrzejscieEl('cp-dn') ? _customPrzejscieEl('cp-dn').value : '',
            price: _customPrzejscieEl('cp-price') ? _customPrzejscieEl('cp-price').value : '',
            rzedna: _customPrzejscieEl('cp-rzedna') ? _customPrzejscieEl('cp-rzedna').value : '',
            angle: _customPrzejscieEl('cp-angle') ? _customPrzejscieEl('cp-angle').value : 0
        };
        const result = buildCustomPrzejscieItem(values, well, existing);
        if (!result.ok) {
            _customPrzejscieShowErrors(result.errors);
            return;
        }
        if (!well.przejscia) well.przejscia = [];
        if (existing) well.przejscia[o.index] = result.item;
        else if (o.insertIndex != null) {
            /* Wiersze Excela istnieją jako puste sloty — dopełnij, nie nadpisuj. */
            while (well.przejscia.length < o.insertIndex) {
                well.przejscia.push({ productId: '', tempCategory: '' });
            }
            well.przejscia[o.insertIndex] = result.item;
        } else well.przejscia.push(result.item);
        if (typeof ensurePrzejsciaIds === 'function') ensurePrzejsciaIds(well.przejscia);
        if (typeof invalidateFrozenPricesForWell === 'function')
            invalidateFrozenPricesForWell(well);
        _customPrzejscieClose();
        showToast(
            existing ? 'Zapisano przejście niestandardowe' : 'Dodano przejście niestandardowe',
            'success'
        );
        _customPrzejscieRefresh(o, result.item);
    };

    const saveBtn = _customPrzejscieEl('cp-save');
    if (saveBtn) saveBtn.addEventListener('click', submit);
    if (overlay) {
        overlay.addEventListener('keydown', function (e) {
            const target = /** @type {HTMLElement|null} */ (e.target);
            if (e.key === 'Enter' && target && target.tagName === 'INPUT') {
                e.preventDefault();
                submit();
            }
        });
    }
    if (typeof window.lucide !== 'undefined' && window.lucide && window.lucide.createIcons)
        window.lucide.createIcons({ root: overlay });
}

/* Delegacja przycisków z panelu przejść (CSP-safe, bez inline handlerów). */
if (typeof document !== 'undefined' && !window.__customPrzejscieDelegated) {
    window.__customPrzejscieDelegated = true;
    document.addEventListener('click', function (e) {
        const presetEl = e.target.closest('[data-action="addCustomPrzejsciePreset"]');
        if (presetEl) {
            addCustomPrzejsciePreset({
                name: presetEl.getAttribute('data-name') || '',
                dn: presetEl.getAttribute('data-dn') || '',
                price: presetEl.getAttribute('data-price') || ''
            });
            return;
        }
        const el = e.target.closest('[data-action="openCustomPrzejscieModal"]');
        if (!el) return;
        openCustomPrzejscieModal({ mode: 'create' });
    });
}

window.openCustomPrzejscieModal = openCustomPrzejscieModal;
window.addCustomPrzejsciePreset = addCustomPrzejsciePreset;
window.buildCustomPrzejscieItem = buildCustomPrzejscieItem;
