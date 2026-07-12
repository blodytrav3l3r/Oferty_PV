# Stan początkowy projektu — 2026-07-12

**Przed rozpoczęciem planu naprawy.**

## Git

- Branch: `main`
- Ostatni commit: `9c68803` — `docs(audit): kompleksowy audyt 2026-07-12 + plan naprawy`
- Repo czyste (poza submodule `plugins/ponytail`)

## Metryki

| Metryka                  | Wartość     |
| ------------------------ | ----------- |
| Test suites              | 54 passed   |
| Test cases               | 1272 passed |
| XSS Score                | 100/100     |
| Wersja                   | 1.6.0       |
| typecheck                | ✅          |
| lint                     | 0 błędów    |
| format                   | ✅          |
| CSP register actions     | 320         |
| CSP data-action coverage | 98%         |
| CSP undocumented         | 6           |

## Znane problemy przed rozpoczęciem

1. Husky pre-commit blokowany przez `well.magazyn` (obejście: `git -c core.hooksPath=/dev/null commit`)
2. 6 undocumented CSP actions
3. 38 data-* completeness issues (CSP)
4. Submodule `plugins/ponytail` modified content

## Konfiguracja początkowa

- `process.env.NODE_ENV` = `test` (w testach)
- `BCRYPT_ROUNDS` = 10 (w auth.ts)
- Brak CSRF protection
- Brak rotacji sesji po zmianie hasła
- `X-XSS-Protection` header obecny
- CSP w trybie report-only
