/**
 * Mirror test: weryfikuje że scoreLayout() w wellConfigRules.js
 * poprawnie przetwarza dane z wellCaseService.getPreferences().
 *
 * Ładuje funkcję bezpośrednio z pliku JS i testuje we/wy.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

interface PreferenceWeights {
    dn: number;
    warehouse: string | null;
    confidence: number;
    ringHeightBonus: Record<string, number>;
    dennicaBonus: Record<string, number>;
    konusBonus: number;
    profileBonuses: Array<{ pattern: number[]; bonus: number }>;
    avoidProductIds: string[];
    preferProductIds: string[];
    warnings: string[];
    timeApplied: string;
}

// Wyciągnij scoreLayout z pliku JS (brace-matching od body, omijając JSDoc)
const scoreLayoutJs = readFileSync(
    join(__dirname, '..', '..', 'public', 'js', 'studnie', 'wellConfigRules.js'),
    'utf8'
);
const fnStart = scoreLayoutJs.indexOf('function scoreLayout(');
if (fnStart === -1) throw new Error('Nie znaleziono scoreLayout');
// Znajdź otwierający nawias funkcji (pierwszy { PO zamknięciu parametrów)
const paramsClose = scoreLayoutJs.indexOf(')', fnStart);
const bodyStart = scoreLayoutJs.indexOf('{', paramsClose);
if (bodyStart === -1) throw new Error('Nie znaleziono body scoreLayout');
let depth = 0;
let pos = bodyStart;
for (; pos < scoreLayoutJs.length; pos++) {
    if (scoreLayoutJs[pos] === '{') depth++;
    else if (scoreLayoutJs[pos] === '}') { depth--; if (depth === 0) { pos++; break; } }
}
const fnBody = scoreLayoutJs.slice(bodyStart + 1, pos - 1);
const scoreLayoutEval = new Function('opts', fnBody);

/* ===== Próbka preferenceWeights ===== */
function samplePrefs(overrides?: Partial<PreferenceWeights>): PreferenceWeights {
    return {
        dn: 1200,
        warehouse: null,
        confidence: 0.5,
        ringHeightBonus: { '25': -5000, '50': -2500 },
        dennicaBonus: {},
        konusBonus: -500000,
        profileBonuses: [],
        avoidProductIds: [],
        preferProductIds: [],
        warnings: [],
        timeApplied: new Date().toISOString(),
        ...overrides
    };
}

function callScoreLayout(opts: Record<string, unknown>): { score: number; breakdown: Array<{ factor: string; value: number }>; reason: string } {
    return scoreLayoutEval(opts) as { score: number; breakdown: Array<{ factor: string; value: number }>; reason: string };
}

