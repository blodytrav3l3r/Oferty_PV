# Web Coding Style (zaadaptowano pod S.O.K.)

> Zrodlo: ECC web/coding-style.md. Projekt: vanilla JS SPA (bez frameworkow) - ADR-002.
> Kod w `public/js/rury/`, `public/js/studnie/`, `public/js/shared/`.

## Core Principles

### Vanilla JS SPA (ADR-002)

- Bez frameworkow SPA - czysty vanilla JS
- Moduly osadzane w iframe w `app.html`
- Globalne helpery rejestrowane jawnie przez `window.nazwa = funkcja;`

### SRP i struktura

- Kazdy modul odpowiedzialny za jedna rzecz
- Oddzielaj logike pobierania danych, walidacji, przetwarzania i renderowania UI
- Logika biznesowa odseparowana od warstwy widoku

## Conventions

### Naming

- Zmienne globalne: prefiks modulu (np. `_excel`, `well`)
- Funkcje: czasownik + rzeczownik (np. `openExcelTableModal`, `getSortedRuryItems`)
- Boolean: is/has/can

### Event Handlers

- Preferuj addEventListener zamiast inline onclick (poza uzasadnionymi przypadkami -
  projekt swiadomie uzywa inline onclick, CSP #13)
- Delegacja zdarzen dla dynamicznych tabel

### Interakcje z DOM

- Zawsze sprawdzaj istnienie elementu: `if (element) { element.addEventListener(...) }`
  (baza bledow #10)
- Po wstrzyknieciu HTML z ikonami Lucide: `lucide.createIcons({root: container})`
- `escapeHtml` przy interpolacji do innerHTML (baza bledow #3)

## Anti-Patterns

- Duplikacja logiki sortowania/renderowania (DRY - uzywaj `getSortedRuryItems`)
- Mutacja oryginalnych tablic przed sortowaniem (kopia, baza #15)
- Style inline zamiast klas CSS (np. `.pehd-btn` zamiast inline, baza #5)
- Polykanie bledow po cichu w handlerach

## Verification

- `node -c public/js/<plik>.js` - weryfikacja skladni po zmianach
- `npm run lint:frontend` - ESLint (osobne reguly dla przegladarki)
- `npm run typecheck:frontend` - analiza typow
- `npm run format` - ZAWSZE po zmianach (spojne formatowanie, Format SSoT)
