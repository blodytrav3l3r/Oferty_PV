import prisma from '../../../prismaClient';

/**
 * P2 — historia transferów w warstwie service (thin routes).
 * Route'y GET /ai/transfer/history i /:transferId tylko delegują.
 */
const HISTORY_LIMIT = 100;

export function listTransferHistory(limit: number = HISTORY_LIMIT) {
    return prisma.aiTransfer.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}

export function getTransferDetail(transferId: string) {
    return prisma.aiTransfer.findUnique({ where: { transferId } });
}
