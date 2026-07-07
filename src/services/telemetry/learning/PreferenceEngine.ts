/**
 * PreferenceEngine.ts
 *
 * Buduje preferencje użytkowników (substitution/addition/removal) z korekt.
 * Czysto pasywne - solver nie zmienia się.
 */

import type { KnowledgePattern } from './KnowledgeBase';
import { ConfidenceCalculator } from './ConfidenceCalculator';

interface CorrectionRaw {
    originalConfig?:
        Array<{ componentType?: string; productId?: string; height?: number }> | unknown[];
    finalConfig?:
        Array<{ componentType?: string; productId?: string; height?: number }> | unknown[];
    overrideReason?: string;
    dn?: string;
}

export class PreferenceEngine {
    private conf: ConfidenceCalculator;

    constructor() {
        this.conf = new ConfidenceCalculator();
    }

    /**
     * Analizuje korekt i buduje preferencje SUBSTITUTION (zamiana X→Y).
     */
    buildSubstitution(corrections: CorrectionRaw[]): KnowledgePattern[] {
        const map = new Map<
            string,
            { count: number; removed: string; added: string; dn: string }
        >();
        for (const c of corrections) {
            if (!c.originalConfig || !c.finalConfig || !c.dn) continue;
            const removedIds = this._extractIds(c.originalConfig);
            const addedIds = this._extractIds(c.finalConfig);
            for (const r of removedIds) {
                for (const a of addedIds) {
                    const key = c.dn + '|sub|' + r + '->' + a;
                    if (!map.has(key)) {
                        map.set(key, { count: 0, removed: r, added: a, dn: c.dn });
                    }
                    map.get(key)!.count++;
                }
            }
        }
        const out: KnowledgePattern[] = [];
        for (const [key, val] of map) {
            if (val.count < 3) continue;
            out.push({
                patternType: 'dennica_swap',
                patternKey: key,
                dn: val.dn,
                hitCount: val.count,
                successCount: val.count,
                rejectionCount: 0,
                confidence: this.conf.rawConfidence(val.count),
                recommendation: {
                    removed: val.removed,
                    added: val.added,
                    type: 'substitution'
                },
                description: 'Substitution ' + val.removed + ' -> ' + val.added + ' w ' + val.dn
            });
        }
        return out;
    }

    /**
     * Preferencje ADDITION - użytkownik dodaje dodatkowy element.
     */
    buildAddition(corrections: CorrectionRaw[]): KnowledgePattern[] {
        const map = new Map<string, { count: number; added: string; dn: string }>();
        for (const c of corrections) {
            if (!c.originalConfig || !c.finalConfig || !c.dn) continue;
            const origIds = new Set(this._extractIds(c.originalConfig));
            const addedIds = this._extractIds(c.finalConfig).filter(function (id) {
                return !origIds.has(id);
            });
            for (const a of addedIds) {
                const key = c.dn + '|add|' + a;
                if (!map.has(key)) {
                    map.set(key, { count: 0, added: a, dn: c.dn });
                }
                map.get(key)!.count++;
            }
        }
        const out: KnowledgePattern[] = [];
        for (const [key, val] of map) {
            if (val.count < 3) continue;
            out.push({
                patternType: 'ring_pattern',
                patternKey: key,
                dn: val.dn,
                hitCount: val.count,
                successCount: val.count,
                rejectionCount: 0,
                confidence: this.conf.rawConfidence(val.count),
                recommendation: { added: val.added, type: 'addition' },
                description: 'Dodatkowy: ' + val.added + ' w ' + val.dn
            });
        }
        return out;
    }

    /**
     * Preferencje REMOVAL - użytkownik usuwa element.
     */
    buildRemoval(corrections: CorrectionRaw[]): KnowledgePattern[] {
        const map = new Map<string, { count: number; removed: string; dn: string }>();
        for (const c of corrections) {
            if (!c.originalConfig || !c.finalConfig || !c.dn) continue;
            const finalIds = new Set(this._extractIds(c.finalConfig));
            const removedIds = this._extractIds(c.originalConfig).filter(function (id) {
                return !finalIds.has(id);
            });
            for (const r of removedIds) {
                const key = c.dn + '|rem|' + r;
                if (!map.has(key)) {
                    map.set(key, { count: 0, removed: r, dn: c.dn });
                }
                map.get(key)!.count++;
            }
        }
        const out: KnowledgePattern[] = [];
        for (const [key, val] of map) {
            if (val.count < 3) continue;
            out.push({
                patternType: 'dennica_swap',
                patternKey: key,
                dn: val.dn,
                hitCount: val.count,
                successCount: 0,
                rejectionCount: val.count,
                confidence: this.conf.rawConfidence(val.count),
                recommendation: { removed: val.removed, type: 'removal' },
                description: 'Usunięto: ' + val.removed + ' w ' + val.dn
            });
        }
        return out;
    }

    private _extractIds(cfg: unknown): string[] {
        if (!Array.isArray(cfg)) return [];
        return cfg
            .map(function (c) {
                return (c as { productId?: string }).productId || '';
            })
            .filter(function (id) {
                return id.length > 0;
            });
    }
}
