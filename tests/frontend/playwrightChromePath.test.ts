import fs from 'fs';
import path from 'path';

/**
 * Guard: harnessy Playwright nie mogą zależeć od przeglądarki konkretnego
 * użytkownika. Na runnerze Linux twarda ścieżka `C:\Users\...` wywalała
 * benchmark (nightly `test:bench`), mimo `npx playwright install chromium`.
 *
 * Zasady:
 *  - zero ścieżek `C:\Users\...` w tests/playwright,
 *  - `executablePath` tylko jako jawny override (`CHROME_PATH`), nigdy na stałe,
 *  - helper: brak env → undefined, env na nieistniejący plik → throw.
 */

const ROOT = path.join(__dirname, '..', '..');
const PW_DIR = path.join(ROOT, 'tests', 'playwright');
const HELPER = path.join(PW_DIR, 'throttleHelper.cjs');

const scripts = fs
    .readdirSync(PW_DIR)
    .filter((name) => name.endsWith('.cjs'))
    .map((name) => ({ name, src: fs.readFileSync(path.join(PW_DIR, name), 'utf-8') }));

/** Absolutna ścieżka Windows do katalogu użytkownika — w dowolnej pisowni. */
const USER_HOME_RE = /[A-Za-z]:[\\/]{1,2}Users[\\/]/i;
/** Absolutna ścieżka Windows do pliku .exe (np. przeglądarki) — w dowolnej pisowni. */
const DRIVE_EXE_RE = /[A-Za-z]:[\\/]{1,2}[^'"\r\n]*\.exe/i;

function hasHardcodedWindowPath(src: string): boolean {
    return USER_HOME_RE.test(src) || DRIVE_EXE_RE.test(src);
}

describe('harnessy Playwright: brak zależności od lokalnej ścieżki przeglądarki', () => {
    it('detektor łapie warianty zapisu ścieżki Windows, nie tylko jeden', () => {
        const offenders = [
            'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\x\\chrome.exe',
            'C:/Users/blody/AppData/Local/ms-playwright/x/chrome.exe',
            'c:/users/blody/chrome.exe',
            'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:/Program Files/Google/Chrome/Application/chrome.exe'
        ];
        const clean = [
            'const CHROME_PATH = resolveChromePath();',
            'docs/plans/p16-baseline.json',
            'chromeLaunchOptions({ headless: true })',
            'npx playwright install chromium'
        ];
        expect(offenders.filter(hasHardcodedWindowPath)).toEqual(offenders);
        expect(clean.filter(hasHardcodedWindowPath)).toEqual([]);
    });

    it('tests/playwright nie zawiera ścieżek profilu użytkownika ani .exe na dysku', () => {
        const offenders = scripts.filter((f) => hasHardcodedWindowPath(f.src)).map((f) => f.name);
        expect(offenders).toEqual([]);
    });

    it('executablePath nigdy nie jest ustawiany bezwarunkowo', () => {
        const offenders = scripts
            .filter((f) => f.src.includes('executablePath'))
            .filter(
                (f) =>
                    // dawny wzorzec: `executablePath: CHROME_PATH,` prosto w launch options
                    /executablePath:\s*CHROME_PATH\s*,/.test(f.src) ||
                    !/if \(CHROME_PATH\)|chromeLaunchOptions\(|CHROME_PATH \? \{ executablePath/.test(
                        f.src
                    )
            )
            .map((f) => f.name);
        expect(offenders).toEqual([]);
    });

    describe('throttleHelper.resolveChromePath', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- helper jest CJS (.cjs), nie ESM
        const helper = require(HELPER);
        const original = process.env.CHROME_PATH;

        afterEach(() => {
            if (original === undefined) delete process.env.CHROME_PATH;
            else process.env.CHROME_PATH = original;
        });

        it('brak CHROME_PATH → undefined (Playwright wybiera własną przeglądarkę)', () => {
            delete process.env.CHROME_PATH;
            expect(helper.resolveChromePath()).toBeUndefined();
            expect(helper.chromeLaunchOptions({ headless: true })).toEqual({ headless: true });
        });

        it('CHROME_PATH na istniejący plik → override w launch options', () => {
            process.env.CHROME_PATH = __filename;
            expect(helper.resolveChromePath()).toBe(__filename);
            expect(helper.chromeLaunchOptions({ headless: true })).toEqual({
                headless: true,
                executablePath: __filename
            });
        });

        it('CHROME_PATH na nieistniejący plik → błąd konfiguracji (nie cichy fallback)', () => {
            process.env.CHROME_PATH = path.join(ROOT, 'nie-ma-takiej-przegladarki.exe');
            expect(() => helper.resolveChromePath()).toThrow(/nieistniejacy plik/i);
        });
    });
});
