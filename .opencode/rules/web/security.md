# Web Security (zaadaptowano pod S.O.K.)

> Zrodlo: ECC web/security.md. Zgodne z AGENTS.md projektu (CSP przez Helmet).
> Stan AKTUALNY (zweryfikowany w kodzie): skrypty bez `unsafe-inline` — nonce
> per-request + `script-src-attr` bez wpisu (inline handlery BLOKOWANE, dyspozytor
> `data-csp*` je zastepuje); `style-src` nadal ma `unsafe-inline`. Zrodlo:
> `src/app.ts:215-244`, kontrakt `tests/security/e55gate.test.ts`. Baza bledow #13
> opisuje stan historyczny (sprzed CSP-E 2026-09-30).

## XSS Prevention (najwazniejsze dla S.O.K.)

Frontend to vanilla JS z duza iloscia dynamicznego HTML. Kazda interpolacja danych
uzytkownika do `innerHTML` musi byc przez `escapeHtml(str)` (baza bledow #3).

- Pola edytowalne (nazwy produktow, numery zamowien) zawsze escapowane (baza bledow #24)
- W atrybutach HTML (`aria-label`, `title`): `escapeHtmlAttr`/`escapeJsStr` - nigdy `escapeHtml`
  (baza bledow #39)
- Po dynamicznym wstrzyknieciu HTML z ikonami Lucide: `lucide.createIcons({root: container})`

## CSP / Headers

- Helmet: `scriptSrc: ["'self'", "nonce-..."]` (CSP-E, `src/app.ts:225-229`) — **zero
  `unsafe-inline` dla skryptów**; `script-src-attr` bez wpisu → inline handlery
  (`onclick=`) są blokowane i zastąpione dyspozytorem `data-csp*`
- `styleSrc: ["'self'", "'unsafe-inline'"]` — nadal obecne (style="..." nie wykonuje JS)
- **NIE dodawaj nowych inline `onclick`/`on*`** — nie zadziałają; nowy kod: `addEventListener`
  (AGENTS.md: nowe globals/inline = 0)

## DOM Manipulation

- Elementy DOM z danych uzytkownika: sanityzacja przez `escapeHtml`
- Unikaj `eval` i `new Function` - kalkulacje uzywaj `safeEval` (baza bledow #4 - przecinek/kropka)
- Sprawdzaj istnienie elementow przed dodaniem listenerow: `if (element) { ... }`
  (baza bledow #10)

## Storage

- `localStorage` dla danych nie-wrazliwych (np. szerokosci kolumn Excel)
- Nigdy sekretow/tokenow do localStorage bez rozwazenia ryzyka XSS
- Zawsze try/catch + walidacja typu przy odczycie (baza bledow - szerokosci kolumn)

## Anti-Patterns

| Anti-pattern                                     | Dlaczego               | Lepsze                   |
| ------------------------------------------------ | ---------------------- | ------------------------ |
| Interpolacja do innerHTML bez escapowania        | XSS                    | `escapeHtml`             |
| `eval`/`new Function` na danych uzytkownika      | Code injection         | `safeEval` lub whitelist |
| Budowanie DOM bez sprawdzenia istnienia elementu | Null errors (baza #10) | `if (element)`           |
| Ekspozycja danych z API bez walidacji shape      | Wyciek danych, bledy   | Walidacja, DTO           |
