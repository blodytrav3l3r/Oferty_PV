class SearchCache {
    private cache: Map<string, { data: unknown; timestamp: number }>;
    private maxSize: number;
    private ttl: number;

    constructor(maxSize = 100, ttl = 30000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    private makeKey(userId: string, params: Record<string, unknown>): string {
        return userId + '|' + JSON.stringify(params);
    }

    get(userId: string, params: Record<string, unknown>): unknown | null {
        const key = this.makeKey(userId, params);
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        // LRU: przenieś na koniec
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }

    set(userId: string, params: Record<string, unknown>, data: unknown): void {
        const key = this.makeKey(userId, params);

        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }

        this.cache.set(key, { data, timestamp: Date.now() });
    }

    invalidateUser(userId: string): void {
        const prefix = userId + '|';
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    invalidateAll(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

export const searchCache = new SearchCache(100, 30000);
