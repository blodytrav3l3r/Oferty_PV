import { execFileSync } from 'child_process';
import { join } from 'path';

/**
 * Test skryptu frontend-deps.mjs (Faza 4.0) — dependency map frontendu.
 * Skrypt jest narzędziem analitycznym czytającym realne pliki public/js —
 * test weryfikuje poprawność uruchomienia i oczekiwany kształt wyniku.
 */

describe('scripts/frontend-deps.mjs — dependency map', () => {
    const script = join(__dirname, '..', 'scripts', 'frontend-deps.mjs');

    test('uruchamia się i zwraca podsumowanie (exit 0)', () => {
        const out = execFileSync('node', [script], { encoding: 'utf8' });
        expect(out).toContain('LICZBA PLIKOW:');
        expect(out).toContain('LICZBA UNIKALNYCH GLOBALI (window.*):');
    });

    test('tryb --global znajduje definicje i użycia', () => {
        const out = execFileSync('node', [script, '--global', 'escapeHtml'], {
            encoding: 'utf8'
        });
        expect(out).toContain('GLOBAL escapeHtml');
        expect(out).toContain('DEF');
    });
});
