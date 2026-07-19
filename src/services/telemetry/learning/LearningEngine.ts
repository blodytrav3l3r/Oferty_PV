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
import { ML_CONSTANTS } from '../../../config/mlConstants';
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
    private async loadLastRun(): Promise<string | null> {
        try {
            const row = await prisma.settings.findUnique({ where: { key: 'learning_last_run' } });
            return row?.value || null;
        } catch {
            return this.lastRunAt;
        }
    }

    private async saveLastRun(ts: string): Promise<void> {
        await prisma.settings.upsert({
            where: { key: 'learning_last_run' },
            update: { value: ts },
            create: { key: 'learning_last_run', value: ts }
        });
        this.lastRunAt = ts;
    }

    private async fetchTelemetryRecords(since: string | null): Promise<{
        records: Array<Record<string, unknown>>;
        transitionsByConfig: Map<string, Array<Record<string, unknown>>>;
    }> {
        const where: Record<string, unknown> = { dn: { not: null } };
        if (since) {
            where.createdAt = { gt: since };
        }
        const records = await prisma.ai_telemetry_logs.findMany({
            take: ML_CONSTANTS.LEARNING_MAX_RECORDS,
            orderBy: { createdAt: 'desc' },
            where
        });

        const allTransitions = await prisma.ai_transition_snapshots.findMany({
            where: {
                configId: { in: records.map((r) => r.id) }
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

        return { records, transitionsByConfig };
    }

    private buildCorrections(records: Array<Record<string, unknown>>): Array<{
        dn?: string;
        originalConfig?: unknown[];
        finalConfig?: unknown[];
        overrideReason?: string;
    }> {
        const corrections: Array<{
            dn?: string;
            originalConfig?: unknown[];
            finalConfig?: unknown[];
            overrideReason?: string;
        }> = [];
        for (const rec of records) {
            if (!rec.wasModified || !rec.final_user_config || !rec.original_auto_config) continue;
            try {
                const final = JSON.parse(rec.final_user_config as string);
                const orig = JSON.parse(rec.original_auto_config as string);
                corrections.push({
                    dn: (rec.dn as string) || 'unknown',
                    originalConfig: orig,
                    finalConfig: final,
                    overrideReason: (rec.override_reason as string) || ''
                });
            } catch (_e) {
                /* skip */
            }
        }
        return corrections;
    }

    private detectAllPatterns(
        records: Array<Record<string, unknown>>,
        transitionsByConfig: Map<string, Array<Record<string, unknown>>>,
        corrections: Array<Record<string, unknown>>
    ): KnowledgePattern[] {
        const subPatterns = this.prefs.buildSubstitution(corrections);
        const addPatterns = this.prefs.buildAddition(corrections);
        const remPatterns = this.prefs.buildRemoval(corrections);

        const transitionLayouts = this.patterns.detectTransitionLayout(
            records.map((r) => {
                const id = r.id as string;
                const ts = id ? transitionsByConfig.get(id) || [] : [];
                const accepted = r.wasAccepted ? 1 : 0;
                const rejected = r.wasRejected ? 1 : 0;
                const avgH =
                    ts.length > 0
                        ? ts.reduce(
                              (acc, t) =>
                                  acc +
                                  (typeof t.heightFromBottomMm === 'number'
                                      ? t.heightFromBottomMm
                                      : 0),
                              0
                          ) / ts.length
                        : 0;
                let layout = 'unknown';
                if (ts.length >= 2) {
                    const heights = ts
                        .map((t) =>
                            typeof t.heightFromBottomMm === 'number' ? t.heightFromBottomMm : 0
                        )
                        .sort((a, b) => a - b);
                    const gaps: number[] = [];
                    for (let i = 1; i < heights.length; i++) gaps.push(heights[i] - heights[i - 1]);
                    const maxGap = Math.max(...gaps);
                    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
                    layout =
                        maxGap > avgGap * 2.5
                            ? 'clustered'
                            : maxGap < avgGap * 1.2
                              ? 'evenly_spaced'
                              : 'mixed';
                }
                return {
                    dn: (r.dn as string) || 'unknown',
                    transitionsCount: ts.length,
                    layout,
                    transitionAvgHeight: avgH,
                    accepted,
                    rejected
                };
            })
        );

        const reductionPatterns = this.patterns.detectReductionChoice(
            records.map((r) => {
                let final: unknown[] = [];
                if (r.final_user_config) {
                    try {
                        final = JSON.parse(r.final_user_config as string);
                    } catch {
                        final = [];
                    }
                }
                const reductionUsed = (final as { componentType?: string }[]).some((c) =>
                    (c.componentType || '').toLowerCase().includes('redukcj')
                );
                const id = r.id as string;
                const ts = id ? transitionsByConfig.get(id) || [] : [];
                return {
                    dn: (r.dn as string) || 'unknown',
                    reductionUsed,
                    wellHeight: typeof r.wellHeight === 'number' ? r.wellHeight : 0,
                    transitionCount: ts.length,
                    wasAccepted: !!r.wasAccepted,
                    wasRejected: !!r.wasRejected
                };
            })
        );

        return [
            ...subPatterns,
            ...addPatterns,
            ...remPatterns,
            ...transitionLayouts,
            ...reductionPatterns
        ];
    }

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
            const since = await this.loadLastRun();

            const { records, transitionsByConfig } = await this.fetchTelemetryRecords(since);

            processed = records.length;
            if (records.length === 0) {
                return {
                    processed: 0,
                    patternsDetected: 0,
                    persistedToKb: 0,
                    durationMs: Date.now() - startedAt
                };
            }

            const corrections = this.buildCorrections(records);

            const allPatterns = this.detectAllPatterns(records, transitionsByConfig, corrections);

            persisted = await this.patterns.persist(allPatterns);

            await this.saveLastRun(new Date().toISOString());
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
