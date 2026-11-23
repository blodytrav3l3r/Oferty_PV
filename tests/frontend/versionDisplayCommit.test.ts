import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'public/js/versionDisplay.js'), 'utf8');

describe('hash commita w nagłówku aplikacji', () => {
    test('pobiera hash dla każdej zalogowanej roli, nie tylko admina', () => {
        expect(source).toMatch(
            /ready && ready\.role\s*\?\s*fetch\(['"]\/api\/version\/commit['"]\)/
        );
        expect(source).not.toMatch(/ready\.role\s*===\s*['"]admin['"]/);
    });

    test('wyświetla wyłącznie poprawny skrócony hash zwrócony przez endpoint', () => {
        expect(source).toMatch(/commitInfo\.commitHash/);
        expect(source).toMatch(/\^\[0-9a-f\]\{12\}\$/i);
        expect(source).toMatch(/commitHash\.slice\(0, 12\)/);
    });
});
