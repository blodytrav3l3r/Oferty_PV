# Cenniki — instrukcja administratora (SSoT)

**Wersja:** 1.51.0

Jedyny dokument o tym, jak tworzyć, publikować i korygować cenniki.
Szczegóły techniczne (endpointy, limity, schematy): `docs/API.md`.
Stan techniczny (dlaczego tak działa): `docs/plans/archive/wersjonowanie-cennikow-effectiveFrom-plan.md`.

## 1. Dla kogo i zasady

- Cennikami zarządza wyłącznie **admin** (pozostali widzą podgląd + badge wersji w ofercie).
- Każda operacja jest **audytowana** (`audit_logs`, `entityType=pricelist_version`).
- Obowiązuje reguła I-001: **zapisany dokument oferty nigdy nie zmienia cen sam** —
  publikacja nowego cennika nie rusza istniejących ofert (mają pieczątkę wersji + snapshot cen).
- **Bufor edycji nie zmienia ofert**: szkic (DRAFT) to warsztat, oferta liczy z wersji obowiązującej.
- Przed ryzykowną operacją: `npm run backup`.

## 2. Model wersji: dwa statusy zapisane, cztery etykiety w UI

W bazie zapisywane są **tylko dwa statusy**: `DRAFT` i `APPROVED`. Stany `SCHEDULED`, `ACTIVE`
i `ARCHIVED` są **wyliczane** z daty `effectiveFrom` (UTC) i nigdy nie są zapisywane.

| Etykieta UI         | Zapisany status | Warunek                                                   |
| ------------------- | --------------- | --------------------------------------------------------- |
| **Obowiązuje**      | `APPROVED`      | `effectiveFrom <= now` i najnowsza na osi typu            |
| **Do wdrożenia**    | `APPROVED`      | `effectiveFrom > now`                                     |
| **W przygotowaniu** | `DRAFT`         | szkic — nie jest na osi czasu                             |
| **Historyczny**     | `APPROVED`      | wyparta przez nowszą zatwierdzoną wersję na tej samej osi |

- „Obowiązuje" jest **wyliczane**, nie zapisane → UI zawsze pokazuje datę obowiązywania.
- Kolejność stanów w UI: `DRAFT` → (publikacja, data przyszła) → `SCHEDULED` → (nadeszła data) →
  `ACTIVE` → (nowsza wersja na osi) → `ARCHIVED`.
- **Nie ma crona aktywującego**: stan wynika z daty, przełącza się sam bez interwencji.

Słownik pojęć:

| Pojęcie                           | Co to jest                                                                     | Gdzie to widać                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **LIVE**                          | Robocze tabele cennika (tryb rollbacku). Nie jest wersją.                      | Sekcja „Transfer plików" (opisana jako „na żywo")                 |
| **Wersja**                        | Zamrożona kopia cennika: `{type, seq, version, status, effectiveFrom, sha256}` | Edytor `#/rury` / `#/studnie` → „Cennik" → panel „Wersje cennika" |
| **Obowiązuje / Do wdrożenia**     | Dwa stany tej samej wersji zatwierdzonej — różni je data wejścia w życie.      | Pasek stanu w edytorze + panel „Wersje cennika"                   |
| **W przygotowaniu**               | Szkic (`DRAFT`). Nie żyje na osi czasu, dopóki go nie opublikujesz.            | Kafelek stanu + „W przygotowaniu" w historii                      |
| **Historyczny**                   | Wersja wyparta przez nowszą — tylko odczyt.                                    | Kafelek stanu „Historyczny"                                       |
| **DEFAULT / price_defaults.json** | Wzorzec do resetu + transfer między komputerami. Nie jest wersją.              | „Zapisz domyślne" / `npm run prices:export                        | import | verify` |

Dwie niezależne osie: **status** (cykl życia) i **effectiveFrom** (miejsce na osi czasu, zawsze UTC).
Labelka wersji to `{Prefiks}v{seq}-{RRRRMMDD}` z daty obowiązywania; `seq` jest per typ
(rury/studnie/preco mają własne numeracje), a prefiks oznacza oś: **R** = rury, **S** = studnie,
**P** = PRECO (np. `Sv4-20261004`, `Rv2-20261004`, `Pv1-20260601`).

> Uwaga o bazie: migracja statusów jest wdrożona (`ACTIVE/SCHEDULED/ARCHIVED/BACKDATE → APPROVED`,
> `BACKDATE_REQUESTED → DRAFT`). Instalacje spoza tej bazy wymagają `npx prisma migrate deploy`,
> inaczej w bazie mogą zostać statusy legacy, których UI nie zna.

