# P7 — AI/ML Transfer Center (plan wdrożenia, NIE wykonano)

> Wersja: 1.34.0 | Baza: `c71fc925` (main) | Status: KONTRAKT v3 (zamrożony,
> GO na implementację P7 Core; P7.5 Extended dopiero po realnym round-trip PC-A→PC-B)
> Realizacja 2026-09-30: P7.0–P7.7 + P7.2–P7.4 (fingerprint-only) + P7.5 Core +
> audit/historia/API — ZROBIONE i pokryte testami (tests/transfer, 30 testów).
> OTWARTE: P7.8 UI (zakładka Transfer w Dashboardzie), P7.5 Extended
> (FULL DATA / Knowledge / Telemetry), P7.9 cross-instance na dwóch fizycznych
> maszynach (round-trip zweryfikowany na jednej instancji + symulacja PC-B).
> Cel: bezpieczny, wersjonowany i audytowalny mechanizm przenoszenia stanu AI/ML
> między instancjami S.O.K. Pakiet `.sokml` = oficjalny artefakt MLOps, nie kontener
> na pliki. Import zawsze: CANDIDATE → IMPORT/LINEAGE/MODEL VALIDATION →
> ADMIN REVIEW → APPROVE → PROMOTE. Tylko AcceptanceModel (round-trip first,
> inne typy modeli poza zakresem).

## 0. Kolejność etapów (obowiązująca)

```text
P7.0 Security/Archive Gate
  → P7.1 Manifest + checksum + fingerprinty
  → P7.6 Compatibility engine (strukturalny raport)
  → P7.7 Dry-run (first-class, przed każdym importem)
  → P7.2 Export model-only (samowystarczalny)
  → P7.3 Import model (idempotentny, zawsze CANDIDATE)
  → P7.4 Dataset (FULL DATA vs FINGERPRINT ONLY)
  → P7.5 Full package (Core vs Extended)
  → P7.8 UI + audit + historia transferów
  → P7.9 Test dwóch maszyn + security regression suite
```

Najpierw „czy pakiet bezpieczny i kompatybilny”, potem „co z nim robimy”.

## 1. Zakres / non-goals

Wchodzi: P7.0–P7.9 z tego planu. Nie wchodzi: kopiowanie całej bazy SQLite,
auto-aktywacja po imporcie, modele inne niż AcceptanceModel, pełna historia
telemetrii (domyślnie OFF, tylko wybrane agregaty), automatyczny import po uploadzie.

## 2. P7.0 — Security/Archive Gate (twardy kontrakt, przed wszystkim)

`.sokml` to ZIP + obowiązkowy manifest, ale import zaczyna się od walidacji
strukturalnej archiwum PRZED zapisem jakichkolwiek danych:

- tylko ścieżki względne; zakaz `../`, ścieżek absolutnych, symlinków;
- zakaz duplikatów ścieżek i artefaktów spoza allowlisty;
- zgodność `manifest.artifacts[]` z faktyczną zawartością ZIP;
- SHA-256 każdego artefaktu + SHA-256 manifestu/checksumów;
- limity konfigurowalne (rozdz. 9): liczba plików, rozmiar uploadu,
  rozmiar po rozpakowaniu, rozmiar pojedynczego artefaktu, stopień kompresji
  (ochrona przed zip bomb); rozpakowanie wyłącznie do katalogu tymczasowego.

Kolejność bramek archiwum:

```text
ZIP → structural validation → manifest extraction → manifest schema →
allowlist → size/path limits → checksums → compatibility →
business validation → import
```

### GO-3 — pre-extraction validation (zakaz: unzip-then-validate)

ZABRONIONE jest pełne rozpakowanie archiwum przed walidacją (katalog tymczasowy
tego nie legalizuje). Obowiązkowy model implementacji:

```text
uploaded .sokml
  → odczyt wpisów ZIP (central directory, bez ekstrakcji treści)
  → walidacja nazw / typów / liczby wpisów / limitów rozmiaru
  → walidacja manifestu
  → dopiero kontrolowana ekstrakcja (po jednym artefakcie, każdy z limitem)
  → checksum → compatibility
```

