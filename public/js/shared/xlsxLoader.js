// @ts-check
/**
 * Lazy-loader biblioteki SheetJS (xlsx.full.min.js, ~1.5 MB).
 * Ładowana tylko przy pierwszej operacji importu/eksportu XLSX,
 * zamiast przy starcie modułu — oszczędza ~1.5 MB parsowania JS
 * na każde otwarcie studnie.html / rury.html / kartoteka.html.
 */
let _xlsxPromise = null;

/**
 * Gwarantuje załadowanie globalnego obiektu XLSX.
 * Zwraca Promise — idempotentny, może być wołany współbieżnie.
 * @returns {Promise<any>}
 */
function ensureXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!_xlsxPromise) {
        _xlsxPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'vendor/xlsx.full.min.js';
            script.onload = () => resolve(window.XLSX);
            script.onerror = () => {
                _xlsxPromise = null;
                reject(new Error('Nie udało się załadować biblioteki XLSX'));
            };
            document.head.appendChild(script);
        });
    }
    return _xlsxPromise;
}

window.ensureXlsx = ensureXlsx;
