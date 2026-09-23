# DESIGN.md — S.O.K. System Ofert i Kalkulacji

Marka: profesjonalne narzędzie produkcyjne. Zero AI slop: brak glassmorphism bez funkcji, neonów, przesadnych gradientów/cieni/radiusów. Dane ważniejsze niż dekoracje.

## Principles

1. Gęstość tam, gdzie decyzje (tabele, Excel) — oddech tam, gdzie formularze.
2. Jeden token = jedna rola. Zakaz gołych hexów poza `:root` (`style.base.css:3-289`).
3. Kontrakt przed estetyką: `id/class/data-*` z JS zostają; zmiany geometrii minimalne.
4. Status = ikona + kolor + tooltip, nigdy sam kolor. Focus zawsze widoczny.

## Colors

Baza (dark, `:root`): `--bg-primary #0a0e1a`, `--bg-secondary #111827`, `--bg-card`, `--bg-tertiary`, `--bg-input`. Tekst: `--text-primary/secondary/muted/heading` (slate). Akcent: `--accent #6366f1` → `--accent2 #8b5cf6`. Semantyka: `--success #10b981`, `--danger #ef4444`, `--warn #f59e0b`, `--blue #3b82f6`, `--pink #ec4899` — każdy z `-hover/-bg/-border` i `-rgb` do tintów.

Light (`html[data-theme='light']`, base:2174-2312 + łatki modułowe): własna hierarchia powierzchni (jasne tła, ciemny tekst, mocniejsze bordury), nie inwersja dark. Excel wyłącznie przez `--excel-*` (18 tokenów, kontrakt z testem `excelThemeTokens`).

Akcenty modułów (logo gradient): rury accent→accent2, studnie success, kartoteka warn, zlecenia pink.

## Typography

Inter (`--font-sans`), mono dla ID/numerów/cen (`--font-mono`). Skala `--fs-3xs…8xl`, wagi `--fw-light…black`. Hierarchia: H1 1×/widok, sekcje H2/H3, tabele `--fs-sm` mono dla liczb (`.rury-col-num`), caption/label dla pomocy formularzy.

## Spacing / radius / shadow

`--section-gap 1.5rem`, `--section-gap-lg 2rem`, gap `.gap-1…4`, `--header-h 57px`. Radius: 4/8/12 (główny)/16/20/pill. Cienie sm/md/lg + navy. Transition `--transition` 0.25s, hovery 150-300ms, `prefers-reduced-motion` wyłącza animacje.

## Components

Przyciski `.btn-*` (primary/secondary/danger/success/warn/ghost, sm, icon). Formularze `.form-*` + `.form-row-2/3/4`, błędy przy polu z `role=alert`. Tabele `.table-wrap`, sticky `th` uppercase, hover `--bg-hover`, liczby mono do prawej. Excel: wysoka gęstość, sticky 7 kolumn, `--excel-row-height`, tła statusów z priorytetem duplikat > ERROR > WARNING. Modale wyłącznie `modalCore.js`, rozmiary `.modal--sm/md/lg`, warstwy `LAYERS.*` / `--z-*`. Toast 3-5s `showToast`. Ikony wyłącznie Lucide + `createIcons({root})`.

## States

default/hover/focus/active/selected/disabled/loading/error/success dla każdego komponentu. Disabled = `.disabled-fade`. Empty states: komunikat + akcja (`.empty-state`). Loading: skeleton/spinner w kontenerze, nie pustka.

## Accessibility (WCAG 2.2 AA)

Kontrast ≥ 4.5:1, `:focus-visible` + `--focus-ring`, `<label for>`, semantyczny HTML, `aria-label` na przyciskach ikonowych, jeden `h1`, błędy nie tylko kolorem.

## Responsive

Kanon 1400/1200/1100/900/768/600/480 (+ lokalne 860/720/700/640 — nie ujednolicać bez screenshotów). Brak poziomego scrolla w 375/768/1024/1440. Desktop workflow nietykalny.

## Animation

Tylko funkcja: fade overlay, translateY(-2px) hover kart, zero `scale`. Overlay/modal 150-250ms.

## Print

Szablony `public/templates/` (ofertaRury/Studnie, kartaBudowy, zlecenie, etykieta): nagłówki/stopki, page-breaks, kolory druku, brak overflow. Print workflow bez zmian geometrii ekranowej.
