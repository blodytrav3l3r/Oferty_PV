/**
 * M: metryki in-process (bez Prometheusa na początek).
 * - request duration per endpoint (ring buffer 512, p50/p95 na odczyt)
 * - DB query count + czas (zasilane z prisma $on query)
 * - SQLITE_BUSY counter (z errorHandler)
 * - event-loop lag (sampler 1 s), RSS
 * - metryki PDF doklejane w snapshocie (pdfEngine.getPdfMetrics)
 * Bounded: max 300 kluczy endpointów, ring 512 na klucz.
 */

const RING = 512;
const MAX_KEYS = 300;

interface EndpointStats {
    samples: number[];
    count: number;
    errors: number;
    lastMs: number;
}

const endpoints = new Map<string, EndpointStats>();

let dbQueries = 0;
let dbMsTotal = 0;
let busyCount = 0;
let loopLagMs = 0;
let loopLagMax = 0;
let samplerStarted = false;

function pct(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

/** Normalizacja ścieżki: UUID/liczby/ID Mongo-ish → :id (kardynalność). */
export function normalizePath(p: string): string {
    return p
        .split('?')[0]
        .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F-]{4,}/g, '/:id')
        .replace(/\/\d+([/?]|$)/g, '/:id$1')
        .replace(/\/[^/]{20,}$/, '/:id');
}

const SKIP_PREFIXES = ['/health', '/metrics', '/api/docs', '/favicon'];

export function shouldSkip(path: string): boolean {
    if (
        SKIP_PREFIXES.some(
            (s) => path === s || path.startsWith(s + '/') || path.startsWith(s + '?')
        )
    )
        return true;
    return /\.(js|css|html|svg|png|ico|map|woff2?)($|\?)/.test(path);
}

function startSampler() {
    if (samplerStarted) return;
    samplerStarted = true;
    let last = Date.now();
    const timer = setInterval(() => {
        const now = Date.now();
        const lag = now - last - 1000;
        last = now;
        if (lag > 0) {
            loopLagMs = lag;
            if (lag > loopLagMax) loopLagMax = lag;
        }
    }, 1000);
    // Timer metryk nie trzyma procesu przy życiu.
    timer.unref?.();
}

export function recordRequest(method: string, path: string, status: number, ms: number): void {
    startSampler();
    if (shouldSkip(path)) return;
    const key = `${method} ${normalizePath(path)}`;
    let st = endpoints.get(key);
    if (!st) {
        if (endpoints.size >= MAX_KEYS) return;
        st = { samples: [], count: 0, errors: 0, lastMs: 0 };
        endpoints.set(key, st);
    }
    st.samples.push(ms);
    if (st.samples.length > RING) st.samples.shift();
    st.count++;
    if (status >= 500) st.errors++;
    st.lastMs = ms;
}

export function recordDbQuery(ms: number): void {
    dbQueries++;
    dbMsTotal += ms;
}

/** Wołane z errorHandler przy błędach DB typu locked/busy. */
export function recordDbBusy(): void {
    busyCount++;
}

export interface MetricsSnapshot {
    uptimeSec: number;
    rssMB: number;
    loopLagMs: number;
    loopLagMaxMs: number;
    db: { queries: number; msTotal: number; avgMs: number; busy: number };
    endpoints: Record<
        string,
        { n: number; p50: number; p95: number; errors: number; lastMs: number }
    >;
    pdf: Record<string, unknown>;
}

export function getMetricsSnapshot(pdf: Record<string, unknown> = {}): MetricsSnapshot {
    const eps: MetricsSnapshot['endpoints'] = {};
    for (const [key, st] of endpoints) {
        const sorted = [...st.samples].sort((a, b) => a - b);
        eps[key] = {
            n: st.count,
            p50: +pct(sorted, 50).toFixed(1),
            p95: +pct(sorted, 95).toFixed(1),
            errors: st.errors,
            lastMs: +st.lastMs.toFixed(1)
        };
    }
    return {
        uptimeSec: Math.round(process.uptime()),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        loopLagMs: loopLagMs,
        loopLagMaxMs: loopLagMax,
        db: {
            queries: dbQueries,
            msTotal: Math.round(dbMsTotal),
            avgMs: dbQueries > 0 ? +(dbMsTotal / dbQueries).toFixed(2) : 0,
            busy: busyCount
        },
        endpoints: eps,
        pdf
    };
}

/** Reset do testów. */
export function resetMetrics(): void {
    endpoints.clear();
    dbQueries = 0;
    dbMsTotal = 0;
    busyCount = 0;
    loopLagMs = 0;
    loopLagMax = 0;
}
