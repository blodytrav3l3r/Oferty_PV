# ADR-013: System palety kolorow dark/light (WCAG AA)

**Status:** zaakceptowana (2026-09-24)
**Kontekst:** audyt kolorystyki wykazal, ze test parzystosci tokenow
(`themeTokensParity`) nie mierzy kontrastu — bialy tekst na bialym
przechodzil CI (bledy L8/L9/L10 i następcy).

## Decyzja

1. **Rozdzial rol tokenow:** `--accent` (i `--accent2`, `--purple`)
   SLUZY WYLACZNIE do wypelnien/obramowan/gradientow. Tekst na
   powierzchniach UZYWA WYLACZNIE wariantow `-text`/`-hover`
   (`--accent-text`, `--accent2-hover`), ktore sa adaptacyjne
   (jasne w dark, ciemne w light). Vivid baza jako `color` jest
   zakazana — pilnuje gate `themeTextContrast.test.ts`.
2. **`--accent` dark `#6366f1` → `#5b5fec`** (ten sam odcien indigo):
   bialy tekst na pelnym wypelnieniu 4,47 → 4,89:1 (AA).
   Sync z `DOCX_COLORS.accent` (gate `printTokensConsistency`).
3. **Hovery przyciskow pelnych ciemnieja, nie jasnieja**
   (`.btn-primary`, `.action-btn.primary`, `.wizard-btn-next` → tlo
   `--accent-strong`): bialy tekst na `--accent-hover` w dark dawal ~3,0.
4. **Nowe tokeny `--bg-subtle` / `--border-color`** (z parami light)
   zamiast bialych fallbackow `rgba(255,255,255,…)` w `mlPanels.js`.
5. **Badze typu konfiguracji** maja pary bg/fg w mapie `typeBadge`
   (`actionsConfigRender.js`), kazda para liczona do AA ≥ 4,5
   (gate w tescie).
6. **Duzy tekst (display 8xl, `.index-logo`)** moze uzywac vivid bazy
   (prog large-text 3:1) — jawna allowlista w tescie, nie precedens.
7. **`.header-version`: opacity 0.65 → 1** (batch B, 2026-09-30):
   slate-400 × 0.65 dawało 3.64:1 na tle headera; pełny slate-400 ~7:1.
   Celowy wyjątek tylko dla tej klasy, nie zmiana tokenu.
8. **`.wizard-dot-label` w axe: false-positive narzędzia, nie dług** (batch B):
   iframe modułu ma przezroczyste body (router.js celowo), więc axe zakłada
   białe tło canvas (1.99). Realny render: rodzic app.html `rgb(10,14,26)` —
   label #a5b4fc ma tam ~7:1. `.exclude()` na selektor w iframe jest
   w @axe-core/playwright 4.13 nieskuteczne (sonda) — test filtruje DOKŁADNIE
   ten węzeł po (rule + selektor), nie całą regułę.

## Konsekwencje

- Zmiana odcienia akcentu widoczna na przyciskach/gradientach
  (minimalna, ten sam hue); dokumenty DOCX/PDF zsynchronizowane.
- Kazdy nowy `color: var(--accent|accent2|purple|slate-500)` wywali gate.
- Pary palety zablokowane testem (19 par, oba motywy).
