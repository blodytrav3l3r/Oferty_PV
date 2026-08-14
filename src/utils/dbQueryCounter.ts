/**
 * Licznik zapytań DB per request (dev-only, Faza 5.2).
 *
 * AsyncLocalStorage propaguje kontekst requestu przez asynchroniczne wywołania,
 * dzięki czemu hook `prisma.$on('query')` inkrementuje licznik bieżącego requestu.
 */
import { AsyncLocalStorage } from 'async_hooks';

export const dbCounterStore = new AsyncLocalStorage<{ count: number }>();

export function runWithDbCounter<T>(fn: () => T): T {
    return dbCounterStore.run({ count: 0 }, fn);
}

export function countDbQuery(): void {
    const store = dbCounterStore.getStore();
    if (store) store.count++;
}

export function getDbCount(): number {
    const store = dbCounterStore.getStore();
    return store ? store.count : -1;
}