### Ręczna korekta etykiety wersji

W panelu „Wersje cennika" każdy wiersz ma przycisk **Etykieta** (tylko administrator).
Służy do poprawy **samego napisu** etykiety, gdy jest mylący (np. zła data po imporcie
albo literówka w nazwie własnej). To operacja kosmetyczna z jawnym ostrzeżeniem:

- **Nie zmienia** cen, pozycji, `seq`, daty obowiązywania (`effectiveFrom`) ani pieczątek
  ofert i zamówień — te trzymają `pricelistVersionId`, nie napis.
- **Zmienia** to, co widzą użytkownicy: badge „cennik …" w ofertach, historię i eksporty.
- Etykieta automatyczna (`{Prefiks}v{seq}-{RRRRMMDD}`) zostaje w bazie jako wartość
  kanoniczna; w tabeli ręczna korekta jest oznaczona jako **(ręczna)**.
- **Puste pole** przywraca etykietę automatyczną.
- Kolizja z etykietą innej wersji tej samej osi jest blokowana (`409 LABEL_COLLISION`).
- Każda zmiana trafia do audytu (stara i nowa etykieta, autor, data).

Jeśli błędna jest **data obowiązywania**, a nie napis, popraw `effectiveFrom` przy
publikacji — etykieta automatyczna policzy się ponownie. Ręczna korekta napisu nie
przesuwa wersji na osi czasu.

## 3. Osie cenników

Trzy **niezależne osie** wersji: **rury**, **studnie**, **preco**. Każda ma własną numerację `seq`,
własny cykl życia i własną oś czasu.

- **PRECO to osobna oś**, nie sekcja studni. Studnia wskazuje PRECO przez resolver po dacie
  (wybierana jest wersja PRECO obowiązująca w dacie wersji studni). Publikacja studni
  **nie publikuje** PRECO — to dwie niezależne operacje.
- Sekcje studni: DN1000…DN2500, Styczne, Dennice, Akcesoria, Przejścia, Kinety, Transport
    - osobna oś „Wkładki PRECO".
- **Transport nie ma własnej osi wersji.** W cenniku istnieją pozycje kursu `TR-RURY`
  („Transport rur (kurs)") i `TR-STUDNIE` („Transport studni (kurs)"), kategoria `Transport`,
  cena `0` — to część cennika (snapshot trafia do wersji). **Cena kursu** jest jednak
  parametrem dokumentu oferty/zamówienia: `transportKm × transportRate`, limit 24 000 kg/kurs,
  tryb `transportSeparate` (kurs jako osobna pozycja albo wliczony w pozycje).

## 4. Gdzie klikać

**Edycja treści** lives w edytorach: `#/rury` i `#/studnie`, zakładka **„Cennik"**
(miejsce pracy admina i miejsce deep-linków). Zapis w edytorze tworzy/aktualizuje
**DRAFT**. W edytorze widać pasek stanu (Szkic vs Obowiązuje).

Panel **„Wersje cennika"** (przycisk w zakładce „Cennik" edytora) pokazuje historię wersji
danej osi: badge stanu, data, autor, użycie, nota, akcje (Podgląd, Porównaj, Kontrola,
Eksport, Klon, Usuń). Jest **warstwą sterowania** — nie duplikuje edytora siatki cen.

Uwaga o buforze: edytor czyta `DRAFT → ACTIVE → LIVE`, a oferta liczy z wersji obowiązującej.
Szkic w edytorze **nie** oznacza, że oferta policzy z niego.

## 5. Nowy cennik od zera (szkic)

1. Wejdź w moduł (`#/rury` lub `#/studnie`) → zakładka **„Cennik"** i popraw ceny
   (ręcznie albo importem XLSX).
2. Zapis tworzy lub aktualizuje **DRAFT** tej osi. Docelowy zapis: `PRICELIST_WRITE_TARGET=draft`
   (domyślnie). Tryb `live` to rollback do starych tabel — wtedy zapis nie tworzy wersji.
3. Uzupełnij datę obowiązywania i notę (data i nota mogą zostać podane dopiero przy publikacji).
4. Uruchom **Kontrolę** i **Porównaj** (sekcja 7).
5. **Opublikuj** → `POST /:id/approve` (sekcja 8).

Bez publikacji szkic nie wchodzi na oś czasu i nie wpływa na oferty.

## 6. effectiveFrom: dwa przypadki

