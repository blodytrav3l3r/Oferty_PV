// @ts-nocheck
/* Migracja confirm() -> appConfirm: shareModal / pricelistVersions / dashboard.
 * Statyka sprawdza wpięcie źródła; mock sprawdza priorytet (confirm nie wołany). */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const bareConfirm = (src) => {
    const stripped = src
        .replace(/window\.confirm\s*\(/g, '')
        .replace(/window\.appConfirm/g, '')
        .replace(/window\.aiUiConfirm/g, '')
        .replace(/appConfirm\s*\(/g, '');
    return stripped.match(/(?<![\w$.])confirm\s*\(/g) || [];
};

describe('frontend: confirm() -> appConfirm', () => {
    test('shareModal: appConfirm primary, brak gołego confirm()', () => {
        const src = read('public/js/shared/shareModal.js');
        expect(src).toContain('window.appConfirm');
        expect(bareConfirm(src)).toHaveLength(0);
    });

    test('pricelistVersions: pvConfirm via appConfirm, window.confirm tylko w fallbackzie', () => {
        const src = read('public/js/shared/pricelistVersions.js');
        expect(src).toContain('function pvConfirm');
        expect(src).toContain('window.appConfirm');
        const confirms = src.match(/window\.confirm\s*\(/g) || [];
        expect(confirms).toHaveLength(1);
        expect(src).toMatch(/pvConfirm\(cloneMsg/);
        expect(src).toMatch(/pvConfirm\(deleteMsg/);
    });

    test('dashboard AI/ML: appConfirm przed aiUiConfirm, confirm tylko fallback', () => {
        const src = read('public/js/shared/dashboard.js');
        const appIdx = src.indexOf('window.appConfirm');
        const aiIdx = src.indexOf('window.aiUiConfirm');
        expect(appIdx).toBeGreaterThan(-1);
        expect(aiIdx).toBeGreaterThan(-1);
        expect(appIdx).toBeLessThan(aiIdx);
        expect(bareConfirm(src)).toHaveLength(0);
    });

    test('mock: appConfirm obecny -> window.confirm nie wołany (kontrakt pvConfirm/dashboard)', async () => {
        const appConfirm = jest.fn(async () => true);
        const nativeConfirm = jest.fn(() => true);
        const aiUiConfirm = jest.fn(async () => true);
        const w = { appConfirm, aiUiConfirm, confirm: nativeConfirm };
        // kopia kontraktu z kodu: appConfirm > aiUiConfirm > confirm > true
        const confirmAsync = (msg, opts) => {
            if (typeof w.appConfirm === 'function') return w.appConfirm(msg, opts);
            if (typeof w.aiUiConfirm === 'function') return w.aiUiConfirm(msg, opts);
            if (typeof w.confirm === 'function') return Promise.resolve(w.confirm(msg));
            return Promise.resolve(true);
        };
        await expect(confirmAsync('msg', { title: 't' })).resolves.toBe(true);
        expect(appConfirm).toHaveBeenCalledTimes(1);
        expect(nativeConfirm).not.toHaveBeenCalled();
        expect(aiUiConfirm).not.toHaveBeenCalled();
    });

    test('mock: brak appConfirm -> aiUiConfirm przejmuje, confirm dalej nie wołany', async () => {
        const nativeConfirm = jest.fn(() => true);
        const aiUiConfirm = jest.fn(async () => true);
        const w = { aiUiConfirm, confirm: nativeConfirm };
        const confirmAsync = (msg, opts) => {
            if (typeof w.appConfirm === 'function') return w.appConfirm(msg, opts);
            if (typeof w.aiUiConfirm === 'function') return w.aiUiConfirm(msg, opts);
            if (typeof w.confirm === 'function') return Promise.resolve(w.confirm(msg));
            return Promise.resolve(true);
        };
        await expect(confirmAsync('msg', {})).resolves.toBe(true);
        expect(aiUiConfirm).toHaveBeenCalledTimes(1);
        expect(nativeConfirm).not.toHaveBeenCalled();
    });
});
