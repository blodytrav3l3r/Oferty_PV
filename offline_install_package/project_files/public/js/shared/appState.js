/* ===== WITROS PRECISION OS — SINGLETON STANU APLIKACJI (RURY) ===== */
/* Faza 4 refaktoryzacji: enkapsulacja zmiennych globalnych */
/* Zamiast luźnych `let` na poziomie globalnym, cały stan współdzielony */
/* jest zarządzany przez obiekt AppState z walidacją typów. */
/* Moduły rury/ odwołują się do stanu przez window-level aliasy */
/* kompatybilne wstecz (products, offers, currentOfferItems itp.). */

/**
 * Centralny kontener stanu dla modułu Rury.
 * Zapewnia gettery/settery z walidacją typów i logowaniem błędów.
 *
 * @example
 *   AppState.products = await loadProducts();
 *   console.log(AppState.products.length);
 */
const AppState = {
    /* ===== PRYWATNE POLA ===== */
    _currentUser: null,
    _products: [],
    _offers: [],
    _clientsDb: [],
    _currentOfferItems: [],
    _editingOfferId: null,
    _editingOfferAssignedUserId: null,
    _editingOfferAssignedUserName: '',
    _isTransportBreakdownExpanded: false,

    /* ===== WALIDATORY ===== */

    /**
     * Sprawdza, czy wartość jest tablicą. Loguje ostrzeżenie przy błędzie.
     * @param {*} value — wartość do sprawdzenia
     * @param {string} fieldName — nazwa pola (do komunikatu)
     * @returns {boolean}
     */
    _validateArray(value, fieldName) {
        if (!Array.isArray(value)) {
            console.warn(`[AppState] ${fieldName} musi być tablicą, otrzymano:`, typeof value);
            return false;
        }
        return true;
    },

    /**
     * Sprawdza, czy wartość jest stringiem lub null. Loguje ostrzeżenie przy błędzie.
     * @param {*} value — wartość do sprawdzenia
     * @param {string} fieldName — nazwa pola (do komunikatu)
     * @returns {boolean}
     */
    _validateStringOrNull(value, fieldName) {
        if (value !== null && typeof value !== 'string') {
            console.warn(`[AppState] ${fieldName} musi być stringiem lub null, otrzymano:`, typeof value);
            return false;
        }
        return true;
    },

    /* ===== GETTERY / SETTERY ===== */

    /** Aktualnie zalogowany użytkownik (obiekt lub null) */
    get currentUser() { return this._currentUser; },
    set currentUser(value) {
        if (value !== null && typeof value !== 'object') {
            console.warn('[AppState] currentUser musi być obiektem lub null, otrzymano:', typeof value);
            return;
        }
        this._currentUser = value;
    },

    /** Tablica produktów załadowanych z cennika */
    get products() { return this._products; },
    set products(value) {
        if (!this._validateArray(value, 'products')) return;
        this._products = value;
    },

    /** Tablica zapisanych ofert */
    get offers() { return this._offers; },
    set offers(value) {
        if (!this._validateArray(value, 'offers')) return;
        this._offers = value;
    },

    /** Baza klientów (kartoteka) */
    get clientsDb() { return this._clientsDb; },
    set clientsDb(value) {
        if (!this._validateArray(value, 'clientsDb')) return;
        this._clientsDb = value;
    },

    /** Pozycje bieżącej edytowanej oferty */
    get currentOfferItems() { return this._currentOfferItems; },
    set currentOfferItems(value) {
        if (!this._validateArray(value, 'currentOfferItems')) return;
        this._currentOfferItems = value;
    },

    /** ID aktualnie edytowanej oferty (string lub null) */
    get editingOfferId() { return this._editingOfferId; },
    set editingOfferId(value) {
        if (!this._validateStringOrNull(value, 'editingOfferId')) return;
        this._editingOfferId = value;
    },

    /** ID przypisanego użytkownika-opiekuna (string lub null) */
    get editingOfferAssignedUserId() { return this._editingOfferAssignedUserId; },
    set editingOfferAssignedUserId(value) {
        if (!this._validateStringOrNull(value, 'editingOfferAssignedUserId')) return;
        this._editingOfferAssignedUserId = value;
    },

    /** Nazwa wyświetlana przypisanego opiekuna */
    get editingOfferAssignedUserName() { return this._editingOfferAssignedUserName; },
    set editingOfferAssignedUserName(value) {
        if (typeof value !== 'string') {
            console.warn('[AppState] editingOfferAssignedUserName musi być stringiem, otrzymano:', typeof value);
            return;
        }
        this._editingOfferAssignedUserName = value;
    },

    /** Czy sekcja rozkładu transportu jest rozwinięta */
    get isTransportBreakdownExpanded() { return this._isTransportBreakdownExpanded; },
    set isTransportBreakdownExpanded(value) {
        this._isTransportBreakdownExpanded = Boolean(value);
    },

    /* ===== METODY POMOCNICZE ===== */

    /**
     * Resetuje stan do wartości domyślnych (czyści bieżącą ofertę).
     * Przydatne przy tworzeniu nowej oferty lub wylogowaniu.
     */
    resetOfferState() {
        this._currentOfferItems = [];
        this._editingOfferId = null;
        this._editingOfferAssignedUserId = null;
        this._editingOfferAssignedUserName = '';
        this._isTransportBreakdownExpanded = false;
    },

    /**
     * Zwraca pełną migawkę stanu (do debugowania / logowania).
     * @returns {Object} — kopia stanu bez prywatnych prefiksów
     */
    snapshot() {
        return {
            currentUser: this._currentUser,
            productsCount: this._products.length,
            offersCount: this._offers.length,
            clientsDbCount: this._clientsDb.length,
            currentOfferItemsCount: this._currentOfferItems.length,
            editingOfferId: this._editingOfferId,
            editingOfferAssignedUserId: this._editingOfferAssignedUserId,
            editingOfferAssignedUserName: this._editingOfferAssignedUserName,
            isTransportBreakdownExpanded: this._isTransportBreakdownExpanded
        };
    }
};

/* ===== ALIASY GLOBALNE (KOMPATYBILNOŚĆ WSTECZNA) ===== */
/* Wszystkie moduły rury/ odwołują się do tych zmiennych bezpośrednio. */
/* Definiujemy je jako Object.defineProperty na window, by delegowały do AppState. */
/* Dzięki temu istniejący kod (products.find(...), currentOfferItems.push(...)) */
/* działa bez żadnych zmian — a jednocześnie walidacja i centralizacja jest aktywna. */

const _appStateGlobalAliases = [
    'currentUser',
    'products',
    'offers',
    'clientsDb',
    'currentOfferItems',
    'editingOfferId',
    'editingOfferAssignedUserId',
    'editingOfferAssignedUserName',
    'isTransportBreakdownExpanded'
];

_appStateGlobalAliases.forEach((key) => {
    Object.defineProperty(window, key, {
        get() { return AppState[key]; },
        set(value) { AppState[key] = value; },
        configurable: true,
        enumerable: true
    });
});
