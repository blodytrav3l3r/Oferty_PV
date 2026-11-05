/* Auto-heal SLA thresholds at startup: bootstrap, idempotence and scoped repair. */
import prisma from '../../src/prismaClient';
import { ensureSlaConfigRow, DEFAULT_SLA } from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const testId = `care-sla-bootstrap-${process.pid}-${Date.now()}`;

describe('ensureSlaConfigRow (PostgreSQL auto-heal)', () => {
    beforeEach(async () => {
        await prisma.care_sla_config.deleteMany({ where: { id: 'global' } });
        await prisma.care_sla_scopes.deleteMany({ where: { scopeId: { startsWith: testId } } });
    });

    afterAll(async () => {
        await prisma.care_sla_config.deleteMany({ where: { id: 'global' } });
        await prisma.care_sla_scopes.deleteMany({ where: { scopeId: { startsWith: testId } } });
    });

    it('tworzy wiersz global z domyślnymi progami 24/7/72', async () => {
        await expect(ensureSlaConfigRow(prisma, NOW)).resolves.toEqual({
            created: true,
            globalRepaired: false,
            scopedRepaired: 0
        });
        await expect(
            prisma.care_sla_config.findUnique({ where: { id: 'global' } })
        ).resolves.toMatchObject({
            firstContactH: DEFAULT_SLA.firstContactH,
            staleD: DEFAULT_SLA.staleD,
            escalationH: DEFAULT_SLA.escalationH,
            updatedBy: 'bootstrap',
            updatedAt: NOW
        });
    });

    it('jest idempotentny — drugie wywołanie nic nie zmienia', async () => {
        await ensureSlaConfigRow(prisma, NOW);
        await expect(ensureSlaConfigRow(prisma, '2027-01-01T00:00:00.000Z')).resolves.toEqual({
            created: false,
            globalRepaired: false,
            scopedRepaired: 0
        });
        await expect(
            prisma.care_sla_config.findUnique({ where: { id: 'global' } })
        ).resolves.toMatchObject({ updatedAt: NOW });
    });

    it('nie nadpisuje progów ustawionych przez admina', async () => {
        await prisma.care_sla_config.create({
            data: {
                id: 'global',
                firstContactH: 12,
                staleD: 3,
                escalationH: 36,
                updatedBy: 'admin',
                updatedAt: '2026-09-01T00:00:00.000Z'
            }
        });
        await expect(ensureSlaConfigRow(prisma, NOW)).resolves.toEqual({
            created: false,
            globalRepaired: false,
            scopedRepaired: 0
        });
        await expect(
            prisma.care_sla_config.findUnique({ where: { id: 'global' } })
        ).resolves.toMatchObject({
            firstContactH: 12,
            staleD: 3,
            escalationH: 36,
            updatedBy: 'admin',
            updatedAt: '2026-09-01T00:00:00.000Z'
        });
    });

    it('naprawia nieczytelne liczbowe wartości globalne (zero i wartość ujemna)', async () => {
        await prisma.care_sla_config.create({
            data: {
                id: 'global',
                firstContactH: 0,
                staleD: 0,
                escalationH: -5,
                updatedBy: 'admin',
                updatedAt: '2026-09-01T00:00:00.000Z'
            }
        });
        await expect(ensureSlaConfigRow(prisma, NOW)).resolves.toEqual({
            created: false,
            globalRepaired: true,
            scopedRepaired: 0
        });
        await expect(
            prisma.care_sla_config.findUnique({ where: { id: 'global' } })
        ).resolves.toMatchObject({
            firstContactH: DEFAULT_SLA.firstContactH,
            staleD: DEFAULT_SLA.staleD,
            escalationH: DEFAULT_SLA.escalationH,
            updatedBy: 'bootstrap',
            updatedAt: NOW
        });
    });

    it('naprawia tylko nieczytelne pola, resztę zostawia', async () => {
        await prisma.care_sla_config.create({
            data: {
                id: 'global',
                firstContactH: 12,
                staleD: 0,
                escalationH: 36,
                updatedBy: 'admin',
                updatedAt: '2026-09-01T00:00:00.000Z'
            }
        });
        await ensureSlaConfigRow(prisma, NOW);
        await expect(
            prisma.care_sla_config.findUnique({ where: { id: 'global' } })
        ).resolves.toMatchObject({
            firstContactH: 12,
            staleD: DEFAULT_SLA.staleD,
            escalationH: 36,
            updatedBy: 'bootstrap',
            updatedAt: NOW
        });
    });

    it('naprawia nieczytelne progi per zespół/user, poprawne zostawia', async () => {
        await prisma.care_sla_scopes.createMany({
            data: [
                {
                    scopeType: 'team',
                    scopeId: `${testId}-p1`,
                    firstContactH: 0,
                    staleD: 3,
                    escalationH: 36,
                    updatedBy: 'p1',
                    updatedAt: '2026-09-01T00:00:00.000Z'
                },
                {
                    scopeType: 'user',
                    scopeId: `${testId}-u1`,
                    firstContactH: 12,
                    staleD: 3,
                    escalationH: 36,
                    updatedBy: 'u1',
                    updatedAt: '2026-09-01T00:00:00.000Z'
                }
            ]
        });
        await expect(ensureSlaConfigRow(prisma, NOW)).resolves.toEqual({
            created: true,
            globalRepaired: false,
            scopedRepaired: 1
        });
        await expect(
            prisma.care_sla_scopes.findUnique({
                where: { scopeType_scopeId: { scopeType: 'team', scopeId: `${testId}-p1` } }
            })
        ).resolves.toMatchObject({
            firstContactH: DEFAULT_SLA.firstContactH,
            staleD: 3,
            escalationH: 36,
            updatedBy: 'bootstrap',
            updatedAt: NOW
        });
        await expect(
            prisma.care_sla_scopes.findUnique({
                where: { scopeType_scopeId: { scopeType: 'user', scopeId: `${testId}-u1` } }
            })
        ).resolves.toMatchObject({
            firstContactH: 12,
            staleD: 3,
            escalationH: 36,
            updatedBy: 'u1',
            updatedAt: '2026-09-01T00:00:00.000Z'
        });
    });
});
