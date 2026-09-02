# ADR-009: Mapa produktów studni jako SSoT dla O(1) lookup

Data: 2026-09-02
Status: zaakceptowana
Powiązane: ADR-008 (modularyzacja), baza błędów #46, `public/js/studnie/globals.js:42`

## Kontekst

`studnieProducts` to tablica ~800 produktów. `public/js/studnie/*` wywoływał `studnieProducts.find(p=>p.id===id)` w pętlach render/pricing/solver (87 miejsc). Przy 10k studni `40M porównań` na tick. Potrzebny `O(1)` lookup.

## Decyzja

- Źródło prawdy: `studnieProducts` tablica + `studnieProductsById Map<string,Product>` budowana w `globals.js:42`.
- Klucz canonical: `String(product.id)` — jeden SSoT dla lookupu.
- Zapis: `window.studnieProducts =` jako jawny kontrakt grep-owalny (setter `Object.defineProperty window.studnieProducts` `globals.js:31` robi `_purgeOrphanOtProducts` + `_rebuildStudnieProductsById()`).
- Odczyt: `getStudnieProductById(id)` — `Map.get(String(id))`, lazy cheap detector `size !== length` + fallback `find(String(p.id)===k)` jako self-healing (hybrid: explicit setter + lazy guard).
- Formalny invariant dev/CI: `__assertStudnieMapFresh()` `every p=>Map.get(String(p.id))===p && Set size` `globals.js:55` — wykrywa podmianę elementu bez zmiany length oraz duplikaty ID (`Map last-write-wins` vs `find first-match-wins`).
- Precedence: `(resolveProduct(c.productId)?.componentType==='wlaz')` — nawiasy obowiązkowe (88e2868 regresja).

## Odrzucone alternatywy

- `Proxy` na tablicy — większa zmiana semantyki klasycznych globalnych skryptów (classic script `let` nie `window`), perf overhead, trudny `push/filter` trap.
- Sam lazy `size` guard bez `window.*` — magiczny, maskuje błędne assignmenty.
- Sam `window.*` bez guard — brittle przy przyszłym `push` bypass.

## Konsekwencje

- `grep -R "studnieProducts =" public/js/studnie` musi dawać 0 poza `let` decl (kontrakt).
- `offerStudnieById` i `ruryProductsById` analogicznie (lazy guard).
- Test `globalsMapStale.test.ts` direct assignment + duplicate ID.

## Weryfikacja

- `node -c public/js/studnie/globals.js`, `npm run typecheck:frontend`, `npm run test:quick` `globalsMapStale`.
