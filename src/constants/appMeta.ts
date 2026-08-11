/**
 * Metadane aplikacji — pojedyncze źródło prawdy nazwy systemu.
 *
 * Nazwa jest konfigurowalna przez zmienne środowiskowe (APP_NAME, APP_SUBTITLE),
 * dzięki czemu aplikacja jest niezależna od nazwy (S.O.K., WITROS itd.).
 */
export const APP_NAME = (process.env.APP_NAME ?? 'S.O.K.').trim() || 'S.O.K.';
export const APP_SUBTITLE =
    (process.env.APP_SUBTITLE ?? 'System Ofert i Kalkulacji').trim() || 'System Ofert i Kalkulacji';
