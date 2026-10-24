---
name: search-first
description: Research-before-coding workflow. Search for existing tools, libraries, and patterns in the local repo and web before writing custom code. Zadaptowano pod S.O.K. (bez gh CLI, MCP, Exa).
metadata:
    origin: ECC (zaadaptowano pod S.O.K.)
---

# /search-first - Research Before You Code

Systematyzuje workflow "szukaj istniejacych rozwiazan przed implementacja".

## Trigger

Uzyj tego skillu gdy:

- Zaczynasz nowa funkcje, ktora prawdopodobnie ma istniejace rozwiazanie
- Dodajesz zaleznosc lub integracje
- Uzytkownik mowi "dodaj funkcjonalnosc X" i masz zamiar pisac kod
- Przed utworzeniem nowego utility, helpera lub abstrakcji

## Quick Mode (inline)

Przed napisaniem utility lub dodaniem funkcjonalnosci, przejdz mentalnie:

0. Czy to juz istnieje w repo? -> `rg` / Grep po modulach i testach
1. Czy to typowy problem? -> Search w web / docs uzywanego stacka
2. Czy jest skill na to? -> sprawdz skille projektu (`.opencode/skills/`)
3. Czy jest gotowy wzorzec w ECC lub lokalnym repo? -> sprawdz przez Grep/Glob
4. Czy zewnetrzna biblioteka to rozwiazuje? -> websearch + dokumentacja dostawcy

## Workflow

### Krok 1: Analiza potrzeb

- Okresl dokladnie, jaka funkcjonalnosc jest potrzebna
- Okresl ograniczenia stacka (TS + Express + Prisma + SQLite, vanilla JS frontend)

### Krok 2: Lokalne przeszukanie (zawsze pierwsze)

- `Grep` / `Glob` po kodzie zrodlowym i testach
- Sprawdz, czy pomocnik/funkcja juz istnieje (DRY - baza bledow projektu wymaga tego bezwzglednie)
- Sprawdz `public/js/shared/` - globalne helpery rejestrowane na `window`

### Krok 3: Przeszukanie zewnetrzne

- `websearch` / `webfetch` oficjalnej dokumentacji stacka
- NPM registry dla gotowych bibliotek (tylko gdy lokalna implementacja to zbyt duzo kodu)

### Krok 4: Decyzja

| Sygnal                                | Akcja                                           |
| ------------------------------------- | ----------------------------------------------- |
| Dokladne dopasowanie, utrzymywane     | **Adopt** - uzyj bezposrednio                   |
| Czesciowe dopasowanie, dobra podstawa | **Extend** - uzyj + cienki wrapper              |
| Nic odpowiedniego                     | **Build** - pisz wlasne, ale swiadomy researchu |

### Krok 5: Implementacja

- Zainstaluj pakiet / napisz minimalny wlasny kod
- Zarejestruj helpery przez `window.nazwaHelpera = helper`

## Przykłady (stack S.O.K.)

- "Dodaj walidacje danych wejsciowych" -> juz w repo: `zod` (wersja 4) w dependencies - uzyj, nie dodawaj nowego
- "Export danych" -> juz w repo: modul `public/js/import-export/`
- "Nowy helper globalny" -> sprawdz `public/js/shared/`, rejestruj przez `window`

## Anti-Patterns

- **Skakanie do kodu**: pisanie utility bez sprawdzenia, czy nie istnieje
- **Ciche pomijanie**: raportowanie "nic nie znaleziono", gdy kanal wyszukiwania byl niedostepny
- **Nadmierna customizacja**: opakowanie biblioteki tak ciezko, ze traci sens
- **Bloat zaleznosci**: instalowanie duzego pakietu dla jednej malej funkcji
