# Security matrix P1-2 (read-only inventory + nowy test, 2026-09-29)

Metoda: `Select-String router.(get|post|put|patch|delete|use)` po `src/routes/**` + rewizja kodów w `shares.ts`, `offers/crud.ts`, `offers/ruryCrud.ts`, `locks.ts`.

## Reguła globalna (zweryfikowana w kodzie)

- Wszystkie mutacje i odczyty biznesowe: `requireAuth`. Admin: `+ requireAdmin` (`admin.ts`, `users.ts`, `pricelistVersions.ts` mutacje, `products*/delete`, `featureFlags` import-export/ai-ml/audit, `telemetryAiDashboard` knowledge, `telemetryAiMl` training-users).
- Publiczne z дизайна: `POST /api/auth/login|logout`, `GET /health`, `GET /health/pdf` (bez smoke), `GET /api/version`.
- Semantyka: brak obiektu → 404, cudzy obiekt → 403, zły format id → 400, cudzy lock → 404 (ukrywa istnienie — ostrzej niż 403, akcept).
- Komunikaty generyczne (`Forbidden`, `Dokument nie istnieje`) — bez id właściciela/nazw.

## Pokrycie testami (po tym batchu)

| Powierzchnia                                                      | Test                                                               | Status                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| ownership unit (read/write/assign/claim, legacy null fail-closed) | `tests/security/ownership.test.ts`, `tests/ownershipWrite.test.ts` | istniało                                                             |
| PUT rury cross-user 403 + brak transakcji                         | `tests/ownershipWrite.test.ts`                                     | istniało                                                             |
| **GET oferta cross-user 403 + non-disclosure + 404 + 400**        | **`tests/security/crossUserRead.test.ts`**                         | **NOWE (GREEN za 1. razem — ścieżka już poprawna, test ją blokuje)** |
| shares 404/403/400                                                | kod `src/routes/shares.ts:68-295`                                  | kod OK, testy tworzenia istnieją (`sharesRoutes.test.ts`)            |
| public endpoints disclosure                                       | `tests/security/informationDisclosure.test.ts`                     | istniało                                                             |
| csrf/auth/headers/validation/rateLimit                            | `tests/security/*.test.ts`                                         | istniało                                                             |

## Luki (następne, nie w tym batchu)

- `DELETE /:id` (crud.ts:146) i `POST /:id/duplicate` cross-user na HTTP — ten sam wzorzec co PUT/GET, kandydat na 1 test parametryzowany.
- Dynamiczne `onclick` w szablonach JS (`kartotekaAudit.js`, `kartotekaHelpers.js`) — tor CSP-C, nie auth.
