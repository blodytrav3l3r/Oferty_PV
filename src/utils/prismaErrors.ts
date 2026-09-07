/**
 * P2: mapowanie błędów Prisma na semantyczne kody HTTP.
 * - P2025 (brak rekordu przy update/delete) → 404 zamiast mylącego 500.
 * - P2002 (naruszenie UNIQUE) → 409 zamiast mylącego 500.
 * Wołaj w catch PRZED generycznym 500, po specyficznych mapowaniach
 * (np. PRODUCTION_NUMBER_CONFLICT ma pierwszeństwo).
 */

interface JsonRes {
    status(code: number): { json(body: unknown): unknown };
}

export function mapPrismaError(res: JsonRes, e: unknown, extra?: Record<string, unknown>): boolean {
    const code = (e as { code?: string }).code;
    if (code === 'P2025') {
        res.status(404).json({ error: 'Rekord nie istnieje', code: 'NOT_FOUND', ...extra });
        return true;
    }
    if (code === 'P2002') {
        res.status(409).json({
            error: 'Konflikt unikalności — rekord już istnieje',
            code: 'UNIQUE_CONFLICT',
            ...extra
        });
        return true;
    }
    return false;
}
