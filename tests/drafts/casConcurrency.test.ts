/**
 * H-1 (L2): dowód, że `updateMany` z predykatem wersji jest bezpiecznym CAS
 * w SQLite pod Prismą przy RÓWNOLEGŁYCH zapisach.
 *
 * Dotychczasowy stan (przed L2): `tests/versionInvariant.test.ts` pokrywa
 * 6 przypadków sekwencyjnych, zero równoległych — bezpieczeństwo współbieżne
 * było hipotezą, nie faktem.
 *
 * Ten test używa DWÓCH niezależnych klientów Prisma (dwa połączenia do tego
 * samego pliku), bo jeden klient z `connection_limit=1` serializuje zapytania
 * i nie dowodzi niczego o wyścigu.
 *
 * Kontrakt: dokładnie jeden zapis wygrywa, drugi dostaje count === 0
 * (w trasie draftu → 409), wersja rośnie dokładnie o 1.
 */
import { PrismaClient } from '../../generated/prisma';
import prisma from '../../src/prismaClient';
import { versionedWrite } from '../../src/utils/versionWrite';

const DOC_ID = 'cas-proof-l2';

function newClient(): PrismaClient {
    return new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } }
    });
}

async function seedDoc(): Promise<void> {
    await prisma.offers_rel.upsert({
        where: { id: DOC_ID },
        create: { id: DOC_ID, userId: 'u-cas', version: 1, data: '{}' },
        update: { version: 1, data: '{}' }
    });
}

async function cleanup(): Promise<void> {
    await prisma.offers_rel.deleteMany({ where: { id: DOC_ID } });
}

describe('H-1 CAS — updateMany z predykatem wersji (równolegle)', () => {
    afterAll(async () => {
        await cleanup();
    });

    test('dwa równoległe zapisy z tą samą wersją → dokładnie jeden wygrywa', async () => {
        await seedDoc();
        const a = newClient();
        const b = newClient();
        try {
            const [ra, rb] = await Promise.all([
                a.offers_rel.updateMany({
                    where: { id: DOC_ID, version: 1 },
                    data: { data: '{"who":"A"}', version: { increment: 1 } }
                }),
                b.offers_rel.updateMany({
                    where: { id: DOC_ID, version: 1 },
                    data: { data: '{"who":"B"}', version: { increment: 1 } }
                })
            ]);
            const counts = [ra.count, rb.count].sort();
            expect(counts).toEqual([0, 1]);

            const after = await prisma.offers_rel.findUnique({ where: { id: DOC_ID } });
            expect(after?.version).toBe(2);
            // Zwycięzca jest jednoznaczny: dane odpowiadają temu, kto dostał count=1.
            const winner = ra.count === 1 ? '{"who":"A"}' : '{"who":"B"}';
            expect(after?.data).toBe(winner);
        } finally {
            await a.$disconnect();
            await b.$disconnect();
        }
    });

    test('versionedWrite: równoległy duplikat → jeden sukces, jeden 409', async () => {
        await seedDoc();
        const a = newClient();
        const b = newClient();
        const write = (client: PrismaClient, tag: string) =>
            versionedWrite(client.offers_rel, {
                id: DOC_ID,
                exists: true,
                serverVersion: 1,
                clientVersion: 1,
                createData: {},
                updateData: { data: `{"tag":"${tag}"}` },
                conflictMessage: 'Konflikt wersji'
            });
        try {
            const results = await Promise.allSettled([write(a, 'A'), write(b, 'B')]);
            const fulfilled = results.filter((r) => r.status === 'fulfilled');
            const rejected = results.filter(
                (r): r is PromiseRejectedResult => r.status === 'rejected'
            );
            expect(fulfilled).toHaveLength(1);
            expect(rejected).toHaveLength(1);
            expect((rejected[0].reason as { status: number }).status).toBe(409);
            expect((rejected[0].reason as { code: string }).code).toBe('VERSION_CONFLICT');

            const after = await prisma.offers_rel.findUnique({ where: { id: DOC_ID } });
            expect(after?.version).toBe(2);
        } finally {
            await a.$disconnect();
            await b.$disconnect();
        }
    });
});
