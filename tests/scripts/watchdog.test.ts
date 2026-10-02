/**
 * C1: watchdog — okno resetu + rotacja logu (logika z scripts/watchdog.mjs).
 * Zachowanie: normalny start, 1 crash, N crashów, crash loop, upływ okna.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

/* eslint-disable @typescript-eslint/no-require-imports -- moduł CJS (helper CLI) */
const { decideWindow, shouldRotate } = require('../../scripts/watchdog.cjs') as {
    decideWindow: (a: number, b: number, c: number) => string;
    shouldRotate: (a: number, b: number) => boolean;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const HELPER = path.resolve(__dirname, '../../scripts/watchdog.cjs');
const WINDOW = 3600;

function tmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
}

function cli(cmd: string, ...args: string[]): { stdout: string; code: number } {
    try {
        const out = execFileSync(process.execPath, [HELPER, cmd, ...args], {
            encoding: 'utf8'
        });
        return { stdout: String(out).trim(), code: 0 };
    } catch (e: unknown) {
        const err = e as { stdout?: unknown; status?: number };
        return { stdout: String(err.stdout ?? '').trim(), code: err.status ?? 2 };
    }
}

/** Symulacja pętli watchdoga z bat (licznik + max 5, okno przez helper). */
function simulate(
    dir: string,
    exits: number[],
    maxRestarts = 5
): { restarts: number; stopped: boolean } {
    const state = path.join(dir, 'watchdog.last');
    let count = 0;
    let stopped = false;
    for (const code of exits) {
        if (code === 0) break; // exit 0 = kontrolowane zamknięcie, brak restartu
        const r = cli('window', state, String(WINDOW));
        expect(r.code).toBe(0);
        if (r.stdout === 'RESET') count = 0;
        count += 1;
        if (count >= maxRestarts) {
            stopped = true;
            break;
        }
    }
    return { restarts: count, stopped };
}

describe('C1 watchdog window', () => {
    test('decideWindow: brak stanu → RESET; w oknie → KEEP; po oknie → RESET', () => {
        expect(decideWindow(NaN, 1000, WINDOW)).toBe('RESET');
        expect(decideWindow(900, 1000, WINDOW)).toBe('KEEP');
        expect(decideWindow(1000, 1000 + WINDOW + 1, WINDOW)).toBe('RESET');
        expect(decideWindow(1000, 1000 + WINDOW, WINDOW)).toBe('KEEP'); // granica: > nie >=
    });

    test('1. normalny start (exit 0) → brak restartu', () => {
        expect(simulate(tmp(), [0]).restarts).toBe(0);
    });

    test('2. jeden crash → restart 1, brak stopu', () => {
        const r = simulate(tmp(), [1, 0]);
        expect(r.restarts).toBe(1);
        expect(r.stopped).toBe(false);
    });

    test('3. kilka crashów w oknie → licznik rośnie, stop na max', () => {
        const r = simulate(tmp(), [1, 1, 1, 1, 1, 1, 0]);
        expect(r.restarts).toBe(5);
        expect(r.stopped).toBe(true);
    });

    test('4. crash loop (nieskończone crashe) → STOP na max, brak pętli', () => {
        const r = simulate(tmp(), new Array(50).fill(1));
        expect(r.stopped).toBe(true);
        expect(r.restarts).toBe(5);
    });

    test('5. upływ okna resetuje licznik (zdrowy okres kasuje historię)', () => {
        const dir = tmp();
        const state = path.join(dir, 'watchdog.last');
        // 4 crashe, potem przerwa > okna (stan postarzony ręcznie).
        let r = simulate(dir, [1, 1, 1, 1, 0]);
        expect(r.restarts).toBe(4);
        const old = Math.floor(Date.now() / 1000) - WINDOW - 10;
        fs.writeFileSync(state, String(old), 'utf8');
        r = simulate(dir, [1, 0]);
        expect(r.restarts).toBe(1);
        expect(r.stopped).toBe(false);
    });

    test('CLI window zapisuje stan i zwraca KEEP/RESET (exit 0)', () => {
        const dir = tmp();
        const state = path.join(dir, 'watchdog.last');
        expect(cli('window', state, String(WINDOW)).stdout).toBe('RESET');
        expect(cli('window', state, String(WINDOW)).stdout).toBe('KEEP');
    });
});

describe('C1 watchdog log rotation', () => {
    test('shouldRotate: granica bajtów (>)', () => {
        expect(shouldRotate(0, 10)).toBe(false);
        expect(shouldRotate(10, 10)).toBe(false);
        expect(shouldRotate(11, 10)).toBe(true);
        expect(shouldRotate(5, 0)).toBe(false);
    });

    test('CLI rotate: mały log nietknięty, duży → .1, ponowny → nadpisanie .1', () => {
        const dir = tmp();
        const log = path.join(dir, 'watchdog.log');
        fs.writeFileSync(log, 'x'.repeat(100), 'utf8');
        expect(cli('rotate', log, '1000').code).toBe(0);
        expect(fs.existsSync(log)).toBe(true);
        expect(fs.existsSync(log + '.1')).toBe(false);
        fs.writeFileSync(log, 'y'.repeat(1001), 'utf8');
        expect(cli('rotate', log, '1000').code).toBe(0);
        expect(fs.readFileSync(log + '.1', 'utf8')).toBe('y'.repeat(1001));
        fs.writeFileSync(log, 'z'.repeat(1001), 'utf8');
        expect(cli('rotate', log, '1000').code).toBe(0);
        expect(fs.readFileSync(log + '.1', 'utf8')).toBe('z'.repeat(1001));
    });

    test('CLI rotate: brak pliku / zły limit → exit 0, brak throw', () => {
        expect(cli('rotate', path.join(tmp(), 'nie-ma.log'), '1000').code).toBe(0);
        expect(cli('rotate', path.join(tmp(), 'x.log'), 'nie-liczba').code).toBe(0);
    });
});
