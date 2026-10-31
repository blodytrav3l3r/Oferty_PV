# Security (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/security.md + web/security.md. Zgodne z AGENTS.md projektu
> (baza bledow #3, #13, #24, #39). CSP przez Helmet: stan zweryfikowany w kodzie —
> skrypty bez `unsafe-inline` (nonce per-request, `script-src-attr` bez wpisu, inline
> handlery BLOKOWANE i zastepowane dyspozytorem `data-csp*`), `style-src` nadal ma
> `unsafe-inline`. Zrodlo: `src/app.ts:215-244`, kontrakt `tests/security/e55gate.test.ts`.

## Mandatory Security Checks

Przed KAŻDYM commitem:

- [ ] Brak twardo zakodowanych sekretow (klucze API, hasla, tokeny)
- [ ] Wszystkie dane wejsciowe walidowane
- [ ] Zapobieganie SQL injection (parametryzowane zapytania Prisma)
- [ ] Zapobieganie XSS (sanityzowany HTML, `escapeHtml`)
- [ ] CSRF protection wlaczone
- [ ] Autoryzacja/uwierzytelnianie zweryfikowane
- [ ] Rate limiting na endpointach
- [ ] Komunikaty bledow nie wyciekaja danych

## XSS Prevention (kluczowe dla S.O.K.)

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

## Secret Management

- NIGDY nie twardo koduj sekretow w kodzie zrodlowym
- ZAWSZE uzywaj zmiennych srodowiskowych (`process.env`) lub sekret managera
- Waliduj, ze wymagane sekrety istnieja przy starcie
- Rotuj sekrety, ktore moga byc wyciekniete

## Security Response Protocol

Jesli znaleziono problem bezpieczenstwa:

1. STOP natychmiast
2. Uzyj agenta **security-reviewer**
3. Napraw CRITICAL issues przed kontynuacja
4. Rotuj eksponowane sekrety
5. Przeskanuj caly kod pod katem podobnych problemow

## Anti-Patterns

| Anti-pattern                                     | Dlaczego               | Lepsze                   |
| ------------------------------------------------ | ---------------------- | ------------------------ |
| Interpolacja do innerHTML bez escapowania        | XSS                    | `escapeHtml`             |
| `eval`/`new Function` na danych uzytkownika      | Code injection         | `safeEval` lub whitelist |
| Budowanie DOM bez sprawdzenia istnienia elementu | Null errors (baza #10) | `if (element)`           |
| Ekspozycja danych z API bez walidacji shape      | Wyciek danych, bledy   | Walidacja, DTO           |
