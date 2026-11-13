// @ts-check
/**
 * Shared Formatters — wspólne formatowanie liczb.
 * Eliminuje duplikat fmt/fmtInt z app.js i app_studnie.js.
 */

/**
 * SSoT zaokrągleń pieniędzy: 2 miejsca po przecinku, tryb handlowy
 * (half-up, od zera). Używaj na KAŻDEJ granicy kwoty PLN — cena pozycji,
 * suma netto, VAT, brutto, transport. Reguła projektu: docs/MONEY_ROUNDING.md.
 *
 * Przesunięcie dziesiętne poprawnie zaokrągla m.in. 1.005 oraz 10.075.
 * Wartości nieliczbowe (NaN/Infinity/null) → 0.
 * @param {number|string} value
 * @returns {number}
 */
function roundMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (Math.abs(n) >= 1e21) return n;
    const [mantissa, exponent = '0'] = Math.abs(n).toString().split('e');
    return (n < 0 ? -1 : 1) * (Math.round(Number(`${mantissa}e${Number(exponent) + 2}`)) / 100);
}

/**
 * Formatuje liczbę z 2 miejscami po przecinku i spacją tysięczną.
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
    return Number(n || 0).toLocaleString('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Formatuje liczbę całkowitą ze spacją tysięczną.
 * @param {number} n
 * @returns {string}
 */
function fmtInt(n) {
    return Math.round(n || 0).toLocaleString('pl-PL');
}

/** Format ISO date to pl-PL locale with time */
function formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/** Tokeny dla dokumentów drukowanych (silentPrint / window.open).
 *  Wartości MUSZĄ być zgodne z :root w public/css/style.base.css
 *  oraz z src/services/pdf/printTokens.ts (backend PDF). */
const PRINT_TOKENS_CSS = `:root {
    --slate-50: #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-950: #0f172a;
    --white: #ffffff;
    --black: #000000;
    --warn: #f59e0b;
    --warn-bg-light: #fffbeb;
    --danger: #ef4444;
    --success: #10b981;
    --brand-navy: #2d3561;
    --radius-2xs: 4px;
    --radius: 12px;
    --radius-sm: 8px;
    --radius-md: 16px;
    --radius-lg: 20px;
    --radius-pill: 999px;
    --fs-3xs: 0.55rem;
    --fs-2xs: 0.6rem;
    --fs-xs: 0.65rem;
    --fs-sm: 0.7rem;
    --fs-base: 0.75rem;
    --fs-md: 0.8rem;
    --fs-lg: 0.85rem;
    --fs-xl: 0.9rem;
    --fs-2xl: 1rem;
    --fs-3xl: 1.1rem;
    --fs-4xl: 1.25rem;
    --fs-5xl: 1.4rem;
    --fs-6xl: 1.6rem;
    --fs-7xl: 2rem;
    --fs-8xl: 2.5rem;
    --fw-light: 300;
    --fw-normal: 400;
    --fw-medium: 500;
    --fw-semibold: 600;
    --fw-bold: 700;
    --fw-extrabold: 800;
    --fw-black: 900;
}`;

/** Prosta interpolacja szablonu: zastępuje {{KEY}} wartościami z dataObj */
function renderTemplate(template, dataObj) {
    return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
        if (key === 'PRINT_TOKENS') return PRINT_TOKENS_CSS;
        return dataObj[key] !== undefined ? dataObj[key] : '';
    });
}

/**
 * Dopasowuje font w komórkach wydruku (`.fit-text[data-fit-max]`) do
 * dostępnej szerokości i wysokości komórki — bez ucinania tekstu.
 *
 * Uruchamiane w kontekście dokumentu wydruku (iframe), bo skrypt inline
 * z szablonu jest blokowany przez CSP (nonce rodzica ≠ nonce szablonu).
 * Współczynnik 0.9: iframe ma 1200px, a A4 landscape po marginesach ~1062px.
 */
