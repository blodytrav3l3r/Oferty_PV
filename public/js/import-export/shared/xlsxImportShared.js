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

    parseExternalXlsx(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
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

    generateExternalXlsx(module, rows) {
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
    }
};
