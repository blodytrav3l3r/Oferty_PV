# Baseline HTTPS — S.O.K. — System Ofert i Kalkulacji

> **Stan na 2026-08-05:** wdrożono dedup telemetrii AUTO_JS + indeksy
> (migracja `20260805100000_telemetry_well_dedup`), TrainingPipeline sliding window,
> auto-heal indeksów i FTS5. Poniższy baseline pozostaje historycznym zapisem stanu
> z daty utworzenia dokumentu.

**Data:** 2026-07-24
**Cel:** Punkt odniesienia przed/po migracji HTTP → HTTPS.
**Wersja aplikacji:** 1.23.0

---

## 1. Środowisko

| Parametr      | Wartość                         |
| ------------- | ------------------------------- |
| Node.js       | `node --version` → v22.x        |
| npm           | `npm --version` → 10.x          |
| System        | Windows / Linux                 |
| Reverse proxy | Caddy (rekomendowany) lub Nginx |

---

## 2. Testy przed migracją

| Test                                        | Wynik |
| ------------------------------------------- | ----- |
| `npm run typecheck`                         | [x]   |
| `npm run lint`                              | [x]   |
| `npm test`                                  | [x]   |
| `npm run validate`                          | [x]   |
| Aplikacja działa na `http://localhost:3000` | [x]   |
| `/health` zwraca 200                        | [x]   |

---

## 3. Testy po migracji (HTTPS)

| Test                                                            | Wynik |
| --------------------------------------------------------------- | ----- |
| `https://domena.pl` → 200 OK                                    | ☐     |
| `http://domena.pl` → przekierowanie na HTTPS (301/308)          | ☐     |
| HSTS nagłówek `max-age=...`                                     | ☐     |
| `Secure` flag na ciastku sesji                                  | ☐     |
| Logowanie działa                                                | ☐     |
| API (`/api/*`) działa przez HTTPS                               | ☐     |
| Brak mixed content w DevTools (Console/Network/Security/Issues) | ☐     |
| `window.isSecureContext === true`                               | ☐     |

---

## 4. Macierz przeglądarek

| Funkcja                              | Chrome | Edge | Firefox | Safari | Brave |
| ------------------------------------ | ------ | ---- | ------- | ------ | ----- |
| Logowanie                            | ☐      | ☐    | ☐       | ☐      | ☐     |
| Iframe (rury, studnie)               | ☐      | ☐    | ☐       | ☐      | ☐     |
| Clipboard Copy / Paste               | ☐      | ☐    | ☐       | ☐      | ☐     |
| Excel (kopiowanie/wklejanie zakresu) | ☐      | ☐    | ☐       | ☐      | ☐     |
| Drukowanie oferty                    | ☐      | ☐    | ☐       | ☐      | ☐     |
| `window.open` (print)                | ☐      | ☐    | ☐       | ☐      | ☐     |
| PDF / DOCX (generowanie, pobieranie) | ☐      | ☐    | ☐       | ☐      | ☐     |
| Upload (import XLSX)                 | ☐      | ☐    | ☐       | ☐      | ☐     |
| localStorage / Cookies / API         | ☐      | ☐    | ☐       | ☐      | ☐     |

---

## 5. Uwagi

- Zmiany wprowadzone podczas migracji: patrz `docs/adr/ADR-006-https-transport.md`
  oraz plan `docs/plans/archive/https-migration-plan.md`.
- Pliki konfiguracyjne: `Caddyfile` (produkcja), `Caddyfile.dev` (lokalny dev z mkcert).
