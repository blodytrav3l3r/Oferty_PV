# OPENCODE V2 — konfiguracja środowiska agenta (SSoT)

> Runtime projektu. Fakty sprawdzone w `opencode-cli.exe --version` i `opencode debug config`.
> Ten plik opisuje **stan oczekiwany**; kod i config są rozstrzygające przy rozbieżności.

---

## 1. Runtime

| Element      | Wartość                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Wersja       | OpenCode **V2** (obecnie 2.1.4), CLI z aplikacji desktop: `<Programs>\opencode-aidesktop\resources\opencode-cli.exe` |
| Niewspierane | globalny npm `opencode` 1.x — odrzuca projektowy config (`V2 permissions are not supported by OpenCode V1`)          |
| Sprawdzenie  | `opencode-cli.exe --version` → `opencode v2.x.y`                                                                     |

V1 i V2 dzielą nazwę komendy `opencode`, więc obecność V1 w `PATH` myli. W tym repo używamy wyłącznie V2.

## 2. Pliki konfiguracyjne

| Plik                                | Zakres                                                 | W repo |
| ----------------------------------- | ------------------------------------------------------ | ------ |
| `.opencode/opencode.json`           | projekt: model, agenci, permissions, MCP, instructions | tak    |
| `~/.config/opencode/opencode.json`  | globalnie: `plugins`, `mcp.servers`                    | nie    |
| `~/.config/opencode/opencode.jsonc` | globalnie: `providers` (V1 `provider`, normalizowane)  | nie    |
| `~/.config/opencode/cli.json`       | tylko klient TUI (motyw, keybindy, pluginy TUI)        | nie    |
| `.opencode/prompts/agents/*.txt`    | system prompty 10 agentów                              | tak    |
| `.opencode/rules/**`                | kontrakt inżynierski (rules)                           | tak    |
| `.opencode/skills/<id>/SKILL.md`    | 5 skilli specyficznych dla S.O.K.                      | tak    |
| `.caveman.json`                     | projekt: domyślny tryb caveman (`defaultMode`)         | tak    |

Pozostałe skille (design, ui-ux-pro-max, slides, brand, banner-design, ui-styling, design-system) są lokalne — `.gitignore` trzyma je poza repo.

Zmiana configu przeładowuje się bez restartu. Weryfikacja: `opencode-cli.exe debug config` (źródła), `opencode-cli.exe debug agents` (agenci z promptami).

## 3. Aktywne pluginy

| Plugin                     | Źródło                                                         | Funkcja                                                                                                       |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `claude-mem`               | `~/.config/opencode/plugins/claude-mem` (katalog z `index.ts`) | pamięć sesji + tool `claude_mem_search`                                                                       |
| `caveman`                  | `~/.config/opencode/plugins/caveman`                           | dynamiczny tryb caveman (flagi, parsowanie komend)                                                            |
| `@dietrichgebert/ponytail` | npm, **pin `5.3.2`** (nie `@latest`)                           | 6 skilli + ruleset minimalizmu (`ponytail`, `-review`, `-audit`, `-debt`, `-gain`, `-help`)                   |
| `open-code-review`         | `~/.config/opencode/plugins/open-code-review.ts`               | tools `ocr_review`, `ocr_health`                                                                              |
| `graphify`                 | `.opencode/plugins/graphify.js` (wersjonowany)                 | przypomnienie o `graphify-out/` przed pierwszą komendą                                                        |
| `git-safety-guard`         | `.opencode/plugins/git-safety-guard.js` (wersjonowany)         | `ask` przed operacją Tier A (`reset --hard`, `clean -f`, `checkout --`, `restore`) — pokrywa bypass `git.exe` |

Zasady: plugin V2 to **katalog z punktem wejścia** (`index.ts` lub `package.json`) **albo pojedynczy plik `.js`** z `export default { id, setup }` (`effect` wg API). Dowód: `graphify.js` działa jako jedna plikowa definicja bez importu pakietu opencode.

Usunięty: `status-bar` (commit `2989c63`) — katalog bez punktu wejścia V2, tracked w ignorowanym katalogu, powodował `WARN failed to capture snapshot` przy każdym tool callu.

## 4. MCP

| Serwer        | Zakres   | Uwagi                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `graphify`    | projekt  | `uvx --from graphifyy[mcp] graphify-mcp`, graf `graphify-out/graph.json` |
| `open-design` | globalny | Electron daemon                                                          |

`graphify` — wymagania i pułapki:

- `uv` ≥ 0.10 w PATH (`uvx`). Extra **`[mcp]` jest obowiązkowe**: `graphifyy` bez extra nie ma modułu `mcp` i serwer kończy się `ImportError`.
- Pierwszy start po instalacji dociąga zależności (~60 pakietów) — może zbliżyć się do timeoutu MCP 30 s. Kolejne starty są szybkie (cache `uv`).
- `graphify-out/graph.json` jest gitignored: po świeżym clone uruchom `graphify update .`, inaczej serwer wstanie bez grafu.

