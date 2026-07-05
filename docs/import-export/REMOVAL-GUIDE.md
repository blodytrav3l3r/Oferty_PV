# Instrukcja usunięcia — Import/Eksport ofert

## Szybkie usunięcie (6 kroków)

### 1. Usuń katalog frontendowy

```
rm -rf public/js/import-export/
rm -rf public/js/sales/pvImportExportToolbar.js
```

### 2. Cofnij zmiany w `src/app.ts`

Usuń 2 linie:

```diff
- import featureFlagsRoutes from './routes/featureFlags';
- app.use('/api/feature-flags', featureFlagsRoutes);
```

### 3. Cofnij zmiany w `public/js/sales/pvSalesUi.js`

Usuń wywołanie:

```diff
- if (window.PvImportExportToolbar) PvImportExportToolbar.init('ie-toolbar-host');
```

### 4. Cofnij zmiany w `public/kartoteka.html`

Usuń blok Import/Eksport:

```diff
-                    <!-- IE Toolbar -->
-                    <div id="ie-toolbar-host"></div>
```

Usuń script tagi:

```diff
-        <!-- Import/Eksport ofert (feature flag) -->
-        <script src="js/import-export/shared/featureFlag.js?v=3.1"></script>
-        <script src="js/import-export/shared/xlsxImportShared.js?v=3.1"></script>
-        <script src="js/import-export/shared/conflictModal.js?v=3.1"></script>
-        <script src="js/import-export/shared/jsonOfferTransfer.js?v=3.1"></script>
-        <script src="js/import-export/rury/externalImport.js?v=3.1"></script>
-        <script src="js/import-export/rury/externalExportTemplate.js?v=3.1"></script>
-        <script src="js/import-export/rury/transferJson.js?v=3.1"></script>
-        <script src="js/import-export/studnie/externalImport.js?v=3.1"></script>
-        <script src="js/import-export/studnie/externalExportTemplate.js?v=3.1"></script>
-        <script src="js/import-export/studnie/transferJson.js?v=3.1"></script>
-        <script src="js/sales/pvImportExportToolbar.js?v=3.1"></script>
```

### 5. (Opcjonalnie) Usuń klucz z bazy danych

```sql
DELETE FROM settings WHERE key = 'feature_import_export_enabled';
```

Lub przez Prisma Studio:

```
npx prisma studio
→ znajdź tabelę settings → usuń rekord feature_import_export_enabled
```

### 6. (Opcjonalnie) Usuń migrację

```
rm -rf prisma/migrations/20260705000000_feature_import_export/
```

## Usunięcie przez git (jeśli zmiany nie byly commitowane)

```bash
git checkout -- src/app.ts public/kartoteka.html public/js/sales/pvSalesUi.js
rm -rf public/js/import-export/ public/js/sales/pvImportExportToolbar.js src/routes/featureFlags.ts docs/import-export/
```

## Weryfikacja po usunięciu

- `npm run typecheck` — OK
- `npm run lint` — bez błędów (nie będzie ostrzeżeń o nieużywanych importach)
- `npm run test:quick` — wszystkie testy przechodzą
- Otwórz kartotekę w przeglądarce — pasek Import/Eksport zniknął

## Pliki które pozostaną bez zmian

Następujące pliki są nietknięte przez tę funkcję:

- `public/rury.html`, `public/studnie.html`
- `public/js/rury/offerCrud.js`, `offerExports.js`, `offerItems.js`
- `public/js/studnie/offerManager.js`
- `public/js/spa/router.js`
- Wszystkie pliki CSS
- Wszystkie pliki testowe
