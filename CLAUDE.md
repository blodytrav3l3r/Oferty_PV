# Projekt WITROS Oferty - Zasady i Standardy (Everything Claude Code - ECC)

## Architektura i Konwencje

1. **Struktura Katalogów**
    - `src/routes/` - Główne routery zgrupowane dziedzinowo (np. `offers/`, `products/`). Unikać "God Objects" obsługujących dziesiątki podścieżek. Duże routery dzielimy do podfolderów.
    - `src/services/` - Logika biznesowa, integracje zewnętrzne i zaawansowane operatory (np. DocxTemplater, Puppeteer).
    - `src/utils/` - Globalne funkcje narzędziowe, helpery formatujące u uniwersalne moduły.
    - `src/validators/` - Schematy walidacji oparte o `zod`.
    - `src/middleware/` - Samowystarczalne warstwy wejścia/wyjścia (auth, security, rate limiting).
    - `tests/` - Szablon testowy na podstawie Jesta, z wydzielonym katalogiem `mocks/` np. dla bazy Prisma.

2. **Podstawowe Zasady (ECC Framework)**
    - **Brak Pustych Typów / Unikanie "any":** Wymagane używanie strict typingu, np. zamiast `catch(e: any)` i odwoływania się do `e.message` - stwórz zdefiniowany `Error`. (Utrzymujemy zgodność wstecznie przy refaktoringach). Typy na pierwszym miejscu!
    - **Barrel Exports:** Wszystkie sub-moduły w folderach grupujemy i eksportujemy poprzez `index.ts`. Przykład: router `offers`, generatory docx, generatory pdf.
    - **Brak Globalnych Instancji Console:** Zamiast `console.log()` / `console.error()` **Zawsze** używać ujednoliconego loggera `src/utils/logger.ts`.
    - **Twarde Skrypty (Single Responsibility):** Każdy test ma sprawdzić 1 funkcjonalność. Route zajmuje się wejściem, Middleware zajmuje się przetworzeniem, a Service wykonuje akcję.

3. **Praca z Bazą i ORM (Prisma)**
    - Klient bazy **Musi być singletonem** pobieranym zawsze z `src/prismaClient.ts`.
    - Operacje testowe nie łączą się z SQLite - domyślnie zawsze korzystamy z mocka bazy w testach jednostkowych (`tests/mocks/prisma.ts`).

4. **Bezpieczeństwo i Secrets**
    - **Nigdy Hardcoded Secrets**. Wszystkie hasła (jak np. `admin123`) uciekają do `.env` (np. `DEFAULT_ADMIN_PASSWORD`).
    - Rate limiting musi obejmować wszystkie trasy odczytu/zapisu logiki biznesowej zdefiniowane w `server.ts`.

## Flow Testowania

- Dla weryfikacji kompilatora zawsze odpalać: `node ./node_modules/typescript/bin/tsc --noEmit`. Zawsze wynik 0 errorów.
- Narzędziem testowania jest `jest` (uruchomiony poprzez `node ./node_modules/jest/bin/jest.js`).
- Testom podlegają główniej klasy Utils, Services, Validators (pokrycie >90%).
- Zrównoleglone Route'y testowane są end-2-end jeżeli wchodzą w kontakt z obcym narzędziem (np. render docx do fs) za pomocą specjalnych modułów E2E (wyłączonych z globalnego scope `npm test`).
