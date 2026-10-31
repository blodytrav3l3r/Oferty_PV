# Evidence-First — pełna wersja protokołu

> Skrót normatywny jest w `AGENTS.md` (§Source of Truth Protocol). Ten plik trzyma
> pełną treść: uzasadnienia, listę źródeł i szablony. Czytaj przed audytem P0/P1.

## Zakres

Repozytorium jest jedynym źródłem prawdy o stanie projektu. Poprzedni audyt, plan,
komentarz, pamięć agenta i założenie użytkownika to hipoteza startowa, nie fakt.

- Agent NIE traktuje jako faktu informacji wyłącznie z: wcześniejszych rozmów,
  promptów, planów, raportów audytu, komentarzy, TODO, commit messages, pamięci
  agenta, założeń użytkownika, opisów innych agentów.
- Każde twierdzenie o aktualnym stanie kodu musi być potwierdzalne w: working tree,
  kodzie, konfiguracji, testach, historii Git, wynikach wykonywalnych komend.
- Zasada: `CLAIM → EVIDENCE → VERIFY → ACT`. Nigdy: `CLAIM → ASSUME → ACT`.
- Łańcuch: `NIE WIEM → SPRAWDZAM → MAM DOWÓD → DZIAŁAM → ZMIENIŁEM → TESTUJĘ → DIFF → COMMIT`.

## Hierarchia źródeł prawdy

Przy konflikcie wyższe wygrywa; niższe nigdy nie nadpisuje wyższego bez
zweryfikowanej zmiany:

1. Aktualny kod i konfiguracja repozytorium.
2. Aktualne testy i ich rzeczywiste wyniki.
3. Aktualny stan Git / diff / commit (HEAD, nie historia).
4. Artefakty build/CI rzeczywiście pobrane lub wykonane.
5. Dokumentacja projektu.
6. ADR i inwarianty.
7. Plany i TODO.
8. Raporty wcześniejszych audytów.
9. Wcześniejsze rozmowy.
10. Założenia agenta.

## Klasyfikacja twierdzeń

- `FACT` — potwierdzone kodem, testem, konfiguracją lub runtime.
- `INFERENCE` — wniosek logiczny z kilku potwierdzonych faktów.
- `HYPOTHESIS` — możliwe wyjaśnienie do weryfikacji.
- `UNVERIFIED` — info ze źródła zewnętrznego/starego audytu, niepotwierdzone teraz.

Zakaz przedstawiania `HYPOTHESIS` i `UNVERIFIED` jako `FACT`.

## Twarde reguły dowodowe

- `VERIFY FIRST, FIX SECOND` — zakaz napraw hipotetycznych problemów, starych
  audytów bez re-weryfikacji, regresji bez reprodukcji. Wyjątek: proaktywny fix
  z udokumentowanym ryzykiem i jawną akceptacją zakresu w zadaniu.
- `NEGATIVE CLAIMS` — brak wyniku jednego grepa to dowód tylko na brak
  dopasowania w tym wyszukiwaniu, nie na nieistnienie funkcji. Negatywne
  twierdzenie wymaga metody adekwatnej (referencje, AST, test, runtime, Git, skrypt).
- `RUNTIME > STATIC` — kod pokazuje INTENCJĘ, runtime/test pokazuje ZACHOWANIE.
  Zachowanie runtime (API, CSRF, auth, CSP, PDF, DB, CI) weryfikuj wykonaniem,
  gdy bezpiecznie możliwe; przy konflikcie zbadaj przyczynę.
- `TEST ≠ DOWÓD PEŁNEJ POPRAWNOŚCI` — PASS potwierdza tylko pokryte zachowanie.
  P0/P1/security: test regresyjny + kontrakt + ścieżka + konsumenci + brak regresji.
  Weak assertion, test omijający ścieżkę i test na samym mocku to nie pełny dowód.
- `REGRESSION PROOF` — dla naprawianego błędu, gdy możliwe: test na starym kodzie
  (FAIL/RED = ten problem) → minimalna zmiana → test ponownie (PASS/GREEN).
  Zakaz testu zielonego od początku jako „dowodu naprawy”.
- `CODE VS DOCUMENTATION` — docs opisują zamiar, kod + testy określają stan.
  Przy sprzeczności: oznacz rozbieżność, ustal zamiar z inwariantów/ADR/kontraktu
  biznesowego, zmień kod albo docs, dodaj test kontraktu.
- `GIT HISTORY` — historia wyjaśnia dlaczego/kiedy (także regresje), ale nie
  zastępuje HEAD. „Naprawione w commit X” ≠ „nadal naprawione”.
- `DEPENDENCY SURFACE` — przed zmianą zachowania określ: producenta, konsumentów
  bezpośrednich i pośrednich, testy, skrypty, CI/CD, docs, integracje runtime.
  Brak bezpośredniej referencji ≠ brak konsumenta.

## Evidence Ledger (zadania P0/P1, audyty)

Roboczy dziennik bieżącego zadania (np. `docs/plans/_active-evidence.md`, nie docs
produktu). Jeden wiersz na istotną decyzję; statusy tylko
`VERIFIED / HYPOTHESIS / UNVERIFIED / REJECTED`:

| ID    | Twierdzenie | Dowód       | Status   |
| ----- | ----------- | ----------- | -------- |
| E-001 | …           | plik + test | VERIFIED |

Checkpoint zamiast `P0.1 DONE` zapisuje: CLAIM, EVIDENCE (pliki:linie), REPRODUCTION
(komenda), BEFORE/AFTER, CHANGE, TESTS (komendy + wynik), DIFF (zakres), COMMIT,
VERIFIED (YES/NO).
