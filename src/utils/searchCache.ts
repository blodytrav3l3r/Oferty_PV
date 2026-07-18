export class SearchCache {
    private cache: Map<string, { data: unknown; timestamp: number }>;
    private maxSize: number;
    private ttl: number;

    constructor(maxSize = 100, ttl = 30000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    private _makeKey(namespace: string, params: Record<string, unknown>): string {
        return namespace + '|' + JSON.stringify(params);
    }

    get(namespace: string, params: Record<string, unknown>): unknown | null {
        const key = this._makeKey(namespace, params);
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }

    set(namespace: string, params: Record<string, unknown>, data: unknown): void {
        const key = this._makeKey(namespace, params);
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    invalidateNamespace(namespace: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(namespace + '|')) {
                this.cache.delete(key);
            }
        }
    }

    invalidateAll(): void {
        this.cache.clear();
    }
}

export const searchCache = new SearchCache(100, 30000);
