# Plan: deduplikacja sekcji AGENTS.md / CLAUDE.md (ADR, VERSION, Known Errors)

## Cel

Graf wiedzy (graphify) wykrył 3 semantyczne duplikaty między `AGENTS.md` a `CLAUDE.md`
(ADR-001..007, Version SSoT, Baza Znanych Błędów). Analiza linijka-po-linii wykazała,
że pliki **nie są tekstowo zduplikowane** (0 identycznych ciągów, 6% wspólnych linii),
ale w sekcjach koncepcyjnych CLAUDE.md zawiera przestarzałe podzbiory AGENTS.md.

## Diagnoza (stan faktyczny)

| Sekcja                       | AGENTS.md                                      | CLAUDE.md                    | Starszy   | Różnica                                  |
| ---------------------------- | ---------------------------------------------- | ---------------------------- | --------- | ---------------------------------------- |
| ADR                          | lista ADR-001..007 (L33-45)                    | tabela ADR-001..005 (L18-25) | CLAUDE.md | brak ADR-006/007                         |
| Wersja SSoT                  | pełna sekcja + `BEZWZGLĘDNE ZASADY` (L104-145) | skrót 7 punktów (L35-42)     | CLAUDE.md | brak guard version:check / markerów docs |
| Znane błędy                  | tabela #1..#39 (L261-307)                      | tabela #1..#15 (L114-133)    | CLAUDE.md | brak #16..#39                            |
| ML System                    | brak                                           | sekcja L178-213              | AGENTS.md | unikaty po stronie CLAUDE.md             |
| Core Conventions (item-list) | brak (AGENTS ma inną strukturę)                | L28-89                       | AGENTS.md | unikaty po stronie CLAUDE.md             |

## Zakres scalenia

Scalenie NIE jest łączeniem plików — to **usunięcie 3 przestarzałych sekcji z CLAUDE.md**,
które dublują AGENTS.md, i zastąpienie ich referencją do AGENTS.md (jedno źródło prawdy).

### Zmiany w `CLAUDE.md`

1. **Sekcja "Architektura (ADR)" (L14-25)**: usunąć tabelę ADR-001..005.
   Zastąpić wskaźnikiem: `# ADR — patrz `docs/adr/` (ADR-001..007) oraz sekcja "Decyzje Architektoniczne" w AGENTS.md`.
2. **Sekcja "Wersja (SSoT)" (L35-42)**: usunąć skrót.
   Zastąpić: `# Wersja (SSoT) — jednym źródłem prawdy jest sekcja "Wersjonowanie i Release Flow" w AGENTS.md (wraz z BEZWZGLĘDNYMI ZASADAMI SPÓJNOŚCI WERSJI).`
3. **Sekcja "Znane błędy" (L114-133)**: nagłówek już wskazuje `docs/errors-known.md`,
   ale tabela #1..#15 jest zdublowana. Usunąć tabelę, zostawić wskaźnik do
   `docs/errors-known.md` (pełna lista) + `AGENTS.md §5 Baza Znanych Błędów` (pełna tabela #1..#39).

### Czego NIE ruszać w CLAUDE.md

- Sekcja **"ML System (AI Pipeline dla studni)"** (L178-213) — unikaty, brak w AGENTS.md.
- Sekcja **"Zasady ogólne"** / **"Core Conventions"** — inna struktura, treści częściowo unikatowe.
- **Rury / Studnie — szczegóły implementacji** — krótsze wersje AGENTS.md, ale dopuszczalne
  jako szybka ściąga; decyzja o ich usunięciu poza zakresem (wymaga akceptacji).

## Kryteria akceptacji

- [ ] CLAUDE.md nie zawiera tabeli ADR ani listy wersji SSoT duplikującej AGENTS.md
- [ ] CLAUDE.md nie zawiera tabeli błędów #1..#15 (jest tylko wskaźnik do docs/errors-known.md)
- [ ] `npm run encoding:check` przechodzi
- [ ] `npm run version:check` przechodzi

## Uwagi

- Zmiany tylko w CLAUDE.md — AGENTS.md zostaje nietknięty (pełne źródło).
- Po zgłoszeniu się użytkownika do pracy dodawaj wpisy do `docs/errors-known.md`,
  nie do tabeli w CLAUDE.md.
