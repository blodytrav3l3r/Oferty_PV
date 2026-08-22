# Status Bar dla OpenCode TUI — plan realizacji

**Data:** 2026-08-22
**Wersja aplikacji:** niezależne od wersji S.O.K. narzędzie deweloperskie
**Zakres:** plugin TUI OpenCode v1.18+ (provider-agnostic), bez zmian w rdzeniu S.O.K.

## Cel

Profesjonalny Status Bar w OpenCode pokazujący na bieżąco: model, providera, stan
sesji, throughput (tok/s), TTFT, wykorzystanie kontekstu, czasy requestów, czas
sesji oraz koszty — wyłącznie z realnych danych OpenCode.

## Architektura

OpenCode jest aplikacją zewnętrzną (binarna, v1.18.17) — modyfikacja odbywa się
wyłącznie przez oficjalne **TUI Plugin API** (`@opencode-ai/plugin/tui`, sloty,
event bus, keymap). Zero forkowania, zero własnej telemetrii.

```
.opencode/plugins/status-bar/
├── status-bar.tsx      moduł TUI: default export { id: "sok.status-bar", tui }
├── smoke.mjs           integracyjny smoke-test (bun run smoke.mjs)
└── lib/
    ├── format.js       formatery czyste: k/M, tok/s, mm:ss, %, $, N/A, progi 80/90%
    ├── state.js        store + subskrypcje: agregacja tokenów/kosztów, TTFT, historie avg/peak
    ├── layout.js       renderCompact(state, theme, width) + renderDetailRows(state)
    ├── events.js       api.event.on -> store (5 eventów), seedSession, resolveModel
    ├── view.tsx        SolidJS/OpenTUI: StatusBarView (slot app_bottom) + DetailsDialog
    ├── format.test.mjs / state.test.mjs / flow.test.mjs   node --test
```

Rejestracja globalna (`C:\Users\<user>\.config\opencode\tui.json`) — ścieżka
absolutna do pliku pluginu; działa we wszystkich projektach:

```json
{
    "$schema": "https://opencode.ai/tui.json",
    "plugin": ["I:/GitHub/Oferty_PV/.opencode/plugins/status-bar/status-bar.tsx"]
}
```

Uwaga: katalog `.opencode/` jest w całości ignorowany przez git tego repo
(root `.gitignore:98`) — kod pluginu dodany do indeksu z `git add -f`
świadomie, zgodnie z decyzją o wersjonowaniu.

## Źródła danych (ETAP 0/21 — nic nie jest zgadywane)

| Metryka          | Źródło                                                                                                           | Brak danych             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Model / Provider | `AssistantMessage.providerID/modelID` + katalog `api.state.provider` (models.dev): `Model.name`, `limit.context` | ID surowe / `"Unknown"` |
| Tokeny           | `message.tokens {input, output, reasoning, cache.read/write, total}`                                             | sekcja ukryta / `N/A`   |
| Kontekst %       | `tokens.total / model.limit.context`; progi wizualne 80%/90% + markery `!`/`!!`                                  | bez `%`                 |
| tok/s            | po ukończeniu: `output / (completed − pierwszy delta)`; live: tylko z interim usage providera                    | spinner                 |
| TTFT             | pierwszy delta − `message.time.created` (oba timestampy serwera); pomiar klienta, bo OpenCode nie eksponuje TTFT | ukryte                  |
| Czas requestu    | `completed − created` ("Last X s") lub stopwatch podczas generowania                                             | ukryte                  |
| Koszt            | suma `message.cost` (liczony przez OpenCode z cennika models.dev)                                                | `Cost: N/A`             |
| Stan sesji       | `session.status`: idle/busy/retry{attempt,message} + `session.error`                                             | `● READY`               |

## Przepływ

```
provider SSE -> OpenCode core -> event bus -> api.event.on [events.js]
  -> mutacje store + emit() [state.js] -> setSignal [view.tsx]
  -> renderCompact [layout.js] -> slot app_bottom (renderer hosta)

Timer 1 s (jedyny): store.tick() (czas sesji) + detekcja zmiany sesji
w route.current -> seedSession(). Nazwy modeli: katalog w pamięci, zero sieci.
```

Skrót: `ctrl+shift+s` lub `/status` (command palette) — dialog szczegółów
(Etap 13): Current/Average/Peak tok/s, TTFT, Generation/Request, Input/Output,
Context, Session duration, Requests/Messages, Cost.

## Testy i weryfikacja (2026-08-22)

- `node --test lib\*.test.mjs` — **25/25 pass**
  (formatery: wartości brzegowe tok/s, duration, cost, progi kontekstu, stany;
  state: agregacja, dedupe sum, retry/error, reset sesji; responsive: dobór
  sekcji 60/120/180 kol; flow: pełny cykl busy→deltas→interim→completed→idle)
- `bun run smoke.mjs` — import modułu tsx przez bun (JSX runtime OK),
  rejestracja 5 subskrypcji eventów, dispose timera — **EXIT=0**
- `bun build --external @opentui/* solid-js` — **EXIT=0** (6 modułów)

## Manualna weryfikacja TUI (do wykonania przy pierwszym uruchomieniu)

1. Uruchom `opencode` (TUI) — pasek widoczny pod trasą (home + sesja).
2. Wyślij wiadomość: `● IDLE` → `◉ GENERATING` + stopwatch → `● IDLE` + `Last`.
3. Po odpowiedzi: tok/s, TTFT, kontekst, koszt aktualizują się eventowo.
4. `ctrl+shift+s` — dialog szczegółów; Esc zamyka.
5. Zmiana modelu/providera → natychmiastowa aktualizacja nazw.
6. Wąski terminal → priorytety sekcji (koszt/ttft/provider odpadają pierwsze).

## Znane ograniczenia (świadome, ponytail)

- Resize terminala nie przeładowuje sekcji do czasu ponownego otwarcia TUI
  (host nie emituje eventu resize do pluginów).
- Przełączenie sesji resetuje sumy bieżącego widoku (agregaty liczone od nowa).
- Live tok/s tylko dla providerów raportujących usage w trakcie streamingu;
  pozostali dostają dokładną wartość po ukończeniu.
- `.opencode/tsconfig.json` (ECC) celowo nie obejmuje `plugins/**/*.tsx`.
