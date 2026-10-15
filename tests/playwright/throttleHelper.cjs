'use strict';

/**
 * Throttle-x4 helper (F2 baseline): CPU 4x slowdown przez CDP + --disable-gpu.
 * Sterowanie: THROTTLE_X4=1 wlacza, brak = zachowanie bazowe (zero zmian).
 * CHROME_PATH z env, fallback do wbudowanego headless-shell w harnessach.
 */

const THROTTLE_RATE = 4;

function isThrottleX4() {
    return process.env.THROTTLE_X4 === '1';
}

function resolveChromePath(fallback) {
    return process.env.CHROME_PATH || fallback;
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
    getLaunchArgs,
    resolveOutPath,
    applyThrottle
};
