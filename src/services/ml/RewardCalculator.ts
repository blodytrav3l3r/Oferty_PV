import crypto from 'crypto';
import prisma from '../../prismaClient';
import type { Prisma } from '../../../generated/prisma-postgres/client';
import { logger } from '../../utils/logger';
import { addVerifiedPredictionProvenance, type VerifiedPrediction } from './predictionProvenance';

export interface RewardEvent {
    userId: string;
    wellId?: string;
    dn?: number;
    action: 'ACCEPT' | 'REJECT' | 'MODIFY' | 'ADJUST' | 'SWAP';
    scoreBefore?: number;
    scoreAfter?: number;
    wasAiRanked?: boolean;
    configSnapshot?: Record<string, unknown>;
    verifiedPrediction?: VerifiedPrediction;
}

export type RewardActionTransactionWork = (transaction: Prisma.TransactionClient) => Promise<void>;

export class RewardCalculator {
    /**
     * Zapisuje nagrodę atomowo. Dedup per (wellId, action) wymusza unikalny
     * indeks uq_reward_well_action (nie findFirst→create — TOCTOU).
     * Pre-check findUnique wycina powtarzalne duplikaty PRZED transakcja,
     * zeby silnik Prisma nie logowal prisma:error przy kazdym retry
     * (P2002 w catch zostaje jako backstop wyscigu).
     * @returns {Promise<{ applied: boolean }>} applied=false = duplikat
     */
    async processAction(
        event: RewardEvent,
        onApplied?: RewardActionTransactionWork
    ): Promise<{ applied: boolean }> {
        let reward = 0;

        switch (event.action) {
            case 'ACCEPT':
                reward = event.wasAiRanked ? 1.0 : 0.5;
                break;
            case 'REJECT':
                reward = -1.0;
                break;
            case 'MODIFY':
                if (event.scoreBefore !== undefined && event.scoreAfter !== undefined) {
                    const improvement = event.scoreAfter - event.scoreBefore;
                    reward = Math.max(-0.5, Math.min(0.5, improvement * 0.1));
                } else {
                    reward = -0.3;
                }
                break;
            case 'ADJUST':
                reward = 0.0;
                break;
            case 'SWAP':
                reward = -0.2;
                break;
            default:
                throw new Error(`Nieznana akcja reward: ${String(event.action)}`);
        }

        const wellId = event.wellId || 'unknown';
        try {
            const dupe = await prisma.aiRewardLog.findUnique({
                where: { wellId_action: { wellId, action: event.action } },
                select: { id: true }
            });
            if (dupe) {
                logger.info('RewardCalculator', `Duplikat reward ${event.action} — pomijam`);
                return { applied: false };
            }
        } catch (e) {
            logger.debug(
                'RewardCalculator',
                'pre-check ignore',
                e instanceof Error ? e.message : String(e)
            );
        }

        const rewardId = crypto.randomUUID();
        const rewardSnapshot =
            event.configSnapshot || event.verifiedPrediction
                ? JSON.stringify(
                      addVerifiedPredictionProvenance(
                          event.configSnapshot,
                          event.verifiedPrediction ?? null,
                          rewardId
                      )
                  )
                : null;

        try {
            await prisma.$transaction(async (tx) => {
                await tx.aiRewardLog.create({
                    data: {
                        id: rewardId,
                        userId: event.userId,
                        wellId,
                        dn: event.dn ?? 0,
                        action: event.action,
                        reward,
                        scoreBefore: event.verifiedPrediction?.score ?? event.scoreBefore ?? null,
                        scoreAfter: event.scoreAfter ?? null,
                        wasAiRanked: event.wasAiRanked ?? false,
                        configSnapshot: rewardSnapshot,
                        createdAt: new Date().toISOString()
                    }
                });

                await tx.users.updateMany({
                    where: { id: event.userId },
                    data: { totalReward: { increment: reward } }
                });
                if (onApplied) await onApplied(tx);
            });

            logger.info('RewardCalculator', `Reward ${event.action}: ${reward.toFixed(3)}`);
            return { applied: true };
        } catch (e) {
            // P2002 = duplikat (wellId, action) — unikalny indeks, nie błąd.
            if (
                typeof e === 'object' &&
                e !== null &&
                'code' in e &&
                (e as { code?: string }).code === 'P2002'
            ) {
                logger.info('RewardCalculator', `Duplikat reward ${event.action} — pomijam`);
                return { applied: false };
            }
            throw e;
        }
    }
}

export const rewardCalculator = new RewardCalculator();
