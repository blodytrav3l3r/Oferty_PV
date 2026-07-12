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
