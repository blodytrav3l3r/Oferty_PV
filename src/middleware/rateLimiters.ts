import { createRateLimiter } from './rateLimiter';

/**
 * Predefiniowane rate limitery współdzielone między routes.
 *
 * Zasady:
 *  - WRITE_LIMITER (60/min): ogólne operacje zapisu (orders, clients, offers CRUD)
 *  - PRICELIST_WRITE_LIMITER (30/min): zapis cenników (mniej ruchu, ale większe pliki)
 *  - EXPORT_LIMITER (20/min): eksporty PDF/DOCX (puppeteer — kosztowne)
 *  - LOGIN_LIMITER (10/min): próby logowania (anti-bruteforce)
 *  - ADMIN_USERS_LIMITER (30/min): operacje na userach
 *  - PRECO_PRICING_LIMITER (20/min): operacje na cennikach preco
 *
 * Każdy limiter ma własny `Map<ip, ...>`, więc są niezależne.
 */

const DEFAULT_MSG = 'Zbyt wiele operacji. Odczekaj minutę.';

export const WRITE_LIMITER = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: DEFAULT_MSG
});

/**
 * Rate limiter dla odczytów telemetry (dashboard, historia).
 * Wyższe limity bo używany intensywnie przy pollingu.
 */
export const READ_LIMITER = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 600,
    message: 'Zbyt wiele odczytów. Odczekaj chwilę.'
});

export const PRICELIST_WRITE_LIMITER = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 30,
    message: 'Zbyt wiele operacji na cennikach. Odczekaj minutę.'
});

export const EXPORT_LIMITER = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 20,
    message: 'Zbyt wiele eksportów. Odczekaj minutę.'
});

export const LOGIN_LIMITER = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 10,
    message: 'Zbyt wiele prób logowania. Odczekaj minutę.'
});

export const ADMIN_USERS_LIMITER = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 30,
    message: 'Zbyt wiele operacji na użytkownikach. Odczekaj minutę.'
});

export const PRECO_PRICING_LIMITER = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 20,
    message: 'Zbyt wiele operacji na cennikach. Odczekaj minutę.'
});
