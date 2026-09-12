/**
 * F0 fixture: deterministyczne 1200 studni do benchmarku open Excela.
 * Ten sam seed = te same dane = porównywalny benchmark (plan 2026-09-12).
 * Użycie: bench Playwright (wstrzyknięcie jako wells) + test Jest (rozkład).
 *
 * Pokryte gałęzie: DN×6, magazyny KLB/Włoc, config pełny/minimalny,
 * przejścia 0..3, duplikaty nazw, configStatus ERROR/WARNING/OK.
 * PZ-lock NIE jest wymuszany danymi (zależy od produkcji) — pokrywa go
 * tests/studnie/excelWellLock.test.ts.
 */
'use strict';

const PERF_FIXTURE_SEED = 20260912;
const PERF_FIXTURE_TOTAL = 1200;

// Rozkład DN: suma 1200. 'styczna' mapuje na zakładkę 'styczne'.
const PERF_FIXTURE_DN_PLAN = [
    ['1000', 300],
    ['1200', 250],
    ['1500', 200],
    ['2000', 150],
    ['2500', 100],
    ['styczna', 200]
];

/* Seeded RNG mulberry32 — determinizm bez zależności. */
function _perfRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function _perfPick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function buildPerfWells(seed) {
    const rng = _perfRng(seed === undefined ? PERF_FIXTURE_SEED : seed);
    const wells = [];
    let idx = 0;
    for (const [dn, count] of PERF_FIXTURE_DN_PLAN) {
        for (let k = 0; k < count; k++) {
            const i = idx++;
            // Co 10. studnia dzieli nazwę — gałąź duplikatów w tbody.
            const dup = i % 10 === 0;
            const name = dup
                ? 'Powtarzalna-' + (i % 50)
                : 'Perf-' + dn + '-' + String(i).padStart(4, '0');
            // Config: co 3. minimalny (pusty), reszta pełny.
            const minimal = i % 3 === 0;
            const config = minimal
                ? []
                : [
                      { productId: 'perf-krag-' + dn, quantity: 2, autoAdded: false },
                      { productId: 'perf-dennica-' + dn, quantity: 1, autoAdded: false }
                  ];
            // Przejścia 0..3.
            const trCount = Math.floor(rng() * 4);
            const przejscia = [];
            for (let t = 0; t < trCount; t++) {
                przejscia.push({
                    id: 'perf-prz-' + i + '-' + t,
                    productId: '',
                    rzednaWlaczenia: Math.round((0.2 + rng() * 1.5) * 1000) / 1000,
                    angle: Math.floor(rng() * 90),
                    flowType: 'WYLOT',
                    angleExecution: 0,
                    angleGony: '0.00',
                    displayIndex: t
                });
            }
            // Status: co 20. ERROR, co 20.+1 WARNING, reszta OK.
            const mod = i % 20;
            const configStatus = mod === 0 ? 'ERROR' : mod === 1 ? 'WARNING' : 'OK';
            wells.push({
                id: 'perf-well-' + String(i).padStart(4, '0'),
                name: name,
                numer: name,
                dn: dn,
                rzednaWlazu: Math.round((1.5 + rng() * 2) * 100) / 100,
                rzednaDna: Math.round(rng() * 100) / 100,
                przejscia: przejscia,
                config: config,
                configStatus: configStatus,
                configErrors: configStatus === 'OK' ? [] : ['Błąd fixture ' + configStatus],
                autoSelect: i % 2 === 0,
                configSource: i % 2 === 0 ? 'AUTO_JS' : 'MANUAL',
                kineta: _perfPick(rng, ['brak', 'beton', 'preco']),
                psiaBuda: rng() < 0.1,
                magazyn: i % 2 === 0 ? 'Kluczbork' : 'Włocławek',
                redukcjaDN1000: false
            });
        }
    }
    return wells;
}

module.exports = { buildPerfWells, PERF_FIXTURE_SEED, PERF_FIXTURE_TOTAL, PERF_FIXTURE_DN_PLAN };
