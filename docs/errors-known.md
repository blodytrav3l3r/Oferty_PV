# Znane błędy — Oferty_PV

## 1. Seed timeout na Render (productsStudnie)

**Problem**: 824 produktów × 35 pól = 28k wartości w jednej `$transaction` timeoutuje.
**Objaw**: `Operations timed out after N/A` — SQLite busy_timeout (5000ms default).
**Kontekst**: Render Persistent Disk (sieciowy) + SQLite 1 writer = wolne zapisy.

**Fix** (v2, `2418394`):
- chunk 25 produktów na transakcję (33 transakcje zamiast 1)
- `PRAGMA busy_timeout = 30000` w prismaClient.ts
- sekwencyjne init: rury → studnie → admin → listen

**Powiązane**: productsRury (94 prod) działa z timeout 120s.

## 2. Concurrent IIFE race condition

**Problem**: IIFE w `productsV2.ts` i `productsStudnieV2.ts` startowały równolegle przy `import`.
**Objaw**: SQLITE_BUSY — obie transakcje walczą o write lock.
**Fix** (`2418394`): IIFE → wyeksportowane funkcje, `server.ts` `await` sekwencyjnie.

## 3. XSS w innerHTML

**Problem**: Stringi użytkownika w `innerHTML` bez `escapeHtml()`.
**Objaw**: Podatność na XSS przy nazwach produktów/ofert.
**Fix** (`6cf8871`): zawsze `escapeHtml(str)` przy interpolacji HTML.

## 4. Kalkulator comma/dot (calcInput.ts)

**Problem**: Użytkownicy wprowadzają przecinek `,` zamiast kropki `.`.
**Objaw**: `safeEval()` zwraca NaN.
**Fix** (`9858c6f`): `value.replace(',', '.')` przed parsowaniem.

## 5. PEHD button — duplikacja stylów

**Problem**: `style="color:var(--warn)"` + `.pehd-btn { color:var(--warn) }` na tym samym elemencie.
**Objaw**: Konflikt CSS, zależnie od specyficzności.
**Fix** (`d08e8fc`): usunięto inline style, CSS klasa `pehd-btn` kontroluje wszystko.

## 6. isLocked TDZ (Temporal Dead Zone)

**Problem**: Zmienna `isLocked` używana przed deklaracją w `offerItems.js`.
**Objaw**: `ReferenceError: Cannot access 'isLocked' before initialization`.
**Fix** (`16a86d8`): hoist deklaracji przed użyciem.

## 7. colspan 13→15 w trybie porównania

**Problem**: Tabela ma 13 kolumn standard, 15 w trybie porównania — brak dynamicznego colspan.
**Objaw**: Tabela się rozjeżdża.
**Fix** (`16a86d8`): dynamiczny colspan w `updateRuryOrderSummary`.

## 8. toggleAllItemsForOrder guard

**Problem**: Brak sprawdzenia `data-uid` przed toggle.
**Objaw**: `TypeError: Cannot read properties of null`.
**Fix** (`16a86d8`): dodano guard `if (checkbox)`.

## 9. N+1 queries (Prisma)

**Problem**: Pętla `for` z `findUnique` wewnątrz zamiast batch `findMany` + Map lookup.
**Objaw**: Wolne endpointy, dużo SQLite queries.
**Fix** (`1bd859c`): Map lookup + `findMany` z `{ in: [...] }`.

## 10. Null guards na DOM queries

**Problem**: `document.querySelector()` zwraca null, brak sprawdzenia przed `.addEventListener`.
**Objaw**: `TypeError: Cannot read properties of null`.
**Fix** (`18a76b9`): `if (el) el.addEventListener(...)`.

## 11. Audit log cleanup timeout

**Problem**: `audit_logs.deleteMany` dla starych rekordów timeoutuje (dużo danych).
**Objaw**: `Operations timed out`.
**Fix** (planowany): chunkowane `deleteMany` z limitem + indeks na `createdAt`.

## 12. ensureAdminExists timeout

**Problem**: ensureAdminExists uruchamiany równolegle z seed produktów → SQLite busy.
**Objaw**: `Operations timed out after N/A`.
**Fix** (`2418394`): sekwencyjne init — produkty → admin → listen.

## 13. CSP violation z 'unsafe-inline'

**Problem**: Helmet CSP blokuje inline event handlers (`onclick="..."`).
**Fix** (`server.ts`): `scriptSrc: ["'self'", "'unsafe-inline'"]`.
**Uwaga**: Konieczne dla vanilla JS legacy patternów. Docelowo: migracja do `addEventListener`.

## 14. Spinner w input[type=number]

**Problem**: Chrome/FF pokazuje strzałki increment/decrement na polach liczbowych.
**Objaw**: Szpeci UI, user może przypadkowo zmienić wartość.
**Fix** (`style.css`): `::-webkit-inner-spin-button { appearance: none }` + `-moz-appearance: textfield`.

## 15. sort() mutacja oryginalnej tablicy

**Problem**: `.sort()` w JS jest in-place — mutuje oryginalną tablicę.
**Objaw**: Kolejność `products` zmienia się po renderowaniu.
**Fix** (`1bd859c`): `[...array].sort(...)` — kopia przed sortowaniem.
