# Cenniki — instrukcja administratora (SSoT)

**Wersja:** 1.46.3

Jedyny dokument o tym, jak tworzyć, publikować i korygować cenniki.
Szczegóły techniczne (endpointy, limity, schematy): `docs/API.md`.
Stan techniczny (dlaczego tak działa): `docs/plans/archive/wersjonowanie-cennikow-effectiveFrom-plan.md`.

## 1. Dla kogo i zasady

- Cennikami zarządza wyłącznie **admin** (pozostali widzą podgląd + badge wersji w ofercie).
- Każda operacja jest **audytowana** (`audit_logs`, `entityType=pricelist_version`).
- Obowiązuje reguła I-001: **zapisany dokument oferty nigdy nie zmienia cen sam** —
  publikacja nowego cennika nie rusza istniejących ofert (mają pieczątkę wersji + snapshot cen).
- Przed ryzykowną operacją: `npm run backup`.

## 2. Słownik: LIVE vs ACTIVE vs reszta

| Pojęcie                           | Co to jest                                                                     | Gdzie to widać                                                       |
| --------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **LIVE**                          | Robocze tabele cennika (to, co edytujesz w kartotece). Nie jest wersją.        | Zakładka cennika, sekcja „Transfer plików" (opisana jako „na żywo")  |
| **Wersja**                        | Zamrożona kopia cennika: `{type, seq, version, status, effectiveFrom, sha256}` | Panel „Zarządzanie cennikami", tabela wersji                         |
| **ACTIVE**                        | Wersja obowiązująca — wybrana po dacie, nie „ta z panelu".                     | Badge „cennik vX" w ofercie, pasek „Rury vN · Studnie vM · Preco vK" |
| **SCHEDULED**                     | Zatwierdzona, czeka na datę wejścia w życie (cron co 5 min + przy starcie).    | Status niebieski                                                     |
| **Robocza (DRAFT)**               | Szkic z klona. Nie żyje na osi czasu, dopóki go nie opublikujesz.              | Status szary, przycisk „Opublikuj roboczą"                           |
| **Robocza-wsteczna**              | Szkic z datą w przeszłości. Wymaga uzasadnienia min. 10 znaków.                | Status bursztynowy, przycisk „Zatwierdź wstecz"                      |
| **Wsteczna (BACKDATE)**           | Zatwierdzona korekta historyczna. Tylko odczyt.                                | Status szary                                                         |
| **Archiwalna**                    | Poprzednia aktywna po aktywowaniu nowszej. Tylko odczyt.                       | Status w panelu                                                      |
| **DEFAULT / price_defaults.json** | Wzorzec do resetu + transfer między komputerami. Nie jest wersją.              | „Zapisz domyślne" / `npm run prices:export                           | import | verify` |

Dwie niezależne osie: **status** (cykl życia) i **effectiveFrom** (miejsce na osi czasu, zawsze UTC).
Labelka wersji to `v{seq}-{RRRRMMDD}` z daty obowiązywania; `seq` jest per typ (rury/studnie/preco
mają własne numeracje).

## 3. Gdzie klikać

Panel „Zarządzanie cennikami" (przycisk „Zarządzaj" w kartotece cennika), zakładki Rury/Studnie.
Tabela wersji: Wersja · Nr · Status · Obowiązuje od (lokalnie + UTC) · Autor · **Użycie**
(ile ofert/zamówień trzyma pieczątkę) · Notatki · Akcje (Porównaj, Eksport, aktywacja, klon, usuń).
Legenda statusów jest nad tabelą; pełny cykl opisuje też pomoc w panelu.

## 4. Nowy cennik od zera (draft)

1. Edytuj LIVE (ręcznie lub importem XLSX) do pożądanego stanu.
2. „Zapisz jako wersję": podgląd numeru (`v{seq}`, tylko odczyt), „Obowiązuje od"
   (czas lokalny, zapisywany jako UTC ISO), notatka.
3. Data przyszła → wersja **Zaplanowana**. Data przeszła → **Robocza-wsteczna**:
   wymagane uzasadnienie (licznik `0/10`) + checkbox „przepisuję historię".
4. Po zapisie panel sam otwiera **Porównaj** — sprawdź top zmian cen przed aktywacją.

## 5. effectiveFrom: trzy przypadki

- **Pusto / teraz** → wejdzie przy najbliższej aktywacji (ręcznej lub cronem).
- **Przyszłość** → SCHEDULED; `POST /:id/activate` przed terminem odrzuci (`ACTIVATE_NOT_DUE`),
  cron aktywuje sam po terminie (`POST /activate-due` to ręczny trigger awaryjny).
