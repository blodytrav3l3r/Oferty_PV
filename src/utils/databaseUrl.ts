/**
 * Wymaga jawnego DATABASE_URL — brak fallbacku do domyślnej bazy.
 *
 * Wydzielone z prismaClient.ts, bo import klienta ma side-effect (Prisma runtime
 * ładuje .env), przez co brak env jest nieobserwowalny w teście modułowym.
 */
export function requireDatabaseUrl(raw: string | undefined): string {
    if (!raw) {
        throw new Error(
            'DATABASE_URL is required — brak fallbacku do domyślnej bazy (AGENTS.md / SYSTEM_INVARIANTS)'
        );
    }
    return raw;
}
