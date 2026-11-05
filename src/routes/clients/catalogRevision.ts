import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma-postgres/client';

type ClientRow = Prisma.clients_relGetPayload<object>;
type CatalogRow = Pick<ClientRow, 'id'> & Partial<ClientRow>;

export const CATALOG_CONFLICT_CODE = 'CLIENT_CATALOG_CONFLICT';
export const CATALOG_CONFLICT_MESSAGE =
    'Baza klientów zmieniła się w międzyczasie. Odśwież stronę, sprawdź zmiany i spróbuj ponownie.';

export function getClientCatalogRevision(rows: readonly CatalogRow[]): string {
    const sorted = [...rows].sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    );
    const values = sorted.map((r) => [
        r.id,
        r.userId,
        r.name,
        r.nip,
        r.address,
        r.email,
        r.phone,
        r.contact,
        r.clientNumber,
        r.createdAt,
        r.updatedAt
    ]);
    return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

export function readClientCatalog(db: Pick<Prisma.TransactionClient, '$queryRaw'>) {
    return db.$queryRaw<ClientRow[]>`
        SELECT id, "userId", name, nip, address, email, phone, contact,
               "clientNumber", "createdAt", "updatedAt"
        FROM clients_rel
    `;
}

export function normalizeClientCatalog(clients: readonly ClientRow[]): ClientRow[] {
    const normalize = (value: string | null) =>
        value && /^\d{10,}$/.test(value) ? new Date(Number(value)).toISOString() : value;
    return clients.map((client) => ({
        ...client,
        createdAt: normalize(client.createdAt),
        updatedAt: normalize(client.updatedAt)
    }));
}
