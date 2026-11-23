# Etap 2 — usunięcie tabel LIVE (roadmap)

> Status: **kod wykonany 2026-10-31, drop tabel w bazie oczekuje na backup
> i osobne GO.** Etap 1 (LIVE tylko do odczytu + detektor + twarde 409) wdrożony
> 2026-10-31, commity `252b3d7`…`c5de82d`. Etap 2: migracja plikowa
> `20261031120000_drop_pricelist_live` gotowa, niewykonana na żadnej bazie.

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

## Zakres techniczny (wykonany)

- `?source=live` usunięty (`422 INVALID_SOURCE`); `?source=default` czyta
  `data/seed_*.json`, zostają `active|draft`.
- `priceOverrideService.ts`, `routes/priceOverrides.ts`, `scripts/prices-export.ts`
  i `prices-import.ts` usunięte; `prices-verify.ts` przepisany na seed + ACTIVE.
  Detektor `drift.ts` (ACTIVE vs LIVE) usunięty razem z LIVE.
- `productsV2.ts` / `productsStudnieV2.ts` / `precoPricingV2.ts` — GET bez
  `source`: DRAFT → ACTIVE → seed (bez fallbacku do LIVE).
- Bootstrap (`ensureBaselineVersionsAtStartup`) tworzy v1 z seeda.
- PDF/DOCX i katalog produktów czytają ACTIVE (fallback seed) — `catalog.ts`.
- `prisma/seed.ts` tylko model ML; `check-db.js` sprawdza tabele wersji.
- Guard `tests/pricelistLegacyGuard.test.ts` → allowlista = 0.
- Migracja `20261031120000_drop_pricelist_live` (drop 10 tabel), **niewykonana**.
- Frontend: „Zapisz domyślne" usunięte; „Przywróć domyślne" czyta `/default` (seed).

## Kryteria akceptacji

- Brak referencji do `Products*`/`Preco*`/`*_Default`/`price_defaults` poza
  historią (guard zielony, allowlista pusta). **Spełnione.**
- Oferty, eksporty i PDF-y liczą wyłącznie z wersji; `prices:verify` sprawdza
  seed i integralność ACTIVE. **Spełnione.**
- Świeża instalacja: od razu ACTIVE v1 (seed), nowa oferta zapisuje się bez 409.
  **Do potwierdzenia testem świeżej instalacji po dropie.**
- Drop 10 tabel w bazie: backup pliku DB → `prisma migrate deploy` → smoke.
  **Oczekuje na osobne GO.**