- **Data przyszła** → wersja wchodzi na oś jako **Do wdrożenia** (`SCHEDULED`). Gdy data nadejdzie,
  etykieta zmienia się sama na **Obowiązuje** — bez crona i bez dodatkowego kliknięcia.
- **Data z przeszłości** → **korekta wsteczna**: wymagane uzasadnienie (nota **min. 10 znaków**).
  Wersja wchodzi na oś jako zatwierdzona; jeśli na tej osi jest nowsza wersja, będzie **Historyczny**,
  jeśli nie — **Obowiązuje** (i zostaje wyliczona jako obowiązująca dla nowych ofert).
- **Kolizja daty** (dwie zatwierdzone wersje tej samej osi o tej samej dacie) → `409 EFFECTIVE_COLLISION`.
  Zmień datę.
- **Pusto / teraz** → wersja wchodzi na oś jako obowiązująca od momentu publikacji.

## 7. Kontrola i porównanie przed publikacją

**Kontrola** (`GET /:id/checks`) — admin, read-only, **doradcza** (nie blokuje publikacji):

| Element                       | Co pokazuje                                                               |
| ----------------------------- | ------------------------------------------------------------------------- |
| `usage`                       | liczba ofert/zamówień (lub wersji studni dla PRECO) trzymających wersję   |
| `collision`                   | czy na tej osi jest inna wersja o tej samej dacie                         |
| `liveDiff`                    | różnica wierszy wobec tabel LIVE                                          |
| `comparisonToCurrentApproved` | porównanie z bieżącą wersją obowiązującą (`MATCH`/`DIFFERS`/`NO_CURRENT`) |
| `baseVersion.status`          | zawsze `UNVERIFIABLE` — w schemacie nie ma zapisanego id wersji bazowej   |

**Porównaj** (`GET /:id/diff`) — liczniki sekcji (dodane/usunięte/zmienione) oraz **top zmian cen**
(pozycja, cena przed/po, Δ%). **Podgląd** (`GET /:id/preview`) — zawartość wersji bez eksportu XLSX.

Jeśli po kontroli edytujesz wersję, wynik kontroli jest nieaktualny. Przy publikacji prześlij
`checksCheckedAt` (znacznik czasu kontroli) — odpowiedź może wtedy zawierać **`checksStale: true`**:
to **ostrzeżenie** (HTTP 200), nie błąd. Publikacja i tak waliduje warunki krytyczne w transakcji.

## 8. Publikacja (jedna ścieżka)

**„Opublikuj" → `POST /api/pricelist-versions/:id/approve`** — jedyna kanoniczna ścieżka publikacji.

| Pole body         | Znaczenie                                                       |
| ----------------- | --------------------------------------------------------------- |
| `effectiveFrom`   | data wejścia w życie (UTC ISO); domyślnie data z wersji         |
| `note`            | notatka; **wymagana (min. 10 znaków) przy dacie z przeszłości** |
| `checksCheckedAt` | znacznik czasu ostatniej kontroli → możliwe `checksStale: true` |

- Efekt: `DRAFT` → `APPROVED` (zapisany status). Dalej etykieta zależy od daty:
  przyszła → **Do wdrożenia**, przeszła → korekta wsteczna (**Obowiązuje** albo **Historyczny**).
- Zatwierdzić można **tylko szkic**: inaczej `409 APPROVE_NOT_DRAFT`.
- Eksport do review: **Eksport (review)** w wierszu pobiera XLSX wersji z sufiksem `_REVIEW` —
  wyślij do akceptacji przed publikacją.

**Deprecated (aliasy, wygasają 31.03.2027)** — odpowiedzi mają nagłówki `Deprecation: true` i
`Sunset: Wed, 31 Mar 2027 23:59:59 GMT`. Nie używaj ich w nowym kodzie:

| Alias                | Rola                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| `POST /:id/publish`  | publikacja szkicu na zapisanej dacie (bez guardu noty dla daty w przeszłości) |
| `POST /:id/activate` | aktywacja wersji z datą ≤ teraz                                               |
| `POST /:id/backdate` | korekta wsteczna (nota min. 10 znaków)                                        |

**`POST /api/pricelist-versions/activate-due`** (ręczny trigger crona) — **usunięty**:
zawsze `410 Gone` (`code: GONE`). Automatycznej aktywacji nie ma, bo stan wynika z daty.

## 9. Edycja, klon, usuwanie

