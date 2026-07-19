# Konwencje dokumentacji — WITROS Oferty PV

**Data:** 2026-07-19
**Źródło:** `AGENTS.md`, `CONTRIBUTING.md`, analiza istniejących plików `docs/`

---

## 1. Język dokumentacji

| Typ treści                                     | Język     | Przykład                       |
| ---------------------------------------------- | --------- | ------------------------------ |
| Komunikacja z użytkownikiem w odpowiedziach AI | Polski    | —                              |
| Komentarze w kodzie, commity, CHANGELOG        | Polski    | `fix(api): naprawa walidacji`  |
| Nazewnictwo w kodzie (zmienne, funkcje, klasy) | Angielski | `createUser`, `productPrice`   |
| Pliki dokumentacyjne (`docs/*.md`)             | Polski    | Nagłówki, opisy, instrukcje    |
| Kod źródłowy w dokumentacji                    | Angielski | Przykłady kodu, identyfikatory |

---

## 2. Lokalizacja plików dokumentacji

- **Główna dokumentacja**: `docs/` — wszystkie pliki `.md` z wyjątkiem README projektu
- **Decyzje architektoniczne (ADR)**: `docs/adr/ADR-XXX-nazwa.md`
- **Plany, taski, implementation plany**: `docs/plans/*.md`
- **Audyty**: `docs/audits/*.md`
- **Dokumentacja modułów (feature)**: `docs/<nazwa-modulu>/` (np. `docs/import-export/`)

**Wyjątki** (plany narzędziowe poza `docs/`):

- `.opencode/` — konfiguracja OpenCode
- `.claude/` — konfiguracja Claude/Hermes
- `plugins/` — dokumentacja pluginów (np. ponytail)

---

## 3. Encoding (kodowanie znaków)

| Typ pliku     | Kodowanie       | Uwagi                   |
| ------------- | --------------- | ----------------------- |
| `.md`, `.txt` | UTF-8 (bez BOM) | Polskie znaki dozwolone |
| `.json`       | UTF-8 (bez BOM) | —                       |
| `.html`       | UTF-8 (bez BOM) | —                       |

**Zasady:**

- W plikach `.md` używaj swobodnie polskich znaków (ąćęłńóśźż)
- Unikaj BOM (Byte Order Mark) na początku plików UTF-8
- Nie używaj emoji, chyba że użytkownik wyraźnie o to poprosi

---

## 4. Formatowanie plików `.md`

- Używaj GitHub Flavored Markdown (GFM)
- Tabele dla danych tabelarycznych
- Nagłówki: `#` dla tytułu, `##` dla sekcji, `###` dla podsekcji
- Kod: otoczony `` `backtickami` `` (inline) lub ` `triple backticks` ` (bloki)
- Ścieżki plików: względne (np. `docs/ARCHITECTURE.md`)
- Wyrównanie tekstu: do lewej (LICZBY w tabelach do prawej)

---

## 5. Konwencje commitów dla dokumentacji

Typ: `docs(scope): opis`

```
docs(readme): aktualizacja instrukcji instalacji
docs(api): dodanie endpointu /api/v2/offers
docs(adr): nowy ADR-005 dla wyboru biblioteki XLSX
```

---

## 6. Release flow a dokumentacja

- Przed releasem: sprawdź czy `CHANGELOG.md` jest aktualny (generowany przez `standard-version`)
- Po zmianie wersji: zaktualizuj `VERSION` i `package.json` (automatyczne przez `npm run release`)
- Cache-bust `?v=` w HTML jest synchronizowany z `VERSION` — **nie edytuj ręcznie**

---

## 7. Szablon nowego pliku dokumentacji

```markdown
# Tytuł

**Cel**: Krótki opis celu dokumentu.
**Odbiorca**: Dla kogo jest przeznaczony.
**Data aktualizacji**: RRRR-MM-DD

## Opis

...

## Powiązane pliki

- `docs/powiazany-plik.md` — opis powiązania
- `src/komponent.ts` — implementacja
```

---

## 8. Zasady jakości

- **DRY**: Nie powielaj informacji — odnoś się do innych dokumentów
- **Aktualność**: Każdy plik powinien mieć datę aktualizacji
- **Spójność terminologii**: Używaj tych samych nazw co w kodzie i innych dokumentach
- **Kontekst**: Każdy dokument powinien jasno określać swojego odbiorcę i cel
