import crypto from 'crypto';
import { logger } from '../../utils/logger';
import prisma from '../../prismaClient';

export interface WellCaseInput {
    dn: number;
    totalHeightMm: number;
    wellType: string;
    warehouse?: string;
    producer?: string;
    kinetType?: string;
    inflowCount?: number;
    loadClass?: string;
    manholeClass?: string;
    coverType?: string;
    componentSeq: unknown[];
    diameterProfile: unknown[];
    transitions: unknown[];
    configSource?: string;
    userId?: string;
}

export interface ScoredWellCase {
    id: string;
    dn: number;
    totalHeightMm: number;
    wellType: string;
    warehouse: string | null;
    producer: string | null;
    kinetType: string | null;
    inflowCount: number | null;
    loadClass: string | null;
    manholeClass: string | null;
    coverType: string | null;
    componentSeq: unknown[];
    diameterProfile: unknown[];
    transitions: unknown[];
    configSource: string | null;
    acceptanceCount: number;
    confidenceScore: number | null;
    firstAcceptedAt: Date;
    lastAcceptedAt: Date;
    similarityScore: number;
}

interface PatternAggregate {
    count: number;
    data: unknown;
}

class WellCaseService {
    async createOrUpdate(input: WellCaseInput): Promise<string> {
        const configHash = crypto
            .createHash('md5')
            .update(JSON.stringify(input.componentSeq))
            .digest('hex');

        return await prisma.$transaction(async (tx) => {
            const existing = await tx.ai_well_cases.findUnique({
                where: {
                    uniq_dn_height_type_hash: {
                        dn: input.dn,
                        totalHeightMm: input.totalHeightMm,
                        wellType: input.wellType,
                        configHash: configHash
                    }
                }
            });

            if (existing) {
                await tx.ai_well_cases.update({
                    where: { id: existing.id },
                    data: {
                        acceptanceCount: { increment: 1 },
                        warehouse: input.warehouse ?? existing.warehouse,
                        loadClass: input.loadClass ?? existing.loadClass,
                        manholeClass: input.manholeClass ?? existing.manholeClass
                    }
                });
                logger.debug('WellCase', `Zwiększono licznik przypadku ${existing.id} → ${existing.acceptanceCount + 1}`);
                return existing.id;
            }

            const id = crypto.randomUUID();
            try {
                await tx.ai_well_cases.create({
                    data: {
                        id,
                        dn: input.dn,
                        totalHeightMm: input.totalHeightMm,
                        wellType: input.wellType,
                        warehouse: input.warehouse ?? null,
                        producer: input.producer ?? null,
                        kinetType: input.kinetType ?? null,
                        inflowCount: input.inflowCount ?? null,
                        loadClass: input.loadClass ?? null,
                        manholeClass: input.manholeClass ?? null,
                        coverType: input.coverType ?? null,
                        componentSeq: JSON.stringify(input.componentSeq),
                        diameterProfile: JSON.stringify(input.diameterProfile),
                        transitions: JSON.stringify(input.transitions),
                        configHash,
                        userId: input.userId ?? null,
                        configSource: input.configSource ?? null,
                        acceptanceCount: 1,
                        firstAcceptedAt: new Date()
                    }
                });
                logger.debug('WellCase', `Utworzono nowy przypadek ${id}`);
                return id;
            } catch (err: any) {
                if (err?.code === 'P2002') {
                    const winner = await tx.ai_well_cases.findUnique({
                        where: {
                            uniq_dn_height_type_hash: {
                                dn: input.dn,
                                totalHeightMm: input.totalHeightMm,
                                wellType: input.wellType,
                                configHash: configHash
                            }
                        }
                    });
                    if (winner) {
                        await tx.ai_well_cases.update({
                            where: { id: winner.id },
                            data: { acceptanceCount: { increment: 1 } }
                        });
                        logger.debug('WellCase', `Race → inkrementacja zwycięzcy ${winner.id}`);
                        return winner.id;
                    }
                }
                throw err;
            }
        });
    }

