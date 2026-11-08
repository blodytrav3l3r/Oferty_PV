import prisma from './prismaClient';
import { splitMergedContact } from './utils/contactSplit';
import { logger } from './utils/logger';

/**
 * One-time compatibility repair for legacy client rows. Table and indexes are
 * owned by PostgreSQL migrations; application startup must never change DDL.
 */
export async function ensureClientContactsTable(): Promise<void> {
    try {
        const clients = await prisma.clients_rel.findMany({
            select: {
                id: true,
                userId: true,
                contact: true,
                phone: true,
                email: true
            }
        });
        const contacts = clients.length
            ? await prisma.client_contacts_rel.findMany({
                  where: { clientId: { in: clients.map((client) => client.id) } },
                  select: { clientId: true }
              })
            : [];
        const clientsWithContacts = new Set(contacts.map((contact) => contact.clientId));
        const legacy = clients.filter((client) => !clientsWithContacts.has(client.id));
        const now = new Date().toISOString();
        const rows = legacy.flatMap((client) => {
            let name = (client.contact ?? '').trim();
            const email = (client.email ?? '').trim();
            const split = splitMergedContact(name, (client.phone ?? '').trim() || null);
            name = split.name;
            const phone = (split.phone ?? '').trim();
            if (!name && !phone && !email) return [];
            return [
                {
                    id: crypto.randomUUID(),
                    clientId: client.id,
                    name,
                    phone: phone || null,
                    email: email || null,
                    isPrimary: 1,
                    createdByUserId: client.userId,
                    createdAt: now,
                    updatedAt: now
                }
            ];
        });
        if (rows.length) await prisma.client_contacts_rel.createMany({ data: rows });

        const existing = await prisma.client_contacts_rel.findMany({
            select: { id: true, name: true, phone: true }
        });
        for (const contact of existing) {
            const split = splitMergedContact(contact.name, contact.phone);
            if (split.name === contact.name) continue;
            await prisma.client_contacts_rel.update({
                where: { id: contact.id },
                data: { name: split.name, phone: split.phone, updatedAt: now }
            });
        }
    } catch (error) {
        logger.warn(
            'Server',
            'Nie udało się wykonać zgodnościowego backfillu kontaktów klienta',
            error instanceof Error ? error.message : String(error)
        );
    }
}
