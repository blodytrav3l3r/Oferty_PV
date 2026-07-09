/**
 * LearningEngine.ts
 *
 * Centralny punkt orkiestrujący uczenie AI:
 * - odczytuje historię z telemetry
 * - ekstrahuje features
 * - wykrywa wzorce
 * - aktualizuje/preference/dodje do bazy wiedzy
 * - zarządza rekomendacjami
 *
 * Bezpieczne dla solvera - NIE wywiera wpływu na logikę doboru.
 */

import prisma from '../../../prismaClient';
import { logger } from '../../../utils/logger';

import { PatternDetector } from './PatternDetector';
import { PreferenceEngine } from './PreferenceEngine';
import { RankingEngine } from './RankingEngine';
import { KnowledgeBase } from './KnowledgeBase';
import type { KnowledgePattern } from './KnowledgeBase';
import { FeedbackProcessor } from './FeedbackProcessor';
import { RecommendationEngine } from './RecommendationEngine';

export interface LearningRunSummary {
    processed: number;
    patternsDetected: number;
    persistedToKb: number;
    durationMs: number;
    error?: string;
}

export class LearningEngine {
    private kb: KnowledgeBase;
    private patterns: PatternDetector;
    private prefs: PreferenceEngine;
    private feedback: FeedbackProcessor;
    private recommend: RecommendationEngine;
    private ranker: RankingEngine;
    private _running: boolean = false;
    private lastRunAt: string | null = null;
    private initialized: boolean = false;

    constructor() {
        this.kb = new KnowledgeBase();
        this.patterns = new PatternDetector();
        this.prefs = new PreferenceEngine();
        this.feedback = new FeedbackProcessor();
        this.recommend = new RecommendationEngine();
        this.ranker = new RankingEngine();
    }

