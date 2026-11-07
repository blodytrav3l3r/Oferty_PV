# S.O.K. — Kontrakt autonomii agenta

> Źródło prawdy o zakresie samodzielnego działania i wymaganej zgodzie użytkownika.
> Obowiązuje niezależnie od technicznych zabezpieczeń Git opisanych w `docs/development/GIT_SAFETY.md`.

## Poziomy zgody

| Poziom       | Zakres                                                                                                                                          | Wymagana zgoda                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 🟢 Autonomia | Audyty tylko do odczytu, testy, dokumentacja, małe poprawki z zielonym `test:quick`, ponowne pomiary; commity wyłącznie dokumentacji lub testów | Działanie i raport po wykonaniu; bez pushu     |
| 🟡 Batch GO  | Implementacje P1/P2, nowe plany, commity zawierające kod                                                                                        | Jedna jawna zgoda na całą opisaną paczkę zmian |
| 🔴 Osobne GO | Push, migracje lub seed, produkcyjna baza danych, zmiana progów ML, destrukcyjne operacje Git                                                   | Jawna zgoda przed każdą operacją               |

## Inwarianty

- GO na plan nie jest GO na implementację.
- Nie wykonuj operacji na live DB poza zatwierdzonym drillem.
- Zmieniaj progi ML wyłącznie na danych.
- Nie stosuj fallbacku do domyślnego `DATABASE_URL`.
- Po `STOP` natychmiast przerwij całą paczkę.

## Commit i push

- Przed commitem sprawdź branch, status, staged diff i zakres zmian. Nie dołączaj niepowiązanej pracy.
- Commit dokumentacji lub testów może wykonać agent autonomicznie po przejściu wymaganych bram.
- Commit zawierający kod wymaga zgody na opisaną paczkę zmian. Zgoda na implementację obejmuje commit tej samej paczki, ale nie obejmuje pushu.
- Push zawsze wymaga osobnego, jawnego GO. Przed prośbą o zgodę ustal i podaj dokładny cel w formacie `remote/branch` oraz liczbę i skróty commitów do wysłania.
- Zgoda na push jest ważna wyłącznie dla podanego celu i zakresu. Zmiana remote, branch lub zakresu wymaga nowego GO.
- Jeśli remote lub branch nie da się jednoznacznie ustalić, nie zgaduj. Pokaż dostępny upstream i poczekaj na wybór użytkownika.
- Push bez force nie jest destrukcyjny według Git Safety, lecz nadal wymaga zgody zgodnie z tym kontraktem. Force push i inne operacje zmieniające historię podlegają dodatkowo bramom Git Safety.

## Weryfikacja i raport

- Przed każdym commitem lub pushem przejdź bramy z `AGENTS.md`; hooki repozytorium muszą pozostać aktywne.
- Po commicie potwierdź hash i stan working tree.
- Po pushu potwierdź kod wyjścia, `git status -sb` oraz zgodność lokalnego HEAD z refem na remote. Sam komunikat Git na stderr nie oznacza błędu.
- Nie obchodź automatycznej kontroli uprawnień ani hooków. Jeśli kontrola odmówi operacji, podaj dokładny powód i wymagane działanie użytkownika.
