# Weryfikacja: Adam Klos vs 4 alerty Budimex (plan read-only)

Cel: rozstrzygnąć, czy 4 wiersze `PRZEKROCZONY SLA` (OS/000001, OS/000002,
OS/000003, OS/000008, Budimex S.A.) w Centrum to prawłowa własna skrzynka,
czy lewe wiersze po zanieczyszczeniu sprzed fixa `f5ea612`.

## Zasady bezpieczeństwa (twarde)

1. NIGDY na live DB (`data/app_database.sqlite`). Tylko kopia backupu.
2. Najpierw `npm run backup` (VACUUM INTO, bezpieczny online).
3. Kopię otwierać **read-only** (`readOnly: true`). Zero INSERT/UPDATE/DELETE.
4. Wyniki wkleić do tego planu jako checkpoint (bez danych wrażliwych —
   same id/role, bez haseł; tabela `users` zawiera hash — nie kopiować kolumny
   `password` do żadnych notatek).

## Krok 1: backup + kopia robocza (PowerShell)

```powershell
npm run backup
$bak = Get-ChildItem data/backups/backup_*.sqlite | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Copy-Item $bak.FullName "$env:TEMP\opencode\adam-klos-check.sqlite"
```

## Krok 2: kwerendy (node, read-only)

```js
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.TEMP + '/opencode/adam-klos-check.sqlite', {
    readOnly: true
});

// Q1: kim jest Adam (id potrzebne dalej)
db.prepare(
    `SELECT id, username, firstName, lastName, role, subUsers
  FROM users WHERE username LIKE '%adam%' OR firstName LIKE '%Adam%' OR lastName LIKE '%los%'`
).all();

// Q2: właściciele 4 ofert z alertów (OS = studnie)
db.prepare(
    `SELECT id, offer_number, userId, clientName FROM offers_studnie_rel
  WHERE offer_number IN ('OS/000001/SA/2026','OS/000002/SA/2026','OS/000003/SA/2026','OS/000008/SA/2026')`
).all();

// Q3: ile ofert ma Adam (rury + studnie) — wstaw ADAM_ID z Q1
db.prepare(
    `SELECT 'rury' k, COUNT(*) c FROM offers_rel WHERE userId = 'ADAM_ID'
  UNION ALL SELECT 'studnie', COUNT(*) FROM offers_studnie_rel WHERE userId = 'ADAM_ID'`
).all();

// Q4: czy te 4 oferty są komuś udostępnione
db.prepare(
    `SELECT "sharedWithUserId", "documentType", "documentId" FROM document_shares
  WHERE "documentId" IN (SELECT id FROM offers_studnie_rel
    WHERE offer_number IN ('OS/000001/SA/2026','OS/000002/SA/2026','OS/000003/SA/2026','OS/000008/SA/2026'))`
).all();

// Q5: w CZYICH skrzynkach leżą powiadomienia o tych ofertach
db.prepare(
    `SELECT "userId", "offerKind", "offerId", "type", "readAt", "createdAt"
  FROM care_notifications WHERE "offerId" IN (SELECT id FROM offers_studnie_rel
    WHERE offer_number IN ('OS/000001/SA/2026','OS/000002/SA/2026','OS/000003/SA/2026','OS/000008/SA/2026'))
  ORDER BY "userId", "offerId"`
).all();

// Q6: stan opieki tych ofert (pauza/terminal — pauza nie generuje)
db.prepare(
    `SELECT * FROM care_states WHERE "offerId" IN (SELECT id FROM offers_studnie_rel
  WHERE offer_number IN ('OS/000001/SA/2026','OS/000002/SA/2026','OS/000003/SA/2026','OS/000008/SA/2026'))`
).all();
```

## Krok 3: interpretacja (macierz)

| Q2 właściciel | Q4 share        | Q5 skrzynka   | Werdykt                                                                                                              |
| ------------- | --------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Ty (viewer)   | —               | Twoja         | OK — prawłowe alerty o Twoich ofertach                                                                               |
| Ty            | —               | Twoja + Adama | LEWE wiersze u Adama — sprawdzić, czy Adam klikał Twój podgląd (nie: podgląd nie pisze do cudzej; raczej stary sync) |
| Adam          | share do Ciebie | Twoja         | OK — read via share, alert o udostępnionej ofercie                                                                   |
| Adam          | brak            | Twoja         | ZANIECZYSZCZENIE sprzed `f5ea612` — wiersze do obserwacji (pełny sync je auto-read po updacie prod)                  |
| Adam          | brak            | Adama         | OK — to jego skrzynka, nie Twoja (widzisz ją tylko, jeśli jesteś Adamem)                                             |
| ktokolwiek    | —               | pusta         | Alerty już sprzątnięte (auto-read pełnego synca)                                                                     |

Dodatkowo Q3 rozstrzyga zgłoszenie: `0/0` = Adam faktycznie nie ma ofert
(puste kolejka/liczniki przy `Moje + Adam` poprawne).

## Krok 4: po updacie prod

1. Wdrożenie kodu z `f5ea612` + restart (`start.bat`).
2. Wejść w opiekę BEZ wyboru repa (pełny sync) — auto-read zamknie lewe
   wiersze (`resolved > 0` w odpowiedzi `/panel`).
3. Powtórka Q5 na świeżym backupie: lewe wiersze mają `readAt NOT NULL`
   albo zniknąć z unread.

## Checkpoint (wypełnić wynikami)

Wyniki z backupu `backup_2026-10-11_1791745158286.sqlite` (kopia read-only,
live DB nietknięte), 2026-10-11:

- [x] Q1: ADAM_ID = `user_1787942816223` (`adamklos`, role `user`); Dawid = `user_1787946247137` (`dawidplociennik`, role `user`).
- [x] Q2: właściciele 4 ofert = `usr_admin` (wszystkie: OS/000001,2,3,8); OS/000010 = Dawid.
- [x] Q3: oferty Adama rury/studnie = 1/2 (żadna to OS/00000x; pusta kolejka przy `Moje + Adam` poprawna — brak share do viewera).
- [x] Q4: shares = ∅ (brak udostępnień tych 4 ofert).
- [x] Q5: skrzynki = wyłącznie `usr_admin` (68 wierszy, w tym 4 unread) — zero wierszy cudzych.
- [x] Q6: care_states = ∅ (brak pauz/terminali — alerty regenerują się przy każdym odczycie).
- [x] Werdykt: OK — prawłowa własna skrzynka, zero zanieczyszczenia. Kolejka/pilność za repem, centrum za mailboxem (kontrakt A+C).