- **Przeszłość** → BACKDATE_REQUESTED; brak auto-aktywacji; zatwierdzenie przyciskiem
  „Zatwierdź wstecz" (nota min. 10 znaków). Resolver dat historycznych uwzględnia
  wersje wsteczne deterministycznie (najnowsza `effectiveFrom <= data`).

## 6. Porównaj przed publikacją (obowiązkowo)

Przycisk **Porównaj** pokazuje liczniki sekcji (dodane/usunięte/zmienione) oraz
**top zmian cen** (pozycja, cena przed/po, Δ%, max 100, sort po |Δ%|).
Aktywacja też najpierw pokazuje podsumowanie diff i prosi o potwierdzenie
(wraz z liczbą ofert trzymających tę wersję).

## 7. Publikacja i aktywacja

- **Robocza → „Opublikuj roboczą"** (`POST /:id/publish`): wchodzi na oś czasu jako
  Zaplanowana albo Robocza-wsteczna (wg daty). Bez tego klon wisi jako szkic.
- **Zaplanowana → „Aktywuj"** (po terminie): atomowo stara ACTIVE → Archiwalna,
  nowa → ACTIVE, wpis audytu ACTIVATE. Powtórna aktywacja to 409 (wyścig obsłużony).
- Eksport do review: **Eksport (review)** w wierszu pobiera XLSX wersji z sufiksem
  `_REVIEW` — wyślij do akceptacji przed aktywacją.

## 8. Backdate (korekta wsteczna)

