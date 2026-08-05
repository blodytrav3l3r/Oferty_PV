# Plan napraw: dopłata wkładki PEHD w module studni
> **Stan: ZREALIZOWANE (commit f2895d1).** Wspólne helpery getPehdTypeForComponent/getPehdSurcharge w actionsWellPainting.js (używane przez actionsConfigRender, actionsWellPricing, offerWellComponents, solverValidation), seed uzupełniony o doplataPEHD (265 produktów; przejścia/kinety/konusy bez dopłaty), scripts/fill-pehd-seed.mjs, test tests/studnie/pehdPricing.test.ts, ruleEngine.getTopClosure respektuje forcedId z blokadą konusa przy wkładce, solverAutoSelect z fallbackiem Płyta DIN, tests/studnie/selectionRules.test.ts zaktualizowany. Treść ponizżej zachowana jako dokumentacja procesu.

Status: W TRAKCIE WDRAŻANIA (specyfikacja napraw realizowanych równolegle)
Data: 2026-08-02

## Problem

Logika cenowa dopłaty PEHD w `public/js/studnie/actionsWellPricing.js` jest poprawna,
ale **dane `doplataPEHD` w `data/seed_studnie.json` były `null` dla wszystkich produktów**
(w tym 96 dennic). Konsekwencje:

- Wybór wkładki PEHD (innej niż `'brak'`) **nie doliczał żadnej dopłaty** — cicha utrata
  przychodu w ofertach bez żadnego ostrzeżenia.
- Mapa `pehdType → typ komponentu` była **zdublowana w 5 miejscach** (m.in.
  `actionsWellPricing.js`, `actionsConfigRender.js`, `offerWellComponents.js`), co sprzyja
  rozjazdowi logiki przy kolejnych zmianach.
- Pętla przeliczania PEHD (`pricelistRepehd.js`) pomijała `przejscie`/`kineta`, ale **nie**
  `konus` — konusowi (który nie może mieć wkładki) liczono dopłatę.

## Decyzje

1. **Stawka 270 zł/m²** — domyślna wartość z UI, użyta do wypełnienia seeda
   (skrypt `scripts/fill-pehd-seed.mjs`). Użytkownik nadal może ją zmienić
   ręcznie w cenniku lub przez przeliczenie PEHD.
2. **Osobny rabat PEHD — bez zmian.** Rabat dennicy/nadbudowy **nie obejmuje** dopłaty
   PEHD. To zamierzone: wkładka ma własne pole rabatu `well.pehdDiscount`.
3. **Konus zabroniony z wkładką** (reguła biznesowa) — `getPehdTypeForComponent`
   zwraca `null` dla `'konus'`; konus wykluczony z pętli `recalculatePEHD`.

## Zmiany

| Plik                                       | Zmiana                                                                                                                                                                                    | Agent odpowiedzialny |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `public/js/studnie/actionsWellPainting.js` | Nowe wspólne helpery `getPehdTypeForComponent(well, componentType)` i `getPehdSurcharge(well, p, applyDiscount, item)` (SRP/DRY — jedna kopia mapowania)                                  | Agent A              |
| `public/js/studnie/actionsWellPricing.js`  | Usunięcie lokalnych kopii mapowania; użycie wspólnych helperów                                                                                                                            | Agent A              |
| `public/js/studnie/actionsConfigRender.js` | Usunięcie lokalnej kopii mapowania; użycie `getPehdTypeForComponent`                                                                                                                      | Agent A              |
| `public/js/studnie/offerWellComponents.js` | Usunięcie lokalnej kopii mapowania; użycie `getPehdTypeForComponent`                                                                                                                      | Agent A              |
| `public/js/studnie/solverValidation.js`    | W `recalculateWellErrors`: ostrzeżenie WARNING, gdy `wkladka !== 'brak'` a produkt ma `doplataPEHD` null/0; komunikat `'brak dopłaty PEHD'` wykluczony z twardych błędów (status WARNING) | Agent B              |
| `public/js/studnie/pricelistRepehd.js`     | Wykluczenie `'konus'` z pętli `recalculatePEHD`                                                                                                                                           | Agent C              |
| `data/seed_studnie.json`                   | Wypełnienie `doplataPEHD` (stawka 270 zł/m², wzór jak niżej; pominięte `przejscie`/`kineta`/`konus`)                                                                                      | Agent C              |
| `scripts/fill-pehd-seed.mjs`               | Nowy skrypt uzupełniający `doplataPEHD` w seedzie                                                                                                                                         | Agent C              |
| `tests/studnie/pehdPricing.test.ts`        | Nowy test regresyjny (vm + mockowane globali, wzorzec `recalculateWellErrors.test.ts`)                                                                                                    | Agent B              |
| `public/js/studnie/ruleEngine.js`          | `getTopClosure`: wymuszone zakończenie (`forcedId`) respektowane ZAWSZE (nie tylko przy braku wkładki); konus blokowany tylko gdy aktywna wkładka PEHD zwieńczenia                        | Agent A              |
| `public/js/studnie/solverAutoSelect.js`    | Fallback po `getTopClosure` przy aktywnej wkładce zwieńczenia wybiera Płytę DIN zamiast konusa; nie wskrzesza wymuszonego konusa z wkładką                                                | Agent A              |
| `tests/studnie/selectionRules.test.ts`     | Aktualizacja lokalnej kopii `getTopClosure` i testów: wymuszony konus + PEHD → null; wymuszony nie-konus (płyta/pierścień) + PEHD → respektowany                                          | Agent A              |

Wzór powierzchni efektywnej (`getPehdEffectiveArea`, już w `actionsWellPainting.js`):

- płyty: `×4/π`
- dennica / styczna: `dno×4/π + ściany`
- pozostałe: `area`

## Kontrakt API

```js
// Zwraca typ wkładki PEHD dla komponentu studni lub null, gdy wkładka niedozwolona.
// Dla 'konus' ZAWSZE null (konus z wkładką zabroniony — reguła biznesowa).
function getPehdTypeForComponent(well, componentType) {
    /* ... */
}

// Zwraca wartość dopłaty PEHD (PLN) dla produktu p w kontekście oferty.
// Zwraca 0, gdy: pehdType null/'brak', brak doplataPEHD, disablePehd itd.
function getPehdSurcharge(well, p, applyDiscount, item) {
    /* ... */
}
```

## Weryfikacja

```bash
node -c public/js/studnie/actionsWellPainting.js
node -c public/js/studnie/solverValidation.js
node -c public/js/studnie/pricelistRepehd.js
npm run typecheck
npm run lint:frontend
npx jest tests/studnie/pehdPricing.test.ts
npm run test:quick
npm run format
```

## Ryzyka i uwagi

- **Duplikacja mapowania** — celem naprawy jest jedna kopia (w `actionsWellPainting.js`).
  Po wdrożeniu sprawdzić, czy nie istnieją dalsze, nieujęte w planie kopie.
- **Rozjazd przy przyszłych zmianach** — każda nowa zmiana logiki PEHD musi iść przez
  wspólne helpery; przy code review pilnować, by nie pojawiły się kolejne inline-owe mapowania.
- **Reset cennika przez `ProductsStudnieDefault`** — po naprawie seeda reset przywróci
  spójne dane (z dopłatami); wcześniej reset odtwarzał stan z `null` i cichy brak dopłaty.
