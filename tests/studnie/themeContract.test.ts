// @ts-nocheck -- skan tekstu, celowy brak typow
/* ===== THEME CONTRACT (Faza 3) =====
 * Parzystość frontend-valid === backend-valid oraz warianty logo.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const THEME_JS = fs.readFileSync(path.join(ROOT, 'public/js/shared/theme.js'), 'utf8');
const SCHEMAS_TS = fs.readFileSync(path.join(ROOT, 'src/validators/offerSchemas.ts'), 'utf8');
const LOGO_DARK = fs.readFileSync(path.join(ROOT, 'public/images/logo-sok.svg'), 'utf8');
const LOGO_LIGHT = fs.readFileSync(path.join(ROOT, 'public/images/logo-sok-light.svg'), 'utf8');

function frontendValid() {
    const out = new Set();
    const re = /v === '([a-z]+)'/g;
    let m;
    while ((m = re.exec(THEME_JS)) !== null) out.add(m[1]);
    return [...out].sort();
}

function backendValid() {
    const m = SCHEMAS_TS.match(/value:\s*z\.enum\(\[([^\]]+)\]\)/);
    if (!m) return [];
    return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
}

describe('theme kontrakt frontend === backend', () => {
    test('frontend _sokThemeValid akceptuje dokladnie light/dark', () => {
        expect(frontendValid()).toEqual(['dark', 'light']);
    });

    test('backend userPreferenceSchema akceptuje dokladnie light/dark', () => {
        expect(backendValid()).toEqual(['dark', 'light']);
    });

    test('parzystość: frontend-valid === backend-valid', () => {
        expect(frontendValid()).toEqual(backendValid());
    });
});

describe('theme logo dark/light', () => {
    test('oba warianty istnieja i roznia sie', () => {
        expect(LOGO_DARK.length).toBeGreaterThan(0);
        expect(LOGO_LIGHT.length).toBeGreaterThan(0);
        expect(LOGO_LIGHT).not.toBe(LOGO_DARK);
    });

    test('naglowek: bialy w dark, ciemny w light', () => {
        expect(LOGO_DARK).toContain('fill: #ffffff');
        expect(LOGO_LIGHT).toContain('fill: #0f172a');
    });

    test('kontener: ciemny w dark, jasny w light', () => {
        expect(LOGO_DARK).toContain('fill="#111827"');
        expect(LOGO_LIGHT).toContain('fill="#eaeef2"');
    });
});