Tylko gdy cena historyczna była błędna. Wymaga uzasadnienia (min. 10 znaków, licznik
w modalu) i świadomego checkboxa. Kolizja daty z inną wersją → 409
(`EFFECTIVE_COLLISION` / `PERIOD_OVERLAP` — panel pokazuje jeden komunikat:
„Kolizja daty obowiązywania"). Wersja wsteczna nigdy nie aktywuje się sama.

## 9. Klon, edycja, usuwanie

- **„Klonuj do roboczej"** kopiuje wiersze dowolnej wersji do nowej Roboczej
  (aktywna nietknięta). Następny krok to zawsze „Opublikuj roboczą".
- Edycja treści: tylko Robocza/Zaplanowana/Robocza-wsteczna (`PUT /:id`, podmiana
  wierszy + nowe SHA, audyt UPDATE). ACTIVE/Archiwalna/Wsteczna: niemutowalne (403);
  notatkę edytuje ołówek w kolumnie Notatki.
- Usunięcie: Robocza/Zaplanowana/Robocza-wsteczna — wolno; ACTIVE/Wsteczna — nigdy
  (nawet przy zerowym użyciu, bo resolver rozdaje je nowym ofertom); Archiwalna —
  tylko bez użycia (`409 USED_BY` z liczbą).

## 10. Import XLSX

Modal celu importu: **na żywo (LIVE)** albo **draft + nota**.
Studnie+PRECO importują się dwoma requestami (studnie + preco) — przy rozjechanych
numerach seq eksport wersji studni dobiera PRECO po dacie obowiązywania
(`effectiveFrom <=`, fallback po seq).
Tekst w komórkach liczbowych PRECO odrzuci walidacja (422) — popraw komórki, nie API.

## 11. Eksport XLSX: który przycisk

| Potrzeba                       | Przycisk                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Review wersji przed publikacją | Eksport (review) w wierszu tabeli (`GET /:id/export`, sufiks `_REVIEW` dla szkiców) |
| Stan na żywo                   | „Eksportuj" w sekcji Transfer plików (opisana jako LIVE)                            |
| Domyślne / reset               | `GET .../export.xlsx?source=default` (ręczny URL)                                   |
| Zamrożona ACTIVE               | `GET .../export.xlsx?source=active` (ręczny URL; 409 `NO_ACTIVE_VERSION` gdy brak)  |

## 12. Oferty a cennik

Nowa oferta dostaje pieczątkę aktywnej wersji w chwili utworzenia
(`pricelistVersionId`, null = legacy sprzed wersjonowania) oraz **snapshot cen
w dokumencie — to on jest źródłem prawdy**. Zmiana cennika nie rusza ofert.
Przeliczenie do nowego cennika to jawna operacja („Przelicz do aktywnego");
niezgodny stamp przy zapisie to 409 („odśwież i przelicz ponownie").
Badge „cennik vX · Typ" w ofercie pokazuje wersję z pieczątki (tooltip: data UTC);
„(bieżący)" oznacza podgląd aktywnego przy braku pieczątki.

## 13. DEFAULT i transfer między komputerami

- „Zapisz domyślne" = snapshot wszystkich cenników (tabele `*_Default` + plik
  `data/price_defaults.json`).
- Przenosiny: `npm run prices:export` → skopiuj plik → `npm run prices:import`;
  kontrola: `npm run prices:verify` (LIVE vs Default vs plik).
- Znaczniki czasu są rozdzielone: `pricelist_defaults_updated_at` (snapshot)
  i `pricelist_active_updated_at` (aktywacje wersji).

## 14. Troubleshooting

| Komunikat w panelu                                 | Kod                                          | Przyczyna → fix                                                               |
| -------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| Kolizja daty obowiązywania…                        | 409 `PERIOD_OVERLAP` / `EFFECTIVE_COLLISION` | Data zajęta → zmień datę albo idź ścieżką wsteczną                            |
| Wersja wejdzie w życie… — aktywacja przed terminem | 409 `ACTIVATE_NOT_DUE`                       | Poczekaj na cron (co 5 min) albo zmień datę                                   |
| Można aktywować tylko ze statusu SCHEDULED         | 409 `ACTIVATE_NOT_SCHEDULED`                 | Wsteczną zatwierdź przyciskiem „Zatwierdź wstecz"; roboczą najpierw opublikuj |
| Nota backdate musi mieć min. 10 znaków             | 400 `NOTE_TOO_SHORT`                         | Dopisz uzasadnienie (licznik w modalu)                                        |
| Wersja … niemutowalna                              | 403 `IMMUTABLE_VERSION`                      | Sklonuj do roboczej zamiast edytować                                          |
| Nieprawidłowe wiersze: …                           | 422 `INVALID_ROWS`                           | Popraw wskazane pole/wiersz (często tekst w liczbach PRECO)                   |
| Zapis w toku, spróbuj ponownie                     | 429 / 503 `LOCK_BUSY`                        | Odczekaj ~30 s, nie klikaj wielokrotnie                                       |
| Wersji … używa N ofert/zamówień                    | 409 `USED_BY` / `NOT_DELETABLE`              | Historia chroniona — nie usuwaj, ewentualnie klonuj                           |
| Brak aktywnej wersji cennika                       | 409 `NO_ACTIVE_VERSION`                      | Utwórz i aktywuj pierwszą wersję (start serwera robi to sam z LIVE)           |
| Błąd zapisu wersji (walidacja)                     | 422 `INVALID_DATE` / `NOTE_TOO_LONG`         | Zła data albo nota > 500 znaków                                               |

## 15. Limity i blokady

- Mutacje wersji: tylko admin + limiter zapisów (`429` przy serii).
- Lock per typ: równoległe zapisy tego samego cennika czekają/kolejkują się.
- `GET /:id/diff|export` i `GET /labels`: do odczytu dla zalogowanych (diff/export wersji — admin).

## 16. Audyt i historia

Akcje `CREATE / UPDATE / PUBLISH / ACTIVATE / BACKDATE / DELETE / CLONE`
zapisywane są w `audit_logs` (`przed/po`, autor, nota). Powstanie i edycja szkicu
też zostawiają ślad (wcześniej dziurawe — domknięte). Retencja wg zasad backupu.

## 17. Ściąga endpointów i komend

- `POST /api/pricelist-versions/:type/drafts` — nowy szkic (seq auto, status z daty)
- `PUT /api/pricelist-versions/:id` — edycja szkicu (wiersze i/lub nota)
- `POST /api/pricelist-versions/:id/publish` — robocza na oś czasu
- `POST /api/pricelist-versions/:id/activate` — aktywacja (tylko SCHEDULED po terminie)
- `POST /api/pricelist-versions/:id/backdate` — zatwierdzenie wstecznej (nota ≥ 10)
- `POST /api/pricelist-versions/activate-due` — ręczny cron zaległych
- `POST /api/pricelist-versions/:id/clone-draft` — klon do roboczej
- `GET /api/pricelist-versions/:id/diff` — liczniki + top zmian cen
- `GET /api/pricelist-versions/:id/export` — XLSX wersji
- `GET /api/pricelist-versions/labels` — etykiety na oś czasu (bez cen)
- `npm run prices:export|import|verify`, `npm run backup` — operacje na danych
