// @ts-check
// Opieka nad ofertą (P1): modal "Zapisz kontakt" + timeline kontaktów.
// Mixin do KartotekaUI (import w kartotekaUi.js) — ESM, addEventListener,
// escapeHtml do innerHTML, brak nowych window.*.
import {
    legacyToContacts,
    normalizeContacts,
    renderEditor,
    collectContacts,
    bindEditor
} from '../shared/clientContacts.js';

const CHANNEL_LABELS = {
    PHONE: 'Telefon',
    EMAIL: 'E-mail',
    SMS: 'SMS',
    WHATSAPP: 'WhatsApp',
    MEETING: 'Spotkanie',
    OTHER: 'Inne'
};

const RESULT_LABELS = {
    CONTACTED: 'Skontaktowano się',
    NO_ANSWER: 'Brak odpowiedzi',
    BUSY: 'Zajęty',
    CALLBACK_REQUESTED: 'Prosi o oddzwonienie',
    WRONG_NUMBER: 'Zły numer'
};

const OUTCOME_LABELS = {
    OPEN: 'W toku',
    WON: 'Wygrana — zamówił u nas',
    LOST_COMPETITION: 'Przegrana — konkurencja',
    LOST_OTHER: 'Przegrana — nie zamówił',
    ABANDONED: 'Zamknięta bez decyzji'
};

const TERMINAL_OUTCOMES = ['WON', 'LOST_COMPETITION', 'LOST_OTHER', 'ABANDONED'];

function toLocalInputValue(date) {
    const d = date instanceof Date ? date : new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        'T' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
    );
}

function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return (
        d.toLocaleDateString('pl-PL') +
        ' ' +
        d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    );
}

function optionsHtml(map, selected) {
    return Object.entries(map)
        .map(
            ([v, label]) =>
                `<option value="${window.escapeHtml(v)}"${v === selected ? ' selected' : ''}>${window.escapeHtml(label)}</option>`
        )
        .join('');
}

