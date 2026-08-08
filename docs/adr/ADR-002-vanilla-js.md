# ADR-002: Vanilla JS SPA bez frameworka

**Status:** Zaakceptowany  
**Data:** 2026-06-20  
**Autor:** Hermes Agent

## Kontekst

Frontend aplikacji WITROS Oferty wymaga interaktywnego UI (kreator studni w 5 krokach,
kalkulator rur, tabela konfiguracyjna, generowanie PDF/DOCX). Rozważano frameworki
(React, Vue, Svelte) vs czysty Vanilla JS.

## Decyzja

**Vanilla JavaScript SPA** — bez frameworka, bez bibliotek UI, bez web components.

## Uzasadnienie

1. **Brak zależności** — zero node_modules dla frontendu, mniejszy bundle, szybsze buildy.
2. **Łatwy deploy** — pojedyncze pliki HTML + JS + CSS. Brak SSR, hydration, waterfall.
3. **Legacy codebase** — aplikacja rozwijana od 2024, migracja do frameworka = przepisanie 37k+ linii JS.
4. **Full control** — 100% kontrola nad DOM, SVG, Web API. Żadne frameworkowe abstrakcje nie ograniczają.
5. **IIFE pattern** — każdy moduł to IIFE lub funkcja globalna. Prosty, przewidywalny.
6. **Wsparcie Vite (historyczne)** — Vite rozwiązywał bundle'owanie, HMR i code splitting bez frameworka; wycofany w ADR-005 (Express jako jedyny serwer).

## Konsekwencje

- **Ręczne zarządzanie stanem** — brak useState/ref/reactive. Stan w globalnych tablicach (`wells[]`, `products[]`).
- **Manualne renderowanie** — każde `innerHTML = ...` wymaga `lucide.createIcons()`.
- **Brak type safety** — frontend w czystym JS (karuzela typów). Planowana migracja na TS (Phase 2 planu).
- **Więcej boilerplate'u** — modal, dropdown, select budowane od zera za każdym razem (planowana biblioteka helperów w Phase 3).
- **Inline event handlers** — `onclick="..."` w HTML (zgodne z CSP `'unsafe-inline'` w Helmet).
- **Deduplikacja telemetrii po stronie frontendu** — `public/js/studnie/telemetryBridge.js`
  trzyma sesyjną mapę `autoJsDedupMap` (wellId → fingerprint treści + wyceny studni) i pomija
  powtórki identycznych konfiguracji AUTO_JS; `public/js/studnie/offerSave.js` wysyła przy
  zapisie oferty tylko studnie zmienione od ostatniego zapisu (`_filterChangedWells`).
  To przykład wzorca „globalny stan w pamięci” typowego dla SPA bez frameworka.

## Alternatywy odrzucone

| Alternatywa     | Powód odrzucenia                                                                    |
| --------------- | ----------------------------------------------------------------------------------- |
| React + Next.js | Zbyt duży overhead dla aplikacji z jednym użytkownikiem. Wymaga przepisania 100% UI |
| Vue + Nuxt      | Podobnie jak React — nieproporcjonalny koszt migracji                               |
| Svelte          | Mniejszy bundle, ale wciąż wymaga pełnej migracji                                   |
| HTMX            | Nieobsługuje złożonych interakcji SVG (diagram studni, drag & drop)                 |