    async findSimilar(params: {
        dn: number;
        totalHeightMm: number;
        wellType: string;
        warehouse?: string;
        producer?: string;
        loadClass?: string;
        limit?: number;
    }): Promise<ScoredWellCase[]> {
        const { dn, totalHeightMm, wellType } = params;
        const limit = Math.min(params.limit || 100, 500);

        const cases = await prisma.ai_well_cases.findMany({
            where: {
                isArchived: false,
                wellType: wellType,
                dn: { gte: Math.max(0, dn - 300), lte: dn + 300 },
                totalHeightMm: { gte: Math.max(0, totalHeightMm - 1000), lte: totalHeightMm + 1000 }
            },
            orderBy: { acceptanceCount: 'desc' },
            take: 500
        });

        const scored: ScoredWellCase[] = cases.map((c) => ({
            ...c,
            componentSeq: (this._safeParse(c.componentSeq) as unknown[]) || [],
            diameterProfile: (this._safeParse(c.diameterProfile) as unknown[]) || [],
            transitions: (this._safeParse(c.transitions) as unknown[]) || [],
            similarityScore: this._calculateSimilarity(c, params)
        }));

        scored.sort((a, b) => b.similarityScore - a.similarityScore);
        return scored.slice(0, limit);
    }

    async getPatterns(dn: number): Promise<{
        totalCases: number;
        commonProfiles: PatternAggregate[];
        commonTransitions: PatternAggregate[];
    }> {
        const cases = await prisma.ai_well_cases.findMany({
            where: { dn, isArchived: false },
            select: {
                diameterProfile: true,
                transitions: true,
                acceptanceCount: true
            }
        });

        return {
            totalCases: cases.length,
            commonProfiles: this._aggregate(cases, 'diameterProfile'),
            commonTransitions: this._aggregate(cases, 'transitions')
        };
    }

    private _calculateSimilarity(
        c: { dn: number; totalHeightMm: number; wellType: string; warehouse: string | null; producer: string | null; loadClass: string | null },
        params: { dn: number; totalHeightMm: number; warehouse?: string; producer?: string; loadClass?: string }
    ): number {
        let score = 0;
        const dnDiff = Math.abs(c.dn - params.dn);
        score += dnDiff <= 0 ? 30 : dnDiff <= 150 ? 25 : dnDiff <= 300 ? 15 : 0;

        const hDiff = Math.abs(c.totalHeightMm - params.totalHeightMm);
        score += hDiff <= 100 ? 20 : hDiff <= 300 ? 15 : hDiff <= 500 ? 10 : 0;

        score += 20;

        if (c.warehouse && c.warehouse === params.warehouse) score += 15;
        if (c.producer && c.producer === params.producer) score += 10;
        if (c.loadClass && c.loadClass === params.loadClass) score += 5;
        return score;
    }

