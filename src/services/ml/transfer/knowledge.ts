import crypto from 'crypto';
import prisma from '../../../prismaClient';
import { TransferError } from './transferErrors';

/**
 * P7.5 Extended — Knowledge Base (TYLKO patterns).
 *
 * Decyzja kontraktowa: ai_recommendations są wykluczone (wellId instancyjne,
 * decyzje operacyjne konkretnej instalacji). Patterns (wiedza wyuczona)
 * przenosimy; istniejące patternKey pomijamy (bez akumulacji liczników —
 * nie fałszujemy statystyk celu).
 */

export interface KnowledgePattern {
    patternType: string;
    patternKey: string;
    dn: string | null;
    context: string | null;
    description: string | null;
    recommendation: string | null;
    hitCount: number;
    confidence: number;
    successCount: number;
    rejectionCount: number;
    firstDetectedAt: string | null;
    lastHitAt: string | null;
    lastUpdatedAt: string | null;
    changeHistory: string | null;
    status: string;
    generatedBy: string | null;
}

const MAX_PATTERNS = 5000;

export async function exportPatterns(): Promise<KnowledgePattern[]> {
    const rows = await prisma.ai_knowledge_base.findMany({
        where: { status: { not: 'archived' } },
        orderBy: { lastUpdatedAt: 'desc' },
        take: MAX_PATTERNS
    });
    return rows.map((r) => ({
        patternType: r.patternType,
        patternKey: r.patternKey,
        dn: r.dn,
        context: r.context,
        description: r.description,
        recommendation: r.recommendation,
        hitCount: r.hitCount,
        confidence: r.confidence,
        successCount: r.successCount,
        rejectionCount: r.rejectionCount,
        firstDetectedAt: r.firstDetectedAt,
        lastHitAt: r.lastHitAt,
        lastUpdatedAt: r.lastUpdatedAt,
        changeHistory: r.changeHistory,
        status: r.status,
        generatedBy: r.generatedBy
    }));
}

function isKnowledgePattern(v: unknown): v is KnowledgePattern {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return typeof o.patternKey === 'string' && typeof o.patternType === 'string';
}

export function parsePatternsFile(text: string): KnowledgePattern[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new TransferError('MODEL_INVALID', 'knowledge/patterns.json nie jest JSON');
    }
    if (!Array.isArray(parsed) || !parsed.every(isKnowledgePattern)) {
        throw new TransferError('MODEL_INVALID', 'Nieprawidłowa struktura patterns');
    }
    return parsed;
}

export interface KnowledgeImportResult {
    inserted: number;
    skipped: number;
}

export async function importPatterns(patterns: KnowledgePattern[]): Promise<KnowledgeImportResult> {
    let inserted = 0;
    let skipped = 0;
    for (const p of patterns) {
        const existing = await prisma.ai_knowledge_base.findFirst({
            where: { patternKey: p.patternKey, status: { not: 'archived' } },
            select: { id: true }
        });
        if (existing) {
            skipped++;
            continue;
        }
        await prisma.ai_knowledge_base.create({
            data: { id: crypto.randomUUID(), ...p }
        });
        inserted++;
    }
    return { inserted, skipped };
}
