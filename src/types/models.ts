/**
 * Modele domenowe - interfejsy dla encji aplikacji
 *
 * Odpowiadają strukturom z Prisma schema, ale dostosowane do potrzeb API.
 * Wszystkie pola opcjonalne (?) pochodzą z bazy SQLite która pozwala na NULL.
 */

// =============================================================================
// OFERTY - RURY
// =============================================================================

/**
 * Pozycja w ofercie rur
 */
export interface OfferItem {
    id?: string;
    productId?: string | null;
    quantity?: number | null;
    discount?: number | null;
    price?: number | null;
    unitPrice?: number;
}

/**
 * Oferta rur - mapowana dla frontendu
 */
export interface OfferMapped {
    id: string;
    type: 'offer';
    userId?: string | null;
    title: string;
    price: number;
    status: 'active' | 'draft';
    createdAt?: string | null;
    updatedAt?: string | null;
    lastEditedBy?: string | null;
    items: OfferItem[];
    transportCost: number;
    history: unknown[];
}
