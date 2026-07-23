# ADR-005: Ujednolicony system cenników

## Status

Zaakceptowany

## Data

2026-07-23

## Kontekst

System posiada 3 moduły cenników: Rury, Studnie i PRECO. Każdy z nich ewoluował niezależnie, co
doprowadziło do niespójności w:

- Zabezpieczeniach (writeLock, requireAdmin)
- Obsłudze przywracania wartości fabrycznych (Reset)
- Formacie odpowiedzi GET /default (fallback do LIVE w PRECO)
- Ekspozycji funkcji frontendowych na window

## Decyzja

### 1. Spójny wzorzec API dla wszystkich modułów

| Endpoint     | Rury                | Studnie             | PRECO                                    |
| ------------ | ------------------- | ------------------- | ---------------------------------------- |
| PUT /        | DELETE ALL + INSERT | DELETE ALL + INSERT | DELETE ALL + INSERT (3 tabele)           |
| PATCH        | /:id (1 rekord)     | /:id (1 rekord)     | / (merge DN, bo struktura hierarchiczna) |
| DELETE       | /:id                | /:id                | brak (PUT pokrywa)                       |
| GET /default | zawsze DEFAULT      | zawsze DEFAULT      | zawsze DEFAULT (bez fallbacku)           |

### 2. writeLock na wszystkich modyfikowalnych endpointach

Każdy moduł chroni PUT/PATCH/DELETE przed race condition przez `acquireLock()`/`releaseLock()`.

### 3. requireAdmin na wszystkich modyfikowalnych endpointach

Tylko administrator może zmieniać ceny w cenniku.

### 4. Reset w każdym module

Każdy moduł ma przycisk Reset pobierający dane z `GET /default` i ładujący do lokalnego stanu
(wymaga kliknięcia "Zapisz" by utrwalić).

### 5. PRECO zachowuje osobną strukturę danych

PRECO ma strukturę hierarchiczną (DN → konfig + kinety + zakresy), ponieważ:

- To tabela kalkulacyjna stawek, a nie katalog produktów
- Cena zależy od kombinacji parametrów (DN studni, DN rury, spadek, uniesienie)
- Frontend operuje przez lookup po kluczu DN i iterację zakresową
- Spłaszczenie do płaskiej listy wygenerowałoby ~7200 kombinacji zamiast ~50 wierszy

Różnica struktur w bazie jest akceptowalna — API i mechanizmy synchronizacji są ujednolicone.

### 6. Price Overrides

Jeden serwis (`priceOverrideService.ts`) obsługuje wszystkie 3 moduły.
Rury/Studnie: format records + deletedIds. PRECO: osobny format (konfig/kinety/zakresy)
ze względu na hierarchiczną strukturę danych.

## Konsekwencje

### Pozytywne

- Spójne zachowanie dla użytkownika we wszystkich modułach
- Jednolity mechanizm synchronizacji cen między komputerami (price_overrides.json)
- Ochrona przed race condition (writeLock) i nieautoryzowanym dostępem (requireAdmin)
- Niższe ryzyko błędów przy dalszym rozwoju

### Negatywne

- PRECO nadal ma inny format danych w bazie (3 tabele zamiast 1), co wymaga osobnych ścieżek
  w priceOverrideService.ts
- PRECO nie wspiera DELETE /:id (nie ma naturalnego ID dla pojedynczej zmiany)

## Uzasadnienie

Spójność API i mechanizmów synchronizacji jest ważniejsza niż spójność struktur danych w bazie.
PRECO z natury jest inny (tabela kalkulacyjna vs katalog produktów) — wymuszanie płaskiej
struktury dałoby ~7200 kombinacji zamiast ~50 wierszy, pogarszając wydajność i czytelność.
