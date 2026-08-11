# Implementation Plan: Wersjonowanie Cenników i Import/Eksport UI

## Overview

Plan wycofania doraźnego mechanizmu `price_defaults.json` oraz tabel `*_Default` na rzecz wersjonowania cenników (DRAFT / ACTIVE / ARCHIVED) wraz z pełnym interfejsem importu/eksportu w UI panelu Ustawień / Kartoteki.

## Requirements

- Pełna wsteczna kompatybilność istniejących ofert i zamówień (mrożenie cen w wyliczeniach).
- Brak przerwy w działaniu aplikacji (Expand & Contract strategy).
- Historia wersji cenników (autor, data aktywacji, opis zmian/komentarz).
- Podgląd różnic (Diff Viewer) przy imporcie nowych cen XLSX przed ich publikacją.
- Usunięcie długu technologicznego (`price_defaults.json`, `ProductsRuryDefault`, `ProductsStudnieDefault`, `Preco*Default`).

## Architecture Changes

- **Nowe modele Prisma**: `Pricelist`, `PricelistVersion`, `PricelistItemRury`, `PricelistItemStudnie`, `PricelistItemPreco*`.
- **Wsparcie dla PRECO (ADR-007)**: Dedykowana hierarchiczna struktura dla stawek Preco w nowej tabeli wersji.
- **Nowy Backend Engine**: `src/services/pricelistService.ts` zastępuje `priceOverrideService.ts`.
- **UI Zarządzania Cennikami**: `public/js/admin/pricelistManager.js` + eksport/import XLSX w Kartotece / Ustawieniach.

## Implementation Steps

### Phase 1: Rozszerzenie Bazy & Migracja Bezstratna (Expand Phase)

1. **Nowy Schemat Prisma** (`prisma/schema.prisma`)
    - Dodanie tabel `Pricelist`, `PricelistVersion` i pozycji wersjonowanych.
    - Dodanie opcjonalnego pola `pricelistVersionId` do `Offer` / `Order`.
2. **Automatyczny Skrypt Migracji** (`scripts/migrate-pricelists-v2.ts`)
    - Tworzy backup bazy SQLite (`npm run backup`).
    - Klonuje dane z obecnych tabel `ProductsRury`, `ProductsStudnie`, `Preco*` do wersji `v1.0.0` ze statusem `ACTIVE`.
    - Waliduje spójność i sumy kontrolne cen.

### Phase 2: Engine Backendowy & API Compatibility

1. **Pricelist Service** (`src/services/pricelistService.ts`)
    - Generowanie wersji DRAFT, aktywacja wersji (ACTIVE), wyszukiwanie aktywnego cennika po typie i dacie.
    - Podgląd różnic cenowych pomiędzy wersją DRAFT a ACTIVE.
2. **REST API Endpointy** (`src/routes/pricelists.ts`)
    - `GET /api/pricelists` — lista cenników i wersji.
    - `POST /api/pricelists/:type/versions` — tworzenie nowego DRAFT.
    - `PUT /api/pricelists/versions/:id/activate` — aktywacja wersji z zapisem w AuditLog.
    - `GET /api/pricelists/versions/:id/export` — pobranie XLSX.
    - `POST /api/pricelists/versions/import` — wczytanie XLSX do wersji DRAFT.
3. **Kompatybilność Wsteczna**
    - Istniejące szlaki `GET /api/rury/products`, `GET /api/studnie/products`, `GET /api/preco` przekierowane pod spodem do aktywnej wersji cennika (`ACTIVE`).

### Phase 3: Interfejs UI w Panelu Ustawień & Kartotece

1. **Widok Historii i Wersjonowania** (`public/js/admin/pricelistManager.js`)
    - Tabela wersji (v1.0.0, v1.1.0...) ze statusami DRAFT, ACTIVE, ARCHIVED.
    - Opcje: Podgląd różnic (Diff Viewer), Aktywuj, Pobierz XLSX, Edytuj szkic.
2. **Moduł Importu / Eksportu w UI**
    - Przycisk "Eksportuj XLSX" na liście produktów / w cenniku.
    - Modal "Importuj Cennik" z przeciąganiem pliku, walidacją nagłówków i wizualnym porównaniem zmian przed aktywacją.

### Phase 4: Integracja z Ofertami i Zamówieniami

1. **Audyt Wersji w Ofercie**
    - Podczas kalkulacji oferty zapisywane jest `pricelistVersionId`.
2. **Mrożenie Wyliczeń**
    - Oferty i zamówienia zachowują przeliczone ceny w snapshotach JSON. Zmiana aktywnego cennika nie wpływa retroaktywnie na historyczne wyceny.

### Phase 5: Czyszczenie i Redukcja Długu Technologicznego (Contract Phase)

1. **Wycofanie Legacy Systems**
    - Usunięcie `price_defaults.json` i procedury `restoreDefaultsFromJson` w `app.ts`.
    - Usunięcie zmigrowanych tabel `ProductsRuryDefault`, `ProductsStudnieDefault`, `Preco*Default` z `schema.prisma`.
    - Usunięcie przestarzałego `priceOverrideService.ts`.
2. **Weryfikacja**
    - Uruchomienie `npm run version:check`, `npm run validate` oraz testów dymnych.

## Testing Strategy

- Unit tests: `tests/services/pricelistService.test.ts` (tworzenie DRAFT, aktywacja, wyliczanie diffu).
- Integration tests: `tests/routes/pricelists.test.ts` (import/eksport XLSX, wsteczna kompatybilność starych GET endpoints).
- Smoke tests: Spróbowanie utworzenia oferty przy zmianie aktywnej wersji cennika.

## Risks & Mitigations

- **Risk**: Rozjazd cen przy migracji historycznej.
    - Mitigation: Skrypt migracyjny porównuje cenę każdego elementu sprzed i po migracji z błędem Tolerancji 0.00 PLN.
- **Risk**: Zaburzenie istniejących zintegrowanych modułów UI (Rury/Studnie).
    - Mitigation: Stare endpointy REST zachowane z pełną spójnością sygnatury odpowiedzi JSON.

## Success Criteria

- [ ] Usunięcie pliku `price_defaults.json` i tabel `*_Default`.
- [ ] Działający import i eksport XLSX z UI z poziomu panelu z podglądem różnic (diff).
- [ ] Historia i wersjonowanie cenników z zachowaniem kompatybilności dla stworzonych ofert.
