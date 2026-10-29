'use strict';

/**
 * Throttle-x4 helper (F2 baseline): CPU 4x slowdown przez CDP + --disable-gpu.
 * Sterowanie: THROTTLE_X4=1 wlacza, brak = zachowanie bazowe (zero zmian).
 * CHROME_PATH z env = jawny override; brak zmiennej = przegladarka Playwrighta
 * (w CI instaluje ja `npx playwright install`). Zadnych sciezek uzytkownika.
 */

const fs = require('fs');

const THROTTLE_RATE = 4;

function isThrottleX4() {
    return process.env.THROTTLE_X4 === '1';
}

/**
 * Sciezka przegladarki do launchu.
 * - brak `CHROME_PATH` → `undefined` (Playwright uzyje wlasnej instalacji),
 * - `CHROME_PATH` na nieistniejacy plik → throw (blad konfiguracji, nie cichy fallback).
 * @returns {string|undefined}
 */
function resolveChromePath() {
    const explicit = process.env.CHROME_PATH;
    if (!explicit) return undefined;
    if (!fs.existsSync(explicit)) {
        throw new Error('CHROME_PATH wskazuje nieistniejacy plik: ' + explicit);
    }
    return explicit;
}

/** Opcje launchu: `executablePath` tylko gdy override istnieje. */
function chromeLaunchOptions(baseOptions) {
    const options = { ...(baseOptions || {}) };
    const explicit = resolveChromePath();
    if (explicit) options.executablePath = explicit;
    return options;
}

function getLaunchArgs(baseArgs) {
    const base = Array.isArray(baseArgs) ? [...baseArgs] : [];
    if (isThrottleX4() && !base.includes('--disable-gpu')) base.push('--disable-gpu');
    return base;
}

function resolveOutPath(defaultOut, throttleOut) {
    if (!isThrottleX4()) return defaultOut;
    if (throttleOut) return throttleOut;
    return String(defaultOut).replace(/\.json$/i, '-throttle-x4.json');
}

async function applyThrottle(page) {
    if (!isThrottleX4()) return;
    try {
        const session = await page.context().newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE_RATE });
    } catch (_) {
        // best-effort: brak CDP (np. nie-Chromium) nie blokuje pomiaru
    }
}

module.exports = {
    THROTTLE_RATE,
    isThrottleX4,
    resolveChromePath,
    chromeLaunchOptions,
    getLaunchArgs,
    resolveOutPath,
    applyThrottle
};
