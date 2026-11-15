# Teksty licencji zależności npm

Poniższe pliki są kopiami oryginalnych tekstów z repozytoriów autorów. Wersje
pochodzą z `package-lock.json`; identyfikatory commitów z metadanych tych wersji
w rejestrze npm. Pliki dostarczane są wraz z katalogiem `public/licenses/`.
Maszynowe powiązania pakietów, wersji, źródeł i sum SHA-256 znajdują się
w `manifest.json`; spójność weryfikuje `npm run licenses:check`.

| Zależność                                                                                        | Wersja  | Plik                                | Źródło oryginału                                                                                               |
| ------------------------------------------------------------------------------------------------ | ------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@puppeteer/browsers`                                                                            | 3.2.6   | `puppeteer-a207faf-LICENSE.txt`     | [commit a207faf](https://github.com/puppeteer/puppeteer/blob/a207faf527ce4305b33a6c0f9706b090c21c115e/LICENSE) |
| `puppeteer`                                                                                      | 25.16.0 | `puppeteer-a207faf-LICENSE.txt`     | [commit a207faf](https://github.com/puppeteer/puppeteer/blob/a207faf527ce4305b33a6c0f9706b090c21c115e/LICENSE) |
| `puppeteer-core`                                                                                 | 25.16.0 | `puppeteer-a207faf-LICENSE.txt`     | [commit a207faf](https://github.com/puppeteer/puppeteer/blob/a207faf527ce4305b33a6c0f9706b090c21c115e/LICENSE) |
| `@radix-ui/react-compose-refs`                                                                   | 1.1.2   | `radix-fcef066-LICENSE.txt`         | [commit fcef066](https://github.com/radix-ui/primitives/blob/fcef0668a5c827e5a4baac405474d75680f9a4eb/LICENSE) |
| `@radix-ui/react-use-layout-effect`                                                              | 1.1.1   | `radix-fcef066-LICENSE.txt`         | [commit fcef066](https://github.com/radix-ui/primitives/blob/fcef0668a5c827e5a4baac405474d75680f9a4eb/LICENSE) |
| `remeda`                                                                                         | 2.33.4  | `remeda-f9e681a-LICENSE.txt`        | [commit f9e681a](https://github.com/remeda/remeda/blob/f9e681a707fd8cac00c43c10591c44e17f577610/LICENSE)       |
| `postgres`                                                                                       | 3.4.7   | `postgres-9b92b65-UNLICENSE.txt`    | [commit 9b92b65](https://github.com/porsager/postgres/blob/9b92b65da6a5121545581a6dd5de859c2a70177f/UNLICENSE) |
| `@sentry/server-utils`                                                                           | 10.76.2 | `sentry-10.76.2-LICENSE.txt`        | [tag 10.76.2](https://github.com/getsentry/sentry-javascript/blob/10.76.2/LICENSE)                             |
| `@esbuild/linux-x64`, `@esbuild/win32-x64`                                                       | 0.28.2  | `esbuild-609683d-LICENSE.txt`       | [commit 609683d](https://github.com/evanw/esbuild/blob/609683d892977362a0f99026cb74b96263d728a9/LICENSE.md)    |
| `@pkgr/core`                                                                                     | 0.3.6   | `pkgr-6e1c726-LICENSE.txt`          | [commit 6e1c726](https://github.com/un-ts/pkgr/blob/6e1c7260486c7251e61404176a293986229a5869/LICENSE)          |
| `unrs-resolver`, `@unrs/resolver-binding-linux-x64-gnu`, `@unrs/resolver-binding-win32-x64-msvc` | 1.12.2  | `unrs-resolver-ccb26d2-LICENSE.txt` | [commit ccb26d2](https://github.com/unrs/unrs-resolver/blob/ccb26d205e2938b16069c64a28996b48ee97ff94/LICENSE)  |
| `saxes`                                                                                          | 6.0.0   | `saxes-211fa0e-LICENSE.txt`         | [commit 211fa0e](https://github.com/lddubeau/saxes/blob/211fa0ebec9b628affc09219199639887174bfc3/LICENSE)      |

Teksty MIT wraz z notami o prawach autorskich znajdują się również w plikach
README zainstalowanych wersji: `cookie-signature@1.0.6`, `hash.js@1.1.7`,
`isarray@1.0.0`, `pg-types@2.2.0` i `pgpass@1.0.5`. Należy zachować te pliki
w odpowiednim artefakcie; brak osobnego pliku `LICENSE` nie oznacza braku
tekstu licencji w pakiecie.

Powyższa lista nie potwierdza kompletności licencji całej dystrybucji. Każdy
artefakt (w tym obraz Docker i instalacja Windows) wymaga osobnej weryfikacji
dołączonych tekstów i informacji o dostępie do źródeł dla jego faktycznej
zawartości i wersji.

**Chrome for Testing:** pełna lista atrybucji i warunków wszystkich składników
w konkretnym pakiecie binarnym nie została tu zweryfikowana. Licencja Puppeteer
nie zastępuje licencji i informacji o składnikach samej przeglądarki. Przed
dystrybucją zweryfikuj wersję dostarczonej przeglądarki oraz dostępność jej
informacji licencyjnych; projekt Chromium dokumentuje ich prezentację pod
[`about:credits`](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/adding_to_third_party.md).
