export interface ApiResponse<T> {
    data?: T;
    error?: string;
    total?: number;
    limit?: number;
    offset?: number;
}

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
    wykorzystano?: number; // Used for algorithm building parts
    przejscia?: PassageConfig[];
    position?: number;
    isOverwritten?: boolean;
    overwrittenCost?: number;
    [key: string]: unknown;
}

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