function fitPrintedText(doc) {
    const boxes = doc.querySelectorAll('.fit-text[data-fit-max]');
    boxes.forEach((box) => {
        const span = box.querySelector('span');
        const cell = box.closest('td') || box.parentElement;
        if (!span || !cell) return;

        const cs = doc.defaultView.getComputedStyle(cell);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        const availW = (cell.clientWidth - padX) * 0.9;
        const availH = cell.clientHeight - padY;
        if (availW <= 0 || availH <= 0) return;

        const maxPx = parseFloat(box.getAttribute('data-fit-max')) || 16;
        const minPx = 8;
        let size = maxPx;
        const apply = () => {
            span.style.fontSize = size + 'px';
        };
        apply();
        for (let i = 0; i < 16; i++) {
            const textW = span.getBoundingClientRect().width;
            const textH = span.getBoundingClientRect().height;
            if (textW <= availW && textH <= availH) break;
            const ratio = Math.min(availW / Math.max(textW, 1), availH / Math.max(textH, 1));
            const next = Math.max(minPx, Math.floor(size * ratio * 0.97));
            if (next >= size) break;
            size = next;
            apply();
        }
    });
}

/** Print HTML silently using a hidden iframe */
function silentPrint(htmlString) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:1200px;height:1200px;border:0;opacity:0;z-index:-9999;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlString);
    doc.close();

    iframe.onload = () => {
        setTimeout(() => {
            try {
                fitPrintedText(doc);
            } catch (err) {
                if (typeof logger !== 'undefined')
                    logger.error('formatters', 'fitPrintedText:', err);
            }
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 60000);
        }, 500);
    };
}

/** Mapuje wewnętrzną wartość parametru na czytelną etykietę */
function paramLabel(val) {
    const map = {
        tak: 'Tak',
        nie: 'Nie',
        linia_dolna: 'Linia dolna',
        linia_gorna: 'Linia górna',
        w_osi: 'W osi',
        patrz_uwagi: 'Patrz uwagi',
        brak: 'Brak',
        beton: 'Beton',
        beton_gfk: 'Beton z GFK',
        klinkier: 'Klinkier',
        preco: 'Preco',
        precotop: 'PrecoTop',
        unolith: 'UnoLith',
        predl: 'Predl',
        kamionka: 'Kamionka',
        zelbet: 'Żelbet',
        drabinka_a_stalowa: 'Drabinka Typ A/stalowa',
        drabinka_a_szlachetna: 'Drabinka Typ A/stal szlachetna',
        drabinka_b_stalowa: 'Drabinka Typ B/stalowa',
        drabinka_b_szlachetna: 'Drabinka Typ B/stal szlachetna',
        inne: 'Inne',
        '1/2': '1/2',
        '2/3': '2/3',
        '3/4': '3/4',
        '1/1': '1/1'
    };
    return map[val] || val || '';
}

/**
 * Nadaje displayIndex przejściom na podstawie kątów (ruch wskazówek zegara).
 * Przejścia na tym samym kącie dostają ten sam numer. Kąt 0° = indeks 0.
 */
function ensureDisplayIndices(przejscia) {
    if (!przejscia || przejscia.length === 0) return;

    const sorted = [...przejscia].sort((a, b) => {
        return (parseFloat(a.angle) || 0) - (parseFloat(b.angle) || 0);
    });

    sorted.forEach((p, idx) => {
        p.displayIndex = idx;
    });
}

/** Podmienia {{PRINT_TOKENS}} w wycinkach <head> (batch print), które nie przechodzą przez renderTemplate. */
function applyPrintTokens(html) {
    return html.replaceAll('{{PRINT_TOKENS}}', PRINT_TOKENS_CSS);
}

window.PRINT_TOKENS_CSS = PRINT_TOKENS_CSS;
window.applyPrintTokens = applyPrintTokens;
window.fmt = fmt;
window.fmtInt = fmtInt;
window.roundMoney = roundMoney;

/* ===== Rejestracja globali ===== */
window.formatDate = formatDate;
window.renderTemplate = renderTemplate;
window.silentPrint = silentPrint;
window.fitPrintedText = fitPrintedText;
window.paramLabel = paramLabel;
window.ensureDisplayIndices = ensureDisplayIndices;
