import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';

export interface RewardEvent {
    userId: string;
    wellId?: string;
    dn?: number;
    action: 'ACCEPT' | 'REJECT' | 'MODIFY' | 'ADJUST' | 'SWAP';
    scoreBefore?: number;
    scoreAfter?: number;
    wasAiRanked?: boolean;
    configSnapshot?: Record<string, unknown>;
}

export class RewardCalculator {
    /**
     * Zapisuje nagrodę atomowo. Dedup per (wellId, action) wymusza unikalny
     * indeks uq_reward_well_action (nie findFirst→create — TOCTOU).
     * @returns {Promise<{ applied: boolean }>} applied=false = duplikat (P2002)
     */
    async processAction(event: RewardEvent): Promise<{ applied: boolean }> {
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
        }

        try {
            await prisma.$transaction(async (tx) => {
                await tx.aiRewardLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: event.userId,
                        wellId: event.wellId || 'unknown',
                        dn: event.dn ?? 0,
                        action: event.action,
                        reward,
                        scoreBefore: event.scoreBefore ?? null,
                        scoreAfter: event.scoreAfter ?? null,
                        wasAiRanked: event.wasAiRanked ?? false,
                        configSnapshot: event.configSnapshot
                            ? JSON.stringify(event.configSnapshot)
                            : null,
                        createdAt: new Date().toISOString()
                    }
                });

                await tx.users.updateMany({
                    where: { id: event.userId },
                    data: { totalReward: { increment: reward } }
                });
            });

            logger.info(
                'RewardCalculator',
                `Reward ${event.action}: ${reward.toFixed(3)} dla well ${event.wellId}`
            );
            return { applied: true };
        } catch (e) {
            // P2002 = duplikat (wellId, action) — unikalny indeks, nie błąd.
            if (
                typeof e === 'object' &&
                e !== null &&
                'code' in e &&
                (e as { code?: string }).code === 'P2002'
            ) {
                logger.info(
                    'RewardCalculator',
                    `Duplikat reward ${event.action} dla well ${event.wellId} — pomijam`
                );
                return { applied: false };
            }
            throw e;
        }
    }
}

export const rewardCalculator = new RewardCalculator();
