# ADR-003: Vite jako bundler frontendu

**Status:** Zaakceptowany  
**Data:** 2026-06-20  
**Autor:** Hermes Agent

## Kontekst

Frontend aplikacji to wielostronicowa SPA z 6 wejściami HTML. Wymaga bundlera dla
TypeScript, code splitting, i szybkiego HMR. Rozważano: Vite, Webpack, esbuild standalone.

## Decyzja

**Vite** jako bundler i dev server dla frontendu.

## Uzasadnienie

1. **Błyskawiczny HMR** — natywny ESM w dev, podmiana modułów w <100ms.
2. **Wsparcie TypeScript** — natywne TS (tylko transpilacja, bez typecheck — osobny `tsc --noEmit`).
3. **Multi-page setup** — 6 wejść HTML (`index.html`, `studnie.html`, `rury.html`, itd.) przez `rollupOptions.input`.
4. **Proxy do backendu** — `server.proxy` kieruje `/api` na Express (port 3000).
5. **Code splitting** — automatyczne chunkowanie vendorów (xlsx osobno) przez `manualChunks`.
6. **Minimal config** — ~40 linii konfiguracyjnych vs 100+ dla Webpack.

## Konsekwencje

- **TypeScript tylko transpilacja** — typecheck wymaga osobnego `npm run typecheck:frontend` (`tsc --noEmit`).
- **Proxy HMR nie jest w pełni zintegrowane** — backend i frontend to osobne procesy (przez `concurrently`).
- **esbuild minify** — szybszy niż terser, ale mniej opcji transformacji (akceptowalne dla celów ES2015).

## Konfiguracja

```javascript
// vite.config.js
export default defineConfig({
    root: 'public',
    build: {
        outDir: '../dist',
        rollupOptions: {
            input: {
                index: 'public/index.html',
                studnie: 'public/studnie.html',
                rury: 'public/rury.html',
                kartoteka: 'public/kartoteka.html',
                zlecenia: 'public/zlecenia.html',
                app: 'public/app.html'
            }
        }
    },
    server: {
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
