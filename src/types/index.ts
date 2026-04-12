/**
 * Generyczny interfejs odpowiedzi API
 */
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    total?: number;
    limit?: number;
    offset?: number;
}

/**
 * Interfejs reprezentujący komponent studni (np. krąg, dennica)
 */
export interface WellComponent {
    id?: string;
    name?: string;
    opis?: string;
    typ?: string;
    componentType?: string;
    layer?: string;
    dn?: number;
    height?: number;
    wysokosc_uzytkowa?: number;
    waga?: number;
    pojemnosc?: number;
    ilosc_stopni?: number;
    wykorzystano?: number; // Używane przez algorytm do budowania elementów
    przejscia?: PassageConfig[];
    position?: number;
    isOverwritten?: boolean;
    overwrittenCost?: number;
    [key: string]: unknown;
}

/**
 * Konfiguracja przejścia szczelnego rury przez ścianę studni
 */
export interface PassageConfig {
    kat?: string | number;
    angle?: string | number;
    DN?: string | number;
    dn_przejscia?: string | number;
    typ_rury?: string;
    typ_przejscia?: string;
    height_from_bottom?: number;
    zapasDol?: number;
    zapasGora?: number;
    zapasDolMin?: number;
    zapasGoraMin?: number;
    [key: string]: unknown;
}

/**
 * Wpis w logu audytu
 */
export interface AuditLogEntry {
    id: string;
    entityType: string;
    entityId: string;
    userId: string;
    action: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    createdAt?: Date | string | null;
}
