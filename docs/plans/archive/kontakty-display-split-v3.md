# Display-split kontaktów v3 — ujednolicenie dwóch okien (Baza klientów)

Status: DONE — zrealizowane inaczej (2026-10-10). Zamiast display-splitu
poszły 3 osobne kolumny (Imię i nazwisko / Telefon / E-mail) + sub-wiersze

- commit `58f107b feat(clients): 3 kolumny kontaktow i edycja bez wczytywania`.
  Ten plik zostaje jako historia decyzji.
  Poprzednik: `docs/plans/kontakty-stabilizacja-i-katalog.md` (Paczka 2 dowieziona).
  HEAD odniesienia: `f365499`, `VERSION 1.41.2`.

## Problem

Kolumna KONTAKT w popupie pokazuje scalone `kamil kopiec, 795620027` + telefon
w drugiej linii, mimo splitu w kodzie. Tryb edycji wygląda poprawnie (etykiety
zawsze się renderują — artefakt, nie dowód). Root cause: guard równości cyfr —
wiersz z `name` niosącym telefon i `phone` o innej liczbie cyfr (prefix `+48`,
inny numer) zostaje verbatim we wszystkich ścieżkach.

## Kontrakt (formalny, po recenzjach)

Wspólny regex (bez zmian): `/^(.*?)[,;]\s*([\d+\-() ]{7,20})$/`.

- **Strażnik NIP (store + display):** ogon 10-cyfrowy z poprawną sumą
  (`isValidNip`) NIGDY nie cięty. Prawdziwe 10-cyfrowe telefony z sumą NIP
  (~9%) zostają scalone — świadomy koszt poprawności nazw.
- **Store strict (BE `splitMergedContact`, heal, backfill):** split ⇔
  (`phone` puste LUB cyfry równe) I NIE-NIP. Bez zmian semantyki poza NIP.
- **Display (FE `splitMerged`):** reguły store PLUS sufiks: cyfry
  `stored` kończą się wyciągiem, `0 < diff ≤ 4` (prefiksy `0/00/48/0048/+48`),
  wyciąg ≥ 7 znaków (z regexu). Porównanie na cyfrach po stripie separatorów.
- Title/tooltip zawsze pełny verbatim. Nic w display nie zapisuje.

## P0. Read-only (GO udzielone)

1. `git log -1` + `git status` (czysty HEAD).
2. Dev-DB: pary `(name, phone)` z `name LIKE '%,%'` → klasyfikacja nową regułą
   (split / verbatim+NIP / verbatim-rozjazd / verbatim-brak-matchu).
3. Konsumenci `clients_rel.contact`: PDF/DOCX fallback, `searchUtils:131`,
   FTS, XLSX meta — split mirroru zmienia tylko fallback display.

## P1. Display-split

`splitMerged` + sufiks; użycie w: lista, `+N`/tooltip (separatory na `—`),
picker (etykiety; match po `id` bez zmian), edycja. Komentarz
`contactSplit.ts`: rozdział trybów store/display.

## P2. Dedup po inwentaryzacji (kasacja tylko potwierdzona)

`legacySplit:707` → `catalogDisplayList` po checklist równoważności
(pusta lista / błąd cache / brak danych). Fallback `:1048` zostaje.
Zostają 2 kanony + 1 wrapper.

## P3. Batch (`clients/index.ts:183`, zakres uczciwy)

Tylko strict+NIP. Rozbieżne cyfry zostają verbatim — batch NIE naprawia
głównego przypadku (leczy go display+P1). Kontrakty konsumentów potwierdzone.

## P4. Testy (semantyka, wspólna tabela)

`(name,phone) → (store_name,store_phone,display_name,display_phone)`:
NIP (puste/zgodne phone), `+48`/`0048`/`0`, myślniki, email-ogon, wiele
przecinków, 6-cyfrowy ogon, 21-znakowy ogon, brak separatora, rozjazd cyfr.
Ta sama tabela w `contacts.test.ts` i `offerContactsRoundtrip`
(duplikacja świadoma — brak shared BE/FE) + test ochronny `regex BE == FE`.
Regresja batcha (strict-split vs verbatim-rozjazd).

## P5. Bramy i checkpoint

`typecheck`×2, `lint`×2, suity: `contacts`, `roundtrip`, `clientContacts`,
`apiValidation`, `clientsIdor`, `clientsBatchPerf`, `sqlInjection`;
`version:check`; diff-review z checklistą; commit `fix(clients)` przez
`commit.mjs`. `licenses:check` FAIL pre-existing — osobno w raporcie.
Push tylko za osobnym GO.
