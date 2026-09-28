# Web Performance (zaadaptowano pod S.O.K.)

> Zrodlo: ECC web/performance.md. Projekt: vanilla JS SPA w iframe'ach (ADR-002),
> serwowane przez Express. Czesc wzorcow ECC (SSR, frameworki, tree-shaking) NIE
> dotyczy - adaptacja do rzeczywistych problemow projektu.

## Core Principles

- Unikaj niepotrzebnych re-renderow i ponownych zapytan
- Cache-busting przez `?v=` synchronizowany z VERSION przy release (nigdy recznie)
- Paginacja i batch-loading dla duzych zbiorow

## Specific S.O.K. Patterns

### Unikanie N+1 (backend)

- Zbieraj powiazane rekordy zbiorczo (`findMany` z `in`) i mapuj w pamieci
  (baza bledow #9)
- Unikaj zapytan do bazy w petli

### Frontend rendering

- Pelny re-render tylko gdy konieczny (np. tylko dla `krag`/`krag_ot` w Excel, baza #21)
- Odraczaj renderowanie do pojedynczego przebiegu przy batch operacjach (fill, baza #21)
- Filtruj wiersze przez `display: none` bez zmiany tozsamosci (`data-widx`)

### Scroll / infinite loading (zlecenia)

- `IntersectionObserver` z `root: kontener` dla sentinela (baza bledow #37 -
  bez roota sentinel jest zawsze w viewport i eager-load w petli)
- `rootMargin` dla pre-loadingu

### Duzе zbiory

- Paginacja endpointow (batch-delete chunking po 200 ids, baza #36)
- Usuwanie audit logow partiami (baza #11)

## Anti-Patterns

| Anti-pattern                             | Dlaczego                      | Lepsze                           |
| ---------------------------------------- | ----------------------------- | -------------------------------- |
| Zapytania w petli (N+1)                  | Wydajnosc                     | Batch `findMany` + `in`          |
| Sentinel bez root w IO                   | Eager-load w petli (baza #37) | `root: kontener`                 |
| Re-render po kazdym znaku                | Blokada wpisywania (baza #21) | Re-render tylko dla krag/krag_ot |
| Blocking main thread przy duzych listach | UI freeze                     | Paginacja / virtualizacja        |
