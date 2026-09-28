/*
 * tests/e2e-harness/csrfHarness.test.ts
 * P1.3: harness E2E musi emulowac przegladarke (Origin/Referer) przy mutacjach
 * przez APIRequestContext. Bez tego fail-closed CSRF slusznie zwraca 403,
 * seed nie powstaje i extended E2E pada kaskadowo (PUT 403 -> brak id -> timeout).
 * Nie obchodzimy CSRF — naprawiamy harness.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Script } from 'node:vm';

const PROOF = fs.readFileSync(
    path.resolve(__dirname, '..', 'playwright', 'draftLoopProof.cjs'),
    'utf8'
);

describe('P1.3 draftLoopProof CSRF harness', () => {
    it('PUT seed wysyla Origin i Referer (same-origin)', () => {
        // lastIndexOf: pierwsze wystapienie to komentarz naglowkowy, wywolanie jest dalej.
        const idx = PROOF.lastIndexOf('api/orders-studnie');
        expect(idx).toBeGreaterThan(-1);
        const window = PROOF.slice(Math.max(0, idx - 600), idx + 600);
        expect(window).toMatch(/Origin:\s*BASE/);
        expect(window).toMatch(/Referer:/);
    });

    it('login wysyla Origin i Referer', () => {
        const idx = PROOF.indexOf('api/auth/login');
        expect(idx).toBeGreaterThan(-1);
        const window = PROOF.slice(Math.max(0, idx - 600), idx + 600);
        expect(window).toMatch(/Origin:\s*BASE/);
        expect(window).toMatch(/Referer:/);
    });

    it('brak obejsc zabezpieczen w harnessie', () => {
        // Komentarze moga wspominac CSRF; zakazane sa mechanizmy obejsc.
        expect(PROOF).not.toMatch(/continue-on-error/);
        expect(PROOF).not.toMatch(/X-Bypass|BYPASS|disable.*csrf|csrf.*disable/i);
        expect(PROOF).not.toMatch(/HUSKY=0|core\.hooksPath/);
    });

    it('skladnia harnessu poprawna', () => {
        expect(() => new Script(PROOF)).not.toThrow();
    });
});
