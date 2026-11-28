# Status danych AI w ofercie studni

Panel boczny oferty pokazuje przygotowanie danych AI dla każdej studni oraz podsumowanie oferty. Odczyt obejmuje wyłącznie rekordy telemetrii przypisane jednocześnie do `offerId` i `wellId` oraz chroni dostęp istniejącą kontrolą właściciela oferty.

## Znaczenie statusów

- **Dane** — istnieje etykietowana próbka, której telemetria ma `trainingEligible=true`, a właściciel znajduje się na aktualnej allowliście. Pozostałe warunki pipeline'u, w tym okno danych, nadal mogą próbkę odrzucić.
- **Czeka** — próbka spełnia warunek telemetrii i allowlisty, ale ma etykietę `NO_FEEDBACK`.
- **Przygotowanie** — kwalifikująca się telemetria istnieje, lecz ekstrakcja cech nie utworzyła jeszcze odpowiadającej jej próbki.
- **Pominięta** — telemetria istnieje, ale nie spełnia warunku `trainingEligible` lub allowlisty.
- **Brak danych** — brak telemetrii powiązanej z tą studnią i ofertą.

Status **Dane** oznacza spełnienie podstawowych warunków danych, a nie gwarancję wykorzystania w zbiorze treningowym. Nie dowodzi, że próbka weszła do konkretnego uruchomienia ani do aktywnego modelu. Obecny lineage modeli przechowuje fingerprinty i agregaty, a nie trwałą listę identyfikatorów wykorzystanych próbek.

Starsze rekordy telemetrii bez `offerId` nie są przypisywane do oferty heurystycznie. Nowe konfiguracje zapisują identyfikator bieżącej oferty, a zaakceptowana próbka może otrzymać ofertę, jeśli wcześniej nie była z nią powiązana. Istniejące powiązanie z inną ofertą nigdy nie jest nadpisywane.

Odczyt obsługuje maksymalnie 5000 rekordów telemetrii dla jednego zapytania statusu. Przy większej historii API zwraca informację o niedostępności podsumowania, zamiast prezentować niepełny status.
