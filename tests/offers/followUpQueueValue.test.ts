/* Regression: care queue uses PostgreSQL JSONB fallbacks for well-offer values. */
import prisma from '../../src/prismaClient';
import { getCareQueue, type CareUser } from '../../src/services/careService';

const NOW = '2026-10-10T12:00:00.000Z';
const testId = `care-queue-value-${process.pid}-${Date.now()}`;
const userId = `${testId}-user`;
const U1: CareUser = { id: userId, role: 'user', subUsers: [] };

async function cleanup(): Promise<void> {
    await prisma.users.deleteMany({ where: { id: userId } });
    await prisma.offers_rel.deleteMany({ where: { id: { startsWith: testId } } });
    await prisma.offers_studnie_rel.deleteMany({ where: { id: { startsWith: testId } } });
}

describe('wartość studni w kolejce (guard 0-kolumny, PostgreSQL)', () => {
    beforeEach(async () => {
        await prisma.users.create({
            data: {
                id: userId,
                username: userId,
                password: 'test-only',
                role: 'user',
                firstName: 'Jan',
                lastName: 'Kowalski'
            }
        });
    });
    afterEach(cleanup);

    it('kolumna 0 + blob.totalBrutto → wartość z bloba', async () => {
        await prisma.offers_studnie_rel.createMany({
            data: [
                {
                    id: `${testId}-a`,
                    userId,
                    createdAt: '2026-10-01T00:00:00.000Z',
                    totalPrice: 0,
                    data: JSON.stringify({ totalBrutto: 999.99 })
                },
                {
                    id: `${testId}-b`,
                    userId,
                    createdAt: '2026-10-01T00:00:00.000Z',
                    totalPrice: 500,
                    data: JSON.stringify({ totalBrutto: 999 })
                },
                {
                    id: `${testId}-c`,
                    userId,
                    createdAt: '2026-10-01T00:00:00.000Z',
                    totalPrice: 0,
                    data: JSON.stringify({ wellsExport: [{ totalPrice: 100 }, { totalPrice: 50 }] })
                },
                {
                    id: `${testId}-d`,
                    userId,
                    createdAt: '2026-10-01T00:00:00.000Z',
                    totalPrice: 0,
                    data: JSON.stringify({})
                }
            ]
        });
        const { items } = await getCareQueue(prisma, U1, { nowIso: NOW, limit: 50 });
        const byId = new Map(items.map((item) => [item.offerId, item.value]));
        expect(byId.get(`${testId}-a`)).toBeCloseTo(999.99, 2);
        expect(byId.get(`${testId}-b`)).toBe(500);
        expect(byId.get(`${testId}-c`)).toBe(150);
        expect(byId.get(`${testId}-d`)).toBe(0);
    });

    it('obiekt i kontakt: kolumna wygrywa, fallback blob/budowa, braki = null', async () => {
        await prisma.offers_rel.create({
            data: {
                id: `${testId}-r1`,
                userId,
                createdAt: '2026-10-01T00:00:00.000Z',
                investName: 'Obiekt Kolumna',
                clientNumber: 'K-7',
                data: JSON.stringify({
                    investName: 'Obiekt Blob',
                    investAddress: 'ul. Testowa 1',
                    contactPerson: 'Jan Kowalski',
                    clientPhone: '601000111',
                    clientEmail: 'jan@example.com',
                    createdByUserName: 'Ewa Nowak'
                })
            }
        });
        await prisma.offers_studnie_rel.create({
            data: {
                id: `${testId}-s1`,
                userId,
                createdAt: '2026-10-01T00:00:00.000Z',
                totalPrice: 0,
                data: JSON.stringify({
                    budowa: 'Obiekt Budowa',
                    clientContacts: [
                        { name: 'Anna Nowak', phone: '602000222', email: 'anna@example.com' }
                    ]
                })
            }
        });
        await prisma.offers_studnie_rel.create({
            data: {
                id: `${testId}-a`,
                userId,
                createdAt: '2026-10-01T00:00:00.000Z',
                totalPrice: 0,
                data: JSON.stringify({})
            }
        });
        const { items } = await getCareQueue(prisma, U1, { nowIso: NOW, limit: 50 });
        const byId = new Map(items.map((item) => [item.offerId, item]));
        const rury = byId.get(`${testId}-r1`);
        expect(rury).toMatchObject({
            clientNumber: 'K-7',
            ownerName: 'Jan Kowalski',
            authorName: 'Ewa Nowak',
            investName: 'Obiekt Kolumna',
            investAddress: 'ul. Testowa 1',
            contactPerson: 'Jan Kowalski',
            phone: '601000111',
            email: 'jan@example.com'
        });
        const studnie = byId.get(`${testId}-s1`);
        expect(studnie).toMatchObject({
            clientNumber: null,
            investName: 'Obiekt Budowa',
            investAddress: null,
            contactPerson: 'Anna Nowak',
            phone: '602000222',
            email: 'anna@example.com'
        });
        const empty = byId.get(`${testId}-a`);
        expect(empty).toMatchObject({
            investName: null,
            investAddress: null,
            contactPerson: null,
            email: null
        });
    });
});
