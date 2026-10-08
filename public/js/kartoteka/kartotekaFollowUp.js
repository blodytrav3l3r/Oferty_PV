// @ts-check
// Opieka nad ofertą (P1): modal "Zapisz kontakt" + timeline kontaktów.
// Mixin do KartotekaUI (import w kartotekaUi.js) — ESM, addEventListener,
// escapeHtml do innerHTML, brak nowych window.*.

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

        const overlay = window.showModal({
            id: 'offer-followup-modal',
            titleId: 'offer-followup-title',
            html:
                `<div class="modal">` +
                `<h3 id="offer-followup-title">Opieka nad ofertą — ${window.escapeHtml(title)}</h3>` +
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
                `<div class="fu-full"><button type="submit" class="btn btn-sm btn-primary">Zapisz kontakt</button></div>` +
                `</form>` +
                `<h4>Historia kontaktów</h4>` +
                `<div class="fu-timeline" id="fu-timeline">${this.renderFollowUpTimeline(items)}</div>` +
                `</div>`
        });

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
                return (
                    `<div class="fu-timeline-item">` +
                    `<div class="fu-timeline-meta">${window.escapeHtml(fmtDateTime(fu.contactedAt))} • ${window.escapeHtml(channel)} • ${window.escapeHtml(result)}${dur}${next}</div>` +
                    (fu.note ? `<div>${window.escapeHtml(fu.note)}</div>` : '') +
                    (outcome
                        ? `<div class="fu-timeline-meta">Wynik: ${window.escapeHtml(outcome)}</div>`
                        : '') +
                    `</div>`
                );
            })
            .join('');
    },

    async submitFollowUp(offerId, kind, overlay) {
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
            nextContactAt: nextRaw ? new Date(nextRaw + 'T00:00:00').toISOString() : null,
            outcome: outcomeVal,
            loseReason: loseReasonVal || null,
            competitor: val('#fu-competitor') || null,
            reopen: !!overlay.querySelector('#fu-reopen')?.checked
        };

        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        try {
            const resp = await fetch(
                `/api/offers-rury/${encodeURIComponent(kind)}/${encodeURIComponent(offerId)}/followups`,
                {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            );
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                if (resp.status === 409) {
                    fail('Oferta jest zamknięta — zaznacz „Ponownie otwórz", aby dopisać kontakt.');
                } else {
                    fail(json.error || 'Nie udało się zapisać kontaktu.');
                }
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