- **„Edytuj"** w wierszu DRAFT zamyka panel i wchodzi w edytor cennika (Rury/Studnie, a dla PRECO
  zakładka PRECO w cenniku studni). Pasek statusu pokazuje wtedy `✎ Szkic {labelka}` — zapis
  w siatce trafia do szkicu, LIVE bez zmian.
- **„Edytuj jako szkic"** (`POST /:id/clone-draft`) przy wersjach nieedytowalnych kopiuje wiersze
  dowolnej wersji do nowego DRAFT i od razu otwiera edytor (wersja obowiązująca nietknięta).
  Następny krok to zawsze „Opublikuj".
- **Edycja treści**: tylko **DRAFT** (`PUT /:id` — podmiana wierszy + nowe SHA, audyt UPDATE).
  Wersja zatwierdzona jest niemutowalna: `403 IMMUTABLE_VERSION` — sklonuj do szkicu.
  Notatkę edytuje ołówek w kolumnie Notatki (jedyna edytowalna treść wersji zatwierdzonej).
- **Usunięcie**:
    - DRAFT — zawsze wolno;
    - zatwierdzona z **datą w przyszłości** i **użyciem 0** (Do wdrożenia, niewykorzystana) — wolno;
    - historyczna lub obowiązująca → `409 NOT_DELETABLE` (trzyma historię ofert);
    - używana przez oferty/zamówienia → `409 USED_BY` z liczbą.
- **PRECO**: dodatkowo blokada, gdy **dowolna wersja studni** wybiera tę wersję PRECO
  → `409 USED_BY_STUDNIE` z liczbą i maks. 3 labelkami. Referencje są sprawdzane ponownie
  w transakcji pod lockami `preco → studnie`.

## 10. Import XLSX

Modal celu importu: **na żywo (LIVE)** albo **draft + nota**. Studnie + PRECO importują się
dwoma requestami (studnie + PRECO). Eksport wersji studni (review i `?source=active`) dokleja
PRECO obowiązującą w dacie wersji studni: tylko zatwierdzone (`APPROVED`) z `effectiveFrom <=`.
Fallback po `seq` działa wyłącznie dla wersji studni bez `effectiveFrom` (legacy). Gdy brak
kwalifikującej się PRECO — plik zawiera same studnie (eksport wersji ustawia wtedy
`X-Preco-Included: 0`). Tekst w komórkach liczbowych PRECO odrzuci walidacja (`422 INVALID_ROWS`) —
popraw komórki, nie API.

## 11. Eksport XLSX: który przycisk

| Potrzeba                       | Przycisk                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Review wersji przed publikacją | Eksport (review) w wierszu tabeli (`GET /:id/export`, sufiks `_REVIEW` dla szkiców) |
| Stan na żywo                   | „Eksportuj" w sekcji Transfer plików (opisana jako LIVE)                            |
| Domyślne / reset               | `GET .../export.xlsx?source=default` (ręczny URL)                                   |
| Wersja obowiązująca            | `GET .../export.xlsx?source=active` (ręczny URL; `409 NO_ACTIVE_VERSION` gdy brak)  |

## 12. Oferty a cennik

Nowa oferta dostaje pieczątkę wersji obowiązującej w chwili utworzenia
(`pricelistVersionId`, null = legacy sprzed wersjonowania) oraz **snapshot cen w dokumencie —
to on jest źródłem prawdy**. Zmiana cennika nie rusza ofert. Oferta liczy z wersji obowiązującej
(`?source=active`); gdy aktywnej wersji brak — fallback do LIVE z nagłówkiem
`X-Pricelist-Fallback: live`. Przeliczenie do nowego cennika to jawna operacja
(„Przelicz do aktywnego"); niezgodny stamp przy zapisie to 409 („odśwież i przelicz ponownie").
Badge „cennik vX · Typ" w ofercie pokazuje wersję z pieczątki (tooltip: data UTC);
„(bieżący)" oznacza podgląd obowiązującej przy braku pieczątki.

## 13. DEFAULT i transfer między komputerami

- „Zapisz domyślne" = snapshot wszystkich cenników (tabele `*_Default` + plik
  `data/price_defaults.json`).
- Przenosiny: `npm run prices:export` → skopiuj plik → `npm run prices:import`;
  kontrola: `npm run prices:verify` (LIVE vs Default vs plik).
- Znaczniki czasu są rozdzielone: `pricelist_defaults_updated_at` (snapshot)
  i `pricelist_active_updated_at` (publikacje wersji).

## 14. Troubleshooting

