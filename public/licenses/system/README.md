# Licencje pakietów systemowych obrazów Docker

Ten katalog dokumentuje pakiety systemowe (poza npm) obecne w obrazach
dostarczanych z S.O.K. Nie zawiera tekstów licencji — te są w obrazach albo
w `public/licenses/` — tylko inwentarze i sposób ich pozyskania.

## Zakres i źródła danych

| Obraz                | Rola                                   | Wersja systemu          | Digest                                                                    | Inwentarz                                                                               |
| -------------------- | -------------------------------------- | ----------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `sok-app:latest`     | obraz aplikacji (build z `Dockerfile`) | Debian 12.15 (bookworm) | `sha256:a0dd004e3f0e04b5524c81f9c16faa66eb2674f2163fc627d6163086235b86ce` | [`dpkg-inventory-app-image.txt`](dpkg-inventory-app-image.txt) — 229 pakietów           |
| `postgres:18-alpine` | baza danych (Compose)                  | Alpine 3.24.4           | `sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015` | [`apk-inventory-postgres.txt`](apk-inventory-postgres.txt) — 53 pakiety, format `pakiet | wersja | licencja` |

Obraz aplikacji bazuje na `node:22-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee`
(Debian 12.15) i dodaje biblioteki runtime oraz `postgresql-client-18` z repo
PGDG (zainstalowana wersja klienta: 18.6). Digesty obrazów są przypięte
w `Dockerfile`, `docker-compose.yml` i `docker-compose.postgres-test.yml`, więc
inwentarze odpowiadają dokładnie tym wersjom. Po podniesieniu digestu inwentarz
trzeba zebrać ponownie.

## Jak odtworzyć inwentarz

Debian (obraz aplikacji):

```sh
docker run --rm --entrypoint sh sok-app:latest -c 'dpkg-query -W'
```

Alpine (obraz PostgreSQL) — licencje są tylko w bazie APK, nie ma katalogu
`/usr/share/licenses`:

```sh
docker run --rm --entrypoint sh postgres:18-alpine@sha256:b6972e1115a4ff8eba5d7f7d19184926d1e16d7d1136ae1e1a7ebf286da0f015 \
  sh -c "awk -F: '/^P:/{p=substr(\$0,3)} /^V:/{v=substr(\$0,3)} /^L:/{print p\"|\"v\"|\"substr(\$0,3)}' /lib/apk/db/installed"
```

## Gdzie są teksty licencji w obrazach

**Debian (`sok-app`)** — każdy pakiet zainstalowany przez `dpkg` ma katalog
`/usr/share/doc/<pakiet>`, a w nim plik `copyright` z deklaracją licencji
i zwykle pełnym tekstem. Stan zmierzony w obrazie: 229 pakietów, 226 plików
`copyright`, łącznie 4,4 MB. Trzy wpisy w `/usr/share/doc` to dowiązania
symboliczne do dokumentacji innego pakietu (`libstdc++6` i `libgcc-s1` →
`gcc-12-base`, `libncursesw6` → `libtinfo6`), więc dane licencyjne tych
pakietów są w obrazie pod nazwą pakietu źródłowego. Teksty są dostarczane razem
z obrazem, co spełnia obowiązek informacyjny dla komponentów Debian.

**Alpine (`postgres:18-alpine`)** — obraz nie zawiera katalogu z tekstami
licencji. Deklaracje są wyłącznie w bazie APK (`/lib/apk/db/installed`, pole
`L:`), dlatego inwentarz zawiera kolumnę licencji. To wystarcza do
zidentyfikowania obowiązków, ale nie zastępuje pełnych tekstów.

**PostgreSQL w obrazie Alpine** — serwer nie jest pakietem APK. Obraz oficjalny
kompiluje PostgreSQL ze źródeł do `/usr/local`; w obrazie jest wersja **18.7**
(`/usr/local/bin/postgres --version`) i nie ma przy niej pliku `COPYRIGHT`.
Tekst licencji PostgreSQL wraz z notami copyright jest dostarczany osobno jako
`public/licenses/PostgreSQL.txt`; ten plik trzeba przekazać odbiorcy razem
z artefaktem.

