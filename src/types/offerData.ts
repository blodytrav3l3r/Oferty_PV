/** Kształt JSON blob w offer.data / order.data dla ofert rur */
export interface RuryOfferDataBlob {
    type?: string;
    number?: string;
    date?: string;
    clientName?: string;
    clientNip?: string;
    clientAddress?: string;
    clientContact?: string;
    investName?: string;
    investAddress?: string;
    investContractor?: string;
    notes?: string;
    paymentTerms?: string;
    validity?: string;
    validityDays?: number;
    transportKm?: number;
    transportRate?: number;
    transportCostPerTrip?: number;
    transportMode?: string;
    transportCount?: number;
    transportCost?: number;
    totalNetto?: number;
    totalBrutto?: number;
    items?: unknown[];
    userId?: string | null;
    userName?: string;
    [key: string]: unknown;
}

/** Kształt JSON blob w offer.data / order.data dla ofert studni */
export interface StudnieOfferDataBlob {
    type?: string;
    number?: string;
    date?: string;
    clientName?: string;
    clientNip?: string;
    clientAddress?: string;
    clientContact?: string;
    investName?: string;
    investAddress?: string;
    investContractor?: string;
    notes?: string;
    paymentTerms?: string;
    validity?: string;
    validityDays?: number;
    transportKm?: number;
    transportRate?: number;
    transportMode?: string;
    totalWeight?: number;
    totalNetto?: number;
    totalBrutto?: number;
    wells?: unknown[];
    wellsExport?: unknown[];
    visiblePrzejsciaTypes?: string[];
    wellDiscounts?: Record<string, unknown>;
    budowa?: string;
    clientPhone?: string;
    status?: string;
    orderNumber?: string;
    productionOrderNumber?: string;
    [key: string]: unknown;
}

/** Kształt JSON blob w order.data dla zamówień rur */
export interface RuryOrderDataBlob extends RuryOfferDataBlob {
    orderNumber?: string;
    productionOrderNumber?: string;
    status?: string;
}

/** Kształt JSON blob w order.data dla zamówień studni */
export interface StudnieOrderDataBlob extends StudnieOfferDataBlob {
    orderNumber?: string;
    productionOrderNumber?: string;
    status?: string;
}

/** Element oferty rur (offer_item) */
export interface RuryOfferItem {
    productId?: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    lengthM?: number;
    [key: string]: unknown;
}

/** Studnia w ofercie (well) */
export interface StudnieWell {
    id?: string;
    name?: string;
    dn?: string;
    height?: number;
    weight?: number;
    price?: number;
    magazyn?: string;
    rzednaWlazu?: string;
    rzednaDna?: string;
    config?: unknown[];
    przejscia?: unknown[];
    [key: string]: unknown;
}

/** Eksportowa reprezentacja studni (wellExport) */
export interface StudnieWellExport {
    name?: string;
    dn?: string;
    height?: number;
    weight?: number;
    zwienczenie?: string;
    price?: number;
    transportCost?: number;
    totalPrice?: number;
    rzednaWlazu?: string;
    rzednaDna?: string;
    magazyn?: string;
    config?: unknown[];
    przejscia?: unknown[];
    [key: string]: unknown;
}
