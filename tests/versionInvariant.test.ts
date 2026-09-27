import { versionedWrite, blindWrite } from '../src/utils/versionWrite';

/**
 * P1.2: mutation_success ⇒ version_after > version_before.
 * Każdy udany zapis bumpuje version; zapis w pustkę (0 wierszy) to jawny 409,
 * nigdy cichy sukces — dotyczy też ślepej ścieżki starego klienta (version null).
 */
function model(updateCount: number) {
    return {
        create: jest.fn(async () => ({})),
        updateMany: jest.fn(async () => ({ count: updateCount }))
    };
}

describe('P1.2 version invariant', () => {
    it('create startuje z version 1', async () => {
        const m = model(0);
        await versionedWrite(m, {
            id: 'a',
            exists: false,
            serverVersion: null,
            clientVersion: null,
            createData: {},
            updateData: {},
            conflictMessage: 'x'
        });
        expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ version: 1 }) });
    });

    it('predykat trafiony -> bump bez błędu', async () => {
        const m = model(1);
        await versionedWrite(m, {
            id: 'a',
            exists: true,
            serverVersion: 2,
            clientVersion: 2,
            createData: {},
            updateData: { state: 'final' },
            conflictMessage: 'x'
        });
        expect(m.updateMany).toHaveBeenCalledWith({
            where: { id: 'a', version: 2 },
            data: expect.objectContaining({ version: { increment: 1 } })
        });
    });

    it('predykat pudło -> 409 VERSION_CONFLICT', async () => {
        const m = model(0);
        const err = await versionedWrite(m, {
            id: 'a',
            exists: true,
            serverVersion: 2,
            clientVersion: 1,
            createData: {},
            updateData: {},
            conflictMessage: 'Stale'
        }).catch((e) => e);
        expect(err.status).toBe(409);
        expect(err.code).toBe('VERSION_CONFLICT');
        expect(err.serverVersion).toBe(2);
    });

    it('ślepy zapis w istniejący wiersz -> bump bez błędu', async () => {
        const m = model(1);
        await blindWrite(m, { id: 'a', updateData: { state: 'final' }, conflictMessage: 'x' });
        expect(m.updateMany).toHaveBeenCalledWith({
            where: { id: 'a' },
            data: expect.objectContaining({ version: { increment: 1 } })
        });
    });

    it('ślepy zapis w pustkę (0 wierszy) -> 409 zamiast cichego sukcesu', async () => {
        const m = model(0);
        const err = await blindWrite(m, {
            id: 'gone',
            updateData: {},
            conflictMessage: 'Rekord nie istnieje'
        }).catch((e) => e);
        expect(err.status).toBe(409);
        expect(err.code).toBe('VERSION_CONFLICT');
    });

    it('versionedWrite bez clientVersion deleguje do blindWrite (pustka -> 409)', async () => {
        const m = model(0);
        const err = await versionedWrite(m, {
            id: 'gone',
            exists: true,
            serverVersion: 3,
            clientVersion: null,
            createData: {},
            updateData: {},
            conflictMessage: 'Stale'
        }).catch((e) => e);
        expect(err.status).toBe(409);
        expect(err.code).toBe('VERSION_CONFLICT');
    });
});
