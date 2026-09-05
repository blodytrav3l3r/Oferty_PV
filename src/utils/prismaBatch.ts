/**
 * Chunkowany createMany — baza błędów #1 (seed timeout SQLite).
 * Abstrahuje TYLKO chunkowanie; transakcję prowadzi caller
 * (delegat tabeli z `tx` przekazany z zewnątrz, model transakcji bez zmian).
 */
export const SEED_CHUNK_SIZE = 25;

interface CreateManyDelegate<T> {
    createMany: (args: { data: T[] }) => Promise<{ count: number }>;
}

/** Wstawia wiersze paczkami po `chunkSize`; zwraca łączną liczbę. */
export async function chunkedCreateMany<T>(
    delegate: CreateManyDelegate<T>,
    rows: T[],
    chunkSize: number = SEED_CHUNK_SIZE
): Promise<number> {
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const res = await delegate.createMany({ data: chunk });
        total += typeof res?.count === 'number' ? res.count : chunk.length;
    }
    return total;
}