## Pakiety copyleft w obrazie PostgreSQL — obowiązki

Poniższe pakiety są objęte licencjami wymagającymi udostępnienia źródeł lub
zachowania not. Pełne teksty i źródła są dostępne w publicznym repozytorium
Alpine ( <https://git.alpinelinux.org/aports/> ) dla wersji pakietu wskazanej
w inwentarzu.

| Pakiet                                        | Wersja              | Licencja                                                          |
| --------------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| `alpine-baselayout`, `alpine-baselayout-data` | 3.7.2-r1            | GPL-2.0-only                                                      |
| `apk-tools`, `libapk`                         | 3.0.9-r0            | GPL-2.0-only                                                      |
| `bash`                                        | 5.3.9-r1            | GPL-3.0-or-later                                                  |
| `busybox`, `busybox-binsh`, `ssl_client`      | 1.37.0-r31          | GPL-2.0-only                                                      |
| `ca-certificates-bundle`                      | 20261020-r0         | MPL-2.0 AND MIT                                                   |
| `gdbm`                                        | 1.26-r0             | GPL-3.0-or-later                                                  |
| `keyutils-libs`                               | 1.6.3-r4            | GPL-2.0-or-later AND LGPL-2.0-or-later                            |
| `libcom_err`                                  | 1.47.4-r0           | GPL-2.0-or-later AND LGPL-2.0-or-later AND BSD-3-Clause AND MIT   |
| `libgcc`, `libstdc++`                         | 15.2.0-r5           | GPL-2.0-or-later AND LGPL-2.1-or-later                            |
| `libidn2`, `libunistring`                     | 2.3.8-r0 / 1.4.2-r0 | GPL-2.0-or-later OR LGPL-3.0-or-later                             |
| `liburing`                                    | 2.14-r0             | LGPL-2.1-or-later OR MIT                                          |
| `lz4-libs`                                    | 1.10.0-r1           | BSD-2-Clause AND GPL-2.0-or-later                                 |
| `musl-utils`                                  | 1.2.6-r3            | MIT AND BSD-2-Clause AND GPL-2.0-or-later                         |
| `readline`                                    | 8.3.3-r1            | GPL-3.0-or-later                                                  |
| `scanelf`                                     | 1.3.9-r1            | GPL-2.0-only                                                      |
| `xz-libs`                                     | 5.8.4-r0            | GPL-2.0-or-later AND 0BSD AND Public-Domain AND LGPL-2.1-or-later |
| `zstd`, `zstd-libs`                           | 1.5.7-r2            | BSD-3-Clause OR GPL-2.0-or-later                                  |

Obowiązki wynikające z GPL/LGPL dotyczą dystrybucji binarnej obrazu:
zapewnienie dostępu do odpowiadającego kodu źródłowego (repozytorium Alpine
albo wskazanie go w dokumentacji wydania) oraz zachowanie not o prawach.
S.O.K. nie modyfikuje tych pakietów — obraz używa ich w postaci z upstreamu,
więc wystarczy wskazać źródło dla konkretnych wersji z inwentarza.

## Czego ten katalog nie obejmuje

- Chrome for Testing — patrz `public/licenses/chrome-for-testing/`.
- Pakietów npm — patrz `public/licenses/npm/` i `THIRD-PARTY-NOTICES.md`.
- Zasobów hosta (Docker Engine, Docker Desktop, sterowniki) — instalowane
  i licencjonowane osobno przez użytkownika, nie są częścią artefaktu.
- `postgresql-client-18` w obrazie aplikacji — licencja PostgreSQL, tekst
  w `public/licenses/PostgreSQL.txt`; pakiet ma własny `copyright` w Debianie.
