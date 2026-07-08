/**
 * Singleton manager dla Puppeteer (Faza 9 - wydajność).
 *
 * Utrzymuje jedną instancję headless Chromium w pamięci, zamiast
 * uruchamiać nową instancję dla każdego żądania PDF (~200-500ms narzutu
 * na każde `puppeteer.launch()`).
 */

import puppeteer, { Browser } from 'puppeteer';

let cachedBrowser: Browser | null = null;
let launchingPromise: Promise<Browser> | null = null;
let lastUsedTimestamp = 0;

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minut bezczynnosci -> zamknij
const MAX_RETRIES = 3;

/**
 * Zwraca instancję przeglądarki. Leniwie inicjalizuje przy pierwszym użyciu,
 * współdzielona między wszystkimi żądaniami.
 *
 * Po IDLE_TIMEOUT_MS bezczynności przeglądarka zostanie zamknięta.
 * Jeśli tymczasem będzie potrzebna - zostanie ponownie uruchomiona.
 */
export async function getSharedBrowser(): Promise<Browser> {
    // Jeśli mamy cache i ostatnio użyty był blisko - zwracamy
    if (cachedBrowser && cachedBrowser.connected) {
        lastUsedTimestamp = Date.now();
        return cachedBrowser;
    }

    // Jeśli ktoś już launchuje, czekamy na niego
    if (launchingPromise) {
        lastUsedTimestamp = Date.now();
        return launchingPromise;
    }

    // Rozpocznij launch (with retries)
    launchingPromise = launchWithRetry();

    try {
        cachedBrowser = await launchingPromise;
        lastUsedTimestamp = Date.now();

        // Zamknij automatycznie gdy długo nie używana
        cachedBrowser.on('disconnected', () => {
            cachedBrowser = null;
        });

        return cachedBrowser;
    } finally {
        launchingPromise = null;
    }
}

async function launchWithRetry(): Promise<Browser> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--no-zygote'
                ]
            });
            return browser;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < MAX_RETRIES) {
                // Czekaj przed ponowną próbą (linear backoff)
                await new Promise((resolve) => setTimeout(resolve, attempt * 500));
            }
        }
    }
    throw lastError || new Error('Puppeteer launch failed');
}

/**
 * Wymusza zamknięcie współdzielonej przeglądarki.
 * Użyteczne przy graceful shutdown lub po błędzie krytycznym.
 */
export async function closeSharedBrowser(): Promise<void> {
    if (cachedBrowser && cachedBrowser.connected) {
        try {
            await cachedBrowser.close();
        } catch (err) {
            // Logujemy ale nie rzucamy - close mógł się nie udać w trakcie crash
            // browser nie jest krytyczny dla działania aplikacji
            // eslint-disable-next-line no-console
            console.warn('[pdf-bow] closeSharedBrowser: ', err);
        }
    }
    cachedBrowser = null;
    launchingPromise = null;
}

/**
 * Czyści przeglądarkę po długim okresie bezczynności.
 * Wywoływane przez cron lub na początku requestu (lazy GC).
 *
 * Gdy ostatni użytek > IDLE_TIMEOUT_MS temu, zamyka.
 */
export function closeIdleBrowserIfNeeded(): void {
    if (!cachedBrowser || !cachedBrowser.connected) {
        cachedBrowser = null;
        return;
    }
    const idleMs = Date.now() - lastUsedTimestamp;
    if (idleMs > IDLE_TIMEOUT_MS) {
        // Fire-and-forget - nie blokuj
        void closeSharedBrowser();
    }
}

/**
 * Diagnostyka - dla endpointu /api/_health (opcjonalnie).
 */
export function getBrowserStatus(): {
    connected: boolean;
    idleMs: number | null;
} {
    if (!cachedBrowser) {
        return { connected: false, idleMs: null };
    }
    return {
        connected: cachedBrowser.connected,
        idleMs: Date.now() - lastUsedTimestamp
    };
}