## 3. Format pakietu `.sokml` v1

```text
.sokml
├── manifest.json
├── models/*.json
├── datasets/
│   ├── manifest.json
│   └── records.ndjson        # FULL DATA; FINGERPRINT ONLY = sam manifest
├── training/runs.json
├── lineage/snapshots.json
├── knowledge/*.json          # tylko P7.5 Extended, po decyzji o zakresie
├── telemetry/selected.json   # tylko P7.5 Extended, domyślnie brak
└── checksums.sha256
```

NDJSON dla rekordów (nie jeden gigantyczny JSON). Manifest zawiera:

```json
{
    "format": "sok-ai-ml",
    "formatVersion": 1,
    "manifestVersion": 1,
    "aiSchemaVersion": "...",
    "featureSchemaVersion": "...",
    "lineageSchemaVersion": "...",
    "modelSchemaVersion": "...",
    "transferPackageId": "pkg_...",
    "packageFingerprint": "sha256:...",
    "createdAt": "...",
    "sourceSokVersion": "1.34.0",
    "sourcePlatform": "windows-x64"
}
```

`formatVersion` ≠ `modelSchemaVersion` ≠ `featureVersion` — osobne kontrakty.

### GO-1 — kanoniczny `packageFingerprint` (zamrożony kontrakt)

`packageFingerprint` NIE jest hashem pliku ZIP (kolejność wpisów, timestampy
i metadane ZIP mogą się różnić przy identycznej zawartości logicznej).
Definicja obowiązująca:

```text
packageFingerprint = SHA-256(
  canonical sorted list: artifactPath + ":" + artifactSha256,
  linie posortowane deterministycznie, zakończone LF
)
```

Ten sam stan AI/ML → ten sam `packageFingerprint`, niezależnie od metadanych ZIP.

### Uwaga implementacyjna — zakaz cyklu manifest ↔ fingerprint

`manifest.json` jest artefaktem pakietu, ale sam niesie `packageFingerprint`,
więc jego własny hash NIE może być wejściem do wyliczenia. Obowiązkowa kolejność:

```text
artifactSha256 (wszystkie artefakty OPRÓCZ manifest.json i checksums.sha256)
  → canonical sorted list
  → packageFingerprint
  → manifest.packageFingerprint (zapis)
  → SHA-256 manifestu i checksums.sha256 (audyt integralności pliku, nie wejście fingerprintu)
```

Czyli: `packageFingerprint ≠ SHA256(manifest + packageFingerprint)`.
Przy weryfikacji importu odtworzyć listę kanoniczną z artefaktów (bez manifestu)
i porównać z `manifest.packageFingerprint`.

### `transferPackageId` ≠ `packageFingerprint`

```text
transferPackageId  = identyfikator konkretnego eksportu (np. pkg_001, pkg_002)
packageFingerprint = identyfikator zawartości logicznej pakietu
```

Dwa eksporty tego samego stanu: różne `transferPackageId`, identyczny
`packageFingerprint`. `ALREADY_IMPORTED` opiera się na **packageFingerprint**,
nie na `transferPackageId`. Re-import tego samego pakietu → `ALREADY_IMPORTED`.

## 4. Lineage modelu (reprodukowalny artefakt, nie „kopia wag”)

Model w pakiecie niesie pełny blok lineage:

```text
modelVersion, featureVersion, datasetFingerprint, datasetSchemaVersion,
solverVersion, rulesVersion, trainingRunId, trainingConfigFingerprint,
validationResult, sourceSokVersion
```

FINGERPRINT ONLY = `IDENTICAL` tylko gdy zgodne są wszystkie:
`fingerprint + fingerprintAlgorithm + fingerprintVersion + record_count +
schema_version`. Sam SHA-256 to za mało (zabezpiecza przed przyszłą zmianą
sposobu liczenia fingerprintu).

## 5. P7.2 — Export model-only (samowystarczalny)

Pakiet model-only musi zawierać wszystko do predykcji po imporcie:
`weights, bias, normalization, feature names + order + version, model schema +
version`. Sytuacja „import OK, ale prediction failed: missing normalization”
jest błędem blokującym release etapu. Obowiązkowy test: export → import →
prediction (rozdz. 10).

