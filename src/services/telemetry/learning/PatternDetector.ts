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
            const origDennice = (c.originalConfig as { componentType?: string; productId?: string }[])
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
        const buckets = new Map<string, { count: number; reductionYes: number; successes: number }>();

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
     * Wykrywa wzorce RING_PATTERN: najczęściej akceptowane konfiguracje kręgów dla danego DN.
     * Zamiast diffów między auto a final, patrzy na BEZPOŚREDNIO zaakceptowane configi.
     */
    detectRingPattern(
        records: Array<{
            dn: string;
            componentSeq?: string;
            wasAccepted: boolean;
            acceptanceCount: number;
        }>
    ): KnowledgePattern[] {
        const freq = new Map<string, { count: number; dn: string }>();
        for (const r of records) {
            if (!r.componentSeq) continue;
            const weight = r.wasAccepted ? 2 : 1;
            try {
                const seq = JSON.parse(r.componentSeq) as Array<{ productId?: string; componentType?: string }>;
                if (!Array.isArray(seq)) continue;
                const rings = seq.filter(x => {
                    const ct = (x.componentType || '').toLowerCase();
                    return ct === 'krag' || ct === 'krag_ot';
                });
                if (rings.length === 0) continue;
                const pattern = rings.map(x => x.productId || '?').join('|');
                const key = r.dn + '|ring|' + pattern;
                const existing = freq.get(key);
                if (existing) {
                    existing.count += weight;
                } else {
                    freq.set(key, { count: weight, dn: r.dn });
                }
            } catch { /* skip parse errors */ }
        }

        const patterns: KnowledgePattern[] = [];
        for (const [key, val] of freq) {
            if (val.count < 3) continue;
            patterns.push({
                patternType: 'ring_pattern',
                patternKey: key,
                dn: val.dn,
                hitCount: val.count,
                successCount: val.count,
                rejectionCount: 0,
                confidence: this._confidence(val.count),
                description: 'Popularny układ kręgów w DN' + val.dn + ' (wystąpień: ' + val.count + ')',
                recommendation: {
                    ringPattern: key,
                    occurrences: val.count
                }
            });
        }
        return patterns;
    }

    /**
     * Wykrywa wzorce CLOSURE_PREFERENCE: preferencja konus vs DIN vs płyta dla danego DN.
     */
    detectClosurePreference(
        records: Array<{
            dn: string;
            componentSeq?: string;
            wasAccepted: boolean;
        }>
    ): KnowledgePattern[] {
        const closureTypes = ['konus', 'plyta_din', 'plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'];
        const freq = new Map<string, { konus: number; din: number; other: number; total: number }>();
        for (const r of records) {
            if (!r.componentSeq) continue;
            const weight = r.wasAccepted ? 3 : 1;
            try {
                const seq = JSON.parse(r.componentSeq) as Array<{ componentType?: string }>;
                if (!Array.isArray(seq)) continue;
                const closure = seq.find(x => closureTypes.includes((x.componentType || '').toLowerCase()));
                if (!closure) continue;
                const ct = (closure.componentType || '').toLowerCase();
                if (!freq.has(r.dn)) {
                    freq.set(r.dn, { konus: 0, din: 0, other: 0, total: 0 });
                }
                const entry = freq.get(r.dn)!;
                entry.total += weight;
                if (ct === 'konus') entry.konus += weight;
                else if (ct === 'plyta_din') entry.din += weight;
                else entry.other += weight;
            } catch { /* skip */ }
        }

        const patterns: KnowledgePattern[] = [];
        for (const [dn, val] of freq) {
            if (val.total < 5) continue;
            const konusRatio = val.konus / val.total;
            const dinRatio = val.din / val.total;
            if (konusRatio > 0.7) {
                patterns.push({
                    patternType: 'closure_preference',
                    patternKey: dn + '|prefer_konus',
                    dn,
                    hitCount: val.total,
                    successCount: val.konus,
                    rejectionCount: val.din + val.other,
                    confidence: this._confidence(val.total),
                    description: 'Preferencja konus w DN' + dn + ' (' + Math.round(konusRatio * 100) + '%)',
                    recommendation: {
                        preferredClosure: 'konus',
                        ratio: konusRatio,
                        totalCases: val.total
                    }
                });
            }
            if (dinRatio > 0.4) {
                patterns.push({
                    patternType: 'closure_preference',
                    patternKey: dn + '|prefer_din',
                    dn,
                    hitCount: val.total,
                    successCount: val.din,
                    rejectionCount: val.konus + val.other,
                    confidence: this._confidenceWithDecay(val.total, val.din, val.konus + val.other),
                    description: 'Częste użycie DIN w DN' + dn + ' (' + Math.round(dinRatio * 100) + '%)',
                    recommendation: {
                        preferredClosure: 'plyta_din',
                        ratio: dinRatio,
                        totalCases: val.total
                    }
                });
            }
        }
        return patterns;
    }

    /**
     * Wykrywa wzorce PREFER_PRODUCT / AVOID_PRODUCT: produkty częściej akceptowane/odrzucane.
     */
    detectProductPreference(
        records: Array<{
            dn: string;
            componentSeq?: string;
            wasAccepted: boolean;
            wasRejected: boolean;
        }>
    ): KnowledgePattern[] {
        const productStats = new Map<string, { accepted: number; rejected: number; dn: string }>();
        for (const r of records) {
            if (!r.componentSeq) continue;
            try {
                const seq = JSON.parse(r.componentSeq) as Array<{ productId?: string }>;
                if (!Array.isArray(seq)) continue;
                for (const item of seq) {
                    const pid = item.productId;
                    if (!pid) continue;
                    if (!productStats.has(pid)) {
                        productStats.set(pid, { accepted: 0, rejected: 0, dn: r.dn });
                    }
                    const stat = productStats.get(pid)!;
                    if (r.wasAccepted) stat.accepted++;
                    if (r.wasRejected) stat.rejected++;
                }
            } catch { /* skip */ }
        }

        const patterns: KnowledgePattern[] = [];
        for (const [pid, stat] of productStats) {
            const total = stat.accepted + stat.rejected;
            if (total < 3) continue;
            const acceptRatio = stat.accepted / total;
            if (acceptRatio > 0.85) {
                patterns.push({
                    patternType: 'prefer_product',
                    patternKey: pid,
                    dn: stat.dn,
                    hitCount: total,
                    successCount: stat.accepted,
                    rejectionCount: stat.rejected,
                    confidence: this._confidenceWithDecay(total, stat.accepted, stat.rejected),
                    description: 'Preferowany produkt: ' + pid + ' (akceptacja ' + Math.round(acceptRatio * 100) + '%)',
                    recommendation: {
                        productId: pid,
                        acceptRatio,
                        totalCases: total
                    }
                });
            }
            if (acceptRatio < 0.3) {
                patterns.push({
                    patternType: 'avoid_product',
                    patternKey: pid,
                    dn: stat.dn,
                    hitCount: total,
                    successCount: 0,
                    rejectionCount: total,
                    confidence: this._confidenceWithDecay(total, 0, total),
                    description: 'Unikany produkt: ' + pid + ' (odrzucenie ' + Math.round((1 - acceptRatio) * 100) + '%)',
                    recommendation: {
                        productId: pid,
                        rejectRatio: 1 - acceptRatio,
                        totalCases: total
                    }
                });
            }
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

    private _confidenceWithDecay(
        hitCount: number,
        hits: number,
        misses: number
    ): number {
        const base = this._confidence(hitCount);
        if (base === 0) return 0;
        const total = hits + misses;
        if (total === 0) return base * 0.5;
        const ratio = hits / total;
        return Math.min(base * (0.5 + 0.5 * ratio), 0.95);
    }
}
