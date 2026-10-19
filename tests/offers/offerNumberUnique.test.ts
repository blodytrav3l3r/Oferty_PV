import prisma from '../../src/prismaClient';

/**
 * I-004: numer oferty unikalny globalnie per tabela; NULL = brak numeru
 * (SQLite UNIQUE dopuszcza wiele NULL).
 */
const PREFIX = 't-unq-offer-';

async function cleanup() {
    await prisma.offers_rel.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.offers_studnie_rel.deleteMany({ where: { id: { startsWith: PREFIX } } });
}

describe('offer_number UNIQUE (DB backstop)', () => {
    beforeEach(cleanup);
    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    it('rury: drugi rekord z tym samym numerem → P2002', async () => {
        const number = `${PREFIX}OF/1`;
        await prisma.offers_rel.create({ data: { id: `${PREFIX}r1`, offer_number: number } });
        await expect(
            prisma.offers_rel.create({ data: { id: `${PREFIX}r2`, offer_number: number } })
        ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('studnie: drugi rekord z tym samym numerem → P2002', async () => {
        const number = `${PREFIX}OS/1`;
        await prisma.offers_studnie_rel.create({
            data: { id: `${PREFIX}s1`, offer_number: number }
        });
        await expect(
            prisma.offers_studnie_rel.create({ data: { id: `${PREFIX}s2`, offer_number: number } })
        ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('rury: wiele rekordów bez numeru (NULL) jest dozwolone', async () => {
        await prisma.offers_rel.create({ data: { id: `${PREFIX}n1`, offer_number: null } });
        await prisma.offers_rel.create({ data: { id: `${PREFIX}n2`, offer_number: null } });
        expect(
            await prisma.offers_rel.count({ where: { id: { startsWith: PREFIX } } })
        ).toBeGreaterThanOrEqual(2);
    });

    it('studnie: wiele rekordów bez numeru (NULL) jest dozwolone', async () => {
        await prisma.offers_studnie_rel.create({
            data: { id: `${PREFIX}sn1`, offer_number: null }
        });
        await prisma.offers_studnie_rel.create({
            data: { id: `${PREFIX}sn2`, offer_number: null }
        });
        expect(
            await prisma.offers_studnie_rel.count({ where: { id: { startsWith: PREFIX } } })
        ).toBeGreaterThanOrEqual(2);
    });
});
