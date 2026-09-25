# Prompt + plan: Spójność backend–frontend w S.O.K.

> Status: PLAN (nie wykonywać bez GO). Źródło: audyt modułu Rury 6/10.

## Gotowy prompt dla AI (kopiuj całość)

```markdown
# Rola

Jesteś starszym inżynierem full-stack opiekującym się spójnością kontraktów
backend–frontend w projekcie S.O.K. (System Ofert i Kalkulacji).

# Kontekst projektu (obowiązkowy, nie zgaduj)

- Stack: TypeScript + Express + Prisma + SQLite (backend: `src/`, `server.ts`),
  Vanilla JS bez frameworka (frontend: `public/js/`, brak kompilacji tsc).
- Dwa źródła prawdy o pozycjach: tabele relacyjne (`offer_items_rel`,
  `production_orders_rel`, kolumny `wellCount`/`totalPrice`) ORAZ bloby JSON
  (`data`). Relacja/kolumna wygrywa, blob to fallback (reguła: "kolumna wygrywa
  z blobem", precedensy: błąd #48, liczniki kartoteki, `orderFkColumnWins`).
- Wzorce do naśladowania: allowlista DTO (`public/js/studnie/orderDto.js`,
  `_pickDtoFields` + dedykowane buildery zagnieżdżeń), merge przy zapisie
  (`{...oldData, ...rest}` + `preservePrintCounts`, NIGDY replace całości),
  slim-projekcje listy (`mapOfferRow`, `wellsCount`/`itemsCount`,
  `toNum` dla BigInt z Prisma `$queryRaw`), optimistic locking (`version` →
  409), `versionedWrite` + `assertDocLockForWrite` w każdej transakcji zapisu.
- Antywzorce do eliminacji: `.passthrough()` w schematach Zod wpuszczający
  śmieci do bloba, zapis `JSON.stringify(blobSrc)` bez merge, liczenie
  z bloba gdy istnieje tabela SSoT, pola tylko-w-blobie (niewidoczne dla
  filtrów/sortowania SQL).

# Reguły pracy (twarde)

1. Przed edycją przeczytaj WSZYSTKIE pliki, których dotyka zmiana
   (trasę + mapper + frontendowy konsument + testy).
2. Każdy kontrakt zmiana→test: istniejący test rozszerzasz albo dopisujesz
   nowy (wzorzec: `tests/searchSlimParity.test.ts` — prawdziwy `node:sqlite`,
   nie mock logiki).
3. Po zmianie: `npm run format`, `npm run typecheck`, `npm run lint`,
   `npm run lint:frontend`, `node -c` dla każdego ruszonego pliku z `public/js/`.
4. Komentarze i commity po polsku; kod (identyfikatory) po angielsku.
5. Bez placeholderów (`// reszta bez zmian` = błąd); jedna odpowiedzialność
   na funkcję; max 3 poziomy zagnieżdżeń; `escapeHtml` przy `innerHTML`.
6. Commit przez `node scripts/commit.mjs "typ(scope): temat"` (scope z listy
   commitlint); przed commitem `npm run version:check`.

# Zadanie

{OPIS_ZADANIA}

# Wymagany format odpowiedzi

1. **Mapa kontraktu**: tabela pole | backend (plik:linia) | frontend
   (plik:linia) | SSoT (relacja/kolumna/blob) — dla KAŻDEGO pola z zadania.
2. **Luka**: co się gubi/przekłamuje i w którą stronę (zapis vs odczyt).
3. **Fix**: minimalny diff w najmniejszej liczbie plików, z testem.
4. **Weryfikacja**: dokładne komendy + oczekiwany wynik.
```

## Plan poprawy (4 fazy)

**Faza 1 — inwentaryzacja kontraktów (1 sesja, read-only)**
Dla ofert rur, ofert studni, zamówień i PZ zbudować tabelę pole→SSoT (jak
w prompcie §1). Znane dziury startowe: `ruryCrud.ts:87-94` (GET gubi
`pehdCostPerUnit/surcharge/customLengthM/autoAdded/uid`),
`transportMode/transportSeparate` tylko w blobie, `offer_studnie_items_rel`
martwa (nikt nie czyta).

**Faza 2 — projekcje odczytu (kierunek serwer→klient)**

- Poszerzyć `offer_items_rel` w GET o brakujące pola pozycji (bez breaking
  change: dodać klucze, stare klienty ignorują).
- Zweryfikować każdy `mapOfferRow`/slim-mapper testem parzystości (wzorzec
  `searchSlimParity`).
- Kryterium STOP: round-trip rel→API→frontend bez utraty pól biznesowych.

**Faza 3 — merge zapisów (kierunek klient→serwer)**

- Przenieść wzorzec merge `#48` do PUT ofert rur i studni (slim-obiekt nie
  wycina `items`/`wells`; jawne `[]` = celowe czyszczenie — jak guard studni).
- Pola tylko-blobowe (`transportMode`...) albo do kolumn (jeśli filtrowane),
  albo na allowlistę DTO z testem.

**Faza 4 — strażnicy regresji**

- Test kontraktu na każdą parę trasa↔konsument (szablon: slim-PUT nie gubi,
  projekcja niesie).
- `npm run validate` zielone + `version:check`; commit per faza.

## Decyzja o zakresie (2026-09-25)

**Zakres: CAŁA APLIKACJA** — rury + studnie + PZ + kartoteka w pakiecie.
Powód: te same klasy rozjazdów występują w każdym module (blob vs relacja,
replace zamiast merge, liczenie z bloba), a fixy punktowe przenoszą problem
z miejsca na miejsce (lekcja z błędu #48: PZ → oferty rur → oferty studni).
Jeden kontrakt SSoT dla całości zamiast czterech lokalnych łatek.

### Rozszerzenie faz na całą aplikację

- **Faza 1**: mapa pole→SSoT dla 4 obszarów: pozycje rur (`offer_items_rel`),
  studnie oferty (`data.wells` + kolumna `wellCount`), zamówienia
  (`orders_rury_rel` / `orders_studnie_rel` + snapshoty), PZ
  (`production_orders_rel`: kolumny vs blob), kartoteka slim (`mapOfferRow`).
- **Faza 2**: parzystość projekcji dla KAŻDEGO mappera listy/detalu
  (rury GET, studnie GET, search slim, production `/index` vs detal).
- **Faza 3**: merge zapisów wszędzie tam, gdzie PUT przyjmuje partial
  (rury batch, studnie batch — guard już jest, PZ — merge już jest,
  zamówienia). Reguła: brak klucza = zachowaj stare, jawne `[]` = wyczyść.
- **Faza 4**: macierz kontraktów trasa↔konsument dla wszystkich par
  (tabela w `docs/` jako żywy dokument SSoT).
