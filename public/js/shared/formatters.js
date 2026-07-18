// @ts-check
/**
 * Shared Formatters — wspólne formatowanie liczb.
 * Eliminuje duplikat fmt/fmtInt z app.js i app_studnie.js.
 */

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

/** Escape for HTML body content */
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/** Prosta interpolacja szablonu: zastępuje {{KEY}} wartościami z dataObj */
function renderTemplate(template, dataObj) {
    return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
        return dataObj[key] !== undefined ? dataObj[key] : '';
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
