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
    async processAction(event: RewardEvent): Promise<void> {
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

        await prisma.aiRewardLog.create({
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
                configSnapshot: event.configSnapshot ? JSON.stringify(event.configSnapshot) : null,
                createdAt: new Date().toISOString()
            }
        });

        await prisma.users.update({
            where: { id: event.userId },
            data: { totalReward: { increment: reward } }
        });

        logger.info(
            'RewardCalculator',
            `Reward ${event.action}: ${reward.toFixed(3)} dla well ${event.wellId}`
        );
    }

    async getAggregateReward(userId: string): Promise<{ total: number; count: number }> {
        const logs = await prisma.aiRewardLog.findMany({ where: { userId } });
        const total = logs.reduce((sum, l) => sum + l.reward, 0);
        return { total, count: logs.length };
    }
}

export const rewardCalculator = new RewardCalculator();
