import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';
import { startupLogger } from './startupLogger';

/**
 * Sprawdza czy konto administratora istnieje.
 * Jeśli nie — tworzy je z hasła z zmiennej środowiskowej DEFAULT_ADMIN_PASSWORD.
 * Jeśli admin nie istnieje i DEFAULT_ADMIN_PASSWORD nie jest ustawione — rzuca błędem (blokada startupu).
 */
export async function ensureAdminExists(): Promise<void> {
    startupLogger.info('Sprawdzanie konta administratora...');

    const admin = await prisma.users.findUnique({
        where: { username: 'admin' }
    });

    if (admin) {
        startupLogger.success('Konto administratora istnieje');
        return;
    }

    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!defaultPassword) {
        const msg = [
            '========================================',
            '  BŁĄD KRYTYCZNY — brak konta administratora',
            '========================================',
            '  Konto "admin" nie istnieje w bazie danych.',
            '  Aby je utworzyć, ustaw zmienną środowiskową:',
            '',
            '    DEFAULT_ADMIN_PASSWORD=<hasło_min_12_znaków>',
            '',
            '  a następnie uruchom aplikację ponownie.',
            '========================================'
        ].join('\n');

        console.error(msg);
        throw new Error(
            'DEFAULT_ADMIN_PASSWORD nie jest ustawione — nie można utworzyć konta admina'
        );
    }

    if (defaultPassword.length < 12) {
        throw new Error(
            `DEFAULT_ADMIN_PASSWORD jest za krótkie (${defaultPassword.length} znaków). Wymagane minimum: 12.`
        );
    }

    const hash = await bcrypt.hash(defaultPassword, 12);
    await prisma.users.create({
        data: {
            id: 'usr_admin',
            username: 'admin',
            password: hash,
            role: 'admin',
            firstName: 'System',
            lastName: 'Admin'
        }
    });

    startupLogger.success('Utworzono domyślne konto administratora');
}
