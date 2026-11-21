export interface ProductionOrderCrossReferenceSource {
    id: string;
    wellId: string | null;
    elementIndex: number | null;
    componentType: string | null;
    productName?: string | null;
    productionOrderNumber: string | null;
}

function getComponentKind(order: ProductionOrderCrossReferenceSource): 'dennica' | 'other' | null {
    if (order.componentType === 'dennica') return 'dennica';
    if (order.componentType) return 'other';

    const productName = order.productName || '';
    if (/dennic/i.test(productName)) return 'dennica';
    if (/(kr[ąa]g|kr[eę]g|styczn)/i.test(productName)) return 'other';
    return null;
}

/** Buduje tekst powiązań z numerów PZ zapisanych dla tej samej studni. */
export function buildProductionOrderCrossReferences(
    currentOrder: ProductionOrderCrossReferenceSource,
    orders: ProductionOrderCrossReferenceSource[]
): string {
    if (!currentOrder.wellId) return '';

    const siblings = orders
        .filter((order) => order.id !== currentOrder.id && order.wellId === currentOrder.wellId)
        .sort((left, right) => {
            const leftIndex = left.elementIndex ?? Number.MAX_SAFE_INTEGER;
            const rightIndex = right.elementIndex ?? Number.MAX_SAFE_INTEGER;
            return leftIndex - rightIndex || left.id.localeCompare(right.id);
        });
    if (siblings.length === 0) return '';

    const orderNumber = (order: ProductionOrderCrossReferenceSource) =>
        order.productionOrderNumber || '—';
    const currentKind = getComponentKind(currentOrder);
    if (!currentKind) return '';
    const typedSiblings = siblings.filter((order) => getComponentKind(order));

    if (currentKind === 'dennica') {
        return 'Kręgi: ' + typedSiblings.map(orderNumber).join(', ');
    }

    const dennice = typedSiblings.filter((order) => getComponentKind(order) === 'dennica');
    const otherRings = typedSiblings.filter((order) => getComponentKind(order) === 'other');
    const references = [
        ...dennice.map((order) => 'Studnia: ' + orderNumber(order)),
        ...otherRings.map((order) => 'Krąg: ' + orderNumber(order))
    ];

    return references.join(', ');
}
