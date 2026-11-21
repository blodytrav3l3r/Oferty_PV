// @ts-check
/* ===== Przejścia niestandardowe (poza cennikiem) — UI + zapis ===== */
/* SSoT modelu: wellTransitionsHelpers.js (walidacja, limity, etykiety). */

const CUSTOM_PRZEJSCIE_MODAL_ID = 'custom-przejscie-modal';
const CUSTOM_PRZEJSCIE_ITEM_MODAL_ID = 'custom-przejscie-item-modal';

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
 * @param {{name:string,dn:string,price:string|number,weight?:string|number,typeId?:string,
 *          rzedna?:string,angle?:string|number}} values
 * @param {Object} well
 * @param {Object|null} existing
 */
function buildCustomPrzejscieItem(values, well, existing) {
    const src = values || /** @type {any} */ ({});
    const fallbackWeight =
        src.weight === '' || src.weight == null
            ? existing && existing.customWeight != null
                ? existing.customWeight
                : typeof computeCustomPrzejscieWeight === 'function'
                  ? computeCustomPrzejscieWeight(src.dn)
                  : 0
            : src.weight;
    const v = validateCustomPrzejscie({
        name: src.name,
        dn: src.dn,
        price: src.price,
        weight: fallbackWeight
    });
    if (!v.ok) return { ok: false, item: null, errors: v.errors };
    const isFirst = !well || !Array.isArray(well.przejscia) || well.przejscia.length === 0;
    const angleInfo = _customPrzejscieComputeAngle(src.angle);
    const item = existing ? Object.assign({}, existing) : { id: _customPrzejscieNewId() };

    item.isCustom = true;
    item.productId = '';
    item.tempCategory = '';
    item.customName = v.value.name;
    item.customPrice = v.value.price;
    item.customWeight = v.value.weight;
    item.dn = v.value.dn;
    if (src.typeId) item.customTypeId = String(src.typeId);
    item.rzednaWlaczenia = _customPrzejscieNormalizeRzedna(src.rzedna, well);
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

/**
 * Buduje typ custom przejścia (nazwa + warianty DN).
 * @param {{name:string,variants:Array}} values
 * @param {Object|null} existing
 */
function buildCustomPrzejscieType(values, existing) {
    const v = validateCustomPrzejscieType(values);
    if (!v.ok) return { ok: false, type: null, errors: v.errors };
    const type = existing ? Object.assign({}, existing) : { id: _customPrzejscieNewTypeId() };
    type.name = v.value.name;
    type.variants = v.value.variants;
    return { ok: true, type, errors: {} };
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

function _customPrzejscieRefreshInline() {
    if (typeof renderInlinePrzejsciaApp !== 'function') return;
    renderInlinePrzejsciaApp();
    renderInlinePrzejsciaApp('zl-inline-przejscia-app');
}

/* ===== Typ custom przejścia — modal z wieloma średnicami ===== */

function _customTypeErrorHtml(key) {
    return `<div class="cp-error" data-cp-error="${key}" role="alert"></div>`;
}

function _customTypeVariantRowHtml(variant, index) {
    const v = variant || {};
    const dn = v.dn == null ? '' : v.dn;
    const weight = v.weight == null ? '' : v.weight;
    const price = v.price == null ? '' : v.price;
    const reserves = v;
    const autoWeight =
        typeof computeCustomPrzejscieWeight === 'function' ? computeCustomPrzejscieWeight(dn) : 0;
    const isManualWeight = weight !== '' && Number(weight) !== Number(autoWeight);
    return `
    <div class="cp-variant" data-cp-variant>
      <div class="cp-field cp-field-dn">
        <label class="form-label-sm">DN *</label>
        <input class="form-input" data-cp-field="dn" type="text" maxlength="${CUSTOM_PRZEJSCIE_LIMITS.DN_MAX}" value="${_customPrzejscieEscape(dn)}" placeholder="np. 315" />
        ${_customTypeErrorHtml('v' + index + '-dn')}
      </div>
      <div class="cp-field">
        <label class="form-label-sm">Waga [kg]</label>
        <input class="form-input" data-cp-field="weight" data-manual="${isManualWeight ? '1' : '0'}" type="number" min="0" step="0.01" value="${_customPrzejscieEscape(weight)}" placeholder="auto z DN" title="Auto: ścianka 15 cm, beton 2400 kg/m³" />
        ${_customTypeErrorHtml('v' + index + '-weight')}
      </div>
      <div class="cp-field">
        <label class="form-label-sm">Cena netto * [PLN]</label>
        <input class="form-input" data-cp-field="price" type="number" min="0" step="0.01" value="${_customPrzejscieEscape(price)}" placeholder="0,00" />
        ${_customTypeErrorHtml('v' + index + '-price')}
      </div>
      <div class="cp-field">
        <label class="form-label-sm" for="cp-v${index}-zapasDol">Zapas dół [mm]</label>
        <input id="cp-v${index}-zapasDol" class="form-input" data-cp-field="zapasDol" type="number" min="0" step="1" value="${_customPrzejscieEscape(reserves.zapasDol ?? '')}" placeholder="300" />
        ${_customTypeErrorHtml('v' + index + '-zapasDol')}
      </div>
      <div class="cp-field">
        <label class="form-label-sm" for="cp-v${index}-zapasGora">Zapas góra [mm]</label>
        <input id="cp-v${index}-zapasGora" class="form-input" data-cp-field="zapasGora" type="number" min="0" step="1" value="${_customPrzejscieEscape(reserves.zapasGora ?? '')}" placeholder="300" />
        ${_customTypeErrorHtml('v' + index + '-zapasGora')}
      </div>
      <div class="cp-field">
        <label class="form-label-sm" for="cp-v${index}-zapasDolMin">Zapas dół min [mm]</label>
        <input id="cp-v${index}-zapasDolMin" class="form-input" data-cp-field="zapasDolMin" type="number" min="0" step="1" value="${_customPrzejscieEscape(reserves.zapasDolMin ?? '')}" placeholder="150" />
        ${_customTypeErrorHtml('v' + index + '-zapasDolMin')}
      </div>
      <div class="cp-field">
        <label class="form-label-sm" for="cp-v${index}-zapasGoraMin">Zapas góra min [mm]</label>
        <input id="cp-v${index}-zapasGoraMin" class="form-input" data-cp-field="zapasGoraMin" type="number" min="0" step="1" value="${_customPrzejscieEscape(reserves.zapasGoraMin ?? '')}" placeholder="150" />
        ${_customTypeErrorHtml('v' + index + '-zapasGoraMin')}
      </div>
      <button type="button" class="btn-icon cp-remove" data-action="removeCustomPrzejscieVariant" aria-label="Usuń średnicę" title="Usuń średnicę"><i data-lucide="trash-2" aria-hidden="true"></i></button>
    </div>`;
}

function _customTypeModalHtml(isEdit, initial) {
    const raw = initial.variants && initial.variants.length ? initial.variants : [null];
    const variants =
        typeof window.sortCustomPrzejsciaVariants === 'function'
            ? window.sortCustomPrzejsciaVariants(raw)
            : raw;
    const rows = variants.map((v, i) => _customTypeVariantRowHtml(v, i)).join('');
    return `
    <div class="modal modal--prz cp-modal">
      <div class="modal-header">
        <h3 id="custom-przejscie-title">${isEdit ? 'Edytuj typ przejścia niestandardowego' : 'Nowe przejście niestandardowe'}</h3>
        <button class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body cp-body">
        <p class="cp-hint">
          Typ poza cennikiem — widoczny w sekcji „Dodaj Przejście Szczelne" w tej ofercie. Cena bazowa netto, rabat studni nalicza się automatycznie. Waga liczona automatycznie dla ścianki 15 cm, można ją zmienić. Puste zapasy używają wartości domyślnych cennika (300 mm; minimalne 150 mm).
        </p>
        <div class="cp-field cp-name-field">
          <label class="form-label" for="cp-name">Nazwa przejścia *</label>
          <input id="cp-name" class="form-input" type="text" maxlength="${CUSTOM_PRZEJSCIE_LIMITS.NAME_MAX}" value="${_customPrzejscieEscape(initial.name)}" placeholder="np. Przejście specjalne" />
          ${_customTypeErrorHtml('name')}
        </div>
        <div class="cp-section-head">
          <span class="cp-section-title">Średnice (DN) — rosnąco</span>
        </div>
        <div id="cp-variants" class="cp-variants">${rows}</div>
        ${_customTypeErrorHtml('variants')}
        <button type="button" class="btn btn-secondary cp-add" id="cp-add-variant" data-action="addCustomPrzejscieVariant">
          <i data-lucide="plus" aria-hidden="true"></i> Dodaj kolejną średnicę
        </button>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="closeModal">Anuluj</button>
        <button type="button" class="btn btn-primary" id="cp-save"><i data-lucide="${isEdit ? 'check' : 'plus'}" aria-hidden="true"></i> ${isEdit ? 'Zapisz' : 'Dodaj'}</button>
      </div>
    </div>`;
}

function _customTypeModalEl() {
    return _customPrzejscieEl(CUSTOM_PRZEJSCIE_MODAL_ID);
}

function _customTypeRows(modal) {
    if (!modal) return [];
    return Array.from(modal.querySelectorAll('[data-cp-variant]'));
}

function _customTypeRowField(row, field) {
    return row
        ? /** @type {HTMLInputElement|null} */ (
              row.querySelector('[data-cp-field="' + field + '"]')
          )
        : null;
}

function _customTypeAutoWeight(input) {
    const row = input && input.closest ? input.closest('[data-cp-variant]') : null;
    const dnInput = _customTypeRowField(row, 'dn');
    const weightInput = _customTypeRowField(row, 'weight');
    if (!dnInput || !weightInput) return;
    if (weightInput.dataset.manual === '1') return;
    const weight =
        typeof computeCustomPrzejscieWeight === 'function'
            ? computeCustomPrzejscieWeight(dnInput.value)
            : 0;
    weightInput.value = weight > 0 ? String(weight) : '';
}

function _customTypeAddVariantRow() {
    const modal = _customTypeModalEl();
    const container = modal ? modal.querySelector('#cp-variants') : null;
    if (!container) return;
    const index = _customTypeRows(modal).length;
    container.insertAdjacentHTML('beforeend', _customTypeVariantRowHtml(null, index));
    const rows = _customTypeRows(modal);
    const last = rows[rows.length - 1];
    const dnInput = _customTypeRowField(last, 'dn');
    if (dnInput) dnInput.focus();
    if (window.lucide && window.lucide.createIcons)
        window.lucide.createIcons({ root: /** @type {HTMLElement} */ (container) });
}

function _customTypeRemoveVariantRow(btn) {
    const modal = _customTypeModalEl();
    const row = btn && btn.closest ? btn.closest('[data-cp-variant]') : null;
    const rows = _customTypeRows(modal);
    if (!row) return;
    if (rows.length <= 1) {
        ['dn', 'weight', 'price', 'zapasDol', 'zapasGora', 'zapasDolMin', 'zapasGoraMin'].forEach(
            (field) => {
                const input = _customTypeRowField(row, field);
                if (input) {
                    input.value = '';
                    if (field === 'weight') input.dataset.manual = '0';
                }
            }
        );
        return;
    }
    row.remove();
}

function _customTypeCollectValues(modal) {
    const nameInput = modal ? modal.querySelector('#cp-name') : null;
    const variants = _customTypeRows(modal).map((row) => ({
        dn: (_customTypeRowField(row, 'dn') || {}).value || '',
        weight: (_customTypeRowField(row, 'weight') || {}).value || '',
        price: (_customTypeRowField(row, 'price') || {}).value || '',
        zapasDol: (_customTypeRowField(row, 'zapasDol') || {}).value ?? '',
        zapasGora: (_customTypeRowField(row, 'zapasGora') || {}).value ?? '',
        zapasDolMin: (_customTypeRowField(row, 'zapasDolMin') || {}).value ?? '',
        zapasGoraMin: (_customTypeRowField(row, 'zapasGoraMin') || {}).value ?? ''
    }));
    return { name: nameInput ? nameInput.value : '', variants };
}

function _customTypeClearErrors(modal) {
    if (!modal) return;
    modal.querySelectorAll('[data-cp-error]').forEach((el) => {
        el.textContent = '';
    });
    modal.querySelectorAll('.form-input').forEach((el) => {
        el.style.borderColor = '';
    });
}

function _customTypeShowErrors(modal, errors) {
    _customTypeClearErrors(modal);
    if (!modal) return;
    const rows = _customTypeRows(modal);
    Object.keys(errors).forEach((key) => {
        const errEl = modal.querySelector('[data-cp-error="' + key + '"]');
        if (errEl) errEl.textContent = errors[key];
        if (key === 'name') {
            const nameInput = modal.querySelector('#cp-name');
            if (nameInput) nameInput.style.borderColor = 'var(--danger)';
            return;
        }
        const m = /^v(\d+)-(dn|weight|price|zapasDol|zapasGora|zapasDolMin|zapasGoraMin)$/.exec(
            key
        );
        if (!m) return;
        const input = _customTypeRowField(rows[Number(m[1])], m[2]);
        if (input) input.style.borderColor = 'var(--danger)';
    });
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    if (firstKey === 'name') {
        const nameInput = modal.querySelector('#cp-name');
        if (nameInput) nameInput.focus();
        return;
    }
    const m = /^v(\d+)-/.exec(firstKey);
    if (!m) return;
    const row = rows[Number(m[1])];
    const input = row ? row.querySelector('.form-input') : null;
    if (input) input.focus();
}

/** Aktualizuje pozycje w studniach należące do edytowanego typu. */
function _customTypePropagate(type) {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;
    const variantByDn = new Map((type.variants || []).map((v) => [String(v.dn), v]));
    wells.forEach((well) => {
        if (!well || !Array.isArray(well.przejscia)) return;
        let changed = false;
        well.przejscia = well.przejscia.map((item) => {
            if (!isCustomPrzejscie(item)) return item;
            if (String(item.customTypeId || '') !== String(type.id)) return item;
            const variant = variantByDn.get(String(item.dn == null ? '' : item.dn));
            changed = true;
            const next = {
                ...item,
                customName: type.name,
                ...(variant
                    ? {
                          customPrice: variant.price,
                          customWeight: variant.weight,
                          zapasDol: variant.zapasDol,
                          zapasGora: variant.zapasGora,
                          zapasDolMin: variant.zapasDolMin,
                          zapasGoraMin: variant.zapasGoraMin
                      }
                    : {})
            };
            delete next.frozenPrice;
            delete next.frozenPriceBase;
            delete next.frozenName;
            delete next.frozenTransitionPrice;
            delete next.frozenDrillingPrice;
            delete next.frozenDrillingName;
            delete next.frozenDrillingDn;
            return next;
        });
        if (changed && typeof invalidateFrozenPricesForWell === 'function')
            invalidateFrozenPricesForWell(well);
    });
}

function _customTypeSave(modal, existing) {
    const result = buildCustomPrzejscieType(_customTypeCollectValues(modal), existing);
    if (!result.ok) {
        _customTypeShowErrors(modal, result.errors);
        return;
    }
    const list = getCustomPrzejsciaTypesList().slice();
    const idx = list.findIndex((t) => t && String(t.id) === String(result.type.id));
    if (idx >= 0) list[idx] = result.type;
    else list.push(result.type);
    window.customPrzejsciaTypes = list;
    _customTypePropagate(result.type);
    _customPrzejscieClose();
    showToast(existing ? 'Zapisano typ przejścia' : 'Dodano typ przejścia', 'success');
    if (typeof inlinePrzejsciaState !== 'undefined' && inlinePrzejsciaState) {
        inlinePrzejsciaState.type = customPrzejsciaTypeKey(result.type.id);
        inlinePrzejsciaState.dnId = null;
    }
    _customPrzejscieRefresh({}, null);
    _customPrzejscieRefreshInline();
}

/**
 * Otwiera modal tworzenia/edycji typu custom przejścia.
 * @param {{mode?:'create'|'edit', typeId?:string, well?:Object, wellIndex?:number}} [opts]
 */
function openCustomPrzejscieTypeModal(opts) {
    const o = opts || {};
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
    const well = resolveCustomPrzejscieWell(o);
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const existing = o.typeId
        ? getCustomPrzejsciaTypesList().find((t) => t && String(t.id) === String(o.typeId)) || null
        : null;
    const isEdit = !!existing;
    const initial = {
        name: existing ? existing.name : '',
        variants: existing ? existing.variants : []
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
        html: _customTypeModalHtml(isEdit, initial)
    });

    const modal = _customTypeModalEl();
    const saveBtn = _customPrzejscieEl('cp-save');
    if (saveBtn)
        saveBtn.addEventListener('click', function () {
            _customTypeSave(modal, existing);
        });
    if (modal) {
        modal.addEventListener('input', function (e) {
            const target = /** @type {HTMLInputElement|null} */ (e.target);
            if (!target || !target.classList) return;
            if (target.getAttribute('data-cp-field') === 'dn') _customTypeAutoWeight(target);
            else if (target.getAttribute('data-cp-field') === 'weight') {
                target.dataset.manual = String(target.value).trim() === '' ? '0' : '1';
                if (target.dataset.manual === '0') _customTypeAutoWeight(target);
            }
        });
    }
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons({ root: overlay });
}

/* ===== Pojedyncza pozycja custom (Excel / edycja kafelka) ===== */

function _customItemModalHtml(isEdit, initial) {
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
          Pozycja poza cennikiem — tylko w tej ofercie. Cena bazowa netto, rabat studni nalicza się automatycznie. Waga liczona automatycznie dla ścianki 15 cm.
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

function _customItemShowErrors(errors) {
    const overlay = _customPrzejscieEl(CUSTOM_PRZEJSCIE_ITEM_MODAL_ID);
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
    const overlay =
        _customPrzejscieEl(CUSTOM_PRZEJSCIE_MODAL_ID) ||
        _customPrzejscieEl(CUSTOM_PRZEJSCIE_ITEM_MODAL_ID);
    if (!overlay) return;
    if (typeof closeModal === 'function') {
        closeModal();
        return;
    }
    overlay.remove();
    if (typeof restoreBodyScroll === 'function') restoreBodyScroll();
}

/**
 * @typedef {{mode?:'create'|'edit', index?:number, insertIndex?:number, wellIndex?:number,
 *            well?:Object, onSaved?:Function, onCancel?:Function}} CustomPrzejscieOpts
 */

/**
 * Otwiera modal dodania/edycji pojedynczej pozycji custom przejścia.
 * Używane przez wiersz Excel i kafelek pozycji w konfiguratorze.
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
        id: CUSTOM_PRZEJSCIE_ITEM_MODAL_ID,
        titleId: 'custom-przejscie-title',
        html: _customItemModalHtml(o.mode === 'edit', initial),
        onClose: function () {
            if (typeof o.onCancel === 'function') o.onCancel();
            return true;
        }
    });
    const angleInput = _customPrzejscieEl('cp-angle');
    if (angleInput && typeof angleInput.addEventListener === 'function') {
        angleInput.addEventListener('input', () => {
            if (parseFloat(angleInput.value) > 360) angleInput.value = '360';
        });
    }

    const submit = function () {
        const values = {
            name: _customPrzejscieEl('cp-name') ? _customPrzejscieEl('cp-name').value : '',
            dn: _customPrzejscieEl('cp-dn') ? _customPrzejscieEl('cp-dn').value : '',
            price: _customPrzejscieEl('cp-price') ? _customPrzejscieEl('cp-price').value : '',
            weight: existing && existing.customWeight != null ? existing.customWeight : undefined,
            typeId: existing && existing.customTypeId ? existing.customTypeId : undefined,
            rzedna: _customPrzejscieEl('cp-rzedna') ? _customPrzejscieEl('cp-rzedna').value : '',
            angle: _customPrzejscieEl('cp-angle') ? _customPrzejscieEl('cp-angle').value : 0
        };
        const result = buildCustomPrzejscieItem(values, well, existing);
        if (!result.ok) {
            _customItemShowErrors(result.errors);
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
        const target = e.target;
        if (!target || typeof target.closest !== 'function') return;
        const variantBtn = target.closest('[data-action="removeCustomPrzejscieVariant"]');
        if (variantBtn) {
            _customTypeRemoveVariantRow(variantBtn);
            return;
        }
        const addVariantBtn = target.closest('[data-action="addCustomPrzejscieVariant"]');
        if (addVariantBtn) {
            _customTypeAddVariantRow();
            return;
        }
        const typeEditEl = target.closest('[data-action="editCustomPrzejscieType"]');
        if (typeEditEl) {
            openCustomPrzejscieTypeModal({
                mode: 'edit',
                typeId: typeEditEl.getAttribute('data-type-id') || ''
            });
            return;
        }
        const typeEl = target.closest('[data-action="openCustomPrzejscieTypeModal"]');
        if (typeEl) {
            openCustomPrzejscieTypeModal({ mode: 'create' });
            return;
        }
        const el = target.closest('[data-action="openCustomPrzejscieModal"]');
        if (!el) return;
        openCustomPrzejscieModal({ mode: 'create' });
    });
}

window.openCustomPrzejscieModal = openCustomPrzejscieModal;
window.openCustomPrzejscieTypeModal = openCustomPrzejscieTypeModal;
window.buildCustomPrzejscieItem = buildCustomPrzejscieItem;
window.buildCustomPrzejscieType = buildCustomPrzejscieType;
