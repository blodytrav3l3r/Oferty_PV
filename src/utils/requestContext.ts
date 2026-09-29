import { AsyncLocalStorage } from 'async_hooks';

/**
 * P2: kontekst requestu (requestId) propagowany przez async.
 * Ten sam wzorzec co dbQueryCounter — osobny store, zero zmian sygnatur.
 * Odczyt: getRequestId() ('' poza requestem, np. cron/testy).
 */
const store = new AsyncLocalStorage<{ requestId: string }>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
    return store.run({ requestId }, fn);
}

export function getRequestId(): string {
    return store.getStore()?.requestId ?? '';
}