describe('scoreLayout — mirror test', () => {
    it('zwraca strukturę { score, breakdown, reason }', () => {
        const result = callScoreLayout({ ringCount: 0, diff: 0 });
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('breakdown');
        expect(result).toHaveProperty('reason');
        expect(Array.isArray(result.breakdown)).toBe(true);
    });

    it('podstawowy score z ringCount=4: 40', () => {
        const result = callScoreLayout({ ringCount: 4, diff: 0 });
        expect(result.score).toBe(40);
        expect(result.reason).toBe('ok');
    });

    it('diff bez redukcji: |diff| * 5', () => {
        const result = callScoreLayout({ ringCount: 1, diff: 100 });
        expect(result.score).toBe(10 + 500);
        expect(result.breakdown.find(b => b.factor === 'diff')?.value).toBe(500);
    });

    it('diff z redukcją: |diff| * 15', () => {
        const result = callScoreLayout({ ringCount: 1, diff: 100, hasReduction: true });
        expect(result.breakdown.find(b => b.factor === 'diff')?.value).toBe(1500);
    });

    it('outOfBounds bez redukcji: 20000', () => {
        const result = callScoreLayout({ ringCount: 1, isOutOfBounds: true });
        expect(result.breakdown.find(b => b.factor === 'outOfBounds')?.value).toBe(20000);
    });

    it('outOfBounds z redukcją: 50000', () => {
        const result = callScoreLayout({ ringCount: 1, isOutOfBounds: true, hasReduction: true });
        expect(result.breakdown.find(b => b.factor === 'outOfBounds')?.value).toBe(50000);
    });

    it('minimal: 50000', () => {
        const result = callScoreLayout({ ringCount: 1, isMinimal: true });
        expect(result.breakdown.find(b => b.factor === 'minimal')?.value).toBe(50000);
    });

    it('otCount bonus: -otCount * 20000', () => {
        const result = callScoreLayout({ ringCount: 1, otCount: 3 });
        expect(result.breakdown.find(b => b.factor === 'ot_bonus')?.value).toBe(-60000);
    });

    it('fallbackClosure: 100000', () => {
        const result = callScoreLayout({ ringCount: 1, isFallbackClosure: true });
        expect(result.breakdown.find(b => b.factor === 'fallbackClosure')?.value).toBe(100000);
    });

    it('konus z domyślnym bonusem: -500000', () => {
        const result = callScoreLayout({ ringCount: 1, isKonus: true });
        expect(result.breakdown.find(b => b.factor === 'konus_bonus')?.value).toBe(-500000);
    });

    it('konus z preferenceWeights.konusBonus', () => {
        const prefs = samplePrefs({ konusBonus: -250000 });
        const result = callScoreLayout({ ringCount: 1, isKonus: true, preferenceWeights: prefs });
        expect(result.breakdown.find(b => b.factor === 'konus_bonus')?.value).toBe(-250000);
    });

    it('ringHeightBonus sumowany', () => {
        const prefs = samplePrefs({ ringHeightBonus: { '25': -5000, '50': -3000 } });
        const result = callScoreLayout({ ringCount: 2, preferenceWeights: prefs });
        expect(result.breakdown.find(b => b.factor === 'ringHeight_prefs')?.value).toBe(-8000);
    });

    it('avoidProductIds: każdy pasujący +50000', () => {
        const prefs = samplePrefs({ avoidProductIds: ['BAD-1', 'BAD-2'] });
        const result = callScoreLayout({
            ringCount: 1, preferenceWeights: prefs,
            productIds: ['GOOD', 'BAD-1', 'BAD-2']
        });
        expect(result.breakdown.find(b => b.factor === 'avoid_products')?.value).toBe(100000);
    });

    it('preferProductIds: każdy pasujący -20000', () => {
        const prefs = samplePrefs({ preferProductIds: ['GOOD-1'] });
        const result = callScoreLayout({
            ringCount: 1, preferenceWeights: prefs,
            productIds: ['GOOD-1', 'NEUTRAL']
        });
        expect(result.breakdown.find(b => b.factor === 'prefer_products')?.value).toBe(-20000);
    });

    it('profileBonuses: dokładne dopasowanie', () => {
        const prefs = samplePrefs({
            profileBonuses: [{ pattern: [1200, 800], bonus: -10000 }]
        });
        const result = callScoreLayout({
            ringCount: 1, preferenceWeights: prefs,
            diameterProfile: [1200, 800]
        });
        expect(result.breakdown.find(b => b.factor === 'profile_match')?.value).toBe(-10000);
    });

    it('profileBonuses: brak dopasowania = 0', () => {
        const prefs = samplePrefs({
            profileBonuses: [{ pattern: [1200, 800], bonus: -10000 }]
        });
        const result = callScoreLayout({
            ringCount: 1, preferenceWeights: prefs,
            diameterProfile: [1200, 1000]
        });
        expect(result.breakdown.find(b => b.factor === 'profile_match')).toBeUndefined();
    });

    it('bottomSection z DN factor', () => {
        const result = callScoreLayout({
            ringCount: 1, hasReduction: true, bottomSectionH: 500, dn: 1200
        });
        const factor = 1200 / 400;
        expect(result.breakdown.find(b => b.factor === 'bottomSection')?.value).toBe(500 * factor);
    });

    it('oversizedBottom gdy > minBottomTotal', () => {
        const result = callScoreLayout({
            ringCount: 1, hasReduction: true, bottomSectionH: 600, minBottomTotal: 500, dn: 1200
        });
        const oversized = (600 - 500) * 50;
        expect(result.breakdown.find(b => b.factor === 'oversizedBottom')?.value).toBe(oversized);
    });

    it('reductionForced: 5000000', () => {
        const result = callScoreLayout({ ringCount: 1, reductionForced: true });
        expect(result.reason).toBe('reductionForced');
        expect(result.breakdown.find(b => b.factor === 'reductionForced')?.value).toBe(5000000);
    });

    it('preferenceWeights=null nie psuje działania', () => {
        const result = callScoreLayout({ ringCount: 4, diff: 0, preferenceWeights: null });
        expect(result.score).toBe(40);
    });
});
