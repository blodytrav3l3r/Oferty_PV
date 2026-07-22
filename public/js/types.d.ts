/**
 * types.d.ts — Globalne deklaracje typów dla frontendu WITROS Oferty PV.
 * Plik jest automatycznie używany przez TypeScript (include w tsconfig.frontend.json).
 */

/* ===== Klient API ===== */
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

interface ApiRequestOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
    silent?: boolean;
}

interface ApiClient {
    get<T = unknown>(url: string, opts?: ApiRequestOptions): Promise<T | null>;
    post<T = unknown>(url: string, body?: unknown, opts?: ApiRequestOptions): Promise<T | null>;
    put<T = unknown>(url: string, body?: unknown, opts?: ApiRequestOptions): Promise<T | null>;
    del<T = unknown>(url: string, opts?: ApiRequestOptions): Promise<T | null>;
    patch<T = unknown>(url: string, body?: unknown, opts?: ApiRequestOptions): Promise<T | null>;
    request<T = unknown>(url: string, opts?: ApiRequestOptions): Promise<T | null>;
    getWithRetry<T = unknown>(
        url: string,
        opts?: ApiRequestOptions,
        retries?: number,
        delayMs?: number
    ): Promise<T | null>;
}

/* ===== Logger ===== */
interface Logger {
    debug(tag: string, msg: string, ...args: unknown[]): void;
    info(tag: string, msg: string, ...args: unknown[]): void;
    warn(tag: string, msg: string, ...args: unknown[]): void;
    error(tag: string, msg: string, ...args: unknown[]): void;
}

/* ===== UI Helpers ===== */
interface ToastOptions {
    type?: 'success' | 'error' | 'info';
    duration?: number;
}

interface UI {
    showToast(msg: string, type?: 'success' | 'error' | 'info'): void;
    appConfirm(msg: string): Promise<boolean>;
    escapeHtml(str: string): string;
    formatCurrency(amount: number): string;
    formatDate(date: string | Date): string;
}

/* ===== Constants ===== */
interface AppConstants {
    VAT_RATE: number;
    DISCOUNT_MAX_PERCENT: number;
    API_TIMEOUT: number;
    APP_VERSION: string;
    MODULES: Record<string, string>;
}

/* ===== Formatters ===== */
interface Formatters {
    formatCurrency(amount: number, currency?: string): string;
    formatDate(date: string | Date, format?: string): string;
    formatNumber(num: number, decimals?: number): string;
    parseNumber(value: string): number;
}

/* ===== Moduł Auth ===== */
interface AuthUser {
    id: number;
    username: string;
    role: 'admin' | 'pro' | 'user';
    displayName?: string;
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
}

interface AuthModule {
    login(username: string, password: string): Promise<AuthUser>;
    logout(): void;
    getUser(): AuthUser | null;
    getToken(): string | null;
    isAuthenticated(): boolean;
    requireAuth(): Promise<AuthUser>;
}

/* ===== Icons ===== */
interface IconsModule {
    createIcons(options?: { root?: HTMLElement }): void;
    getIcon(name: string): string;
}

/** Augmentacja Window — globalne API dostępne przez window.* */
interface Window {
    api: ApiClient;
    logger: Logger;
    ui: UI;
    constants: AppConstants;
    formatters: Formatters;
    auth: AuthModule;
    icons: IconsModule;

    /** Lucide icons — tworzy ikony po innerHTML */
    lucide: {
        createIcons(options?: { root?: HTMLElement }): void;
    };

    /** Globalna funkcja escapeHtml (w razie braku ui) */
    escapeHtml(str: string): string;

    /** Funkcja showToast (w razie braku ui) */
    showToast(msg: string, type?: 'success' | 'error' | 'info'): void;

    /** Funkcja appConfirm (w razie braku ui) */
    appConfirm(msg: string): Promise<boolean>;
}

/* ===== Deklaracje globalne (do użytku w IIFE bez window.*) ===== */
declare var api: ApiClient;
declare var logger: Logger;
declare var auth: AuthModule;
declare function showToast(msg: string, type?: 'success' | 'error' | 'info'): void;
declare function appConfirm(msg: string): Promise<boolean>;
declare function escapeHtml(str: string): string;
declare function setText(el: HTMLElement | null, value: string | number | null | undefined): void;
declare function authHeaders(): Record<string, string>;
/* ===== Deklaracje dla window.* ===== */
interface Window {
    /* constants.js */
    MAX_TRANSPORT_WEIGHT: number;
    FLOW_TYPES: Readonly<Record<string, string>>;
    calcTransportCount(weight: number, mode: string): number;
    calcTransportCost(weight: number, km: number, rate: number, mode: string): number;
    formatTransportCount(count: number, mode: string): string;
    calculateTransportTrips(
        items: Array<{ weight: number; transport: number; quantity: number }>
    ): { totalTrips: number; saved: number };

    /* clientManager.js */
    clientsDb: ClientData[];
    fetchWithTimeout(url: string, options?: RequestInit, timeoutMs?: number): Promise<Response>;

    /* ui.js */
    globalUsersMap: Map<string, unknown>;

    showModal(options: {
        title?: string;
        content?: string;
        okText?: string;
        cancelText?: string;
        type?: string;
        id?: string;
        allowHtml?: boolean;
        width?: string;
        onOk?: (...args: unknown[]) => void;
        onCancel?: () => void;
        [key: string]: unknown;
    }): HTMLElement | null;

    /* printModal.js — funkcja ma wiele sygnatur (config obiekt lub 3 parametry) */
    showUniversalPrintModal: (...args: any[]) => void;
    __upmListenerInstalled: boolean;
    __upmShow: (config: PrintModalConfig) => void;
    __upmHelperShow: (config: PrintModalConfig) => void;
    __upmClose: () => void;