Przed generacją `.sokml` Dashboard pokazuje **export preview**: model, dataset
(tryb + liczba rekordów), training runs, lineage ✓/✗, knowledge ✓/✗,
telemetry ✓/✗, szacowany rozmiar, przyciski ANULUJ / EKSPORTUJ. Użytkownik ma
wiedzieć, co opuszcza komputer.

## 6. P7.3 — Import (bramki + idempotencja)

```text
UPLOAD → DRY RUN → COMPATIBILITY REPORT → USER CONFIRMATION → IMPORT
```

Nigdy `UPLOAD → automatyczny import`. Import kończy się zawsze jako CANDIDATE,
a po nim trzy walidacje przed review:

```text
IMPORT → CANDIDATE → IMPORT VALIDATION → LINEAGE VALIDATION →
MODEL VALIDATION → ADMIN REVIEW → APPROVED → PROMOTE → PRODUCTION
```

Deduplikacja po: `artifactFingerprint + modelVersion + featureVersion +
datasetFingerprint + modelSchemaVersion` (+ `packageFingerprint` dla wykrycia
re-importu). Powtórzony import tego samego pakietu → `ALREADY_IMPORTED`,
nie tworzy modeli #102, #103.

### GO-2 — `dryRunId` związany z fingerprintem (dry-run obowiązkowy)

Przepływ wiążący:

```text
upload package → dry-run → dryRunId → user confirmation → import(dryRunId)
```

`dryRunId` wiąże: `packageFingerprint + manifestFingerprint`. Import weryfikuje,
że `dryRunId` jest świeży, pozytywny i dotyczy dokładnie tego pakietu, który
jest importowany. Dry-run → modyfikacja pliku → import = `DRY_RUN_PACKAGE_MISMATCH`
→ BLOCKED. Import bez świeżego dry-run jest odrzucany.

## 7. P7.6 — Compatibility engine (strukturalny raport)

Zwraca `{status, checks: [{code, status}]}` — nie jeden string. Przykładowe kody:
`SOK_VERSION_*`, `AI_SCHEMA_*`, `FEATURE_VERSION_*`, `FEATURE_COUNT_*`,
`NORMALIZATION_*`, `MODEL_DIMENSION_*`, `SOLVER_*`, `RULES_*`, `DATASET_*`
(każdy PASS / WARNING / BLOCKED). UI renderuje checklistę z raportu.

Tabela reguł (część ADR/kontraktu P7, nie tylko implementacji):

| Check                     | PASS          | WARNING                        | BLOCKED              |
| ------------------------- | ------------- | ------------------------------ | -------------------- |
| S.O.K. version            | kompatybilna  | nowsza/zgodna wstecz           | niekompatybilna      |
| AI schema                 | =             | kompatybilna                   | niezgodna            |
| Feature schema / count    | =             | —                              | mismatch             |
| Normalization / dimension | =             | —                              | mismatch             |
| Solver                    | =             | zgodny                         | niezgodny            |
| Rules                     | =             | zmienione                      | krytycznie niezgodne |
| Dataset                   | fingerprint = | brak danych (fingerprint only) | konflikt fingerprint |

## 8. P7.4 / P7.5 — Dataset i podział Core vs Extended

- P7.4: tryby FULL DATA (`records.ndjson`) i FINGERPRINT ONLY (sam manifest
  datasetu); reuse `datasetFingerprint.ts`.
- P7.5 Core: MODEL + LINEAGE + DATASET FINGERPRINT + TRAINING RUN + VERSIONS.
- P7.5 Extended: DATASET FULL + KNOWLEDGE + TELEMETRY (osobno, późnej).
  Przed przenoszeniem `knowledge/{patterns,recommendations}` rozstrzygnąć, czy to
  stan AI/ML, czy artefakty aplikacji — nie kopiować automatycznie.
- Telemetria domyślnie OFF: `models ✓, lineage ✓, training ✓,
dataset = fingerprint only, telemetry ✗` + jawny checkbox
  „Dołącz wybrane agregaty telemetryczne” z ostrzeżeniem o danych operacyjnych.

