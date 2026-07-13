import prisma, { Prisma } from '../prismaClient';
import { parseJsonField } from '../helpers';

interface ProductionOrderRaw {
    id: string;
    userId: string | null;
    orderId: string | null;
    wellId: string | null;
    elementIndex: number | null;
    createdAt: string | null;
    updatedAt: string | null;
    data: string | null;
    handlerFirstName: string | null;
    handlerLastName: string | null;
    handlerUsername: string | null;
    creatorFirstName: string | null;
    creatorLastName: string | null;
    creatorUsername: string | null;
    orderData: string | null;
    dbSalesOrderId: string | null;
}

export async function fetchProductionOrders(whereCondition: Prisma.Sql, sortDesc = false) {
    const orders = await prisma.$queryRaw<ProductionOrderRaw[]>`
        SELECT production_orders_rel.id, production_orders_rel."userId", production_orders_rel."orderId", production_orders_rel."wellId", production_orders_rel."elementIndex", production_orders_rel.data,
            CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."createdAt" END as "createdAt",
            CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."updatedAt" END as "updatedAt",
            u1."firstName" as handlerFirstName, u1."lastName" as handlerLastName, u1.username as handlerUsername,
            u2."firstName" as creatorFirstName, u2."lastName" as creatorLastName, u2.username as creatorUsername, o.data as orderData,
            o.id as "dbSalesOrderId"
         FROM production_orders_rel 
         LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
         LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
         LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
         ${whereCondition}${sortDesc ? Prisma.sql` ORDER BY production_orders_rel."createdAt" DESC` : Prisma.empty}`;

    return orders.map(mapProductionOrder);
}

function mapProductionOrder(o: ProductionOrderRaw) {
    const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});

    const handlerName =
        o.handlerFirstName || o.handlerLastName
            ? `${o.handlerFirstName || ''} ${o.handlerLastName || ''}`.trim()
            : o.handlerUsername || '';

    const creatorName =
        o.creatorFirstName || o.creatorLastName
            ? `${o.creatorFirstName || ''} ${o.creatorLastName || ''}`.trim()
            : o.creatorUsername || '';

    const orderParsed = o.orderData ? parseJsonField<Record<string, unknown>>(o.orderData, {}) : {};
    const dbSalesOrderNumber = (orderParsed.orderNumber || '') as string;
    return {
        id: o.id,
        type: 'production_order',
        userId: o.userId,
        orderId: o.orderId,
        wellId: o.wellId,
        elementIndex: o.elementIndex,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        handlerName: handlerName || undefined,
        creatorName: creatorName || undefined,
        ...parsedData,
        dbSalesOrderNumber: dbSalesOrderNumber || undefined,
        dbSalesOrderId: o.dbSalesOrderId || undefined
    };
}

export async function recycleProductionNumber(userId: string, prodNum: string) {
    if (!prodNum) return;
    const parts = prodNum.split('/');
    if (parts.length < 4) return;
    const seqNumber = parseInt(parts[2], 10);
    const yearShort = parseInt(parts[3], 10);
    const fullYear = 2000 + yearShort;
    if (seqNumber <= 0) return;
    await prisma.$executeRaw`
        INSERT INTO recycled_production_numbers ("userId", year, seqNumber)
        VALUES (${userId}, ${fullYear}, ${seqNumber})
        ON CONFLICT ("userId", year, seqNumber) DO NOTHING
    `;
}
