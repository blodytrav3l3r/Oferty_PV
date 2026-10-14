window.XlsxImportShared = {
    REQUIRED_COLS: [
        'NUMER_OFERTY',
        'NR_STUDNI',
        'GLEBOKOSC',
        'INDEKS_CZESCI',
        'ILOSC',
        'CENA_JEDNOSTKOWA',
        'WERSJA',
        'RABAT',
        'SREDNICA',
        'ZAKONCZENIE',
        'MAGAZYN',
        'LP'
    ],

    validateHeaders(headers) {
        const missing = [];
        const requiredPresent = ['NUMER_OFERTY', 'INDEKS_CZESCI', 'ILOSC', 'CENA_JEDNOSTKOWA'];
        for (const col of requiredPresent) {
            if (!headers.includes(col)) missing.push(col);
        }
        return missing;
    },

    normalizeHeader(h) {
        if (!h) return '';
        return String(h).trim().toUpperCase();
    },

    // Scisle parsowanie liczb PL/EN z komorek XLSX (import ofert, D-FIX-2).
    // Kontrakt: number | null — nigdy NaN, nigdy ciche 0. Puste/tekst -> null
    // (blad wiersza u wolajacego). Ujemne przechodza (odrzuca Zod serwera).
    // '1 234,50' -> 1234.5; '1,234.50' -> 1234.5; '1.234,50' -> 1234.5;
    // '10%' -> 10; cienkie spacje (NBSP/U+202F/U+2009) ignorowane.
    // Jeden dom (kartoteka laduje ten plik przed importerami; coerceNumerics
    // cennikow nietkniety — osobny kontrakt, osobne testy).
    parsePlNumber(v) {
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        if (typeof v !== 'string') return null;
        let s = v
            .trim()
            .replace(/[ \u00A0\u202F\u2009]/g, '')
            .replace(/\s*%\s*$/, '');
        if (s === '') return null;
        const c = s.lastIndexOf(',');
        const d = s.lastIndexOf('.');
        if (c > -1 && d > -1) {
            s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        } else if (c > -1) {
            s = s.replace(',', '.');
        }
        if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    },

    parseExternalXlsx(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    await ensureXlsx();
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

                    if (!rows.length) {
                        reject(new Error('Plik XLSX jest pusty'));
                        return;
                    }

                    const headers = Object.keys(rows[0]).map((h) => this.normalizeHeader(h));
                    const missing = this.validateHeaders(headers);
                    if (missing.length) {
                        reject(new Error('Brakujące wymagane kolumny: ' + missing.join(', ')));
                        return;
                    }

                    const normalized = rows.map((row) => {
                        const obj = {};
                        for (const key of Object.keys(row)) {
                            obj[this.normalizeHeader(key)] = String(row[key]).trim();
                        }
                        return obj;
                    });

                    const offers = this.groupRowsIntoOffers(normalized);

                    resolve({ rows: normalized, offers, totalRows: normalized.length });
                } catch (err) {
                    reject(new Error('Błąd parsowania XLSX: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Nie udało się odczytać pliku'));
            reader.readAsArrayBuffer(file);
        });
    },

    groupRowsIntoOffers(rows) {
        const grouped = {};
        for (const row of rows) {
            const key = row['NUMER_OFERTY'] || 'BRAK_NUMERU';
            if (!grouped[key]) grouped[key] = { number: key, rows: [] };
            grouped[key].rows.push(row);
        }
        return Object.values(grouped);
    },

    getLoadedOffers() {
        const ui = window.kartotekaUI;
        return ui && ui.searchResults && Array.isArray(ui.searchResults.items)
            ? ui.searchResults.items
            : [];
    },

    async generateExternalXlsx(module, rows) {
        await ensureXlsx();
        const ws = XLSX.utils.json_to_sheet(rows, { header: this.REQUIRED_COLS });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Import');
        return wb;
    },

    escapeHtml(str) {
        if (typeof str !== 'string') return String(str || '');
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // Raport blednych wierszy po imporcie (blad nigdy nie przechodzi cicho).
    // errors: [{sheet, row, col, value, reason}]. Cap 50 + licznik reszty.
    // Wartosci z XLSX zawsze przez escapeHtml (XSS, baza #3/#24).
    // Zwraca Promise; zamkniecie = 'close'. Brak nowego window.*.
    showRowErrors(errors, stats) {
        const self = this;
        const list = errors || [];
        const shown = list.slice(0, 50);
        const rest = list.length - shown.length;
        const rows = shown
            .map(
                (e) =>
                    '<tr><td>' +
                    self.escapeHtml(String(e.row)) +
                    '</td><td>' +
                    self.escapeHtml(String(e.col)) +
                    '</td><td>' +
                    self.escapeHtml(String(e.value).slice(0, 60)) +
                    '</td><td>' +
                    self.escapeHtml(String(e.reason)) +
                    '</td></tr>'
            )
            .join('');
        const html =
            '<div class="modal modal--ie" role="document">' +
            '<div class="modal-header"><h3 id="ie-rowerrors-title"><span class="modal-title-icon modal-title-icon--warn"><i data-lucide="alert-triangle" class="icon-sm"></i></span>Odrzucone wiersze importu (' +
            self.escapeHtml(String(list.length)) +
            ')</h3><button type="button" class="btn-icon" aria-label="Zamknij" data-re-close><i data-lucide="x" class="icon-14"></i></button></div>' +
            '<div class="modal-body">' +
            '<p class="ie-modal-lead">Te wiersze NIE trafily do ofert (bledne liczby). ' +
            self.escapeHtml(stats || '') +
            '</p>' +
            '<table class="ie-error-table"><thead><tr><th>Wiersz</th><th>Kolumna</th><th>Wartosc</th><th>Powod</th></tr></thead><tbody>' +
            rows +
            '</tbody></table>' +
            (rest > 0
                ? '<p class="ie-modal-lead">… i ' +
                  self.escapeHtml(String(rest)) +
                  ' kolejnych (pelna lista w konsoli).</p>'
                : '') +
            '</div>' +
            '<div class="modal-footer"><button type="button" class="btn btn-sm btn-primary btn-flex-1" data-re-close>Zamknij</button></div>' +
            '</div>';
        return new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                resolve('close');
            };
            if (typeof window === 'undefined' || typeof window.showModal !== 'function') {
                if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                    console.warn('[import] odrzucone wiersze:', list);
                }
                done();
                return;
            }
            window.showModal({
                id: 'ie-rowerrors-modal',
                titleId: 'ie-rowerrors-title',
                html: html,
                onClose: done
            });
            const overlay = document.getElementById('ie-rowerrors-modal');
            if (!overlay) {
                done();
                return;
            }
            if (window.lucide) lucide.createIcons({ root: overlay });
            const close = () => {
                done();
                window.closeModal('ie-rowerrors-modal');
            };
            const btns = overlay.querySelectorAll('[data-re-close]');
            for (const b of btns) b.addEventListener('click', close);
        });
    }
};
