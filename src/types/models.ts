/**
 * Modele domenowe - interfejsy dla encji aplikacji
 *
 * Odpowiadają strukturom z Prisma schema, ale dostosowane do potrzeb API.
 * Wszystkie pola opcjonalne (?) pochodzą z bazy SQLite która pozwala na NULL.
 */

// =============================================================================
// UŻYTKOWNICY
// =============================================================================

/**
 * Użytkownik w formie wejściowej (do tworzenia/aktualizacji)
 */
export interface UserInput {
    username: string;
    password?: string;
    role?: 'admin' | 'user' | 'pro';
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    symbol?: string;
    subUsers?: string[];
    orderStartNumber?: number;
    productionOrderStartNumber?: number;
}

/**
 * Użytkownik w formie wyjściowej (z API) - bez hasła
 */
export interface UserOutput {
    id: string;
    username: string;
    role: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    symbol?: string | null;
    subUsers: string[];
    orderStartNumber?: number | null;
    productionOrderStartNumber?: number | null;
    createdAt?: string | null;
    nextOrderNumber?: string;
}

// =============================================================================
// KLIENCI
// =============================================================================

/**
 * Klient w formie wejściowej
 */
export interface ClientInput {
    name: string;
    nip?: string;
    address?: string;
    email?: string;
    phone?: string;
    contact?: string;
}

/**
 * Klient w formie wyjściowej (z bazy danych)
 */
export interface ClientOutput {
    id: string;
    userId?: string | null;
    name?: string | null;
    nip?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    contact?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}

// =============================================================================
// PRODUKTY
// =============================================================================

/**
 * Produkt - rury
 */
export interface ProductRury {
    id: string;
    name?: string | null;
    price?: number | null;
    category?: string | null;
    weight?: number | null;
    transport?: number | null;
    area?: number | null;
    data?: Record<string, unknown>;
    unit?: string;
}

/**
 * Produkt - studnie (elementy studni)
 */
export interface ProductStudnie {
    id: string;
    name?: string | null;
    price?: number | null;
    category?: string | null;
    weight?: number | null;
    componentType?: string | null;
    dn?: number | null;
    h?: number | null;
    grubosc?: number | null;
    wewnetrzna?: number | null;
    l?: number | null;
    element?: string | null;
    index_k?: string | null;
    index_p?: string | null;
    formaStandardowa?: number | null;
    spocznikH?: string | null;
    data?: Record<string, unknown>;
    magazynWL?: number;
    magazynKLB?: number;
    height?: number;
    formaStandardowaKLB?: number;
    area?: number | null;
    areaExt?: number | null;
    transport?: number | null;
    zapasDol?: number | null;
    zapasGora?: number | null;
    zapasDolMin?: number | null;
    zapasGoraMin?: number | null;
}

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
 * Oferta rur - wejście
 */
export interface OfferInput {
    clientId?: string;
    state?: 'draft' | 'final';
    transportCost?: number;
    items?: OfferItem[];
    data?: Record<string, unknown>;
}

/**
 * Oferta rur - wyjście (z bazy/API)
 */
