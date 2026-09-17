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
    clientNumber?: string;
    clientAddress: string;
    clientPhone: string;
    investName: string;
    investAddress: string;
    investContractor: string;
    items: unknown[];
    transportSeparate?: boolean;
    transportMode?: string;
    transportKm?: number;
    transportRate?: number;
    transportCount?: number;
    transportCostPerTrip?: number;
    transportCost?: number;
    createdAt: string;
    validityDays: number;
    notes: string;
    paymentTerms?: string;
    validity?: string;
    authorUser?: UserContactInfo | null;
    guardianUser?: UserContactInfo | null;
}

export interface StudnieOfferData {
    offerNumber: string;
    documentType?: 'offer' | 'order';
    orderNumber?: string;
    productionOrderNumber?: string;
    orderStatus?: string;
    clientName: string;
    clientNip: string;
    clientNumber?: string;
    clientAddress: string;
    clientPhone: string;
    investName: string;
    investAddress: string;
    investContractor: string;
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
        transportCost?: number | null;
    }>;
    transportCost: number;
    transportSeparate?: boolean;
    transportKm?: number;
    transportRate?: number;
    createdAt: string;
    validityDays: number;
    notes: string;
    paymentTerms?: string;
    validity?: string;
    wellUwagi?: Array<{ name: string; dn: string; uwagi: string }>;
    authorUser?: UserContactInfo | null;
    guardianUser?: UserContactInfo | null;
}
