# Metryki projektu (SSoT liczb)

> Jedyne źródło prawdy dla liczb opisujących rozmiar i dług techniczny repo.
> `AGENTS.md` i pozostałe dokumenty podają reguły, nie liczby — liczby są tutaj.
> Ten plik jest **migawką**, nie inwariantem: wartości zmieniają się wraz z kodem.

## 1. Pomiar

| Element      | Wartość                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| Data pomiaru | 2026-11-05                                                                             |
| HEAD         | `8e2a076a`                                                                             |
| Zakres       | pliki śledzone przez Git (`git ls-files`); pliki nieśledzone pomijane                  |
| Weryfikacja  | dwie niezależne metody: `git grep` / `git ls-files` oraz `ripgrep` — wyniki identyczne |

## 2. Liczby

| Metryka                                              | Wartość |
| ---------------------------------------------------- | ------- |
| Pliki `.js` w `public/js`                            | 263     |
| Pliki `.js` w `public/js/studnie`                    | 150     |
| Przypisania `window.X =` w `public/js`               | 1316    |
| Programistyczne `.onclick =` w `public/js`           | 21      |
| Inline handlery `on*=` w plikach HTML                | 0       |
| Pliki `.html` śledzone przez Git                     | 34      |
| Pliki testowe `.test.ts` / `.spec.ts`                | 587     |
| Pliki w `scripts/`                                   | 88      |
| Migracje PostgreSQL w `prisma/migrations-postgresql` | 3       |
| Modele w `prisma/schema.prisma`                      | 47      |

Zero inline handlerów w HTML jest stanem wymuszonym przez CSP (nonce + dyspozytor
`data-csp*`), nie przypadkiem — patrz `docs/agents/security.md`.

## 3. Komendy pomiarowe

Bash / Git Bash:

```bash
git ls-files public/js | grep -c '\.js$'                                  # 263
git ls-files public/js/studnie | grep -c '\.js$'                          # 150
git grep -o -E 'window\.[A-Za-z_$][A-Za-z0-9_$]*[[:space:]]*=[^=]' -- public/js | wc -l   # 1316
git grep -o -E '\.onclick[[:space:]]*=' -- public/js | wc -l              # 21
git grep -o -i -E '[[:space:]]on[a-z]+[[:space:]]*=' -- '*.html' | wc -l  # 0
git ls-files '*.html' | wc -l                                             # 34
git ls-files tests | grep -cE '\.(test|spec)\.ts$'                        # 587
git ls-files scripts | wc -l                                              # 88
ls -d prisma/migrations-postgresql/*/ | wc -l                             # 3
grep -c '^model ' prisma/schema.prisma                                    # 47
```

PowerShell:

```powershell
(git ls-files public/js | Where-Object { $_ -match '\.js$' } | Measure-Object -Line).Lines
(git ls-files public/js/studnie | Where-Object { $_ -match '\.js$' } | Measure-Object -Line).Lines
(git grep -o -E 'window\.[A-Za-z_$][A-Za-z0-9_$]*[[:space:]]*=[^=]' -- public/js | Measure-Object -Line).Lines
(git grep -o -E '\.onclick[[:space:]]*=' -- public/js | Measure-Object -Line).Lines
(git grep -o -i -E '[[:space:]]on[a-z]+[[:space:]]*=' -- '*.html' | Measure-Object -Line).Lines
(git ls-files tests | Where-Object { $_ -match '\.(test|spec)\.ts$' } | Measure-Object -Line).Lines
(git ls-files scripts | Measure-Object -Line).Lines
(Get-ChildItem prisma/migrations-postgresql -Directory).Count
(Select-String -Path prisma/schema.prisma -Pattern '^model ' | Measure-Object -Line).Lines
```

Kontrola krzyżowa (`ripgrep`):

```bash
rg -o --no-filename -e 'window\.[A-Za-z_$][A-Za-z0-9_$]*\s*=[^=]' public/js | wc -l
rg -o --no-filename -e '\.onclick\s*=' public/js | wc -l
rg -o -i --no-filename -e '\son[a-z]+\s*=' -g '*.html' | wc -l
```

## 4. Odświeżanie

Uruchom komendy z §3 po większej zmianie frontendu (nowy moduł, migracja legacy na
ESM, czyszczenie `window.*`), po dodaniu testów/skryptów oraz po migracji Prisma.
Zaktualizuj tabelę §2 razem z datą i HEAD. Pojedyncza zmiana w jednym pliku nie
wymaga odświeżania.

## 5. Dokumenty poza SSoT

- Baseline'y wydajnościowe z `docs/plans/` opisują pomiary historyczne. Jeśli
  artefakt wskazuje bazę SQLite, traktuj wynik wyłącznie jako punkt odniesienia
  dla ówczesnej instalacji, nie jako baseline PostgreSQL ani dowód równoważnej
  wydajności. Baseline PostgreSQL 18 wymaga osobnego pomiaru bezpośrednio na
  PostgreSQL; nie wyciągaj wniosków o porównywalnej wydajności z dawnych danych.
- `docs/AUDIT.md` — **migawka historyczna** (stan 2026-08-24). Liczby zostają jako
  zapis z daty audytu; nie aktualizować.
- `docs/plans/` — wpisy historyczne, wartości mogą zostać jako zapis stanu z daty.

Liczniki modułów domenowych (studnie, rury, shared, kartoteka, import-export, admin,
spa) zostają w `README.md` i `docs/ARCHITECTURE.md` jako opis struktury.