export interface OfferOutput {
    id: string;
    userId?: string | null;
    clientId?: string | null;
    state?: string | null;
    createdAt?: string | null;
    transportCost?: number | null;
    offerNumber?: string | null;
    data?: Record<string, unknown>;
    updatedAt?: string | null;
    history?: unknown[];
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

// =============================================================================
// OFERTY - STUDNIE
// =============================================================================

/**
 * Pozycja w ofercie studni
 */
export interface OfferStudnieItem {
    id?: string;
    productId?: string | null;
    quantity?: number | null;
    discount?: number | null;
    price?: number | null;
    dodatkoweInfo?: string | null;
}

/**
 * Dane studni w ofercie (pole JSON data)
 */
export interface WellData {
    id?: string;
    dn?: number | string;
    type?: string;
    totalPrice?: number;
    price?: number;
    zwienczenie?: string;
    components?: WellComponentData[];
    passages?: PassageData[];
    height?: number;
    depth?: number;
}

/**
 * Komponent studni w danych oferty
 */
export interface WellComponentData {
    id?: string;
    name?: string;
    typ?: string;
    componentType?: string;
    layer?: string;
    dn?: number;
    height?: number;
    wysokoscUzytkowa?: number;
    waga?: number;
    pojemnosc?: number;
    iloscStopni?: number;
    position?: number;
    quantity?: number;
    price?: number;
    isOverwritten?: boolean;
    overwrittenCost?: number;
}

/**
 * Przejście szczelne w danych oferty
 */
export interface PassageData {
    kat?: string | number;
    angle?: string | number;
    DN?: string | number;
    dnPrzejscia?: string | number;
    typRury?: string;
    typPrzejscia?: string;
    heightFromBottom?: number;
    zapasDol?: number;
    zapasGora?: number;
    zapasDolMin?: number;
    zapasGoraMin?: number;
}

/**
 * Oferta studni - wejście
 */
export interface OfferStudnieInput {
    clientId?: string;
    state?: 'draft' | 'final';
    transportCost?: number;
    wells?: WellData[];
    totalPrice?: number;
    data?: Record<string, unknown>;
}

/**
 * Oferta studni - wyjście (z bazy)
 */
export interface OfferStudnieOutput {
    id: string;
    userId?: string | null;
    clientId?: string | null;
    state?: string | null;
    createdAt?: string | null;
    transportCost?: number | null;
    offerNumber?: string | null;
    data?: Record<string, unknown>;
    updatedAt?: string | null;
    history?: unknown[];
}

/**
 * Oferta studni - mapowana dla frontendu
 */
export interface OfferStudnieMapped {
    id: string;
    type: 'studnia_oferta';
    userId?: string | null;
    title: string;
    price: number;
    status: 'active' | 'draft';
    createdAt?: string | null;
    updatedAt?: string | null;
    lastEditedBy?: string | null;
    data: Record<string, unknown>;
    history: unknown[];
}

// =============================================================================
// ZAMÓWIENIA
// =============================================================================

/**
 * Zamówienie studni - wejście
 */
export interface OrderStudnieInput {
    offerStudnieId?: string;
    status?: string;
    data?: Record<string, unknown>;
}

/**
 * Zamówienie studni - wyjście
 */
export interface OrderStudnieOutput {
    id: string;
    userId?: string | null;
    offerStudnieId?: string | null;
    createdAt?: string | null;
    status?: string | null;
    data?: Record<string, unknown>;
}

/**
 * Zamówienie produkcji - wejście
 */
export interface ProductionOrderInput {
    orderId?: string;
    wellId?: string;
    elementIndex?: number;
    data?: Record<string, unknown>;
}

/**
 * Zamówienie produkcji - wyjście
 */
export interface ProductionOrderOutput {
    id: string;
    userId?: string | null;
    orderId?: string | null;
    wellId?: string | null;
    elementIndex?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    data?: Record<string, unknown>;
    creatorId?: string;
}

// =============================================================================
// LOGI I USTAWIENIA
// =============================================================================

/**
 * Log audytowy - wejście
 */
export interface AuditLogInput {
    entityType: string;
    entityId: string;
    userId?: string;
    action: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
}

/**
 * Telemetria AI - wejście
 */
export interface TelemetryInput {
    userId?: string;
    originalAutoConfig?: Record<string, unknown>;
    finalUserConfig?: Record<string, unknown>;
    overrideReason?: string;
}

/**
 * Ustawienie systemowe
 */
export interface Setting {
    key: string;
    value?: string | null;
}

// =============================================================================
// DLA GENERATORÓW DOKUMENTÓW
// =============================================================================

/**
 * Informacje kontaktowe użytkownika (dla PDF/DOCX)
 */
export interface UserContactInfo {
    firstName?: string | null;
    lastName?: string | null;
    username: string;
    email?: string | null;
    phone?: string | null;
}

/**
 * Dane klienta dla dokumentów
 */
export interface ClientDocData {
    name?: string;
    nip?: string;
    address?: string;
    email?: string;
    phone?: string;
    contact?: string;
}

/**
 * Podsumowanie studni (dla tabeli w DOCX)
 */
export interface WellSummary {
    label: string;
    count: number;
    totalPrice: number;
}