export default {
    /**
     * Otwiera modal opieki: formularz kontaktu + historia kontaktów oferty.
     */
    async openFollowUpModal(offerId, offerType) {
        const id = String(offerId || '');
        if (!id) return;
        const kind =
            typeof window.offerTypeForApi === 'function'
                ? window.offerTypeForApi(offerType)
                : offerType === 'studnia_oferta'
                  ? 'studnie'
                  : 'rury';

        const offer = (this.searchResults?.items || []).find((o) => String(o.id) === id);
        const title = offer ? offer.number || offer.title || offer.offerName || 'Oferta' : 'Oferta';

        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        let items = [];
        try {
            const resp = await fetch(
                `/api/offers-rury/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/followups?t=${Date.now()}`,
                { headers }
            );
            if (resp.ok) {
                const json = await resp.json();
                items = json.items || [];
            } else {
                logger.warn('kartotekaUi', 'Błąd pobierania kontaktów:', resp.status);
            }
        } catch (e) {
            logger.warn('kartotekaUi', 'Błąd pobierania kontaktów:', e);
        }

        const latest = items.length > 0 ? items[0] : null;
        const terminal = !!latest && TERMINAL_OUTCOMES.includes(latest.outcome);

        // Osoby do kontaktu (prefill z DETAIL — tablica clientContacts
        // albo klucze legacy; zapis osobnym PUT).
        let ccList = [];
        try {
            const dResp = await fetch(
                `/api/offers-rury/${encodeURIComponent(id)}?t=${Date.now()}`,
                { headers }
            );
            if (dResp.ok) {
                const dJson = await dResp.json();
                ccList = legacyToContacts((dJson && dJson.data) || {});
            }
        } catch (e) {
            logger.warn('kartotekaUi', 'Błąd pobierania danych klienta:', e);
        }

        const overlay = window.showModal({
            id: 'offer-followup-modal',
            titleId: 'offer-followup-title',
            html:
                `<div class="modal modal--lg">` +
                `<h3 id="offer-followup-title">Opieka nad ofertą — ${window.escapeHtml(title)}</h3>` +
                `<div class="fu-client-box"><h4>Kontakt do klienta</h4>` +
                `<div id="fu-cc-list" data-cc-hidden=""></div>` +
                `<div class="fu-client-actions"><button type="button" class="btn btn-sm btn-secondary" id="fu-client-save">Zapisz kontakt do klienta</button></div>` +
                `</div>` +
                `<form id="fu-contact-form" class="fu-form-grid">` +
                `<label> Kanał <select id="fu-channel" class="form-input form-input-sm">${optionsHtml(CHANNEL_LABELS, 'PHONE')}</select> </label>` +
                `<label> Rezultat <select id="fu-result" class="form-input form-input-sm">${optionsHtml(RESULT_LABELS, 'CONTACTED')}</select> </label>` +
                `<label> Data kontaktu <input type="datetime-local" id="fu-contacted-at" class="form-input form-input-sm" value="${window.escapeHtml(toLocalInputValue(new Date()))}" /> </label>` +
                `<label> Czas (min) <input type="number" id="fu-duration" class="form-input form-input-sm" min="0" max="480" step="1" placeholder="np. 4" /> </label>` +
                `<label class="fu-full"> Notatka <textarea id="fu-note" class="form-input form-input-sm" rows="2" maxlength="2000" placeholder="Co ustalono z klientem..."></textarea> </label>` +
                `<label> Następny kontakt <input type="date" id="fu-next" class="form-input form-input-sm" /> </label>` +
                `<label> Wynik <select id="fu-outcome" class="form-input form-input-sm">${optionsHtml(OUTCOME_LABELS, 'OPEN')}</select> </label>` +
                `<label class="fu-full fu-lose-row" hidden> Powód utraty <input type="text" id="fu-lose-reason" class="form-input form-input-sm" maxlength="200" placeholder="np. cena" /> </label>` +
                `<label class="fu-full fu-lose-row" hidden> Konkurent <input type="text" id="fu-competitor" class="form-input form-input-sm" maxlength="200" /> </label>` +
                (terminal
                    ? `<label class="fu-full"><input type="checkbox" id="fu-reopen" /> Ponownie otwórz zamkniętą ofertę</label>`
                    : '') +
                `<div class="fu-full fu-error" id="fu-error" role="alert" hidden></div>` +
                `<div class="fu-full fu-form-actions"><button type="submit" class="btn btn-sm btn-primary" id="fu-submit-btn">Zapisz kontakt</button><button type="button" class="btn btn-sm btn-secondary" id="fu-cancel-edit" hidden>Anuluj edycję</button></div>` +
                `</form>` +
                `<h4>Historia kontaktów</h4>` +
                `<div class="fu-timeline" id="fu-timeline">${this.renderFollowUpTimeline(items)}</div>` +
                `</div>`
        });

        this._fuItems = items;
        this._fuEditingId = null;

        const ccBox = overlay.querySelector('#fu-cc-list');
        if (ccBox) {
            renderEditor(ccBox, ccList);
            bindEditor(ccBox);
        }

        if (window.lucide) window.lucide.createIcons({ root: overlay });

        const outcomeSel = overlay.querySelector('#fu-outcome');
        const toggleLose = () => {
            const lost =
                outcomeSel.value === 'LOST_COMPETITION' || outcomeSel.value === 'LOST_OTHER';
            overlay.querySelectorAll('.fu-lose-row').forEach((el) => {
                if (el instanceof HTMLElement) el.hidden = !lost;
            });
        };
        outcomeSel.addEventListener('change', toggleLose);

        overlay.querySelector('#fu-contact-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitFollowUp(id, kind, overlay);
        });
        overlay.querySelector('#fu-cancel-edit').addEventListener('click', () => {
            this.cancelFollowUpEdit(overlay);
        });
        overlay.querySelector('#fu-client-save').addEventListener('click', () => {
            this.saveClientContact(id, kind, overlay);
        });
        overlay.querySelector('#fu-timeline').addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('[data-fu-act]') : null;
            if (!btn) return;
            const fuId = btn.getAttribute('data-fu-id') || '';
            if (btn.getAttribute('data-fu-act') === 'edit') this.startFollowUpEdit(fuId, overlay);
            else if (btn.getAttribute('data-fu-act') === 'del')
                this.deleteFollowUp(id, kind, fuId, overlay);
        });
    },

    async loadFollowUpItems(kind, offerId) {
        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        try {
            const resp = await fetch(
                `/api/offers-rury/${encodeURIComponent(kind)}/${encodeURIComponent(offerId)}/followups?t=${Date.now()}`,
                { headers }
            );
            if (!resp.ok) return null;
            const json = await resp.json();
            return json.items || [];
        } catch (e) {
            logger.warn('kartotekaUi', 'Błąd odświeżania kontaktów:', e);
            return null;
        }
    },

    async refreshFollowUpTimeline(overlay, kind, offerId) {
        const items = await this.loadFollowUpItems(kind, offerId);
        if (items === null) return;
        this._fuItems = items;
        const box = overlay.querySelector('#fu-timeline');
        if (box) {
            box.innerHTML = this.renderFollowUpTimeline(items);
            if (window.lucide) window.lucide.createIcons({ root: box });
        }
        await this.loadLocalOffers();
    },

    renderFollowUpTimeline(items) {
        if (!items || items.length === 0) {
            return '<div class="fu-timeline-meta">Brak zapisanych kontaktów — zapisz pierwszy powyżej.</div>';
        }
        return items
            .map((fu) => {
                const channel = CHANNEL_LABELS[fu.channel] || fu.channel || '—';
                const result = RESULT_LABELS[fu.result] || fu.result || '—';
                const outcome = OUTCOME_LABELS[fu.outcome] || fu.outcome || '';
                const dur =
                    fu.durationMin !== null && fu.durationMin !== undefined
                        ? ` • ${window.escapeHtml(String(fu.durationMin))} min`
                        : '';
                const next = fu.nextContactAt
                    ? ` • następny: ${window.escapeHtml(fmtDateTime(fu.nextContactAt))}`
                    : '';
                const fuId = window.escapeHtmlAttr(String(fu.id || ''));
                return (
                    `<div class="fu-timeline-item" data-fu-item="${fuId}">` +
                    `<div class="fu-timeline-meta">${window.escapeHtml(fmtDateTime(fu.contactedAt))} • ${window.escapeHtml(channel)} • ${window.escapeHtml(result)}${dur}${next}</div>` +
                    (fu.note ? `<div>${window.escapeHtml(fu.note)}</div>` : '') +
                    (outcome
                        ? `<div class="fu-timeline-meta">Wynik: ${window.escapeHtml(outcome)}</div>`
                        : '') +
                    `<div class="fu-timeline-actions"><button type="button" class="btn btn-sm btn-secondary" data-fu-act="edit" data-fu-id="${fuId}">Edytuj</button>` +
                    `<button type="button" class="btn btn-sm btn-secondary" data-fu-act="del" data-fu-id="${fuId}">Usuń</button></div>` +
                    `</div>`
                );
            })
            .join('');
    },

    startFollowUpEdit(fuId, overlay) {
        const fu = (this._fuItems || []).find((x) => String(x.id) === String(fuId));
        if (!fu) return;
        this._fuEditingId = String(fuId);
        const set = (sel, v) => {
            const el = overlay.querySelector(sel);
            if (el) el.value = v ?? '';
        };
        set('#fu-channel', fu.channel || 'PHONE');
        set('#fu-result', fu.result || 'CONTACTED');
        set(
            '#fu-contacted-at',
            fu.contactedAt && !Number.isNaN(Date.parse(fu.contactedAt))
                ? toLocalInputValue(new Date(fu.contactedAt))
                : toLocalInputValue(new Date())
        );
        set(
            '#fu-duration',
            fu.durationMin === null || fu.durationMin === undefined ? '' : String(fu.durationMin)
        );
        set('#fu-note', fu.note || '');
        set(
            '#fu-next',
            fu.nextContactAt && !Number.isNaN(Date.parse(fu.nextContactAt))
                ? String(fu.nextContactAt).slice(0, 10)
                : ''
        );
        set('#fu-outcome', fu.outcome || 'OPEN');
        set('#fu-lose-reason', fu.loseReason || '');
        set('#fu-competitor', fu.competitor || '');
        const outSel = overlay.querySelector('#fu-outcome');
        if (outSel && typeof Event === 'function') outSel.dispatchEvent(new Event('change'));
        // Edycja wpisu terminalnego wymaga flagi reopen — dostaw checkbox
        // gdy go nie ma (formularz nowego kontaktu pokazuje go tylko dla latest).
        if (TERMINAL_OUTCOMES.includes(fu.outcome) && !overlay.querySelector('#fu-reopen')) {
            const errBox = overlay.querySelector('#fu-error');
            const label = document.createElement('label');
            label.className = 'fu-full';
            label.id = 'fu-reopen-injected';
            label.innerHTML =
                '<input type="checkbox" id="fu-reopen" /> Potwierdzam zmianę wpisu z wynikiem terminalnym';
            if (errBox && errBox.parentNode) errBox.parentNode.insertBefore(label, errBox);
        }
        const btn = overlay.querySelector('#fu-submit-btn');
        if (btn) btn.textContent = 'Zapisz zmiany';
        const cancel = overlay.querySelector('#fu-cancel-edit');
        if (cancel) cancel.hidden = false;
        const form = overlay.querySelector('#fu-contact-form');
        if (form && typeof form.scrollIntoView === 'function') form.scrollIntoView();
    },

    cancelFollowUpEdit(overlay) {
        this._fuEditingId = null;
        const injected = overlay.querySelector('#fu-reopen-injected');
        if (injected && typeof injected.remove === 'function') injected.remove();
        const form = overlay.querySelector('#fu-contact-form');
        if (form && typeof form.reset === 'function') form.reset();
        const btn = overlay.querySelector('#fu-submit-btn');
        if (btn) btn.textContent = 'Zapisz kontakt';
        const cancel = overlay.querySelector('#fu-cancel-edit');
        if (cancel) cancel.hidden = true;
        const errBox = overlay.querySelector('#fu-error');
        if (errBox) errBox.hidden = true;
    },

    async deleteFollowUp(offerId, kind, fuId, overlay) {
        const fu = (this._fuItems || []).find((x) => String(x.id) === String(fuId));
        if (!fu) return;
        const terminal = TERMINAL_OUTCOMES.includes(fu.outcome);
        const msg = terminal
            ? 'Usunąć ten kontakt? To wpis z wynikiem terminalnym (zamknięcie oferty).'
            : 'Usunąć ten kontakt z historii?';
        if (typeof window.confirm === 'function' && !window.confirm(msg)) return;
        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        try {
            const resp = await fetch(
                `/api/offers-rury/${encodeURIComponent(kind)}/${encodeURIComponent(offerId)}/followups/${encodeURIComponent(fuId)}${terminal ? '?reopen=1' : ''}`,
                { method: 'DELETE', headers }
            );
            if (!resp.ok) {
                const json = await resp.json().catch(() => ({}));
                if (typeof window.showToast === 'function')
                    window.showToast(json.error || 'Nie udało się usunąć kontaktu.', 'error');
                return;
            }
            if (this._fuEditingId === String(fuId)) this.cancelFollowUpEdit(overlay);
            if (typeof window.showToast === 'function')
                window.showToast('Kontakt usunięty.', 'success');
            await this.refreshFollowUpTimeline(overlay, kind, offerId);
        } catch (e) {
            logger.error('kartotekaUi', 'Błąd usuwania kontaktu:', e);
            if (typeof window.showToast === 'function')
                window.showToast('Błąd sieci — spróbuj ponownie.', 'error');
        }
    },

    async saveClientContact(offerId, kind, overlay) {
        const box = overlay.querySelector('#fu-cc-list');
        const contacts = normalizeContacts(box ? collectContacts(box) : []);
        const badEmail = contacts.find((c) => c.email !== '' && !/.+@.+\..+/.test(c.email));
        if (badEmail) {
            if (typeof window.showToast === 'function')
                window.showToast('Podaj poprawny adres e-mail.', 'error');
            return;
        }
        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        try {
            const resp = await fetch(
                `/api/offers-rury/${encodeURIComponent(kind)}/${encodeURIComponent(offerId)}/client-contact`,
                {
                    method: 'PUT',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contacts })
                }
            );
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                if (typeof window.showToast === 'function')
                    window.showToast(json.error || 'Nie udało się zapisać kontaktu.', 'error');
                return;
            }
            if (typeof window.showToast === 'function')
                window.showToast('Kontakt do klienta zapisany.', 'success');
            await this.loadLocalOffers();
        } catch (e) {
            logger.error('kartotekaUi', 'Błąd zapisu kontaktu klienta:', e);
            if (typeof window.showToast === 'function')
                window.showToast('Błąd sieci — spróbuj ponownie.', 'error');
        }
    },

    async submitFollowUp(offerId, kind, overlay) {
        // P4.1: guard przed podwójnym zapisem (2× Enter/klik = duplikat kontaktu).
        if (this._fuSubmitting) return;
        const submitBtn = overlay.querySelector('#fu-contact-form button[type="submit"]');
        this._fuSubmitting = true;
        if (submitBtn) submitBtn.disabled = true;
        try {
            return await this._submitFollowUpInner(offerId, kind, overlay);
        } finally {
            this._fuSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    async _submitFollowUpInner(offerId, kind, overlay) {
        const errBox = overlay.querySelector('#fu-error');
        const fail = (msg) => {
            errBox.textContent = msg;
            errBox.hidden = false;
        };
        errBox.hidden = true;

        const val = (sel) => {
            const el = overlay.querySelector(sel);
            return el && typeof el.value === 'string' ? el.value.trim() : '';
        };
        const contactedRaw = val('#fu-contacted-at');
        if (!contactedRaw || Number.isNaN(Date.parse(contactedRaw))) {
            fail('Podaj poprawną datę kontaktu.');
            return;
        }
        const contactedAt = new Date(contactedRaw).toISOString();
        const durationRaw = val('#fu-duration');
        const durationMin = durationRaw === '' ? null : Number(durationRaw);
        if (
            durationMin !== null &&
            (!Number.isInteger(durationMin) || durationMin < 0 || durationMin > 480)
        ) {
            fail('Czas musi być liczbą całkowitą 0–480.');
            return;
        }
        const nextRaw = val('#fu-next');
        if (nextRaw && Number.isNaN(Date.parse(nextRaw))) {
            fail('Podaj poprawną datę następnego kontaktu.');
            return;
        }
        // P2 twarde domknięcie (lustro walidacji BE): LOST_* wymaga powodu.
        const outcomeVal = val('#fu-outcome') || 'OPEN';
        const loseReasonVal = val('#fu-lose-reason');
        if ((outcomeVal === 'LOST_COMPETITION' || outcomeVal === 'LOST_OTHER') && !loseReasonVal) {
            fail('Podaj powód utraty oferty.');
            return;
        }
        const body = {
            channel: val('#fu-channel') || 'PHONE',
            result: val('#fu-result') || 'CONTACTED',
            contactedAt,
            durationMin,
            note: val('#fu-note') || null,
            // P4.3: termin = koniec dnia lokalnego (nie północ — północ
            // cofałaby termin do poprzedniego dnia po normalizacji do UTC).
            nextContactAt: nextRaw ? new Date(nextRaw + 'T23:59:00').toISOString() : null,
            outcome: outcomeVal,
            loseReason: loseReasonVal || null,
            competitor: val('#fu-competitor') || null,
            reopen: !!overlay.querySelector('#fu-reopen')?.checked
        };

        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        const editingId = this._fuEditingId || null;
        const reopen = !!overlay.querySelector('#fu-reopen')?.checked;
        const url = editingId
            ? `/api/offers-rury/${encodeURIComponent(kind)}/${encodeURIComponent(offerId)}/followups/${encodeURIComponent(editingId)}${reopen ? '?reopen=1' : ''}`
            : `/api/offers-rury/${encodeURIComponent(kind)}/${encodeURIComponent(offerId)}/followups`;
        try {
            const resp = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                if (resp.status === 409) {
                    fail(
                        editingId
                            ? 'Zmiana wyniku terminalnego wymaga zaznaczenia „Ponownie otwórz".'
                            : 'Oferta jest zamknięta — zaznacz „Ponownie otwórz", aby dopisać kontakt.'
                    );
                } else {
                    fail(json.error || 'Nie udało się zapisać kontaktu.');
                }
                return;
            }
            if (editingId) {
                this.cancelFollowUpEdit(overlay);
                if (typeof window.showToast === 'function')
                    window.showToast('Kontakt zaktualizowany.', 'success');
                await this.refreshFollowUpTimeline(overlay, kind, offerId);
                return;
            }
            window.closeModal();
            if (typeof window.showToast === 'function')
                window.showToast('Kontakt zapisany.', 'success');
            await this.loadLocalOffers();
        } catch (e) {
            logger.error('kartotekaUi', 'Błąd zapisu kontaktu:', e);
            fail('Błąd sieci — spróbuj ponownie.');
        }
    }
};
