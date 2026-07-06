/**
 * KnowledgeBase.ts
 *
 * Dostęp do tabeli ai_knowledge_base + ai_recommendations.
 * Pure storage — logika decyzyjna jest w LearningEngine.
 */

import crypto from 'crypto';
import prisma from '../../../prismaClient';
import { logger } from '../../../utils/logger';

export type PatternType =
    | 'dennica_swap'
    | 'ring_pattern'
    | 'reduction_choice'
    | 'transition_layout'
    | 'manifold_substitution'
    | 'acceptance'
    | 'usage_boost'
    | 'closure_preference'
    | 'prefer_product'
    | 'avoid_product';

export interface KnowledgePattern {
    id?: string;
    patternType: PatternType;
    patternKey: string;
    dn?: string;
    context?: Record<string, unknown>;
    description?: string;
    recommendation?: Record<string, unknown>;
    hitCount: number;
    confidence: number;
    successCount: number;
    rejectionCount: number;
    status?: 'active' | 'stale' | 'archived';
}

export interface RecommendationRecord {
    id?: string;
    patternType: PatternType;
    patternKey: string;
    dn?: string;
    wellId?: string;
    score: number;
    confidence: number;
    payload?: Record<string, unknown>;
}

export class KnowledgeBase {
    /**
     * Upsert wzorca - jeśli patternKey istnieje, aktualizuj; wpp wstaw.
     */
    async upsertPattern(pattern: KnowledgePattern): Promise<string> {
        const id = pattern.id || crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            const existing = await prisma.ai_knowledge_base.findFirst({
                where: {
                    patternKey: pattern.patternKey,
                    status: { not: 'archived' }
                }
            });

            if (existing) {
                const history = existing.changeHistory
                    ? JSON.parse(existing.changeHistory)
                    : [];
                history.push({ at: now, hitCount: pattern.hitCount, confidence: pattern.confidence });

                await prisma.ai_knowledge_base.update({
                    where: { id: existing.id },
                    data: {
                        hitCount: pattern.hitCount,
                        confidence: pattern.confidence,
                        successCount: pattern.successCount,
                        rejectionCount: pattern.rejectionCount,
                        lastHitAt: now,
                        lastUpdatedAt: now,
                        changeHistory: JSON.stringify(history.slice(-20)),
                        dn: pattern.dn,
                        context: pattern.context ? JSON.stringify(pattern.context) : null,
                        description: pattern.description,
                        recommendation: pattern.recommendation
                            ? JSON.stringify(pattern.recommendation)
                            : null
                    }
                });
                return existing.id;
            } else {
                await prisma.ai_knowledge_base.create({
                    data: {
                        id,
                        patternType: pattern.patternType,
                        patternKey: pattern.patternKey,
                        dn: pattern.dn,
                        context: pattern.context ? JSON.stringify(pattern.context) : null,
                        description: pattern.description,
                        recommendation: pattern.recommendation
                            ? JSON.stringify(pattern.recommendation)
                            : null,
                        hitCount: pattern.hitCount,
                        confidence: pattern.confidence,
                        successCount: pattern.successCount,
                        rejectionCount: pattern.rejectionCount,
                        firstDetectedAt: now,
                        lastHitAt: now,
                        lastUpdatedAt: now,
                        status: pattern.status || 'active',
                        generatedBy: 'LearningEngine'
                    }
                });
                return id;
            }
        } catch (e) {
            logger.error('KnowledgeBase', `Błąd upsert pattern: ${e}`);
            throw e;
        }
    }

    /**
     * Lista wzorców wg DN (do rekomendacji).
     */
    async getPatternsForDn(
        dn: string,
        minConfidence: number = 0.3
    ): Promise<KnowledgePattern[]> {
        try {
            const whereClause: Record<string, unknown> = {
                status: 'active',
                confidence: { gte: minConfidence }
            };
            if (dn !== 'all_dn' && dn !== '') {
                whereClause.dn = dn;
            }
            const rows = await prisma.ai_knowledge_base.findMany({
                where: whereClause as any,
                orderBy: { confidence: 'desc' },
                take: 50
            });
            return rows.map(function (r) {
                return {
                    id: r.id,
                    patternType: r.patternType as PatternType,
                    patternKey: r.patternKey,
                    dn: r.dn ?? undefined,
                    context: r.context ? JSON.parse(r.context) : undefined,
                    description: r.description ?? undefined,
                    recommendation: r.recommendation
                        ? JSON.parse(r.recommendation)
                        : undefined,
                    hitCount: r.hitCount,
                    confidence: r.confidence,
                    successCount: r.successCount,
                    rejectionCount: r.rejectionCount,
                    status: r.status as 'active' | 'stale' | 'archived'
                };
            });
        } catch (e) {
            logger.error('KnowledgeBase', `Błąd getPatterns: ${e}`);
            return [];
        }
    }

    /**
     * Zapis rekomendacji w tabeli.
     */
    async recordRecommendation(rec: RecommendationRecord): Promise<string> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        try {
            await prisma.ai_recommendations.create({
                data: {
                    id,
                    patternType: rec.patternType,
                    patternKey: rec.patternKey,
                    dn: rec.dn,
                    wellId: rec.wellId,
                    score: rec.score,
                    confidence: rec.confidence,
                    payload: rec.payload ? JSON.stringify(rec.payload) : null,
                    generatedAt: now
                }
            });
            return id;
        } catch (e) {
            logger.error('KnowledgeBase', `Błąd recordRecommendation: ${e}`);
            throw e;
        }
    }

    /**
     * Oznacz rekomendację jako zaakceptowaną/odrzuconą (pasywne — nie wpływa na solver).
     */
    async decideRecommendation(
        id: string,
        accepted: boolean,
        decidedBy: string
    ): Promise<void> {
        try {
            await prisma.ai_recommendations.update({
                where: { id },
                data: {
                    wasAccepted: accepted,
                    wasRejected: !accepted,
                    decidedAt: new Date().toISOString(),
                    decidedBy
                }
            });
        } catch (e) {
            logger.error('KnowledgeBase', `Błąd decide: ${e}`);
        }
    }

    /**
     * Statystyki bazy wiedzy do dashboardu.
     */
    async getStats(): Promise<{
        total: number;
        active: number;
        stale: number;
        archived: number;
        avgConfidence: number;
        totalRecommendations: number;
        acceptedRecommendations: number;
        rejectedRecommendations: number;
        byPatternType: Record<string, number>;
        recentDetected: number;
    }> {
        try {
            const total = await prisma.ai_knowledge_base.count();
            const active = await prisma.ai_knowledge_base.count({
                where: { status: 'active' }
            });
            const stale = await prisma.ai_knowledge_base.count({
                where: { status: 'stale' }
            });
            const archived = await prisma.ai_knowledge_base.count({
                where: { status: 'archived' }
            });
            const allActive = await prisma.ai_knowledge_base.findMany({
                where: { status: 'active' },
                select: { confidence: true, patternType: true }
            });
            const avgConfidence =
                allActive.length > 0
                    ? allActive.reduce(function (acc, p) {
                          return acc + p.confidence;
                      }, 0) / allActive.length
                    : 0;
            const byPatternType: Record<string, number> = {};
            allActive.forEach(function (p) {
                const t = p.patternType;
                byPatternType[t] = (byPatternType[t] || 0) + 1;
            });
            const totalRecommendations = await prisma.ai_recommendations.count();
            const acceptedRecommendations = await prisma.ai_recommendations.count({
                where: { wasAccepted: true }
            });
            const rejectedRecommendations = await prisma.ai_recommendations.count({
                where: { wasRejected: true }
            });
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const recentDetected = await prisma.ai_knowledge_base.count({
                where: { firstDetectedAt: { gte: sevenDaysAgo } }
            });
            return {
                total,
                active,
                stale,
                archived,
                avgConfidence,
                totalRecommendations,
                acceptedRecommendations,
                rejectedRecommendations,
                byPatternType,
                recentDetected
            };
        } catch (e) {
            logger.error('KnowledgeBase', `Błąd getStats: ${e}`);
        return {
            total: 0,
            active: 0,
            stale: 0,
            archived: 0,
            avgConfidence: 0,
            totalRecommendations: 0,
            acceptedRecommendations: 0,
            rejectedRecommendations: 0,
            byPatternType: {},
            recentDetected: 0
        };
        }
    }

    /**
     * Oznacz wzorzec jako 'stale' (nieużywany od dawna).
     */
    async archivePattern(id: string): Promise<void> {
        try {
            await prisma.ai_knowledge_base.update({
                where: { id },
                data: { status: 'archived', lastUpdatedAt: new Date().toISOString() }
            });
        } catch (e) {
            logger.error('KnowledgeBase', `Błąd archive: ${e}`);
        }
    }

    /**
     * Cykl czyszczenia KnowledgeBase:
     * - oznacza jako 'stale' wzorce z confidence < 0.2 i hitCount < 5
     * - archiwizuje wzorce 'stale' starsze niż 90 dni
     */
    async cleanupCycle(): Promise<number> {
        let totalCleaned = 0;
        const now = new Date();
        try {
            const staleThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
            const lowConfPatterns = await prisma.ai_knowledge_base.findMany({
                where: {
                    status: 'active',
                    confidence: { lt: 0.2 },
                    hitCount: { lt: 5 }
                },
                select: { id: true }
            });
            for (const p of lowConfPatterns) {
                await prisma.ai_knowledge_base.update({
                    where: { id: p.id },
                    data: { status: 'stale', lastUpdatedAt: now.toISOString() }
                });
                totalCleaned++;
            }
            const oldStalePatterns = await prisma.ai_knowledge_base.findMany({
                where: {
                    status: 'stale',
                    lastUpdatedAt: { lte: staleThreshold }
                },
                select: { id: true }
            });
            for (const p of oldStalePatterns) {
                await prisma.ai_knowledge_base.update({
                    where: { id: p.id },
                    data: { status: 'archived', lastUpdatedAt: now.toISOString() }
                });
                totalCleaned++;
            }
            return totalCleaned;
        } catch (e) {
            logger.error('KnowledgeBase', `Błąd cleanupCycle: ${e}`);
            return totalCleaned;
        }
    }
}
