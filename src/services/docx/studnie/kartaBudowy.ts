import { Packer, Document, Paragraph, Table } from 'docx';
import prisma from '../../../prismaClient';
import { logger } from '../../../utils/logger';
import {
    buildTitleSection,
    buildInfoSections,
    buildTransitionTable,
    buildUwagiSection
} from './kartaBudowySections';
import {
    loadProductsMap,
    buildRealTransitionsTable,
    buildElementCountTable
} from './kartaBudowyTables';

export async function generateKartaBudowyDOCX(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_studnie_rel.findUnique({ where: { id: orderId } });

    if (!order) {
        throw new Error('Zamówienie studni nie znaleziona');
    }

    let orderData: Record<string, unknown> = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as Record<string, unknown>;
        } catch (e) {
            logger.warn('DocxKartaBudowy', 'Nie udało się sparsować danych zamówienia', e);
        }
    }

    const kb = (orderData.kartaBudowy as Record<string, unknown>) || {};

    const nrZamowienia = String(
        orderData.orderNumber || orderData.productionOrderNumber || String(order.id).substring(0, 8)
    );

    kb.offerNumbers = String(
        orderData.offerNumber ||
            orderData.number ||
            (Array.isArray(kb.offerNumbers) ? kb.offerNumbers : '—')
    );

    const children: (Paragraph | Table)[] = [];

    children.push(...buildTitleSection(nrZamowienia));
    children.push(...buildInfoSections(kb));
    children.push(...buildTransitionTable(kb));
    children.push(buildUwagiSection(kb));

    const products = loadProductsMap();
    children.push(...buildRealTransitionsTable(orderData, products));
    children.push(...buildElementCountTable(orderData, products));

    const doc = new Document({
        styles: { paragraphStyles: [] },
        sections: [{ children }]
    });

    return Packer.toBuffer(doc);
}
