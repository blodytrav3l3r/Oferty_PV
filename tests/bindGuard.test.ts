/*
 * tests/bindGuard.test.ts
 * W3-warn: ostrzeżenie o publicznym bindzie tylko w produkcji na 0.0.0.0.
 */
import { shouldWarnPublicBind } from '../src/utils/bindGuard';

describe('bindGuard', () => {
    it('production + 0.0.0.0 → warn', () => {
        expect(shouldWarnPublicBind('production', '0.0.0.0')).toBe(true);
    });

    it('production + loopback → cisza', () => {
        expect(shouldWarnPublicBind('production', '127.0.0.1')).toBe(false);
    });

    it('development + 0.0.0.0 → cisza (dev default)', () => {
        expect(shouldWarnPublicBind('development', '0.0.0.0')).toBe(false);
    });

    it('test + custom host → cisza', () => {
        expect(shouldWarnPublicBind('test', 'localhost')).toBe(false);
    });
});
