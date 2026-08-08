# ADR-003: Vite jako dev server frontendu

**Status:** Superseded przez ADR-005 (2026-08-08) — Vite wycofany w całości
**Data:** 2026-06-20  
**Autor:** Hermes Agent

## Kontekst

Frontend aplikacji to wielostronicowa SPA z 6 wejściami HTML. Rozważano bundler
(Vite, Webpack, esbuild standalone) dla TypeScript, code splitting i HMR.

## Decyzja

**Vite** jako dev server dla frontendu. **Bundling produkcyjny przez Vite został
uchylony** (patrz Konsekwencje).

## Uzasadnienie

1. **Błyskawiczny HMR** — natywny ESM w dev, podmiana modułów w <100ms.
2. **Wsparcie TypeScript** — natywne TS (tylko transpilacja, bez typecheck — osobny `tsc --noEmit`).
3. **Proxy do backendu** — `server.proxy` kieruje `/api` na Express (port 3000).
4. **Minimal config** — kilka linii konfiguracyjnych.

## Konsekwencje

- **Bundling produkcyjny uchylony (2026-08-08)**. `vite build` z `root: 'public'`
  nie kopiuje klasycznych `<script src>` modułów studni/rur ani katalogów
  `partials/`/`templates/` (Vite bundluje wyłącznie `<script type="module">`),
  więc artefakt `dist-web/` był z definicji niekompletny — moduł studni nie działał
  na `vite preview` (port 4173). Produkcja serwuje `public/` wprost przez Express.
  Usunięto: `build:frontend`, `preview:frontend`, `dist-web/`.
- **Dev server również uchylony (2026-08-08)** — frontend nie używał żadnych cech Vite
  (klasyczne `<script>`, brak HMR/TS/`import.meta.env`), a Express serwował `public/`
  w dev. Usunięto: `vite`, `esbuild`, `concurrently`, `wait-on`, `vite.config.js`,
  `scripts/wait-and-start.mjs`. Patrz ADR-005.
- **TypeScript tylko transpilacja** — typecheck wymaga osobnego `npm run typecheck:frontend` (`tsc --noEmit`).

## Konfiguracja

```javascript
// vite.config.js
export default defineConfig({
    root: 'public',
    base: '/',
    server: {
        port: 5173,
        proxy: { '/api': 'http://localhost:3000' }
    }
});
```

## Alternatywy odrzucone

| Alternatywa        | Powód odrzucenia                                     |
| ------------------ | ---------------------------------------------------- |
| Webpack 5          | Wolniejszy HMR, dużo configu, starsza technologia    |
| esbuild standalone | Brak HMR, plugin system, i obsługi HTML entry points |
| Parcel             | Mniejsza społeczność, problemy z konfiguracją proxy  |