## 5. Skille — kolejność i uprawnienia

Precedencja (od najniższej): wbudowane → `.claude/skills` → `.agents/skills` → `~/.config/opencode/skills` → projekt `.opencode/skills` → wpisy `skills` w configu. Duplikat ID = wygrywa późniejsze źródło.

Zasady:

- Jeden katalog = jeden skill; V2 **nie** skanuje wnętrza katalogu z `SKILL.md` (zagnieżdżone kopie są martwe).
- ID = nazwa katalogu (lowercase, kebab-case), nie `name` z frontmattera.
- Skille niepasujące do stacku S.O.K. (React/Stitch/Remotion/shadcn) są wyłączone przez `permissions` (`effect: "deny"`), nie usuwane — bundle `~/.agents/skills` jest współdzielony z innymi narzędziami.

## 6. Dodawanie nowych elementów

1. Nowy skill S.O.K.: `.opencode/skills/<id>/SKILL.md` + (opcjonalnie) wyjątek w `.gitignore`, jeśli katalog był ignorowany.
2. Nowy plugin: katalog w `~/.config/opencode/plugins/<id>/` z `index.ts` eksportującym `Plugin.define`; wpis `plugins` w globalnym `opencode.json`.
3. Nowy agent: prompt w `.opencode/prompts/agents/` + wpis `agents.<id>` w `.opencode/opencode.json`.
4. Po zmianie: `opencode-cli.exe debug config` (czy plik configu jest w ogóle czytany) i `debug agents`, log `~/.local/share/opencode/log/opencode.log` (szukaj `failed to load plugin`, `duplicate skill name`, `loading plugin` dla każdego wpisu), bramy repo: `npm run version:check`, `npm run encoding:check`.

## 7. Optymalizacja zużycia tokenów

Narzędzia działają na **różnych końcach** kosztu — mylenie ich prowadzi do złych decyzji:

| Narzędzie                          | Cięcie                | Mechanizm                                                                         |
| ---------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `caveman` (plugin + skille)        | **output**            | skompresowany styl odpowiedzi; inputu nie zmniejsza, a dokłada ~250 tokenów reguł |
| `@dietrichgebert/ponytail`         | **output + iteracje** | wymusza najmniejszą zmianę (YAGNI), mniej kodu i mniej poprawek                   |
| subagenci `cavecrew-*`             | **input**             | `cavecrew-investigator`/`-reviewer` zwracają skompresowaną tabelę zamiast plików  |
| `graphify` (MCP + `graphify-out/`) | **input**             | pytanie do węzła grafu zamiast czytania całych plików                             |

Zasady:

- Domyślny tryb caveman jest pinowany w repo przez `.caveman.json` (`defaultMode`), nie przez config użytkownika — zachowanie identyczne na każdej maszynie z pluginem.
- `.caveman/` (stan pluginu) jest gitignored; `.caveman.json` (decyzja projektu) jest w repo. Nie mylić tych ścieżek.
- Duże rozpoznanie kodu robić subagentem `cavecrew-investigator`, nie serią `read` w głównym kontekście.
- `ponytail` pinowany na konkretną wersję: `@latest` zmienia zachowanie skilli bez zmiany w repo.

## 8. Znane pułapki

- Wpis `plugins` w `cli.json` oczekuje katalogu/pliku URL — ścieżka do nieistniejącego pliku kończy się `configured plugin path must be a directory`.
- `tui.json` to V1 legacy; V2 czyta wyłącznie `cli.json`.
- Dwa globalne configi (`opencode.json` + `opencode.jsonc`) są scalane — zmiana w jednym może zostać nadpisana przez drugi.
- **Niepoprawny JSON w globalnym configu = plik pominięty bez błędu.** Po scaleniu dwóch obiektów w jednym pliku `opencode.json` przestał być czytany i cicho wypadł z niego cały wpis `plugins` (npm `ponytail` się nie ładował). Weryfikacja: `debug config` (lista dokumentów) + log `loading plugin` dla każdego wpisu.
- Katalog `~/.config/opencode/plugins/*` jest skanowany niezależnie od listy `plugins` w configu — brak wpisu w configu nie dowodzi, że plugin nie działa (i odwrotnie: wpis npm bez poprawnego configu nie zadziała).
- `plugins/ponytail` to **vendored submoduł** (pin `14a0d79`, `package.json` 4.8.4), którego runtime **nie używa** — plugin pochodzi z npm (`5.3.2`). Jego drzewo było wcześniej formatowane przez Prettier repo (99 plików `M`); dlatego `plugins/` jest w `.prettierignore`. Nie traktować submodułu jako źródła prawdy o działającej wersji.
