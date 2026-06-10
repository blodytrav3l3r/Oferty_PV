/**
 * types.js — Definicje JSDoc dla głównych typów domenowych.
 *
 * Te definicje nie są importowane w runtime — służą jako dokumentacja
 * i wskazówki dla IDE (VS Code, WebStorm) poprzez @typedef w komentarzach.
 *
 * Aby użyć w pliku:
 *   /** @type {Well} * /
 *   const well = { ... };
 *
 * Lub w @param:
 *   /** @param {Well} well - Opis studni * /
 */

/**
 * @typedef {Object} Well
 * @property {string} id - Unikalny identyfikator (UUID lub 'well_{timestamp}')
 * @property {string} name - Nazwa studni (np. "Studnia DN1000 #1")
 * @property {string} dn - Średnica nominalna (np. "1000", "1200", "styczna")
 * @property {string} rzednaWlazu - Rzędna włazu (np. "150.50")
 * @property {string} rzednaDna - Rzędna dna (np. "147.20")
 * @property {string} [magazyn] - Magazyn (np. "KLB", "WL")
 * @property {Array<WellComponent>} [config] - Lista komponentów studni
 * @property {Object} [wellDiscounts] - Rabaty per DN
 * @property {Object} [precoPricing] - Cennik PRECO
 * @property {string} [material] - Materiał ('beton'|'zelbet')
 * @property {string} [stopnie] - Typ stopni ('brak'|'drabinka'|'nierdzewna')
 * @property {boolean} [redukcjaDN1000] - Czy redukcja do DN1000
 */

/**
 * @typedef {Object} WellComponent
 * @property {string} productId - ID produktu
 * @property {number} quantity - Ilość
 * @property {number} [unitPrice] - Cena jednostkowa
 * @property {number} [discount] - Rabat (%)
 * @property {boolean} [forced] - Czy wymuszony przez użytkownika
 */

/**
 * @typedef {Object} Offer
 * @property {string} id - Identyfikator oferty
 * @property {string} userId - ID opiekuna
 * @property {string} userName - Nazwa opiekuna
 * @property {string} createdByUserId - ID twórcy
 * @property {string} createdByUserName - Nazwa twórcy
 * @property {string} number - Numer oferty
 * @property {string} date - Data oferty
 * @property {string} clientName - Nazwa klienta
 * @property {string} clientNip - NIP klienta
 * @property {string} clientAddress - Adres klienta
 * @property {string} clientContact - Kontakt
 * @property {string} investName - Nazwa inwestycji
 * @property {string} investAddress - Adres inwestycji
 * @property {string} investContractor - Wykonawca
 * @property {string} notes - Uwagi
 * @property {string} paymentTerms - Warunki płatności
 * @property {string} validity - Ważność oferty
 * @property {Array<OfferItem>} items - Pozycje oferty (rury)
 * @property {Array<Well>} [wells] - Studnie (dla oferty studni)
 * @property {number} transportKm - Kilometry transportu
 * @property {number} transportRate - Stawka za km
 * @property {number} transportCostPerTrip - Koszt transportu
 * @property {number} transportCount - Liczba transportów
 * @property {number} transportCost - Łączny koszt transportu
 * @property {number} totalNetto - Wartość netto
 * @property {number} totalBrutto - Wartość brutto
 * @property {string} createdAt - Data utworzenia (ISO)
 * @property {string} [lastEditedBy] - Kto ostatnio edytował
 */

/**
 * @typedef {Object} OfferItem
 * @property {string} uid - Unikalny ID pozycji
 * @property {string} productId - ID produktu
 * @property {string} name - Nazwa produktu
 * @property {number} quantity - Ilość
 * @property {number} unitPrice - Cena jednostkowa
 * @property {number} discount - Rabat (%)
 * @property {number} [lengthM] - Długość (rury)
 * @property {number} [pehdThickness3mm] - PEHD 3mm (rury)
 * @property {number} [pehdThickness4mm] - PEHD 4mm (rury)
 * @property {boolean} [ordered] - Czy zamówione
 */