    private _aggregate(
        cases: { diameterProfile: string; transitions: string; acceptanceCount: number }[],
        field: 'diameterProfile' | 'transitions'
    ): PatternAggregate[] {
        const freq = new Map<string, { count: number; data: unknown }>();
        for (const c of cases) {
            const parsed = this._safeParse(c[field]);
            if (!Array.isArray(parsed)) continue;
            const key = JSON.stringify(parsed);
            const existing = freq.get(key);
            if (existing) {
                existing.count += c.acceptanceCount || 1;
            } else {
                freq.set(key, { count: c.acceptanceCount || 1, data: parsed });
            }
        }
        return Array.from(freq.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    async getPreferences(params: {
        dn: number;
        warehouse?: string;
    }): Promise<PreferenceWeights> {
        const { dn, warehouse } = params;

        // 1. Pobierz wzorce z ai_knowledge_base dla danego DN
        const kbPatterns = await prisma.ai_knowledge_base.findMany({
            where: {
                dn: String(dn),
                status: 'active',
                confidence: { gt: 0 }
            }
        });

        // 2. Pobierz przypadki z ai_well_cases dla danego DN
        const cases = await prisma.ai_well_cases.findMany({
            where: {
                dn,
                isArchived: false,
                acceptanceCount: { gt: 0 }
            },
            select: {
                diameterProfile: true,
                transitions: true,
                acceptanceCount: true,
                componentSeq: true
            },
            orderBy: { acceptanceCount: 'desc' },
            take: 100
        });

        const totalAccepted = cases.reduce((s, c) => s + (c.acceptanceCount || 1), 0);
        const confidence = Math.min(1.0, totalAccepted / 50);

        // 3. Zbierz preferencje wysokości kręgów
        const ringHeightFreq: Record<string, number> = {};
        for (const c of cases) {
            const seq = this._safeParse(c.componentSeq) as Array<{ productId: string; quantity: number }> | null;
            if (!Array.isArray(seq)) continue;
            for (const item of seq) {
                const m = String(item.productId ?? '').match(/(\d+)$/);
                if (m) ringHeightFreq[m[1]] = (ringHeightFreq[m[1]] || 0) + (c.acceptanceCount || 1);
            }
        }

        // Bonus za wysokość kręgu: im częściej akceptowana, tym większy bonus (negatywny = obniża score)
        const maxHeightFreq = Math.max(...Object.values(ringHeightFreq), 1);
        const ringHeightBonus: Record<string, number> = {};
        for (const [h, freq] of Object.entries(ringHeightFreq)) {
            const ratio = freq / maxHeightFreq;
            if (ratio > 0.3) ringHeightBonus[h] = -Math.round(ratio * 5000);
        }

        // 4. Profile bonuses: najbardziej akceptowane profile średnic
        const profileBonuses: Array<{ pattern: number[]; bonus: number }> = [];
        for (const c of cases) {
            const prof = this._safeParse(c.diameterProfile) as number[] | null;
            if (Array.isArray(prof) && prof.length >= 2) {
                profileBonuses.push({
                    pattern: prof,
                    bonus: -Math.round((c.acceptanceCount || 1) * 2000)
                });
            }
        }
        profileBonuses.sort((a, b) => a.bonus - b.bonus).slice(0, 5);

        // 5. Konus bonus override z KB
        let konusBonus = -500000;
        const konusPattern = kbPatterns.find(p => p.patternType === 'closure_preference');
        if (konusPattern && konusPattern.confidence > 0.3) {
            konusBonus = Math.round(-500000 * konusPattern.confidence);
        }

        // 7. Unikaj produktów z KB
        const avoidProductIds: string[] = [];
        const preferProductIds: string[] = [];
        for (const p of kbPatterns) {
            if (p.patternType === 'avoid_product' && p.confidence > 0.5) {
                avoidProductIds.push(p.patternKey);
            }
            if (p.patternType === 'prefer_product' && p.confidence > 0.5) {
                preferProductIds.push(p.patternKey);
            }
        }

        return {
            dn,
            warehouse: warehouse || null,
            confidence: Math.round(confidence * 100) / 100,
            ringHeightBonus,
            konusBonus,
            profileBonuses,
            avoidProductIds,
            preferProductIds,
            warnings: confidence < 0.1
                ? ['Brak zgromadzonych danych — preferencje nieaktywne']
                : [],
            timeApplied: new Date().toISOString()
        };
    }

    private _safeParse(json: string): unknown {
        try {
            return JSON.parse(json);
        } catch {
            return null;
        }
    }
}

export interface PreferenceWeights {
    dn: number;
    warehouse: string | null;
    confidence: number;
    ringHeightBonus: Record<string, number>;
    konusBonus: number;
    profileBonuses: Array<{ pattern: number[]; bonus: number }>;
    avoidProductIds: string[];
    preferProductIds: string[];
    warnings: string[];
    timeApplied: string;
}

export const wellCaseService = new WellCaseService();
