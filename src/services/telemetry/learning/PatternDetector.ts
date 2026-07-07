/**
 * PatternDetector.ts
 *
 * Wykrywa wzorce w wektorach cech:
 * - wzorce podmiany dennicy (dennica_swap)
 * - wzorce doboru kręgów (ring_pattern)
 * - wzorce układu przejść szczelnych (transition_layout)
 * - wzorce akceptacji/redukcji
 *
 * Wynik jest zapisywany w KnowledgeBase jako dane, nie jako reguły solvera.
 */

import type { KnowledgePattern } from './KnowledgeBase';
import { KnowledgeBase } from './KnowledgeBase';

interface Correction {
    originalConfig?: unknown[];
    finalConfig?: unknown[];
    overrideReason?: string;
    dn?: string;
}

export class PatternDetector {
    private knowledge: KnowledgeBase;

    constructor() {
        this.knowledge = new KnowledgeBase();
    }

    /**
     * Wykrywa wzorce SUBSTITUTION: użytkownik zamienia dennicę/kręg/redukcję.
     */
    detectDennicaSwap(corrections: Correction[], dn: string): KnowledgePattern[] {
        const patterns: KnowledgePattern[] = [];
        const swapMap = new Map<
            string,
            { removed: Set<string>; added: Set<string>; count: number }
        >();

        for (const c of corrections) {
            if (!c.originalConfig || !c.finalConfig) continue;
            const origDennice = (
                c.originalConfig as { componentType?: string; productId?: string }[]
            )
                .filter(function (x) {
                    return (x.componentType || '').toLowerCase().includes('dennica');
                })
                .map(function (x) {
                    return x.productId || '';
                });
            const finalDennice = (c.finalConfig as { componentType?: string; productId?: string }[])
                .filter(function (x) {
                    return (x.componentType || '').toLowerCase().includes('dennica');
                })
                .map(function (x) {
                    return x.productId || '';
                });
            const removed = origDennice.filter(function (x) {
                return !finalDennice.includes(x);
            });
            const added = finalDennice.filter(function (x) {
                return !origDennice.includes(x);
            });
            if (removed.length === 0 || added.length === 0) continue;
            const key = dn + '|' + removed.join(',') + '->' + added.join(',');
            if (!swapMap.has(key)) {
                swapMap.set(key, { removed: new Set(removed), added: new Set(added), count: 0 });
            }
            swapMap.get(key)!.count++;
        }

        for (const [key, val] of swapMap) {
            if (val.count < 3) continue;
            patterns.push({
                patternType: 'dennica_swap',
                patternKey: key,
                dn: dn,
                hitCount: val.count,
                successCount: val.count,
                rejectionCount: 0,
                confidence: this._confidence(val.count),
                recommendation: {
                    removed: Array.from(val.removed),
                    added: Array.from(val.added),
                    count: val.count
                },
                description: 'Wzorzec podmiany dennicy w ' + dn
            });
        }
        return patterns;
    }

    /**
     * Wykrywa wzorce TRANSITION layout - najczęściej występujące układy przejść.
     */
    detectTransitionLayout(
        records: Array<{
            dn: string;
            transitionsCount: number;
            layout: string;
            transitionAvgHeight: number;
            accepted: number;
            rejected: number;
        }>
    ): KnowledgePattern[] {
        const layoutMap = new Map<
            string,
            {
                dn: string;
                count: number;
                successes: number;
                rejections: number;
                avgHeight: number;
            }
        >();

        for (const r of records) {
            const layout = r.layout;
            const cnt = r.transitionsCount;
            const height = Math.round(r.transitionAvgHeight / 50) * 50;
            const key = r.dn + '|' + layout + '|n' + cnt + '|h' + height;
            if (!layoutMap.has(key)) {
                layoutMap.set(key, {
                    dn: r.dn,
                    count: 0,
                    successes: 0,
                    rejections: 0,
                    avgHeight: r.transitionAvgHeight
                });
            }
            const e = layoutMap.get(key)!;
            e.count++;
            e.successes += r.accepted;
            e.rejections += r.rejected;
            e.avgHeight = (e.avgHeight * (e.count - 1) + r.transitionAvgHeight) / e.count;
        }

        const patterns: KnowledgePattern[] = [];
        for (const [key, val] of layoutMap) {
            if (val.count < 3) continue;
            patterns.push({
                patternType: 'transition_layout',
                patternKey: key,
                dn: val.dn,
                hitCount: val.count,
                successCount: val.successes,
                rejectionCount: val.rejections,
                confidence: this._confidenceWithDecay(val.count, val.successes, val.rejections),
                description: 'Układ ' + val.count + ' przejść w ' + val.dn,
                recommendation: {
                    layout: key,
                    avgHeight: Math.round(val.avgHeight),
                    successRate: val.successes / val.count
                }
            });
        }
        return patterns;
    }

    /**
     * Wykrywa wzorce REDUCTION CHOICE - kiedy stosowana jest redukcja.
     */
    detectReductionChoice(
        records: Array<{
            dn: string;
            reductionUsed: boolean;
            wellHeight: number;
            transitionCount: number;
            wasAccepted: boolean;
            wasRejected: boolean;
        }>
    ): KnowledgePattern[] {
        const buckets = new Map<
            string,
            { count: number; reductionYes: number; successes: number }
        >();

        for (const r of records) {
            const heightBucket = Math.floor(r.wellHeight / 1000) * 1000;
            const key = r.dn + '|' + (r.reductionUsed ? 'with' : 'without') + '|h' + heightBucket;
            if (!buckets.has(key)) {
                buckets.set(key, { count: 0, reductionYes: 0, successes: 0 });
            }
            const b = buckets.get(key)!;
            b.count++;
            if (r.reductionUsed) b.reductionYes++;
            if (r.wasAccepted) b.successes++;
        }

        const patterns: KnowledgePattern[] = [];
        for (const [key, val] of buckets) {
            if (val.count < 3) continue;
            const dn = key.split('|')[1];
            const using = key.includes('with');
            patterns.push({
                patternType: 'reduction_choice',
                patternKey: key,
                dn,
                hitCount: val.count,
                successCount: val.successes,
                rejectionCount: val.count - val.successes,
                confidence: this._confidenceWithDecay(
                    val.count,
                    val.successes,
                    val.count - val.successes
                ),
                description: (using ? 'Z redukcją' : 'Bez redukcji') + ' w ' + dn,
                recommendation: {
                    usesReduction: using,
                    totalCases: val.count,
                    successRate: val.successes / val.count
                }
            });
        }
        return patterns;
    }

    /**
     * Persist wykrytych wzorców do KnowledgeBase.
     */
    async persist(patterns: KnowledgePattern[]): Promise<number> {
        let count = 0;
        for (const p of patterns) {
            try {
                await this.knowledge.upsertPattern(p);
                count++;
            } catch (e) {
                // ignorujemy
            }
        }
        return count;
    }

    /**
     * Confidence z hit_count z krzywą logarytmiczną (lokalna kopia dla izolacji).
     */
    private _confidence(hitCount: number): number {
        if (hitCount < 3) return 0;
        return Math.min(Math.log(hitCount) / Math.log(30), 0.95);
    }

    private _confidenceWithDecay(hitCount: number, hits: number, misses: number): number {
        const base = this._confidence(hitCount);
        if (base === 0) return 0;
        const total = hits + misses;
        if (total === 0) return base * 0.5;
        const ratio = hits / total;
        return Math.min(base * (0.5 + 0.5 * ratio), 0.95);
    }
}
