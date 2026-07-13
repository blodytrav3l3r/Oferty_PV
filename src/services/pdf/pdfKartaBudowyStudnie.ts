import path from 'path';
import fs from 'fs';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { generatePDF } from './pdfHelpers';
import { replaceKartaBudowyFields } from './pdfKartaBudowyFields';
import {
    loadAllProducts,
    buildPrzejsciaDetailsTable,
    buildRealTransitionsTable,
    buildElementCountTable
} from './pdfKartaBudowyTables';

export async function generateKartaBudowyPDF(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_studnie_rel.findUnique({
        where: { id: orderId }
    });

    if (!order) {
        throw new Error('Zamówienie studni nie znaleziona');
    }

    let orderData: Record<string, unknown> = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as Record<string, unknown>;
        } catch (e) {
            logger.warn('PdfKartaBudowy', 'Nie udało się sparsować danych zamówienia', e);
        }
    }

    const kb = (orderData.kartaBudowy as Record<string, unknown>) || {};

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'kartaBudowy.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    const nrZamowienia = String(
        orderData.orderNumber || orderData.id || String(order.id).substring(0, 8)
    );
    const nrOferty = String(
        orderData.offerNumber ||
            orderData.number ||
            (Array.isArray(kb.offerNumbers) ? kb.offerNumbers.join(', ') : '\u2014')
    );

    html = replaceKartaBudowyFields(html, kb, nrZamowienia, nrOferty);

    html = html.replace(
        /\{\{TABELA_PRZEJSCIA\}\}/g,
        buildPrzejsciaDetailsTable(kb.przejsciaDetails as unknown[])
    );

    const allProducts = loadAllProducts();
    const wsz = (Array.isArray(orderData.wells) ? orderData.wells : []) as any[];

    html = html.replace(
        /\{\{RZECZYWISTA_ILOSC_PRZEJSC\}\}/g,
        buildRealTransitionsTable(wsz, allProducts)
    );
    html = html.replace(
        /\{\{ILOSC_ELEMENTOW_ZAMOWIENIA\}\}/g,
        buildElementCountTable(wsz, allProducts)
    );
    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return generatePDF(html);
}
