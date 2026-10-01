/**
 * P1-S — bezpieczna nazwa pliku .sokml z wersji modelu.
 *
 * model.version w schemacie to z.string().min(1) — bez charsetu. Wersja
 * trafiała 1:1 do Content-Disposition, więc granica defensywna jest TUTAJ
 * (przy generowaniu nagłówka), nie w modelu danych. Dozwolone: ASCII
 * alfanumeryczne + . _ - (bezpieczne w nagłówkach HTTP i systemach plików).
 */
const FILENAME_SAFE = 'sok-ai-ml-';
const FILENAME_MAX_VERSION = 64;

export function sokmlFilename(modelVersion: string): string {
    const safe = String(modelVersion ?? '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_.-]+|[_.-]+$/g, '')
        .slice(0, FILENAME_MAX_VERSION);
    return `${FILENAME_SAFE}${safe || 'model'}.sokml`;
}
