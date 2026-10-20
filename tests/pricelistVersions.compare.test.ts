/**
 * GET /api/pricelist-versions/:id/diff?against=<id> — porównanie dowolnych
 * wersji tego samego typu. Route-level: auth mock nagłówkami, DB in-memory.
 * Kontrakt: from/to, seq-1 legacy, klucze naturalne PRECO, cap 100.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        if (req.headers['x-test-anon']) {
            res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
            return;
        }
        req.user = {
            id: (req.headers['x-user-id'] as string) || 'u-test',
            role: (req.headers['x-user-role'] as string) || 'user'
        };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ error: 'Brak uprawnień - wymagany administrator' });
            return;
        }
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    sha256: string;
}

let versions: VRow[] = [];
let itemsRury: Array<Record<string, unknown>> = [];
let itemsStudnie: Array<Record<string, unknown>> = [];
let itemsKonfig: Array<Record<string, unknown>> = [];
let itemsKinety: Array<Record<string, unknown>> = [];
let itemsZakresy: Array<Record<string, unknown>> = [];

const versionDelegate = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return versions.find((v) => v.id === where.id) ?? null;
    }),
    findFirst: jest.fn(async ({ where }: any) => {
        return (
            versions.find(
                (v) =>
                    (where.type === undefined || v.type === where.type) &&
                    (where.seq === undefined || v.seq === where.seq)
            ) ?? null
        );
    })
};

const ruryDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsRury.filter((r) => r.versionId === where.versionId)
    )
};
const studnieDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsStudnie.filter((r) => r.versionId === where.versionId)
    )
};
const konfigDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsKonfig.filter((r) => r.versionId === where.versionId)
    )
};
const kinetyDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsKinety.filter((r) => r.versionId === where.versionId)
    )
};
const zakresyDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsZakresy.filter((r) => r.versionId === where.versionId)
    )
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: versionDelegate,
        pricelistItemRury: ruryDelegate,
        pricelistItemStudnie: studnieDelegate,
        pricelistItemPrecoKonfig: konfigDelegate,
        pricelistItemPrecoKinety: kinetyDelegate,
        pricelistItemPrecoZakresy: zakresyDelegate
    }
}));

import router from '../src/routes/pricelistVersions';

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', router);

const ADMIN = { 'x-user-id': 'admin-1', 'x-user-role': 'admin' };

function version(partial: Partial<VRow> & Pick<VRow, 'id' | 'type' | 'seq' | 'version'>): VRow {
    return {
        status: 'ACTIVE',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        sha256: 'sha',
        ...partial
    };
}

function rura(versionId: string, id: string, price: number, weight = 2) {
    return {
        id: `${versionId}:${id}`,
        versionId,
        name: `Rura ${id}`,
        category: 'Rury',
        price,
        weight
    };
}

function kineta(
    versionId: string,
    id: string,
    fields: { wellDn: number; dn: number; order: number; height: number; cena: number }
) {
    return { id: `${versionId}:${id}`, versionId, ...fields };
}

beforeEach(() => {
    jest.clearAllMocks();
    versions = [
        version({ id: 'rury-a', type: 'rury', seq: 1, version: 'v1' }),
        version({ id: 'rury-b', type: 'rury', seq: 2, version: 'v2' }),
        version({ id: 'rury-c', type: 'rury', seq: 3, version: 'v3' }),
        version({ id: 'studnie-a', type: 'studnie', seq: 1, version: 'sv1' }),
        version({ id: 'preco-a', type: 'preco', seq: 1, version: 'pv1' }),
        version({ id: 'preco-b', type: 'preco', seq: 2, version: 'pv2' }),
        version({ id: 'preco-empty', type: 'preco', seq: 9, version: 'pv9' })
    ];
    itemsRury = [rura('rury-a', 'R1', 100), rura('rury-b', 'R1', 150), rura('rury-c', 'R1', 200)];
    itemsStudnie = [];
    itemsKonfig = [
        { id: 'preco-a:k1000', versionId: 'preco-a', key: '1000', value: '{"a":1,"b":2}' },
        { id: 'preco-b:k1000', versionId: 'preco-b', key: '1000', value: '{"b":2,"a":1}' }
    ];
    itemsKinety = [
        kineta('preco-a', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 500, cena: 11 }),
        kineta('preco-b', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 600, cena: 13 })
    ];
    itemsZakresy = [
        {
            id: 'preco-a:z1',
            versionId: 'preco-a',
            wellDn: 1000,
            label: 'spadekKineta',
            min: 0,
            max: 100,
            order: 0,
            grupy: '{"160":10}'
        },
        {
            id: 'preco-b:z1',
            versionId: 'preco-b',
            wellDn: 1000,
            label: 'spadekKineta',
            min: 0,
            max: 100,
            order: 0,
            grupy: '{"160":20}'
        }
    ];
});

describe('GET /:id/diff — kierunek i wybór wersji bazowej', () => {
    test('bez against: seq-1 (legacy), from/to/previousVersion', async () => {
        const res = await request(app).get('/api/pricelist-versions/rury-c/diff').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.version).toBe('v3');
        expect(res.body.previousVersion).toBe('v2');
        expect(res.body.from).toEqual({ id: 'rury-b', version: 'v2', seq: 2 });
        expect(res.body.to).toEqual({ id: 'rury-c', version: 'v3', seq: 3 });
        expect(res.body.changes[0]).toMatchObject({
            id: 'R1',
            kind: 'changed',
            before: 150,
            after: 200,
            deltaPct: 33.3
        });
        expect(res.headers['cache-control']).toBe('no-store');
    });

    test('against starsza wersja: pomija seq-2 i porównuje do wskazanej', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/rury-c/diff?against=rury-a')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.from).toEqual({ id: 'rury-a', version: 'v1', seq: 1 });
        expect(res.body.to).toEqual({ id: 'rury-c', version: 'v3', seq: 3 });
        expect(res.body.previousVersion).toBe('v1');
        expect(res.body.changes[0]).toMatchObject({ before: 100, after: 200, deltaPct: 100 });
    });

    test('kierunek wstecz: from = against (nowsza), to = id (starsza)', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/rury-a/diff?against=rury-c')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.version).toBe('v1');
        expect(res.body.previousVersion).toBe('v3');
        expect(res.body.from).toEqual({ id: 'rury-c', version: 'v3', seq: 3 });
        expect(res.body.to).toEqual({ id: 'rury-a', version: 'v1', seq: 1 });
        expect(res.body.changes[0]).toMatchObject({ before: 200, after: 100, deltaPct: -50 });
    });

    test('from=null gdy brak poprzedniej wersji', async () => {
        versions.push(version({ id: 'studnie-only', type: 'studnie', seq: 7, version: 's7' }));
        const res = await request(app).get('/api/pricelist-versions/studnie-only/diff').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.from).toBeNull();
        expect(res.body.previousVersion).toBeNull();
        expect(res.body.to).toEqual({ id: 'studnie-only', version: 's7', seq: 7 });
    });
});

describe('GET /:id/diff — walidacja i błędy', () => {
    test('against === id → 400 INVALID_QUERY bez wywołania serwisu', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/rury-a/diff?against=rury-a')
            .set(ADMIN);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_QUERY');
        expect(versionDelegate.findUnique).not.toHaveBeenCalled();
    });

    test('zły against → 400 INVALID_QUERY bez echa wejścia', async () => {
        const bad = [
            '?against=',
            '?against=..%2Fevil',
            '?against=%3Cscript%3E',
            `?against=${'x'.repeat(65)}`,
            '?against=rury-a&against=rury-b',
            '?against[x]=y'
        ];
        for (const query of bad) {
            const res = await request(app)
                .get(`/api/pricelist-versions/rury-a/diff${query}`)
                .set(ADMIN);
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_QUERY');
            const body = JSON.stringify(res.body);
            expect(body).not.toContain('evil');
            expect(body).not.toContain('script');
        }
        expect(versionDelegate.findUnique).not.toHaveBeenCalled();
    });

    test('against nie istnieje → 404 AGAINST_NOT_FOUND bez echa id', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/rury-a/diff?against=nie-ma')
            .set(ADMIN);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('AGAINST_NOT_FOUND');
        expect(JSON.stringify(res.body)).not.toContain('nie-ma');
    });

    test('against inny typ → 422 TYPE_MISMATCH bez echa id', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/rury-a/diff?against=studnie-a')
            .set(ADMIN);
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('TYPE_MISMATCH');
        expect(JSON.stringify(res.body)).not.toContain('studnie-a');
    });
});

describe('GET /:id/diff — cap, deltaPct i zmiany nie-cenowe', () => {
    test('cap 100: changes przycięte, truncated=true', async () => {
        versions.push(
            version({ id: 'rury-big1', type: 'rury', seq: 20, version: 'b1' }),
            version({ id: 'rury-big2', type: 'rury', seq: 21, version: 'b2' })
        );
        for (let i = 0; i < 150; i++) {
            const price = i === 0 ? 0 : i * 10;
            const next = i === 0 ? 50 : i * 10 + 5;
            itemsRury.push(rura('rury-big1', `B${i}`, price));
            itemsRury.push(rura('rury-big2', `B${i}`, next));
        }
        const res = await request(app).get('/api/pricelist-versions/rury-big2/diff').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.changes).toHaveLength(100);
        expect(res.body.changes[0].deltaPct).toBe(50);
        expect(
            res.body.changes.every((c: { deltaPct: number | null }) => c.deltaPct !== null)
        ).toBe(true);
        expect(res.body.truncated).toBe(true);
    });

    test('deltaPct=null gdy before=0', async () => {
        versions.push(
            version({ id: 'rury-zero1', type: 'rury', seq: 30, version: 'z1' }),
            version({ id: 'rury-zero2', type: 'rury', seq: 31, version: 'z2' })
        );
        itemsRury.push(rura('rury-zero1', 'Z1', 0), rura('rury-zero2', 'Z1', 50));
        const res = await request(app).get('/api/pricelist-versions/rury-zero2/diff').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.changes).toHaveLength(1);
        expect(res.body.changes[0]).toMatchObject({
            kind: 'changed',
            before: 0,
            after: 50,
            deltaPct: null
        });
    });

    test('rury: zmiana wagi → sections.changed, changes puste (tylko ceny)', async () => {
        versions.push(
            version({ id: 'rury-w1', type: 'rury', seq: 40, version: 'w1' }),
            version({ id: 'rury-w2', type: 'rury', seq: 41, version: 'w2' })
        );
        itemsRury.push(rura('rury-w1', 'W1', 100, 2), rura('rury-w2', 'W1', 100, 5));
        const res = await request(app).get('/api/pricelist-versions/rury-w2/diff').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections.rury).toEqual({ added: 0, removed: 0, changed: 1 });
        expect(res.body.changes).toEqual([]);
    });
});

describe('GET /:id/diff — PRECO: klucze naturalne i pola', () => {
    test('height + cena to dwa wpisy, sort po |deltaPct| malejąco', async () => {
        itemsKinety[1] = kineta('preco-b', 'k1', {
            wellDn: 1000,
            dn: 160,
            order: 0,
            height: 600,
            cena: 14
        });
        const res = await request(app)
            .get('/api/pricelist-versions/preco-b/diff?against=preco-a')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections.kinety).toEqual({ added: 0, removed: 0, changed: 1 });
        expect(res.body.changes).toHaveLength(2);
        expect(res.body.changes[0]).toMatchObject({
            section: 'kinety',
            id: '1000|160|0',
            name: 'DN1000 / rura 160',
            field: 'cena',
            before: 11,
            after: 14,
            deltaPct: 27.3
        });
        expect(res.body.changes[1]).toMatchObject({
            field: 'height',
            before: 500,
            after: 600,
            deltaPct: 20
        });
    });

    test('duplikat klucza bazowego → sufiks #2 deterministycznie', async () => {
        itemsKinety = [
            kineta('preco-a', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 500, cena: 11 }),
            kineta('preco-b', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 500, cena: 11 }),
            kineta('preco-b', 'k2', { wellDn: 1000, dn: 160, order: 0, height: 700, cena: 11 })
        ];
        const res = await request(app)
            .get('/api/pricelist-versions/preco-b/diff?against=preco-a')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections.kinety).toEqual({ added: 1, removed: 0, changed: 0 });
        expect(res.body.changes).toHaveLength(1);
        expect(res.body.changes[0]).toMatchObject({
            id: '1000|160|0#2',
            kind: 'added',
            field: 'height',
            after: 700
        });
    });

    test('duplikat klucza kinet: zmiana height nie zmienia parowania (tie-break po id)', async () => {
        itemsKinety = [
            kineta('preco-a', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 500, cena: 11 }),
            kineta('preco-a', 'k2', { wellDn: 1000, dn: 160, order: 0, height: 700, cena: 11 }),
            kineta('preco-b', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 800, cena: 11 }),
            kineta('preco-b', 'k2', { wellDn: 1000, dn: 160, order: 0, height: 700, cena: 11 })
        ];
        const res = await request(app)
            .get('/api/pricelist-versions/preco-b/diff?against=preco-a')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections.kinety).toEqual({ added: 0, removed: 0, changed: 1 });
        expect(res.body.changes).toHaveLength(1);
        expect(res.body.changes[0]).toMatchObject({
            id: '1000|160|0',
            kind: 'changed',
            field: 'height',
            before: 500,
            after: 800
        });
    });

    test('kineta tylko w from → removed z before=height, after=null', async () => {
        itemsKinety = [
            kineta('preco-a', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 500, cena: 11 }),
            kineta('preco-a', 'k2', { wellDn: 1000, dn: 160, order: 0, height: 700, cena: 11 }),
            kineta('preco-b', 'k1', { wellDn: 1000, dn: 160, order: 0, height: 500, cena: 11 })
        ];
        const res = await request(app)
            .get('/api/pricelist-versions/preco-b/diff?against=preco-a')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections.kinety).toEqual({ added: 0, removed: 1, changed: 0 });
        expect(res.body.changes).toHaveLength(1);
        expect(res.body.changes[0]).toMatchObject({
            kind: 'removed',
            field: 'height',
            before: 700,
            after: null
        });
    });

    test('konfig: inna kolejność kluczy JSON → changed=0', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/preco-b/diff?against=preco-a')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections.konfig).toEqual({ added: 0, removed: 0, changed: 0 });
    });

    test('zakresy: zmiana grupy JSON → changed bez wpisu w changes', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/preco-b/diff?against=preco-a')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections.zakresy).toEqual({ added: 0, removed: 0, changed: 1 });
        expect(res.body.changes.every((c: { section: string }) => c.section !== 'zakresy')).toBe(
            true
        );
    });

    test('puste sekcje PRECO: trzy liczniki zerowe, changes puste', async () => {
        const res = await request(app).get('/api/pricelist-versions/preco-empty/diff').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sections).toEqual({
            konfig: { added: 0, removed: 0, changed: 0 },
            kinety: { added: 0, removed: 0, changed: 0 },
            zakresy: { added: 0, removed: 0, changed: 0 }
        });
        expect(res.body.changes).toEqual([]);
        expect(res.body.from).toBeNull();
    });
});
