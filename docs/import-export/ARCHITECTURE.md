# Architektura — Import/Eksport ofert

## Cel

Dwie funkcje w kartotece ofert:

1. **Import/Eksport XLSX** — transfer danych do/z zewnętrznych systemów (format kolumnowy)
2. **Eksport/Import JSON 1:1** — przenoszenie pełnej oferty + zamówień między urządzeniami

## Feature flag

Funkcja jest kontrolowana przez wpis w tabeli `settings`:

- Klucz: `feature_import_export_enabled`
- Wartość: `'1'` (włączone) / `'0'` (wyłączone)
- Endpoint: `GET /api/feature-flags` → `{ import_export_enabled: bool }`
- Domyślnie: włączone po migracji

## Struktura plików

```
public/js/import-export/
├── shared/
│   ├── featureFlag.js          # ImportExportFeatureFlag — cache + fetch
│   ├── xlsxImportShared.js     # XlsxImportShared — parse/generate XLSX
│   ├── conflictModal.js        # ConflictModal — skip/overwrite/clone
│   └── jsonOfferTransfer.js    # JsonOfferTransfer — build/parse 1:1 JSON
├── rury/
│   ├── externalImport.js       # RuryExternalImport — XLSX → API
│   ├── externalExportTemplate.js  # RuryExternalExportTemplate — API → XLSX
│   └── transferJson.js         # RuryTransferJson — 1:1 JSON + orders
└── studnie/
    ├── externalImport.js       # StudnieExternalImport — XLSX → API
    ├── externalExportTemplate.js  # StudnieExternalExportTemplate — API → XLSX
    └── transferJson.js         # StudnieTransferJson — 1:1 JSON + orders

public/js/sales/
└── pvImportExportToolbar.js    # UI toolbar w kartotece

src/routes/
└── featureFlags.ts             # Backend: GET/PUT feature flags + audit

prisma/migrations/
└── 20260705000000_feature_import_export/migration.sql
```

## Zależności

- `XLSX` (SheetJS) — wymagany, już istnieje w `public/js/shared/xlsx.full.min.js`
- `lucide` — wymagany, już istnieje
- `fetch` — standardowy

## API endpoints

### Nowe

| Metoda | Endpoint                           | Opis                                  |
| ------ | ---------------------------------- | ------------------------------------- |
| GET    | `/api/feature-flags`               | Pobiera flagę `import_export_enabled` |
| PUT    | `/api/feature-flags/import-export` | Admin toggle flagi                    |
| POST   | `/api/feature-flags/audit`         | Logowanie audytu z frontendu          |

### Istniejące (używane)

| Metoda | Endpoint                       | Opis                                     |
| ------ | ------------------------------ | ---------------------------------------- |
| POST   | `/api/offers-rury`             | Tworzenie/aktualizacja oferty rur        |
| POST   | `/api/offers-rury/studnie`     | Tworzenie/aktualizacja oferty studni     |
| GET    | `/api/offers-rury/:id`         | Pobranie pojedynczej oferty rur          |
| GET    | `/api/offers-rury/studnie/:id` | Pobranie pojedynczej oferty studni       |
| PUT    | `/api/orders-rury`             | Tworzenie/aktualizacja zamówienia rur    |
| PUT    | `/api/orders-studnie`          | Tworzenie/aktualizacja zamówienia studni |

## Format XLSX (import zewnętrzny)

Kolumny:

- `NUMER_OFERTY` (wymagany) — identyfikator oferty
- `NR_STUDNI` (opcjonalny) — nazwa studni
- `GLEBOKOSC` (opcjonalny) — głębokość
- `INDEKS_CZESCI` (wymagany) — kod produktu z cennika
- `ILOSC` (wymagany) — ilość sztuk
- `CENA_JEDNOSTKOWA` (wymagany) — cena jednostkowa
- `WERS` (opcjonalny) — wersja oferty
- `RABAT` (opcjonalny) — rabat w %; pusty dla dennicy (cena finalna)
- `SREDNICA` (opcjonalny) — średnica
- `ZAKONCZENIE` (opcjonalny) — typ zakończenia
- `MAGA` (opcjonalny) — lokalizacja magazynowa
- `LP` (opcjonalny) — kolejność sortowania

## Format JSON 1:1

```json
{
  "kind": "witros-offer-transfer",
  "schemaVersion": 1,
  "module": "rury",
  "exportedAt": "2026-07-05T12:00:00.000Z",
  "exportedBy": "userId",
  "offer": { ... },
  "orders": [ ... ]
}
```

## Obsługa konfliktów

Przy imporcie oferty o numerze który już istnieje w systemie:

1. **Pomiń** — nie importuj
2. **Nadpisz** — zaktualizuj istniejącą ofertę
3. **Utwórz kopię** — zmień numer na `{numer}-2`

## Audyt

Wszystkie akcje logowane do `audit_logs`:
| Akcja | `action` | Opis |
|-------|----------|------|
| Import XLSX | `import.external` | Utworzenie/zaktualizowanie oferty z XLSX |
| Eksport 1:1 | `export.transfer` | Pobranie JSON 1:1 |
| Import 1:1 | `import.transfer` | Import JSON 1:1 (z innego urządzenia) |
