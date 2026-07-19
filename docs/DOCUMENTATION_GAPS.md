# Analiza luk w dokumentacji — WITROS Oferty PV

**Data:** 2026-07-19
**Metoda:** Przegląd istniejących plików `docs/` + analiza struktury kodu źródłowego

---

## Co jest dobrze udokumentowane

- **Architektura systemu** (`ARCHITECTURE.md`) — bardzo szczegółowo, 414 linii
- **API endpoints** (`API.md`) — 336 linii, wszystkie endpointy
- **Baza danych** (`DATABASE.md`) — 387 linii, schemat Prisma, relacje
- **Bezpieczeństwo** (`SECURITY.md`) — 270 linii, autoryzacja, CSP, Helmet, XSS
- **Komponenty CSS/UI** (`COMPONENTS.md`) — 700 linii, bardzo szczegółowo
- **Decyzje architektoniczne** (ADR) — 4 dokumenty, każda decyzja opisana
- **Znane błędy** (`errors-known.md`) — 16 pozycji z przyczynami i rozwiązaniami
- **Proces wydawniczy** (`RELEASE_PROCESS.md`, `VERSIONING.md`) — kompletny

---

## Luki w dokumentacji

### 1. Dokumentacja modułów frontendowych — WYSOKI PRIORYTET

**Brak:** Osobnych dokumentów opisujących logikę biznesową modułów:

- `public/js/rury/` — zarządzanie rurami, kalkulacje, PEHD, oferty
- `public/js/studnie/` — zarządzanie studniami, konfigurator, wizualizacja
- `public/js/sales/` — moduł sprzedaży, kartoteka ofert

**Sugerowany plik:** `docs/FRONTEND_MODULES.md`
**Priorytet:** Wysoki

---

### 2. Dokumentacja kreatora ofert (Wizard) — WYSOKI PRIORYTET

**Brak:** Opisu kroków kreatora (Step 1-5), przepływu danych między krokami, stanów (edycja/podgląd)

**Sugerowany plik:** `docs/WIZARD_FLOW.md`
**Priorytet:** Wysoki

---

### 3. Dokumentacja cyklu życia oferty — WYSOKI PRIORYTET

**Brak:** Opisu pełnego cyklu: tworzenie → edycja → zapis → eksport → zamówienie → zatwierdzenie

**Sugerowany plik:** `docs/OFFER_LIFECYCLE.md`
**Priorytet:** Wysoki

---

### 4. Dokumentacja testów — ŚREDNI PRIORYTET

**Brak:** Opisu struktury testów, jak uruchamiać, jakie testy istnieją, jak pisać nowe

**Sugerowany plik:** `docs/TESTING.md`
**Priorytet:** Średni

---

### 5. Onboarding dewelopera — ŚREDNI PRIORYTET

**Brak:** Przewodnika dla nowego dewelopera — jak zacząć, co gdzie jest, typowe zadania

**Sugerowany plik:** `docs/DEVELOPER_ONBOARDING.md`
**Priorytet:** Średni

---

### 6. Dokumentacja eksportu XLSX — ŚREDNI PRIORYTET

**Brak:** Szczegółowego opisu logiki generowania arkuszy Excel, formatowania kolumn, wzorców

**Sugerowany plik:** `docs/XLSX_EXPORT.md`
**Priorytet:** Średni

---

### 7. Dokumentacja cache-busting — NISKI PRIORYTET

**Brak:** Opisu systemu automatycznego cache-bustingu (`scripts/auto-cache-bust.mjs`), choć częściowo opisany w AGENTS.md

**Sugerowany plik:** sekcja w `docs/RELEASE_PROCESS.md` (wystarczy rozszerzyć istniejący dokument)
**Priorytet:** Niski

---

### 8. Dokumentacja migracji i seedów — NISKI PRIORYTET

**Brak:** Opisu procesu migracji schematu bazy, seedowania danych, przenoszenia bazy między urządzeniami (częściowo w `BACKUP_RESTORE.md`)

**Sugerowany plik:** sekcja w `docs/DATABASE.md` (rozszerzyć istniejący dokument)
**Priorytet:** Niski

---

### 9. Dokumentacja systemu notyfikacji/toastów — NISKI PRIORYTET

**Brak:** Opisu systemu powiadomień UI (toasty, alerty)

**Sugerowany plik:** sekcja w `docs/COMPONENTS.md` (rozszerzyć istniejący dokument)
**Priorytet:** Niski

---

## Podsumowanie

| Priorytet  | Liczba | Sugerowane działania                                                                   |
| ---------- | :----: | -------------------------------------------------------------------------------------- |
| **Wysoki** |   3    | Stworzyć nowe dokumenty: `FRONTEND_MODULES.md`, `WIZARD_FLOW.md`, `OFFER_LIFECYCLE.md` |
| **Średni** |   3    | Stworzyć: `TESTING.md`, `DEVELOPER_ONBOARDING.md`, `XLSX_EXPORT.md`                    |
| **Niski**  |   3    | Rozszerzyć istniejące dokumenty o brakujące sekcje                                     |
| **Razem**  | **9**  | 6 nowych plików + 3 rozszerzenia istniejących                                          |
