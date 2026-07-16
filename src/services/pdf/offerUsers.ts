import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { DOCX_COLORS } from '../docx/colors';
import type { UserContactInfo } from './types';

export async function lookupOfferUsers(
    offerData: Record<string, unknown>,
    offerUserId?: string | null
): Promise<{ authorUser: UserContactInfo | null; guardianUser: UserContactInfo | null }> {
    const formatUserName = (u: Record<string, unknown>): string =>
        u.firstName && u.lastName
            ? `${String(u.firstName)} ${String(u.lastName)}`
            : String(u.username);

    let guardianUser: UserContactInfo | null = null;
    let authorUser: UserContactInfo | null = null;

    const guardianId = typeof offerData.userId === 'string' ? offerData.userId : offerUserId;
    if (guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: guardianId } });
            if (u)
                guardianUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać opiekuna (guardian)', e);
        }
    }

    const authorId =
        typeof offerData.createdByUserId === 'string' ? offerData.createdByUserId : undefined;
    if (authorId && authorId !== guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: authorId } });
            if (u)
                authorUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać autora', e);
        }
    } else if (authorId && authorId === guardianId) {
        authorUser = null;
    }

    return { authorUser, guardianUser };
}

export function buildContactSectionHTML(
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): string {
    const renderUser = (title: string, u: UserContactInfo): string => {
        let ht = '<td style="vertical-align:top; width:50%; padding:4px 8px;">';
        ht += `<strong style="color:#${DOCX_COLORS.headerText};">${title}:</strong><br>`;
        ht += `<strong>${u.name}</strong><br>`;
        if (u.email)
            ht += `Email: <a href="mailto:${u.email}" style="color:#${DOCX_COLORS.labelText};text-decoration:none;">${u.email}</a><br>`;
        if (u.phone) ht += `Telefon: ${u.phone}`;
        ht += '</td>';
        return ht;
    };

    let html =
        '<div style="margin-top:20px; padding-top:10px; border-top:1.5px solid #${DOCX_COLORS.headerText}; font-size:9pt;">';

    if (!guardianUser && !authorUser) {
        html += '<p>W razie pytań prosimy o kontakt z opiekunem oferty.</p>';
    } else {
        html += '<table style="width:100%; border:none;"><tr>';
        if (authorUser) {
            html += renderUser('Ofertę przygotował(-a)', authorUser);
        }
        if (guardianUser) {
            html += renderUser('Opiekun handlowy (kontakt)', guardianUser);
        }
        html += '</tr></table>';
    }

    html += '</div>';
    return html;
}