## 9. Endpointy + limity (konfigurowalne, bez magicznych liczb)

```text
POST /ai/transfer/export
POST /ai/transfer/dry-run
POST /ai/transfer/import
GET  /ai/transfer/:transferId
GET  /ai/transfer/history
```

Wszystkie: `requireAdmin` + `requireAiMlEnabled` + istniejące limitery.
Limity uploadu na poziomie middleware (env, nie magia w kodzie):
`MAX_SOKML_UPLOAD_BYTES`, `MAX_SOKML_UNPACKED_BYTES`, `MAX_SOKML_FILES`,
`MAX_SOKML_ARTIFACT_BYTES` (+ limit stopnia kompresji).

Po uploadzie Dashboard pokazuje **import preview**: pakiet, źródło (S.O.K.),
model, tryb datasetu, checklistę compatibility z raportu, wynik docelowy
(CANDIDATE), przyciski DRY RUN / IMPORTUJ.

## 10. P7.8 / P7.9 — Audit, transferId, testy

Każdy transfer ma `transferId` (np. `trf_20260930_001`). Zdarzenia audytu:
`TRANSFER_EXPORT_STARTED/COMPLETED`, `TRANSFER_DRY_RUN`,
`TRANSFER_IMPORT_STARTED/COMPLETED/REJECTED`,
`TRANSFER_IMPORT_APPROVED/PROMOTED`. Rekord audytu zawiera: `transferId,
packageFingerprint, modelFingerprint, datasetFingerprint, sourceSokVersion,
targetSokVersion, result`. Historia w UI: data, kierunek, wersja, wynik.

Testy:

- P7.0: zip-slip (`../outside.json`) → BLOCKED; zip-bomb → BLOCKED;
  artefakt spoza allowlisty → BLOCKED; naruszony `model.json` →
  `CHECKSUM_MISMATCH`; naruszony manifest → BLOCKED;
  `featureVersion v5` przy wymaganym v6 → `FEATURE_VERSION_MISMATCH`.
- P7.2–3: round-trip na jednej instancji → CANDIDATE, metryki zgodne.
- P7.3: re-import → `ALREADY_IMPORTED`, zero nowych modeli.
- P7.4: FINGERPRINT ONLY na identycznym datasecie → IDENTICAL bez kopiowania.
- P7.7: dry-run nie modyfikuje DB (assert liczby AiModel przed/po).
- P7.9 (dwie instancje, PC-A → PC-B): export → dry-run PASS → import →
  CANDIDATE → approve → promote → **prediction before == prediction after**.
  Kontrakt równości: dla obecnego deterministycznego AcceptanceModel wymagana
  dokładna zgodność (`classification`: exact equality, `probability`: exact
  equality). Tolerancja (epsilon) dopuszczalna dopiero po udokumentowanej zmianie
  modelu/serializacji — nie wymyślać jej teraz.
- Regression: `test:quick` + `validate` zielone po każdym etapie; commit tylko
  via `node scripts/commit.mjs`.

## 11. DONE (wszystkie muszą być spełnione)

1. `.sokml` ma formalny manifest v1 z wersjami schematów (rozdz. 3).
2. Każdy artefakt ma SHA-256 + pakiet ma `packageFingerprint`.
3. ZIP przechodzi P7.0 (path traversal / zip bomb / unknown artifacts niemożliwe).
4. Compatibility engine zwraca strukturalny raport (rozdz. 7).
5. Dry-run nie modyfikuje DB i jest obowiązkowy przed importem.
6. Model przechodzi PC-A → PC-B; prediction przed == prediction po
   (exact equality dla obecnego modelu, rozdz. 10).
7. Import zawsze kończy jako CANDIDATE; PRODUCTION wymaga APPROVE + PROMOTE.
8. Re-import idempotentny (`ALREADY_IMPORTED`, brak duplikatów).
9. Dataset fingerprint (pełny, z wersją algorytmu) zachowany w lineage.
10. Audit zawiera transferId + fingerprinty + wersje źródło/cel.
11. `test:quick` + `validate` zielone; docs API opisują format `.sokml` v1.