    /**
     * Wykonuje pełny pipeline uczenia:
     * 1) zbierze rekordy telemetry
     * 2) przekształci w features
     * 3) wykryje substitution/addition/removal
     * 4) wykryje transition layout + reduction choice
     * 5) zapisze wszystko do Knowledge Base
     */
    async runFullCycle(): Promise<LearningRunSummary> {
        if (this._running) {
            logger.warn('LearningEngine', 'Pipeline juz dziala — pomijam');
            return { processed: 0, patternsDetected: 0, persistedToKb: 0, durationMs: 0 };
        }
        this._running = true;
        const startedAt = Date.now();
        let processed = 0;
        let persisted = 0;

        try {
            // 1) odczyta telemetry - ostatnie 200 rekordów
            const records = await prisma.ai_telemetry_logs.findMany({
                take: 200,
                orderBy: { createdAt: 'desc' },
                where: { dn: { not: null } }
            });
            processed = records.length;
            if (records.length === 0) {
                return {
                    processed: 0,
                    patternsDetected: 0,
                    persistedToKb: 0,
                    durationMs: Date.now() - startedAt
                };
            }

            // 2) powiązane przejścia
            const allTransitions = await prisma.ai_transition_snapshots.findMany({
                where: {
                    configId: {
                        in: records.map(function (r) {
                            return r.id;
                        })
                    }
                }
            });

            const transitionsByConfig = new Map<string, typeof allTransitions>();
            for (const t of allTransitions) {
                if (t.configId) {
                    if (!transitionsByConfig.has(t.configId)) {
                        transitionsByConfig.set(t.configId, []);
                    }
                    transitionsByConfig.get(t.configId)!.push(t);
                }
            }

            // 3) Przygotuj corrections w postaci dla PreferenceEngine
            const corrections: Array<{
                dn?: string;
                originalConfig?: unknown[];
                finalConfig?: unknown[];
                overrideReason?: string;
            }> = [];
            for (const rec of records) {
                if (!rec.wasModified || !rec.final_user_config || !rec.original_auto_config)
                    continue;
                try {
                    const final = JSON.parse(rec.final_user_config);
                    const orig = JSON.parse(rec.original_auto_config);
                    corrections.push({
                        dn: rec.dn || 'unknown',
                        originalConfig: orig,
                        finalConfig: final,
                        overrideReason: rec.override_reason || ''
                    });
                } catch (_e) {
                    /* skip */
                }
            }

            // 4) Pattern Detection - substitution/addition/removal
            const subPatterns = this.prefs.buildSubstitution(corrections);
            const addPatterns = this.prefs.buildAddition(corrections);
            const remPatterns = this.prefs.buildRemoval(corrections);

            // 5) Pattern Detection - transition layout + reduction
            const transitionLayouts = this.patterns.detectTransitionLayout(
                records.map(function (r) {
                    const ts = r.id ? transitionsByConfig.get(r.id) || [] : [];
                    const accepted = r.wasAccepted ? 1 : 0;
                    const rejected = r.wasRejected ? 1 : 0;
                    const avgH =
                        ts.length > 0
                            ? ts.reduce(function (acc, t) {
                                  const v =
                                      typeof t.heightFromBottomMm === 'number'
                                          ? t.heightFromBottomMm
                                          : 0;
                                  return acc + v;
                              }, 0) / ts.length
                            : 0;
                    let layout = 'unknown';
                    if (ts.length >= 2) {
                        const heights = ts
                            .map(function (t) {
                                return typeof t.heightFromBottomMm === 'number'
                                    ? t.heightFromBottomMm
                                    : 0;
                            })
                            .sort(function (a, b) {
                                return a - b;
                            });
                        const gaps: number[] = [];
                        for (let i = 1; i < heights.length; i++) {
                            gaps.push(heights[i] - heights[i - 1]);
                        }
                        const maxGap = Math.max.apply(null, gaps);
                        const avgGap =
                            gaps.reduce(function (a, b) {
                                return a + b;
                            }, 0) / gaps.length;
                        layout =
                            maxGap > avgGap * 2.5
                                ? 'clustered'
                                : maxGap < avgGap * 1.2
                                  ? 'evenly_spaced'
                                  : 'mixed';
                    }
                    return {
                        dn: r.dn || 'unknown',
                        transitionsCount: ts.length,
                        layout,
                        transitionAvgHeight: avgH,
                        accepted,
                        rejected
                    };
                })
            );

            const reductionPatterns = this.patterns.detectReductionChoice(
                records.map(function (r) {
                    const final = r.final_user_config ? JSON.parse(r.final_user_config) : [];
                    const reductionUsed = (final as { componentType?: string }[]).some(
                        function (c) {
                            return (c.componentType || '').toLowerCase().includes('redukcj');
                        }
                    );
                    const ts = r.id ? transitionsByConfig.get(r.id) || [] : [];
                    return {
                        dn: r.dn || 'unknown',
                        reductionUsed,
                        wellHeight: typeof r.wellHeight === 'number' ? r.wellHeight : 0,
                        transitionCount: ts.length,
                        wasAccepted: !!r.wasAccepted,
                        wasRejected: !!r.wasRejected
                    };
                })
            );

            const allPatterns: KnowledgePattern[] = [
                ...subPatterns,
                ...addPatterns,
                ...remPatterns,
                ...transitionLayouts,
                ...reductionPatterns
            ];

            // 6) Zapis do KnowledgeBase
            persisted = await this.patterns.persist(allPatterns);

            this.lastRunAt = new Date().toISOString();
            this.initialized = true;

            return {
                processed,
                patternsDetected: allPatterns.length,
                persistedToKb: persisted,
                durationMs: Date.now() - startedAt
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('LearningEngine', `runFullCycle error: ${message}`);
            return {
                processed,
                patternsDetected: 0,
                persistedToKb: persisted,
                durationMs: Date.now() - startedAt,
                error: message
            };
        } finally {
            this._running = false;
        }
    }

    /**
     * Zwraca status silniczka.
     */
    getStatus(): {
        initialized: boolean;
        lastRunAt: string | null;
    } {
        return {
            initialized: this.initialized,
            lastRunAt: this.lastRunAt
        };
    }

    /**
     * Dostęp do subkompnentów.
     */
    getComponents() {
        return {
            kb: this.kb,
            patterns: this.patterns,
            prefs: this.prefs,
            feedback: this.feedback,
            recommend: this.recommend,
            ranker: this.ranker
        };
    }
}

export const learningEngine = new LearningEngine();
