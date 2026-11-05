import bcrypt from 'bcryptjs';
import prisma from '../src/prismaClient';
import { ensureAdminExists, isUnsafeDefaultAdminPassword } from '../src/middleware/auth';

async function main(): Promise<void> {
    try {
        const existingAdmin = await prisma.users.findUnique({
            where: { username: 'admin' },
            select: { id: true }
        });
        const configuredCredential = process.env.DEFAULT_ADMIN_PASSWORD ?? '';
        const shouldRotateExistingAdmin = process.env.RESET_ADMIN_PASSWORD_ON_BOOTSTRAP === 'true';
        if (existingAdmin && shouldRotateExistingAdmin) {
            if (isUnsafeDefaultAdminPassword(configuredCredential)) {
                throw new Error('Cannot rotate admin to an unsafe bootstrap credential');
            }
            const hash = await bcrypt.hash(configuredCredential, 10);
            await prisma.$transaction(async (tx) => {
                await tx.users.update({
                    where: { id: existingAdmin.id },
                    data: { password: hash }
                });
                await tx.sessions.deleteMany({ where: { userId: existingAdmin.id } });
            });
            console.info('[OK] Existing administrator credential rotated; sessions revoked.');
        } else {
            await ensureAdminExists();
        }
        const admin = await prisma.users.findUnique({
            where: { username: 'admin' },
            select: { password: true }
        });
        const matchesConfiguredCredential =
            typeof admin?.password === 'string' &&
            (await bcrypt.compare(configuredCredential, admin.password));
        console.info(`[INFO] SOK_ADMIN_CREDENTIAL_MATCH=${matchesConfiguredCredential}`);
        console.info('[OK] Initial administrator check completed.');
    } catch {
        console.error(
            '[ERROR] Initial administrator setup failed; inspect the redacted bootstrap logs.'
        );
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void main();
