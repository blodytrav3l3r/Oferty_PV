# Etap 2 — usunięcie tabel LIVE (roadmap)

> Status: **plan, nie wykonany**. Etap 1 (LIVE tylko do odczytu + detektor +
> twarde 409) wdrożony 2026-10-31, commity `252b3d7`…`c5de82d`.

## Cel

Usunąć tabele `ProductsRury`, `ProductsStudnie`, `PrecoKonfig`, `PrecoKinety`,
`PrecoZakresy` oraz `*_Default` i plik `data/price_defaults.json`. Jedynym
źródłem cen zostają wersje cennika (I-014).

## Warunki wejścia (wszystkie obowiązkowe)

1. Etap 1 na produkcji ≥ 1 pełny cykl publikacji (co najmniej 2 wydania).
2. `npm run prices:verify -- --strict` zielone: ACTIVE vs LIVE bez rozjazdu
   (`changed=0`, `ceny=0`). Dziś zostaje `doplataPEHD=275` (świadoma podwyżka
   w Sv4; LIVE nieaktualny) — do rozstrzygnięcia przed etapem 2.
3. Zero zapisów do LIVE poza CLI: brak wpisów `pricelist_live` w `audit_logs`
   po dacie wdrożenia etapu 1.
4. Backup pliku DB + osobne GO na `prisma migrate` / drop tabel.

## Zakres techniczny

- `liveProjection.ts` + eksporty `?source=live|default` — usunąć, zostawić
  `?source=active|draft|version`.
- `priceOverrideService.ts` (restore/verify/export JSON) — usunąć wraz z
  `scripts/prices-import.ts`, `prices-export.ts`, `prices-verify.ts` (detektor
  przenieść do wersji: ACTIVE vs poprzednia ACTIVE).
- `productsV2.ts` / `productsStudnieV2.ts` / `precoPricingV2.ts` — GET bez
  `source` czyta tylko wersje (DRAFT → ACTIVE), bez fallbacku do LIVE.
- Bootstrap (`ensureBaselineVersionsAtStartup`) — bez LIVE nie ma z czego
  tworzyć v1: świeża instalacja musi dostać wersję z seeda.
- Guard `tests/pricelistLegacyGuard.test.ts` → allowlista = 0.
- Migracja: drop tabel LIVE i `*_Default` (osobne GO), po backupie.

## Kryteria akceptacji

- Brak referencji do `Products*`/`Preco*`/`*_Default`/`price_defaults` poza
  historią (guard zielony, allowlista pusta).
- Oferty, eksporty i PDF-y liczą wyłącznie z wersji; `prices:verify --strict`
  nie ma czego porównywać (skrypt usunięty lub przepisany na wersje).
- Świeża instalacja: od razu ACTIVE v1 (seed), nowa oferta zapisuje się bez 409.