/**
 * @typedef {Object} Order
 * @property {string} id - Identyfikator zamówienia
 * @property {string} offerId - ID oferty źródłowej
 * @property {string} offerNumber - Numer oferty
 * @property {string} userId - ID opiekuna
 * @property {string} userName - Nazwa opiekuna
 * @property {string} [clientName] - Klient
 * @property {string} [investName] - Inwestycja
 * @property {string} status - Status ('active'|'draft')
 * @property {Array} [wells] - Zamówione studnie
 * @property {Object} [wellDiscounts] - Rabaty studni
 * @property {number} transportKm - Kilometry
 * @property {number} transportRate - Stawka
 * @property {number} transportCostPerTrip - Koszt kursu
 * @property {number} totalNetto - Wartość netto
 * @property {string} createdAt - Data utworzenia (ISO)
 * @property {Object} [kartaBudowyData] - Dane karty budowy
 */

/**
 * @typedef {Object} Product
 * @property {string} id - ID produktu (np. "R-10-1000-1000")
 * @property {string} name - Nazwa produktu
 * @property {string} category - Kategoria (rury)
 * @property {number} [price] - Cena
 * @property {number} [weight] - Waga (kg)
 * @property {number} [transport] - Transport
 * @property {string} [dn] - Średnica nominalna
 * @property {string} [material] - Materiał
 * @property {string} [height] - Wysokość (studnie)
 * @property {boolean} [formaStandardowa] - Forma standardowa (studnie)
 * @property {number} [magazynKLB] - Stan magazynu Kluczbork
 * @property {number} [magazynWL] - Stan magazynu Włocławek
 * @property {number} [wymMinDennicy] - Wymagana minimalna dennicy
 * @property {number} [zapasGora] - Zapas górny
 * @property {number} [zapasDol] - Zapas dolny
 */

/**
 * @typedef {Object} TransportLine
 * @property {string} productId - ID produktu
 * @property {string} name - Nazwa produktu
 * @property {number} quantity - Ilość
 * @property {number} weightPerPiece - Waga jednostkowa
 * @property {number} totalWeight - Łączna waga
 * @property {number} [pricePerPiece] - Cena jednostkowa
 * @property {number} [transportPerPiece] - Koszt transportu/szt
 */

/**
 * @typedef {Object} KartaBudowyData
 * @property {string} offerNumber - Numer oferty
 * @property {string} orderNumber - Numer zamówienia
 * @property {string} [clientName] - Klient
 * @property {string} [investName] - Inwestycja
 * @property {number} transportKm - Kilometry
 * @property {number} transportRate - Stawka
 * @property {string} [uwagi] - Uwagi
 * @property {string} [dataZamowienia] - Data zamówienia
 * @property {string} [terminDostawy] - Termin dostawy
 * @property {string} [miejsceRozladunku] - Miejsce rozładunku
 * @property {string} [platnik] - Płatnik
 * @property {string} [odbiorca] - Odbiorca
 * @property {Array} [przejscia] - Przejścia zamówione w ofercie
 * @property {Array} [customRows] - Dodatkowe wiersze
 */

/**
 * @typedef {Object} WellDiscounts
 * @property {Object<string, {dennica: number, nadbudowa: number, preco: number}>} - Rabaty per DN
 * @property {number} dennica - Rabat na dennicę (%)
 * @property {number} nadbudowa - Rabat na nadbudowę (%)
 * @property {number} preco - Rabat na PRECO (%)
 */

/**
 * @typedef {'admin'|'pro'|'user'} UserRole
 */

/**
 * @typedef {Object} CurrentUser
 * @property {string} id - ID użytkownika
 * @property {string} username - Nazwa użytkownika
 * @property {string} [firstName] - Imię
 * @property {string} [lastName] - Nazwisko
 * @property {string} [symbol] - Symbol (np. "JP")
 * @property {UserRole} role - Rola
 * @property {Array<{id: string, username: string}>} [subUsers] - Podużytkownicy (dla pro)
 */
