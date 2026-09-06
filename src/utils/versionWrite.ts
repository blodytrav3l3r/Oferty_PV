/**
 * P0-D2: współdzielony optimistic locking licznikiem `version`.
 * Predykat jest ZAWSZE w samym zapisie (SQLite nie ma SELECT FOR UPDATE):
 * UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?
 * 0 wierszy -> 409 VERSION_CONFLICT. Kolumna wygrywa z blobem JSON.
 */

export interface VersionedWriteModel {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
    }): Promise<{ count: number }>;
}

export interface VersionConflict {
    status: 409;
    code: 'VERSION_CONFLICT';
    message: string;
    serverVersion: number;
}

/** Wyciąga bazę spod klucza `version`, reszta (bez version) trafia do bloba. */
export function splitClientVersion(o: Record<string, unknown>): {
    clientVersion: number | null;
    rest: Record<string, unknown>;
} {
    const { version, ...rest } = o;
    return { clientVersion: typeof version === 'number' ? version : null, rest };
}

/**
 * Zapis z optimistic lockingiem. `exists` + `serverVersion` pochodzą z odczytu
 * wykonanego TUŻ przed zapisem (najlepiej w tej samej transakcji).
 * - brak rekordu -> create z version: 1
 * - klient podał version -> updateMany z predykatem, pudło -> throw 409
 * - klient nie podał version (stary klient) -> zapis bez sprawdzenia + bump
 */
export async function versionedWrite(
    model: VersionedWriteModel,
    args: {
        id: string;
        exists: boolean;
        serverVersion: number | null;
        clientVersion: number | null;
        createData: Record<string, unknown>;
        updateData: Record<string, unknown>;
        conflictMessage: string;
    }
): Promise<void> {
    if (!args.exists) {
        await model.create({ data: { ...args.createData, id: args.id, version: 1 } });
        return;
    }
    if (args.clientVersion != null) {
        const upd = await model.updateMany({
            where: { id: args.id, version: args.clientVersion },
            data: { ...args.updateData, version: { increment: 1 } }
        });
        if (upd.count === 0) {
            const err = new Error(args.conflictMessage) as Error & {
                status: number;
                code: string;
                serverVersion: number;
            };
            err.status = 409;
            err.code = 'VERSION_CONFLICT';
            err.serverVersion = args.serverVersion ?? 1;
            throw err;
        }
        return;
    }
    await model.updateMany({
        where: { id: args.id },
        data: { ...args.updateData, version: { increment: 1 } }
    });
}

/** Mapuje błąd wersji na odpowiedź 409. Zwraca true gdy obsłużony. */
export function mapVersionConflict(
    res: { status(code: number): { json(body: unknown): unknown } },
    e: unknown
): boolean {
    if ((e as { status?: number }).status === 409) {
        res.status(409).json({
            error: (e as { message?: string }).message || 'Konflikt wersji',
            code: (e as { code?: string }).code || 'VERSION_CONFLICT',
            serverVersion: (e as { serverVersion?: number }).serverVersion
        });
        return true;
    }
    return false;
}
