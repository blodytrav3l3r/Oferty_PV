import { runWithRequestId, getRequestId } from '../../src/utils/requestContext';
import { logAudit } from '../../src/services/auditService';

/**
 * P2: requestId propagowany do logow audytu (bez zmian sygnatur).
 * Poza requestem getRequestId() = '' (cron/testy) — log nadal dziala.
 */
jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $executeRaw: jest.fn().mockRejectedValue(new Error('DB down'))
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger } = require('../../src/utils/logger');

describe('P2 requestId -> audit', () => {
    it('getRequestId w kontekscie i pusty poza nim', () => {
        expect(getRequestId()).toBe('');
        runWithRequestId('req-1', () => {
            expect(getRequestId()).toBe('req-1');
        });
        expect(getRequestId()).toBe('');
    });

    it('blad zapisu audytu niesie requestId z kontekstu', async () => {
        await runWithRequestId('abc12345', () =>
            logAudit('offer', 'doc-1', 'user-A', 'create', { a: 1 })
        );
        expect(logger.error).toHaveBeenCalledWith(
            'AuditLog',
            'Błąd zapisu logu',
            expect.objectContaining({ requestId: 'abc12345', entityId: 'doc-1' })
        );
    });

    it('blad zapisu audytu bez kontekstu ma pusty requestId', async () => {
        await logAudit('offer', 'doc-2', 'user-A', 'create', { a: 1 });
        expect(logger.error).toHaveBeenCalledWith(
            'AuditLog',
            'Błąd zapisu logu',
            expect.objectContaining({ requestId: '', entityId: 'doc-2' })
        );
    });
});
