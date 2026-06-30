# Git Flow — standard pracy z gałęziami

Ten dokument opisuje przyjęty w projekcie **WITROS Oferty PV** model rozgałęzień (Git Flow).

---

## Gałęzie główne

| Gałąź     | Opis                                                              |
| --------- | ----------------------------------------------------------------- |
| `main`    | **Produkcyjna** — kod wdrożony na produkcję. Chroniona, tylko PR. |
| `develop` | **Robocza** — integracja wszystkich zmian przed wydaniem.         |

## Gałęzie pomocnicze

| Gałąź       | Bazuje na | Merge do           | Opis                                                                     |
| ----------- | --------- | ------------------ | ------------------------------------------------------------------------ |
| `feature/*` | `develop` | `develop`          | Nowe funkcje. Nazwa: `feature/krotki-opis` (np. `feature/excel-export`). |
| `fix/*`     | `develop` | `develop`          | Poprawki błędów na gałęzi roboczej.                                      |
| `hotfix/*`  | `main`    | `main` + `develop` | Pilne bugfixy na produkcji.                                              |
| `release/*` | `develop` | `main` + `develop` | Przygotowanie wydania (bump wersji, CHANGELOG, finalne testy).           |

---

## Zasady

1. **Żaden kod nie trafia bezpośrednio na `main`** — wszystkie zmiany przez Pull Request.
2. **Każdy PR na `main` wymaga:**
    - ✅ przejścia CI (lint + typecheck + testy)
    - ✅ code review (minimum 1 approval)
    - ✅ konwencjonalnego tytułu commita (zgodnego z commitlint)
3. **Każdy PR na `develop` wymaga:**
    - ✅ przejścia CI
    - ✅ opcjonalnego code review dla prostych zmian
4. **Hotfixy** — wyjątek: mogą być mergowane szybciej, ale nadal wymagają CI i review.
5. **Conventional Commits** — obowiązkowy format dla wszystkich commitów:
    ```
    feat: dodanie eksportu PDF
    fix: naprawa błędu w kalkulacji ceny
    chore: aktualizacja zależności
    docs: dodanie GIT_FLOW.md
    ```

---

## Typowy workflow

### Nowa funkcja

```bash
git checkout develop
git checkout -b feature/nazwa-funkcji
# ... praca, commity ...
git push -u origin feature/nazwa-funkcji
# → tworzysz PR na develop
```

### Bugfix

```bash
git checkout develop
git checkout -b fix/opis-bugfixu
# ... naprawa ...
git push -u origin fix/opis-bugfixu
# → tworzysz PR na develop
```

### Hotfix (pilna poprawka na produkcji)

```bash
git checkout main
git checkout -b hotfix/opis-hotfixu
# ... naprawa ...
git push -u origin hotfix/opis-hotfixu
# → tworzysz PR na main + cherry-pick na develop
```

### Wydanie

```bash
git checkout develop
git checkout -b release/v2.1.0
# bump wersji, CHANGELOG, testy
git push -u origin release/v2.1.0
# → PR na main (i potem na develop)
```

---

## Diagram przepływu

```
main     ────●────────────●────────────●────
               \          / \          /
release/*        ●──●──●─●   ●──●──●─●
develop  ──●──●──●──●──●─────●──●──●───────
           \  \/  \/               \/
feature/*   ●──●──●                  ●──●──●
fix/*                ●──●──●
hotfix/*                            ●──●──●
```

---

## Wersjonowanie

Projekt używa **Semantic Versioning** (SemVer): `MAJOR.MINOR.PATCH`.

- **MAJOR** — niezgodne zmiany w API / przełomowe funkcje
- **MINOR** — dodanie funkcji (zgodność wsteczna)
- **PATCH** — bugfixy (zgodność wsteczna)

Wersja jest przechowywana w pliku `VERSION` oraz `package.json`.
Do bumpowania wersji i generowania CHANGELOG-a używamy `standard-version`.
