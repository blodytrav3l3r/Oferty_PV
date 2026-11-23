# Plan: PostgreSQL-only aktywne cenniki i instalatory

## Cel

Nowa instalacja S.O.K. na Windows i Linux ma automatycznie importować trzy
zatwierdzone aktywne cenniki z wersjonowanego pakietu w repozytorium. Nie może
wymagać starej bazy SQLite, ręcznego eksportu ani usuwania istniejących wolumenów.

## Etapy i kryteria

1. **Źródło cen** — zweryfikować dostępny artefakt aktywnych cen, zachować jego
   rekordy, identyfikatory wersji, liczniki i sumy kontrolne; opisać go jako
   pakiet instalacyjny S.O.K., bez twierdzenia, że aktualne ceny pochodzą z
   bieżącej PostgreSQL. `verify:` walidator importu i zgodność liczb wierszy.
2. **Windows i Linux** — dołączyć pakiet do obu instalatorów, wykonać walidację
   bez zapisu, import tylko do pustej przestrzeni cenników, uruchomić aplikację
   i readiness. Usunąć pytanie o ścieżkę/eksport i ręczne potwierdzenie importu.
   `verify:` testy kontraktowe kolejności, bezpieczeństwa wolumenów i brak
   zależności od artefaktu zewnętrznego.
3. **SQLite poza runtime** — usunąć jednorazowy eksporter oraz nieużywaną
   historię migracji SQLite z bieżącego drzewa; zachować guardy negatywne,
   reguły ignorowania plików bazy i dokumentację historyczną. `verify:` skan
   powierzchni PostgreSQL, migracje PostgreSQL od pustej bazy.
4. **Naprawa backupu** — usunąć wyłącznie potwierdzone nieobsługiwane argumenty
   pg_dump i dodać regresję. `verify:` test kontraktu argumentów plus backup
   round-trip, jeżeli środowisko PostgreSQL 18 jest dostępne.
5. **Dokumentacja i pełna walidacja** — zaktualizować instrukcje aktywne oraz
   skrypty agenta, wykonać format, version:check, testy ceny/instalatorów i
   `npm run validate`. Bez commit/push i bez modyfikacji istniejącej bazy live.

## Granice

- Nie eksportować ani nie odczytywać bazy live w ramach tej zmiany.
- Nie zmieniać zachowania ofert, eksportów XLSX ani cen zapisanych w ofertach.
- Nie osłabiać testów i nie usuwać filtrów SQLite, które zapobiegają przypadkowemu
  trackowaniu lub kopiowaniu lokalnych baz.
- Zachować istniejące, niezwiązane zmiany w worktree.
