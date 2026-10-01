# Auth bootstrap — decyzja P2.2: KEEP fallback (2026-09-28)

**Status:** DONE (analiza + weryfikacja, bez zmiany kodu — zmiana odrzucona świadomie).

## Pytanie

Czy usunąć `DEFAULT_ADMIN_FALLBACK_PASSWORD='anim123456'` z `src/middleware/auth.ts`?

## Odpowiedź: NIE. Produkcja jest bezpieczna, usunięcie łamie 20+ konsumentów bez zysku.

## Dowody

1. Produkcja odrzuca fallback (`src/middleware/auth.ts:201-213`): `NODE_ENV=production`
    - hasło `anim123456`/`CHANGE_ME_PLEASE` → `throw`, admin NIE powstaje.
      Brak `DEFAULT_ADMIN_PASSWORD` → `throw`. Testy regresji:
      `tests/authMiddleware.test.ts:287-311` (brak hasła, fallback na prodzie,
      placeholder na prodzie) — zielone.
2. Instalator generuje losowe hasło: `install.bat:60-61` → `scripts/init-env.mjs`
   (`randomBytes(12).base64url`) gdy `.env` pusty lub placeholder. Świeża
   instalacja NIGDY nie dostaje `anim123456`.
3. Konsumenci fallbacku (dev/test only, ~20): skrypty `scripts/benchmark*.mjs`,
   `scripts/load-100.mjs`, `scripts/test-app-views.cjs` oraz harnessy
   `tests/playwright/*.cjs` i `tests/playwright/*.spec.ts` używają
   `... || 'anim123456'` jako defaultu lokalnego. Usunięcie stałej z `auth.ts`
   ich nie rusza (mają własne literały), a usunięcie literałów wymusiłoby
   env na każdym dev-runie — koszt bez zysku bezpieczeństwa.
4. `.env.example` ma `CHANGE_ME_PLEASE` (też odrzucany na prodzie), nie `anim123456`.

## Ryzyko resztkowe

Deweloper może ręcznie ustawić `anim123456` w dev `.env` — akceptowane (dev only,
prod throw + warn w logach). Sekretów produkcyjnych w repo brak.

## Wniosek

Bez zmiany kodu. Ponowna ocena tylko gdy pojawi się multi-instance lub
centralny secret manager — wtedy osobny plan migracji.
