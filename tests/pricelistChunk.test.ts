/**
 * B2: chunkedCreateMany — regresja rozmiaru chunka (benchmark: 25 = 7531 ms,
 * 100 = 2116 ms na 2000 wierszach, 500 = zrywanie silnika; liczby w komentarzu,
 * nie w asercji — timingi są niestabilne na CI).
 * Cenniki używają VERSION_ITEMS_CHUNK=100, seed zostaje na defaulcie 25.
 */
import { chunkedCreateMany } from '../src/utils/prismaBatch';
import prisma from '../src/prismaClient';

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

afterAll(async () => {
    await prisma.$disconnect();
});

describe.each([25, 100])('B2 chunk=%i', (size) => {
    test(`2000 wierszy ląduje w całości (total + count)`, async () => {
        // Unikalny version per run + finally: padnięty run nie zostawia śmieci
        // pod stałym @@unique([type, version]) — śmieci wywalały każdy rerun.
        const stamp = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        const vid = `chunk_v_${size}_${stamp}`;
        // seq też wchodzi w @@unique([type, seq]) — losowy z dużego zakresu.
        const seq = 990000000 + Math.floor(Math.random() * 999999);
        let vId: string | null = null;
        try {
            const v = await prisma.pricelistVersion.create({
                data: {
                    id: vid,
                    type: 'rury',
                    seq,
                    version: `v999${size}_${stamp}`,
                    status: 'DRAFT',
                    effectiveFrom: new Date().toISOString(),
                    sha256: 'chunk'
                }
            });
            vId = v.id;
            const rows = Array.from({ length: 2000 }, (_, i) => ({
                id: `chunk_${size}_${stamp}_${i}`,
                versionId: v.id,
                name: 'n',
                category: 'c',
                price: 1
            }));
            const total = await chunkedCreateMany(prisma.pricelistItemRury as never, rows, size);
            expect(total).toBe(2000);
            expect(await prisma.pricelistItemRury.count({ where: { versionId: v.id } })).toBe(2000);
        } finally {
            if (vId) {
                await prisma.pricelistItemRury.deleteMany({ where: { versionId: vId } });
                await prisma.pricelistVersion.delete({ where: { id: vId } });
            }
        }
    }, 60000); // Ciężki I/O na współdzielonym workerze (8+s solo) — timeout jak migracje.
});
