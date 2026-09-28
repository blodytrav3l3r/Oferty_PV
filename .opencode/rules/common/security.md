# Security Guidelines (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/security.md. Zgodne z AGENTS.md projektu (baza bledow #3, #24, #39).

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

- Kazda interpolacja do `innerHTML` przez `escapeHtml(str)` (baza bledow #3)
- Pola edytowalne (nazwy produktow, numery zamowien) zawsze escapowane (baza bledow #24)
- W atrybutach HTML (`aria-label`, `title`) uzywaj `escapeHtmlAttr`/`escapeJsStr` - nigdy `escapeHtml` (baza bledow #39)
- Po dynamicznym wstrzyknieciu HTML z ikonami Lucide: `lucide.createIcons({root: container})`

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
