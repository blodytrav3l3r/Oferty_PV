import puppeteer from 'puppeteer';

export async function generatePDF(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' as any });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '15mm',
                bottom: '10mm',
                left: '15mm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

export function fmtInt(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function escapeHtml(input: unknown): string {
    if (input === null || input === undefined) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatCurrency(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return new Date().toLocaleDateString('pl-PL');
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr;
    try {
        return new Date(normalized).toLocaleDateString('pl-PL');
    } catch {
        return dateStr;
    }
}

export interface UserContactInfo {
    name: string;
    email: string;
    phone: string;
}

export interface RuryOfferData {
    offerNumber: string;
    documentType?: 'offer' | 'order';
    orderNumber?: string;
    productionOrderNumber?: string;
    orderStatus?: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    clientPhone: string;
    investName: string;
    investAddress: string;
    investContractor: string;
    items: Array<Record<string, unknown>>;
    createdAt: string;
    validityDays: number;
    notes: string;
    paymentTerms?: string;
    validity?: string;
    authorUser?: UserContactInfo | null;
    guardianUser?: UserContactInfo | null;
}

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

import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';

export interface StudnieOfferData {
    offerNumber: string;
    documentType?: 'offer' | 'order';
    orderNumber?: string;
    productionOrderNumber?: string;
    orderStatus?: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    clientPhone: string;
    investName: string;
    investAddress: string;
    items: Array<{
        productId?: string | null;
        productName?: string | null;
        quantity?: number | null;
        discount?: number | null;
        price?: number | null;
        dodatkowe_info?: string | null;
        DN?: string | null;
        height?: number;
        zwienczenie?: string;
    }>;
    transportCost: number;
    createdAt: string;
    validityDays: number;
    notes: string;
    paymentTerms?: string;
    validity?: string;
    authorUser?: UserContactInfo | null;
    guardianUser?: UserContactInfo | null;
}
