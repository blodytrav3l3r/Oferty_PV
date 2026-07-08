/**
 * Prosty cache plikow z TTL (Faza 9 - wydajność).
 *
 * Eliminuje problem powtarzających się fs.readFileSync() na każdym
 * żądaniu PDF. Pliki szablonów/obrazów są ładowane raz i trzymane w pamięci.
 *
 * Cache jest invalidate'owany co TTL ms (default 5 minut na produkcji)
 * albo ręcznie przez `invalidate()` (np. przy hot replace w dev).
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class SimpleCache<T> {
    private store = new Map<string, CacheEntry<T>>();
    private ttlMs: number;

    constructor(ttlMs = 5 * 60 * 1000) {
        this.ttlMs = ttlMs;
    }

    get(key: string, loader: () => T): T {
        const entry = this.store.get(key);
        const now = Date.now();
        if (entry && entry.expiresAt > now) {
            return entry.value;
        }
        if (entry) {
            this.store.delete(key);
        }
        const value = loader();
        this.store.set(key, {
            value,
            expiresAt: now + this.ttlMs
        });
        return value;
    }

    invalidate(key?: string): void {
        if (key) {
            this.store.delete(key);
        } else {
            this.store.clear();
        }
    }

    size(): number {
        return this.store.size;
    }
}

/**
 * Cache dla plikow tekstowych (szablony HTML).
 */
export const textFileCache = new SimpleCache<string>(10 * 60 * 1000);

/**
 * Cache dla plikow binarnych (obrazy PNG/JPG).
 */
export const binaryFileCache = new SimpleCache<Buffer>(10 * 60 * 1000);
