# ADR-005: Express jako jedyny serwer (dev i prod) — wycofanie Vite

**Status:** Zaakceptowany  
**Data:** 2026-08-08  
**Supersedes:** ADR-003 (Vite jako dev server frontendu)

## Kontekst

Frontend to Vanilla JS z klasycznymi `<script src>` (bez `type="module"` dla modułów
studnie/rury, bez TypeScript w runtime, bez `import.meta.env`). Express od zawsze
serwował `public/` w produkcji, a od wprowadzenia gałęzi no-cache (`src/app.ts`)
także w dev. Vite na 5173 był drugim procesem serwującym te same pliki z proxy
`/api` → 3000 — bez HMR (klasyczne skrypty nie są objęte HMR Vite), bez transformacji,
bez bundlingu (`build:frontend` usunięty w `0693fa9`).

## Decyzja

Całkowite wycofanie Vite. Usunięto: `vite`, `esbuild`, `concurrently`, `wait-on`
(devDependencies), `vite.config.js`, `scripts/wait-and-start.mjs`, skrypt
`dev:frontend`. `npm run dev` = `ts-node-dev ./server.ts` (jeden proces na :3000),
który serwuje API i `public/`.

## Uzasadnienie

1. **Zero zużywanych cech Vite** — klasyczne skrypty, brak HMR/TS/`import.meta.env`
   w frontendzie; nieliczne moduły ESM (np. `public/js/kartoteka/kartotekaUi.js`)
   to natywny ESM działający bez bundlera.
2. **Express już serwował `public/` w dev** — przejście na :3000 nie wymagało zmian w runtime.
3. **Mniej złożoności** — 4 pakiety + transitywne, jeden port zamiast dwóch, jeden proces
   zamiast trzech, koniec race condition vite↔backend i logiki `wait-and-start.mjs`.

## Konsekwencje

- Dev i prod działają identycznie: jeden proces Express na :3000.
- Po edycji plików frontendu odświeżenie ręczne (F5) — Express ustawia no-cache w dev.
- Testy Playwright (`tests/playwright/*.cjs`) celują w :3000 zamiast :5173.
- `start.bat`/`dev.sh` pokazują `http://localhost:3000`; port 5173 nie słucha.
- Docker, CI i `build.bat` bez zmian (nigdy nie używały Vite).
- ADR-003 oznaczony jako Superseded.

## Alternatywy odrzucone

- **Status quo (Vite na 5173)**: martwy proces, 4 zbędne zależności, 2 porty, HMR i tak nie działał.
- **Wariant pośredni (Vite tylko opcjonalnie)**: półśrodek bez konsumenta — każda przyszła
  potrzeba bundlingu/HMR zostanie rozpatrzona w osobnym ADR.
