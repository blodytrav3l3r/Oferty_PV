/**
 * @jest-environment jsdom
 */
// @ts-nocheck -- runtime theme.js w jsdom, celowy brak typow
/* Wymagany jsdom: backend odpalenia testow frontend (quirk backslash
 * w testPathIgnorePatterns) uzywa srodowiska z naglowka pliku. */
/* ===== THEME SYNC (Faza 3) =====
 * Zachowanie obserwowalne theme.js: przelaczanie bez reloadu, debounce PUT
 * (kontrakt: dark->light->dark->light = 1 PUT, value light), guard generacji
 * (spozniona odpowiedz nie kasuje wyboru), storage i origin guard.
 * Bez asercji implementacji debounce — tylko obserwowalny efekt.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const THEME_JS = fs.readFileSync(path.join(ROOT, 'public/js/shared/theme.js'), 'utf8');

function loadThemeOnce() {
    if (!window.sokTheme) window.eval(THEME_JS);
    return window.sokTheme;
}

describe('themeSync zachowanie obserwowalne', () => {
    let fetchMock;
    let sokTheme;

    beforeAll(() => {
        sokTheme = loadThemeOnce();
    });

    beforeEach(() => {
        jest.useFakeTimers();
        fetchMock = jest.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve({ preferences: {} }) })
        );
        window.fetch = fetchMock;
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        fetchMock.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('toggle przelacza data-theme bez reloadu (ten sam dokument)', () => {
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
        sokTheme.set('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        sokTheme.toggle();
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
        expect(sokTheme.get()).toBe('dark');
    });

    test('dark->light->dark->light = dokladnie 1 PUT z value light', async () => {
        sokTheme.set('dark');
        sokTheme.set('light');
        sokTheme.set('dark');
        sokTheme.set('light');
        expect(fetchMock).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(400);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/users/me/preferences');
        expect(opts.method).toBe('PUT');
        expect(JSON.parse(opts.body)).toEqual({ key: 'theme', value: 'light' });
    });

    test('spozniona odpowiedz serwera nie kasuje nowszego wyboru (S-07)', async () => {
        let resolveInit;
        fetchMock.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveInit = resolve;
                })
        );
        sokTheme.init();
        sokTheme.set('light');
        expect(sokTheme.get()).toBe('light');
        resolveInit({ ok: true, json: () => Promise.resolve({ preferences: { theme: 'dark' } }) });
        await jest.advanceTimersByTimeAsync(0);
        expect(sokTheme.get()).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('storage event z obcej karty aplikuje motyw', () => {
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
        window.dispatchEvent(new StorageEvent('storage', { key: 'sok-theme', newValue: 'light' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        window.dispatchEvent(new StorageEvent('storage', { key: 'sok-theme', newValue: 'dark' }));
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    test('message z obcego origin ignorowane, z wlasnego aplikowane (K-03)', () => {
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'sok-theme-changed', theme: 'light' },
                origin: 'https://obcy.example'
            })
        );
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'sok-theme-changed', theme: 'light' },
                origin: window.location.origin
            })
        );
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
});