    /* calcInput.js */
    parseCalcExpression(expr: string): number | null;
    resolveFieldValue(inputEl: HTMLElement | null | undefined): number | null;

    /** Dynamiczne właściwości — studnie/, rury/, spa/ */
    [key: string]: any;
}

/* ===== Deklaracje bare global dla zmiennych ustawianych na window ===== */
declare var clientsDb: ClientData[];
declare var lucide: {
    createIcons(options?: { root?: HTMLElement }): void;
    replace?: (element?: HTMLElement) => void;
    icons?: Record<string, string[]>;
};
declare var fetchWithTimeout: (
    url: string,
    options?: RequestInit,
    timeoutMs?: number
) => Promise<Response>;
declare function showModal(options: {
    title?: string;
    content?: string;
    okText?: string;
    cancelText?: string;
    type?: 'info' | 'warning' | 'danger' | string;
    id?: string;
    allowHtml?: boolean;
    width?: string;
    onOk?: (...args: unknown[]) => void;
    onCancel?: () => void;
    [key: string]: unknown;
}): HTMLElement | null;
declare var showUniversalPrintModal: (...args: any[]) => void;
declare function closeModal(): void;

/* ===== Globalne deklaracje dla studnie/ (częściowa — patrz docelowe typowanie) ===== */
declare var XLSX: any;
declare var CATEGORIES_STUDNIE: Record<string, any>;
declare var FLOW_TYPES: Record<string, any>;
declare var ConfigSegment: any;
declare var currentOrder: any;
declare var global: typeof globalThis;
declare function autoSelectComponents(...args: any[]): any;
declare function autoUpdateWellName(...args: any[]): any;
declare function calcTransportCount(...args: any[]): any;
declare function ensureReliefRingPair(...args: any[]): any;
declare function formatTransportCount(...args: any[]): any;
declare function handleOfferPaintingCostChange(...args: any[]): any;
declare function handleOfferPehdDiscountChange(...args: any[]): any;
declare function initializeZleceniaModal(...args: any[]): any;
declare function kinetaLabel(...args: any[]): any;
declare function parseCalcExpression(expr: string): number | null;
declare function renderWellPrzejscia(...args: any[]): any;
declare function renderWellsList(...args: any[]): any;
declare function resolveEffectiveProduct(...args: any[]): any;
declare function tmApplyFilters(...args: any[]): any;
declare function tmRefreshWellData(...args: any[]): any;
declare function tmRenderTable(...args: any[]): any;
declare function tmUpdatePreview(...args: any[]): any;
declare function tmUpdateSelectedCount(...args: any[]): any;
declare function updateConfigToMatchParams(...args: any[]): any;
declare function updateSummary(...args: any[]): any;
declare function calcPrecoPricingPure(...args: any[]): any;

/* ===== Globalne deklaracje dla rury/ ===== */
declare var products: any;
declare var offers: any;
declare var editingOfferId: any;
declare var currentOfferItems: any;
declare function collectSelectedItemsForOrder(...args: any[]): any;
declare function updateTransportCostSummary(...args: any[]): any;
declare function calculateTransportTrips(...args: any[]): any;
declare function formatCurrency(amount: any, precision?: number): string;

/* ===== Typy dla Print Modal ===== */
interface PrintModalSection {
    id?: string;
    actionPdf?: string;
    actionDocx?: string;
    title?: string;
    description?: string;
    badge?: string;
}

interface PrintModalOrdersSection {
    orders: Array<Record<string, unknown>>;
    actionPdf?: string;
    actionDocx?: string;
    title?: string;
    description?: string;
}

interface PrintModalConfig {
    modalTitle?: string;
    subtitle?: string;
    offerSection?: PrintModalSection;
    orderCurrentSection?: PrintModalSection;
    ordersSection?: PrintModalOrdersSection;
    kartaSection?: PrintModalOrdersSection;
}

/* ===== Typy danych ===== */
interface ClientData {
    id: number | string;
    name: string;
    nip?: string;
    address?: string;
    contact?: string;
    clientNumber?: string;
    updatedAt?: string;
    createdAt?: string;
}

/* ===== Usprawnienia DOM dla vanilla JS ===== */
interface HTMLElement {
    /** Wiele skryptów używa .value na document.getElementById('...') */
    value?: string;
    checked?: boolean;
    disabled?: boolean;
    placeholder?: string;
    readOnly?: boolean;
    indeterminate?: boolean;
    type?: string;
    dataset?: DOMStringMap;
    offsetParent?: Element | null;
    select?: () => void;
    click?: () => void;
    files?: FileList | null;
}

interface Element {
    /** document.querySelector() zwraca Element, ale skrypt używa .style */
    style?: CSSStyleDeclaration;
    /** Element może być fokusowany */
    focus?: (options?: FocusOptions) => void;
    /** offsetParent dla obliczeń pozycjonowania */
    offsetParent?: Element | null;
    /** Vanilla JS: .value na polach formularza */
    value?: string;
    checked?: boolean;
    disabled?: boolean;
    placeholder?: string;
    type?: string;
    select?: () => void;
    click?: () => void;
    /** dataset dla data-* atrybutów */
    dataset?: DOMStringMap;
}

interface Node {
    /** Elementy w NodeList mogą być Element — skrypt sprawdza tagName */
    tagName?: string;
    hasAttribute?: (name: string) => boolean;
    querySelector?: (selectors: string) => Element | null;
    querySelectorAll?: (selectors: string) => NodeListOf<Element>;
}

interface EventTarget {
    closest?: (selectors: string) => Element | null;
}