| Komunikat w panelu                              | Kod                                  | Przyczyna → fix                                                   |
| ----------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Kolizja daty obowiązywania…                     | 409 `EFFECTIVE_COLLISION`            | Data zajęta na tej osi → zmień datę                               |
| Można zatwierdzić tylko szkic                   | 409 `APPROVE_NOT_DRAFT`              | Wersja już zatwierdzona → sklonuj do szkicu i opublikuj ponownie  |
| Nota korekty wstecznej musi mieć min. 10 znaków | 400 `NOTE_TOO_SHORT`                 | Dopisz uzasadnienie (licznik w modalu)                            |
| Wersja … niemutowalna                           | 403 `IMMUTABLE_VERSION`              | Treść zmienia się tylko w szkicu → sklonuj do roboczej            |
| Wersji … nie można usunąć                       | 409 `NOT_DELETABLE`                  | Historia chroniona (obowiązująca/historyczna) → zostaw            |
| Wersji … używa N ofert/zamówień                 | 409 `USED_BY`                        | Historia chroniona — nie usuwaj, ewentualnie klonuj               |
| Wersji … używa N wersji studni                  | 409 `USED_BY_STUDNIE`                | Historia eksportu studni chroniona — nie usuwaj tej PRECO         |
| Nieprawidłowe wiersze: …                        | 422 `INVALID_ROWS`                   | Popraw wskazane pole/wiersz (często tekst w liczbach PRECO)       |
| Błąd zapisu wersji (walidacja)                  | 422 `INVALID_DATE` / `NOTE_TOO_LONG` | Zła data albo nota > 500 znaków                                   |
| Zapis w toku, spróbuj ponownie                  | 429 / 503 `LOCK_BUSY`                | Odczekaj ~30 s, nie klikaj wielokrotnie                           |
| Automatyczna aktywacja została usunięta         | 410 `GONE`                           | Cron nie istnieje → użyj `POST /:id/approve` (stan wynika z daty) |

## 15. Limity i blokady

- Mutacje wersji: tylko admin + limiter zapisów (`429` przy serii).
- Lock per typ: równoległe zapisy tego samego cennika czekają/kolejkują się (`503 LOCK_BUSY`).
- DELETE PRECO: referencje są re-checkowane w transakcji pod lockami `preco → studnie`
  (stała kolejność, bez cyklu z tworzeniem szkicu studni). Ograniczenie: operacja
  zmieniająca referencję bez locka `studnie` nie jest objęta gwarancją.
- `GET /:id/checks|diff|export|preview` i `GET /labels`: do odczytu dla zalogowanych
  (pozostałe endpointy wersji — admin).
- Maksymalna długość noty: 500 znaków.

## 16. Audyt i historia

Akcje `CREATE / UPDATE / APPROVE / DELETE / CLONE` zapisywane są w `audit_logs`
(`przed/po`, autor, nota). Powstanie i edycja szkicu też zostawiają ślad. Retencja wg zasad backupu.

## 17. Ściąga endpointów i komend

- `GET /api/pricelist-versions` — lista wersji (z polem `state` = stan wyliczany)
- `GET /api/pricelist-versions/summary` — obowiązująca + najbliższa przyszła per typ (kafelki)
- `GET /api/pricelist-versions/labels` — etykiety na oś czasu (bez cen)
- `POST /api/pricelist-versions/:type/drafts` — nowy szkic (seq auto)
- `PUT /api/pricelist-versions/:id` — edycja szkicu (wiersze i/lub nota)
- `POST /api/pricelist-versions/:id/approve` — **kanoniczna publikacja** (DRAFT → APPROVED)
- `GET /api/pricelist-versions/:id/checks` — kontrola przed publikacją (doradcza)
- `GET /api/pricelist-versions/:id/preview` — zawartość wersji bez XLSX (cap 5000/arkusz)
- `GET /api/pricelist-versions/:id/diff` — liczniki + top zmian cen (dowolne `?against=`)
- `GET /api/pricelist-versions/:id/export` — XLSX wersji
- `POST /api/pricelist-versions/:id/clone-draft` — klon do szkicu
- `DELETE /api/pricelist-versions/:id` — usunięcie (zasady w sekcji 9)
- deprecated: `POST /:id/publish`, `POST /:id/activate`, `POST /:id/backdate`
  (`Deprecation: true`, `Sunset: Wed, 31 Mar 2027 23:59:59 GMT`)
- `POST /api/pricelist-versions/activate-due` — `410 Gone` (cron usunięty)
- `npm run prices:export|import|verify`, `npm run backup` — operacje na danych
