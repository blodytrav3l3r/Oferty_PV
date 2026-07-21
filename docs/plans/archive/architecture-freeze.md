# Architecture Freeze — Kontrakt refaktoryzacji

## Wstęp

Niniejszy dokument stanowi **wiążący kontrakt** podczas refaktoryzacji kodu WITROS Oferty PV. Wymienia wszystko, co **nie może ulec zmianie** — każda modyfikacja wymienionych elementów jest zabroniona, chyba że zostanie wyraźnie zatwierdzona jako nowy zakres prac.

Celem jest zagwarantowanie, że po refaktoryzacji aplikacja działa identycznie jak przed zmianami (**zero zmian funkcjonalnych**). Dokument podlega wersjonowaniu w git — każda zmiana freeze'a wymaga świadomej decyzji i nowego commita.

---

## API Backend

### Prefiksy endpointów

```
/api/audit
/api/auth
/api/clients
/api/feature-flags
/api/offers
/api/orders
/api/preco-pricing
/api/products
/api/products-studnie
/api/pv-marketplace
/api/settings
/api/telemetry
/api/users
```

### Endpointy — nie zmieniać ścieżek, metod HTTP, parametrów query, kształtu body/response

| Metoda | Ścieżka                                           | Limiter                               | Uwagi                                                                                             |
| ------ | ------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/api/audit/:entityType/:entityId`                | requireAuth                           | query: `?page=&limit=`                                                                            |
| GET    | `/api/audit/rebuild/:entityType/:entityId/:logId` | requireAuth                           | —                                                                                                 |
| POST   | `/api/auth/login`                                 | loginLimiter                          | body: `{username, password}`                                                                      |
| POST   | `/api/auth/change-password`                       | requireAuth                           | body: `{currentPassword, newPassword}`                                                            |
| POST   | `/api/auth/logout`                                | —                                     | —                                                                                                 |
| GET    | `/api/auth/me`                                    | requireAuth                           | —                                                                                                 |
| POST   | `/api/auth/register`                              | requireAdmin                          | body: `{username, password, role, ...}`                                                           |
| GET    | `/api/clients`                                    | requireAuth                           | query: `?search=`                                                                                 |
| PUT    | `/api/clients/:id`                                | requireAuth                           | body: pełny obiekt klienta                                                                        |
| GET    | `/api/feature-flags`                              | requireAuth                           | —                                                                                                 |
| PUT    | `/api/feature-flags/import-export`                | requireAuth+requireAdmin              | —                                                                                                 |
| POST   | `/api/feature-flags/audit`                        | requireAuth                           | —                                                                                                 |
| GET    | `/api/offers`                                     | requireAuth                           | query: `?search=&type=&userId=&dateFrom=&dateTo=&page=&limit=&myOffers=&withOrder=&withoutOrder=` |
| GET    | `/api/offers/:id`                                 | requireAuth                           | —                                                                                                 |
| POST   | `/api/offers`                                     | writeOffersLimiter                    | body: obiekt oferty                                                                               |
| DELETE | `/api/offers/:id`                                 | requireAuth+writeOffersLimiter        | —                                                                                                 |
| GET    | `/api/offers/orders`                              | requireAuth                           | query: `?search=&page=&limit=`                                                                    |
| GET    | `/api/offers/:id/export-pdf`                      | EXPORT_LIMITER                        | —                                                                                                 |
| GET    | `/api/offers/studnie/:id/export-pdf`              | EXPORT_LIMITER                        | —                                                                                                 |
| GET    | `/api/offers/:id/export-docx`                     | EXPORT_LIMITER                        | —                                                                                                 |
| GET    | `/api/offers/studnie/:id/export-docx`             | EXPORT_LIMITER                        | —                                                                                                 |
| GET    | `/api/offers/rury`                                | requireAuth                           | query: `?search=&page=&limit=`                                                                    |
| POST   | `/api/offers/rury`                                | writeOffersLimiter                    | body: oferta rur                                                                                  |
| PUT    | `/api/offers/rury/:id`                            | writeOffersLimiter                    | body: oferta rur                                                                                  |
| POST   | `/api/offers/rury/:id/duplicate`                  | writeOffersLimiter                    | —                                                                                                 |
| GET    | `/api/offers/studnie`                             | requireAuth                           | query: `?search=&page=&limit=`                                                                    |
| GET    | `/api/offers/studnie/:id`                         | requireAuth                           | —                                                                                                 |
| POST   | `/api/offers/studnie`                             | writeOffersLimiter                    | body: oferta studni                                                                               |
| PUT    | `/api/offers/studnie/:id`                         | writeOffersLimiter                    | body: oferta studni                                                                               |
| DELETE | `/api/offers/studnie/:id`                         | requireAuth+writeOffersLimiter        | —                                                                                                 |
| GET    | `/api/orders/rury`                                | requireAuth                           | query: `?search=&page=&limit=`                                                                    |
| GET    | `/api/orders/rury/:id`                            | requireAuth                           | —                                                                                                 |
| POST   | `/api/orders/rury/claim-rury-number/:userId`      | requireAuth                           | —                                                                                                 |
| PUT    | `/api/orders/rury/:id`                            | writeOrdersLimiter                    | body: zamówienie rur                                                                              |
| PATCH  | `/api/orders/rury/:id`                            | requireAuth                           | body: częściowa aktualizacja                                                                      |
| DELETE | `/api/orders/rury/:id`                            | requireAuth+writeOrdersLimiter        | —                                                                                                 |
| GET    | `/api/orders/rury/:id/export-karta-pdf`           | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/rury/:id/export-karta-docx`          | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/rury/:id/export-pdf`                 | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/rury/:id/export-docx`                | requireAuth                           | —                                                                                                 |
| POST   | `/api/orders/rury/:id/export-offer-pdf`           | exportOrdersLimiter                   | —                                                                                                 |
| POST   | `/api/orders/rury/:id/export-offer-docx`          | exportOrdersLimiter                   | —                                                                                                 |
| GET    | `/api/orders/studnie`                             | requireAuth                           | query: `?search=&page=&limit=`                                                                    |
| GET    | `/api/orders/studnie/:id`                         | requireAuth                           | —                                                                                                 |
| PUT    | `/api/orders/studnie/:id`                         | writeOrdersLimiter                    | body: zamówienie studni                                                                           |
| PATCH  | `/api/orders/studnie/:id`                         | requireAuth                           | body: częściowa aktualizacja                                                                      |
| DELETE | `/api/orders/studnie/:id`                         | requireAuth+writeOrdersLimiter        | —                                                                                                 |
| GET    | `/api/orders/studnie/:id/export-karta-pdf`        | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/studnie/:id/export-karta-docx`       | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/studnie/:id/export-pdf`              | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/studnie/:id/export-docx`             | requireAuth                           | —                                                                                                 |
| POST   | `/api/orders/studnie/:id/export-offer-pdf`        | exportOrdersLimiter                   | —                                                                                                 |
| POST   | `/api/orders/studnie/:id/export-offer-docx`       | exportOrdersLimiter                   | —                                                                                                 |
| GET    | `/api/orders/recycled`                            | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/next-number/:userId`                 | requireAuth                           | —                                                                                                 |
| POST   | `/api/orders/claim-number/:userId`                | requireAuth                           | —                                                                                                 |
| POST   | `/api/orders/claim-production-number/:userId`     | requireAuth                           | —                                                                                                 |
| GET    | `/api/orders/production`                          | requireAuth                           | query: `?search=&status=&page=&limit=`                                                            |
| GET    | `/api/orders/production/registry`                 | requireAuth                           | query: `?search=&page=&limit=`                                                                    |
| GET    | `/api/orders/production/:id`                      | requireAuth                           | —                                                                                                 |
| POST   | `/api/orders/production`                          | writeProductionLimiter                | body: zlecenie produkcyjne                                                                        |
| PUT    | `/api/orders/production/:id`                      | writeProductionLimiter                | —                                                                                                 |
| DELETE | `/api/orders/production/:id`                      | requireAuth+writeProductionLimiter    | —                                                                                                 |
| GET    | `/api/preco-pricing`                              | requireAuth                           | —                                                                                                 |
| PUT    | `/api/preco-pricing/:id`                          | requireAuth                           | —                                                                                                 |
| PATCH  | `/api/preco-pricing/:id`                          | requireAuth                           | —                                                                                                 |
| GET    | `/api/preco-pricing/default`                      | requireAuth                           | —                                                                                                 |
| GET    | `/api/products`                                   | requireAuth                           | query: `?category=&search=&page=&limit=`                                                          |
| PUT    | `/api/products/:id`                               | requireAuth                           | —                                                                                                 |
| PATCH  | `/api/products/:id`                               | requireAuth                           | —                                                                                                 |
| DELETE | `/api/products/:id`                               | requireAuth+requireAdmin+writeLimiter | —                                                                                                 |
| GET    | `/api/products/default`                           | requireAuth                           | —                                                                                                 |
| GET    | `/api/products-studnie`                           | requireAuth                           | query: `?category=&search=&page=&limit=`                                                          |
| PUT    | `/api/products-studnie/:id`                       | requireAuth                           | —                                                                                                 |
| PATCH  | `/api/products-studnie/:id`                       | requireAuth                           | —                                                                                                 |
| DELETE | `/api/products-studnie/:id`                       | requireAuth+requireAdmin+writeLimiter | —                                                                                                 |
| GET    | `/api/products-studnie/default`                   | requireAuth                           | —                                                                                                 |
| POST   | `/api/pv-marketplace/search`                      | requireAuth                           | body: `{search, filters}`                                                                         |
| POST   | `/api/pv-marketplace/order`                       | requireAuth                           | body: `{items, customer}`                                                                         |
| GET    | `/api/settings/year-letter`                       | requireAuth                           | —                                                                                                 |
| PUT    | `/api/settings/year-letter`                       | requireAuth                           | —                                                                                                 |
| POST   | `/api/telemetry/event`                            | WRITE_LIMITER                         | body: `{type, data}`                                                                              |
| GET    | `/api/telemetry/logs`                             | requireAuth+WRITE_LIMITER             | —                                                                                                 |
| POST   | `/api/telemetry/ai/config`                        | requireAuth+WRITE_LIMITER             | —                                                                                                 |
| POST   | `/api/telemetry/ai/event`                         | requireAuth+WRITE_LIMITER             | —                                                                                                 |
| POST   | `/api/telemetry/ai/events/bulk`                   | requireAuth+WRITE_LIMITER             | —                                                                                                 |
| POST   | `/api/telemetry/ai/version`                       | requireAuth+WRITE_LIMITER             | —                                                                                                 |
| POST   | `/api/telemetry/ai/acceptance`                    | requireAuth+WRITE_LIMITER             | —                                                                                                 |
| POST   | `/api/telemetry/ai/acceptance-full`               | requireAuth+WRITE_LIMITER             | —                                                                                                 |
| GET    | `/api/telemetry/ai/list`                          | requireAuth+READ_LIMITER              | —                                                                                                 |
| GET    | `/api/telemetry/ai/history/:wellId`               | requireAuth+READ_LIMITER              | —                                                                                                 |
| GET    | `/api/telemetry/ai/transitions/:configId`         | requireAuth+READ_LIMITER              | —                                                                                                 |
| GET    | `/api/telemetry/ai/events/:wellId`                | requireAuth+READ_LIMITER              | —                                                                                                 |
| GET    | `/api/telemetry/ai/versions`                      | requireAuth+READ_LIMITER              | —                                                                                                 |
| GET    | `/api/telemetry/ai/learning/status`               | requireAuth+requireAdmin+READ_LIMITER | —                                                                                                 |
| POST   | `/api/telemetry/ai/learning/run`                  | requireAuth+requireAdmin+READ_LIMITER | —                                                                                                 |
| GET    | `/api/telemetry/ai/knowledge/patterns`            | requireAuth+requireAdmin+READ_LIMITER | —                                                                                                 |
| GET    | `/api/telemetry/ai/knowledge/stats`               | requireAuth+requireAdmin+READ_LIMITER | —                                                                                                 |
| GET    | `/api/users`                                      | requireAuth+requireAdmin              | —                                                                                                 |
| PUT    | `/api/users/:id`                                  | requireAuth+requireAdmin              | —                                                                                                 |

### Query parametry, które pozostają zamrożone

| Parametr                     | Występuje w endpointach                       | Opis                                      |
| ---------------------------- | --------------------------------------------- | ----------------------------------------- |
| `search`                     | offers, orders, clients, products, production | Wyszukiwanie full-text                    |
| `type`                       | /api/offers                                   | Filtr typu (offer, studnia_oferta, order) |
| `userId`                     | /api/offers                                   | Filtr użytkownika                         |
| `dateFrom` / `dateTo`        | /api/offers                                   | Zakres dat                                |
| `page` / `limit`             | offers, orders, products, production          | Paginacja                                 |
| `myOffers`                   | /api/offers                                   | boolean — tylko moje                      |
| `withOrder` / `withoutOrder` | /api/offers                                   | boolean — status zamówienia               |
| `status`                     | /api/orders/production                        | Status zlecenia                           |
| `category`                   | /api/products, /api/products-studnie          | Kategoria produktu                        |

### Formaty body request/response (zamrożone)

- **Oferta studni**: `{id, number, date, clientId, clientData, wells: [...], discounts, notes, ...}`
- **Oferta rur**: `{id, number, date, clientId, clientData, items: [...], transport, notes, ...}`
- **Zamówienie studni**: `{id, offerId, orderNumber, wells: [...], kartaBudowyData, ...}`
- **Zamówienie rur**: `{id, offerId, orderNumber, items: [...], kartaBudowyData, ...}`
- **Produkt studni**: `{id, category, dn, height, price, ...}`
- **Produkt rury**: `{id, category, diameter, length, price, ...}`
- **Klient**: `{id, name, nip, address, contact, ...}`
- **Użytkownik**: `{id, username, role, displayName, email, ...}`

---

## Frontend

### Window globals — nie zmieniać nazw, typów ani sygnatur

| Global                                  | Plik inicjujący                           | Typ                | Uwagi                                                |
| --------------------------------------- | ----------------------------------------- | ------------------ | ---------------------------------------------------- |
| `window.api`                            | `shared/api.js`                           | object             | Metody HTTP: `get`, `post`, `put`, `patch`, `delete` |
| `window.fetchWithTimeout`               | `shared/api.js`                           | function           | —                                                    |
| `window.MAX_TRANSPORT_WEIGHT`           | `shared/constants.js`                     | number             | —                                                    |
| `window.FLOW_TYPES`                     | `shared/constants.js`                     | object (frozen)    | Typy przepływów                                      |
| `window.calcTransportCount`             | `shared/constants.js`                     | function           | —                                                    |
| `window.calcTransportCost`              | `shared/constants.js`                     | function           | —                                                    |
| `window.formatTransportCount`           | `shared/constants.js`                     | function           | —                                                    |
| `window.calculateTransportTrips`        | `shared/constants.js`                     | function           | —                                                    |
| `window.escapeHtml`                     | `spa/zleceniaHelpers.js`                  | function           | XSS protection                                       |
| `window.escapeJsStr`                    | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.formatDate`                     | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.paramLabel`                     | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.renderTemplate`                 | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.fetchTemplate`                  | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.silentPrint`                    | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.buildPrzejsciaRowsFromPO`       | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.generateSvgFromPO`              | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.buildZlecenieFromPO`            | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.buildEtykietaFromPO`            | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.buildZlecenieFromPageBlock`     | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.buildEtykietaPageBlock`         | `spa/zleceniaHelpers.js`                  | function           | —                                                    |
| `window.pvSalesUI`                      | `sales/pvSalesUi.js`                      | object (PVSalesUI) | Singleton                                            |
| `window.PvImportExportToolbar`          | `sales/pvImportExportToolbar.js`          | object             | —                                                    |
| `window.StudnieTransferJson`            | `import-export/studnie/transferJson.js`   | object             | —                                                    |
| `window.StudnieExternalImport`          | `import-export/studnie/externalImport.js` | object             | —                                                    |
| `window.AppZlecenia`                    | `spa/zlecenia.js`                         | class/func         | —                                                    |
| `window.toggleCard`                     | `app.js`                                  | function           | —                                                    |
| `window.toggleCompactMode`              | `sales/kartotekaInit.js`                  | function           | —                                                    |
| `window.initAdvancedFilterEvents`       | `sales/kartotekaInit.js`                  | function           | —                                                    |
| `window.openPrintModal`                 | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.offerMatchesUser`               | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.offerMatchesDate`               | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.resolveDatePreset`              | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.httpErrorMessage`               | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.offerTypeForApi`                | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.recalculateRuryTransportCost`   | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.computeOrderValueWithTransport` | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.getOfferPrice`                  | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.getOfferItemCount`              | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.resolveUserName`                | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.navigateToModule`               | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.buildOrderModalHtml`            | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.buildOfferCardHtml`             | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.getOfferDisplayData`            | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.getOrderChangeInfo`             | `sales/pvSalesHelpers.js`                 | function           | —                                                    |
| `window.handleCfgDragStart`             | `studnie/actionsConfigDrag.js`            | function           | —                                                    |
| `window.handleCfgDragOver`              | `studnie/actionsConfigDrag.js`            | function           | —                                                    |
| `window.handleCfgDragLeave`             | `studnie/actionsConfigDrag.js`            | function           | —                                                    |
| `window.handleCfgDrop`                  | `studnie/actionsConfigDrag.js`            | function           | —                                                    |
| `window.handleCfgDragEnd`               | `studnie/actionsConfigDrag.js`            | function           | —                                                    |
| `window.currentDraggedPlaceholderId`    | `studnie/actionsConfigDrag.js`            | string/null        | —                                                    |
| `window.aiDashboardRender`              | `admin/aiDashboard.js`                    | function           | —                                                    |
| `window.mlHealthRender`                 | `admin/mlHealthDashboard.js`              | function           | —                                                    |
| `window.__STUDNIE_APP_ORCHESTRATOR__`   | `appStudnie.js`                           | boolean            | —                                                    |

### Globalne zmienne współdzielone między modułami (nie są na window, ale są globalne w kontekście skryptów)

| Zmienna            | Ustawiana w          | Używana przez                                |
| ------------------ | -------------------- | -------------------------------------------- |
| `studnieProducts`  | inicjalizacja studni | wellSolver, wellDiagram, offerManager        |
| `wells` (tablica)  | offerManager.js      | wellSolver, wellDiagram, wellUI, actionsCrud |
| `currentWellIndex` | offerManager.js      | wellSolver, wellDiagram, wellUI              |
| `currentWell`      | offerManager.js      | parametry, konfigurator                      |
| `offerData`        | offerCrud.js         | wizard, parametry, podsumowanie              |
| `ruryParams`       | inicjalizacja rur    | wizard rur                                   |
| `ruryOffer`        | offerItems.js        | oferta rur                                   |
| `studnieProducts`  | pricelistInit.js     | cennik, konfigurator                         |

### localStorage keys

| Klucz                    | Ustawiany w                             | Opis                            |
| ------------------------ | --------------------------------------- | ------------------------------- |
| `authToken`              | `shared/auth.js`, `shared/dashboard.js` | Token autoryzacji JWT           |
| `kartoteka-compact-mode` | `sales/kartotekaInit.js`                | Preferencja widoku kompaktowego |
| `_excelHiddenColumnIds`  | `studnie/excelState.js`                 | Ukryte kolumny w Excel          |
| `wells_ai_influence`     | `studnie/mlDualRanking.js`              | Lokalny cache AI                |

### sessionStorage keys

| Klucz             | Ustawiany w                                                                | Opis                             |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------- |
| `user`            | `app.js`, `appStudnie.js`, `shared/dashboard.js`, `sales/kartotekaInit.js` | Obiekt aktualnego użytkownika    |
| `pending_restore` | `sales/pvSalesAudit.js`                                                    | Oczekująca restauracja snapshotu |

---

## DOM

### ID elementów — bezwzględny zakaz zmiany

Poniższe ID są używane przez `document.getElementById()` w kodzie JS. Jakakolwiek zmiana powoduje błąd wykonania.

#### Sekcje i main layout

| ID                    | Plik HTML                                     |
| --------------------- | --------------------------------------------- |
| `app-header`          | studnie.html, rury.html                       |
| `spa-main`            | app.html                                      |
| `spa-nav-apps`        | app.html                                      |
| `spa-section-nav`     | app.html                                      |
| `spa-app-studnie`     | app.html                                      |
| `spa-app-rury`        | app.html                                      |
| `spa-app-kartoteka`   | app.html                                      |
| `spa-app-zlecenia`    | app.html                                      |
| `spa-logo-text`       | app.html                                      |
| `header-user-info`    | studnie.html, rury.html, app.html             |
| `header-username`     | studnie.html, rury.html, app.html             |
| `header-role-badge`   | studnie.html, rury.html, app.html             |
| `app-version-toolbar` | app.html, index.html, studnie.html, rury.html |
| `connection-dot`      | app.html                                      |
| `section-builder`     | studnie.html, rury.html                       |
| `section-offer`       | studnie.html, rury.html                       |
| `section-pricelist`   | studnie.html, rury.html                       |
| `toast-container`     | wszystkie HTML                                |
| `dash-header`         | index.html                                    |
| `dash-username`       | index.html                                    |
| `dash-role`           | index.html                                    |

#### Wizard (studnie + rury)

| ID                                  | Opis                             |
| ----------------------------------- | -------------------------------- |
| `wizard-indicator`                  | Wskaźnik kroków                  |
| `wizard-step-1`                     | Krok 1 — dane klienta            |
| `wizard-step-2`                     | Krok 2 — parametry               |
| `wizard-step-3`                     | Krok 3 — oferta/kalkulator       |
| `wizard-step-4`                     | Krok 4 — karta budowy            |
| `wizard-step-5`                     | Krok 5 — zamówienie (rury)       |
| `wizard-line-1` ... `wizard-line-4` | Linie łączące w wizard indicator |
| `diagram-panel`                     | Panel diagramu SVG (studnie)     |
| `center-column`                     | Kolumna środkowa (studnie)       |
| `wizard-container`                  | Kontener kreatora (studnie)      |
| `wells-sidebar-container`           | Panel boczny (studnie)           |

#### Offer / Order (studnie)

| ID                 | Opis                  |
| ------------------ | --------------------- |
| `offer-items-body` | Tabela oferty — ciało |
| `offer-colgroup`   | Kolumny tabeli oferty |
| `order-items-body` | Tabela zamówienia     |

#### Offer / Order (rury)

| ID                    | Opis                           |
| --------------------- | ------------------------------ |
| `offer-items-body`    | Tabela pozycji oferty          |
| `offer-colgroup`      | Kolumny tabeli                 |
| `select-all-items`    | Checkbox "zaznacz wszystkie"   |
| `product-search`      | Wyszukiwarka produktów         |
| `product-dropdown`    | Dropdown produktów             |
| `toggle-catalog-btn`  | Przycisk przełączania katalogu |
| `product-catalog`     | Katalog produktów              |
| `catalog-tabs`        | Zakładki katalogu              |
| `catalog-products`    | Lista produktów w katalogu     |
| `transport-breakdown` | Podsumowanie transportu        |
| `rury-summary-bar`    | Pasek podsumowania rur         |

#### Formularz oferty (rury)

| ID                      | Opis              |
| ----------------------- | ----------------- |
| `offer-form-title`      | Tytuł formularza  |
| `client-number`         | Numer klienta     |
| `client-name`           | Nazwa klienta     |
| `client-nip`            | NIP               |
| `client-address`        | Adres             |
| `client-contact`        | Kontakt           |
| `invest-name`           | Nazwa inwestycji  |
| `invest-address`        | Adres inwestycji  |
| `invest-contractor`     | Wykonawca         |
| `offer-number`          | Numer oferty      |
| `offer-date`            | Data oferty       |
| `transport-km`          | KM transportu     |
| `transport-rate`        | Stawka transportu |
| `offer-notes`           | Uwagi do oferty   |
| `offer-payment-terms`   | Warunki płatności |
| `offer-validity`        | Ważność oferty    |
| `btn-change-offer-user` | Zmiana opiekuna   |

#### Krok 4 — Karta budowy (rury)

| ID                                | Opis                      |
| --------------------------------- | ------------------------- |
| `step4-copy-order-select`         | Kopiowanie z zamówienia   |
| `step4-copy-order-help`           | Pomoc kopiowania          |
| `step4-copy-toggle-btn`           | Przełącznik kopiowania    |
| `step4-email-faktura`             | Email faktura             |
| `step4-email-efaktura`            | Email e-faktura           |
| `step4-offer-nr-input`            | Numer oferty              |
| `step4-adres-wysylki`             | Adres wysyłki             |
| `step4-warunki-platnosci`         | Warunki płatności         |
| `step4-ilosc-dni`                 | Ilość dni                 |
| `step4-ubezpieczenie`             | Ubezpieczenie             |
| `step4-osoba-kontakt`             | Osoba kontaktowa          |
| `step4-zabezpieczenie-transportu` | Zabezpieczenie transportu |
| `step4-rodzaj-transportu`         | Rodzaj transportu         |
| `step4-wyliczony-transport`       | Wyliczony transport       |
| `step4-rodzaj-studni`             | Rodzaj studni             |
| `step4-uszczelka-studni`          | Uszczelka studni          |
| `step4-uszczelka-studni-inne`     | Uszczelka inne            |
| `step4-rodzaj-stopni`             | Rodzaj stopni             |
| `step4-rodzaj-stopni-inne`        | Rodzaj stopni inne        |
| `step4-kineta`                    | Kineta                    |
| `step4-kineta-inne`               | Kineta inne               |
| `step4-wysokosc-spocznika`        | Wysokość spocznika        |
| `step4-usytuowanie`               | Usytuowanie               |
| `step4-kaskada`                   | Kaskada                   |
| `step4-kaskada-uwagi`             | Uwagi kaskady             |

#### Kartoteka (sales)

| ID                      | Opis                   |
| ----------------------- | ---------------------- |
| `pv-local-offers-list`  | Lista ofert            |
| `pv-user-filter`        | Filtr użytkownika      |
| `pv-my-offers-btn`      | Przycisk "moje oferty" |
| `pv-date-range-btn`     | Przycisk zakresu dat   |
| `pv-date-popover`       | Popover zakresu dat    |
| `pv-date-from`          | Data od                |
| `pv-date-to`            | Data do                |
| `pv-clear-filters-btn`  | Wyczyść filtry         |
| `pv-local-search-input` | Wyszukiwarka ofert     |
| `pv-load-more-btn`      | Wczytaj więcej         |
| `pv-offer-count`        | Licznik ofert          |

#### Zlecenia

| ID                      | Opis              |
| ----------------------- | ----------------- |
| `section-zlecenia`      | Sekcja zleceń     |
| `zlecenia-stats`        | Statystyki        |
| `zlecenia-filter-tabs`  | Filtry            |
| `zlecenia-search-input` | Wyszukiwarka      |
| `zlecenia-batch-bar`    | Batch bar         |
| `zlecenia-table`        | Tabela zleceń     |
| `zlecenia-table-body`   | Ciało tabeli      |
| `zlecenia-select-all`   | Zaznacz wszystkie |

#### Modale i overlay

| ID                                | Opis                        |
| --------------------------------- | --------------------------- |
| `app-confirm-overlay`             | Overlay potwierdzenia       |
| `app-confirm-icon`                | Ikona modala                |
| `app-confirm-title`               | Tytuł modala                |
| `app-confirm-message`             | Treść modala                |
| `app-confirm-cancel`              | Przycisk anuluj             |
| `app-confirm-ok`                  | Przycisk OK                 |
| `app-confirm-styles`              | Style modala (wstrzykiwane) |
| `offer-history-modal`             | Historia oferty             |
| `offer-history-title`             | Tytuł historii              |
| `offer-discounts-modal`           | Rabaty oferty               |
| `offer-orders-modal`              | Zamówienia oferty           |
| `offer-orders-title`              | Tytuł zamówień              |
| `offer-pehd-price-after-discount` | Cena PEHD po rabacie        |
| `offer-mal-zew-cena`              | Cena malowania zewnętrznego |

#### Well/studnie specyficzne

| ID                             | Opis                         |
| ------------------------------ | ---------------------------- |
| `well-config-body`             | Ciało tabeli konfiguracji    |
| `well-required-height`         | Wymagana wysokość            |
| `well-configured-height`       | Skonfigurowana wysokość      |
| `well-config-errors-container` | Kontener błędów konfiguracji |
| `well-redukcja-toggle`         | Przełącznik redukcji         |

### Atrybuty `data-*` — zakaz zmiany nazw

| Atrybut                        | Występuje w                               | Używany przez                                 |
| ------------------------------ | ----------------------------------------- | --------------------------------------------- |
| `data-section`                 | studnie.html, rury.html, kartoteka.html   | `showSection()` — nawigacja między zakładkami |
| `data-step`                    | studnie.html, rury.html (wizard-step-dot) | `goToPhase()` — nawigacja w wizardzie         |
| `data-lucide`                  | wszystkie HTML                            | `lucide.createIcons()` — inicjalizacja ikon   |
| `data-type-filter`             | kartoteka.html                            | Filtrowanie typu oferty                       |
| `data-filter`                  | kartoteka.html, zlecenia.html             | Filtrowanie statusu                           |
| `data-date-range`              | kartoteka.html                            | Presety dat                                   |
| `data-partial`                 | studnie.html (planowane)                  | Loader partiali HTML                          |
| `data-*` (inne niestandardowe) | różne HTML                                | Używane przez logikę JS, nie zmieniać         |

### Klasy CSS — zakaz zmiany nazw

Wszystkie istniejące klasy CSS w plikach `public/css/*.css` i inline w HTML są zamrożone. Nowe klasy można dodawać, ale istniejące nie mogą być zmieniane ani usuwane.

Kluczowe klasy, które są używane przez JS (querySelector, classList):

| Klasa                         | Używana przez                    |
| ----------------------------- | -------------------------------- |
| `.section`                    | showSection(), nawigacja modułów |
| `.section.active`             | showSection()                    |
| `.wizard-step`                | goToPhase(), nawigacja wizardem  |
| `.wizard-step.active`         | goToPhase()                      |
| `.wizard-step-dot`            | wskaźnik kroków                  |
| `.wizard-step-dot.active`     | wskaźnik kroków                  |
| `.wizard-step-line`           | linie łączące kroki              |
| `.wells-sidebar`              | panel boczny studni              |
| `.search-box`                 | wyszukiwarka                     |
| `.toast-container`            | kontener toastów                 |
| `.toast`                      | pojedynczy toast                 |
| `.rury-col-num`               | wyrównanie liczb w tabelach rur  |
| `.pehd-btn`                   | przyciski PEHD                   |
| `.app-confirm-modal`          | modal potwierdzenia              |
| `.excel-sel-wrap.disabled`    | wyłączone selecty w Excel        |
| `.wizard-loading-state`       | stan ładowania wizarda           |
| `.connection-dot`             | wskaźnik połączenia              |
| `.connection-dot.is-checking` | stan sprawdzania                 |
| `.connection-dot.is-online`   | stan online                      |
| `.connection-dot.is-offline`  | stan offline                     |
| `.nav-tile`                   | kafelki nawigacji                |
| `.nav-tile-icon`              | ikony kafelków                   |
| `.nav-tile-text`              | tekst kafelków                   |
| `.header`                     | nagłówek strony                  |
| `.header-inner`               | wewnętrzny kontener nagłówka     |
| `.main`                       | główny kontener treści           |
| `.lucide-rotate-n90`          | rotacja ikony Lucide             |
| `.btn-icon`                   | przycisk ikonowy                 |
| `.btn-hero`                   | przycisk hero                    |
| `.kartoteka-offers-grid`      | grid ofert w kartotece           |
| `.kartoteka-filter-bar`       | pasek filtrów                    |
| `.zlecenia-table`             | tabela zleceń                    |
| `.zlecenia-filter-tab`        | zakładka filtru zleceń           |
| `.zlecenia-batch-bar`         | batch bar zleceń                 |
| `.index-page`                 | body index.html                  |
| `.login-box`                  | formularz logowania              |
| `.login-btn`                  | przycisk logowania               |
| `.launch-grid`                | grid uruchamiania modułów        |

### Atrybuty `onclick` — zakaz zmiany

Wszystkie ~129 atrybutów `onclick` w `studnie.html` i ~42 w `rury.html` pozostają nienaruszone. Nie zastępować `addEventListener` — jest to poza zakresem refaktoryzacji.

Wzór: `onclick="nazwaFunkcji(args)"` — nazwy funkcji wywoływanych przez onclick są zamrożone.

---

## Dependencies (npm)

### Żadna z poniższych zależności nie może być dodana, usunięta ani zmieniona w zakresie wersji major

**Produkcja (dependencies):**

- `@prisma/client` ^6.0.0
- `bcryptjs` ^3.0.3
- `compression` ^1.8.1
- `cookie-parser` ^1.4.7
- `docx` ^9.6.1
- `dotenv` ^17.4.1
- `express` ^4.21.0
- `helmet` ^8.1.0
- `puppeteer` ^24.40.0
- `zod` ^4.3.6

**Deweloperskie (devDependencies):**

- `@commitlint/cli` ^21.1.0
- `@commitlint/config-conventional` ^21.0.2
- `@eslint/js` ^9.39.4
- `@types/bcryptjs` ^2.4.6
- `@types/compression` ^1.8.1
- `@types/cookie-parser` ^1.4.10
- `@types/express` ^4.17.21
- `@types/jest` ^30.0.0
- `@types/node` ^26.0.1
- `@types/supertest` ^7.2.0
- `@types/swagger-jsdoc` ^6.0.4
- `@types/swagger-ui-express` ^4.1.8
- `concurrently` ^10.0.3
- `esbuild` ^0.28.1
- `eslint` ^10.6.0
- `eslint-config-prettier` ^10.1.8
- `globals` ^17.4.0
- `husky` ^9.1.7
- `jest` ^30.3.0
- `js-yaml` ^4.2.0
- `lint-staged` ^17.0.7
- `prettier` ^3.9.4
- `prisma` ^6.0.0
- `rollup-plugin-visualizer` ^7.0.1
- `standard-version` ^9.5.0
- `supertest` ^7.2.2
- `swagger-jsdoc` ^6.3.0
- `swagger-ui-express` ^5.0.1
- `ts-jest` ^29.4.9
- `ts-node` ^10.9.2
- `ts-node-dev` ^2.0.0
- `typescript` ^6.0.2
- `typescript-eslint` ^8.62.1
- `vite` ^8.0.14
- `wait-on` ^9.0.10

### Zakaz dodawania nowych zależności

Refaktoryzacja nie może wprowadzać nowych pakietów npm. Jeśli potrzebna jest nowa funkcjonalność, należy użyć istniejących zależności lub vanilla JS/Node.js.

---

## Eventy

### Custom event names — zakaz zmiany

| Nazwa eventu             | Nasłuchiwane w                | Opis                          |
| ------------------------ | ----------------------------- | ----------------------------- |
| `pv-sync-status-changed` | `studnie/offerSvgDrag.js:218` | Zmiana statusu synchronizacji |

### Standardowe eventy używane przez logikę biznesową (nie zmieniać uchwytów ani kolejności nasłuchiwania)

| Event               | Element         | Plik                                                     |
| ------------------- | --------------- | -------------------------------------------------------- |
| `hashchange`        | window          | spa/router.js                                            |
| `pagehide`          | window          | kartotekaInit.js, pvSalesUi.js                           |
| `online`            | window          | shared/auth.js                                           |
| `offline`           | window          | shared/auth.js                                           |
| `change` (bubbling) | document/excel  | excelModal.js, excelCellNavigation.js, excelCopyPaste.js |
| `input` (bubbling)  | document/excel  | excelCellNavigation.js, excelCopyPaste.js                |
| `copy`              | document        | excelModal.js                                            |
| `paste`             | excel container | excelModal.js                                            |
| `keydown`           | document        | excelModal.js, dashboard.js, shared/ui.js                |

---

## Format danych

### JSON shapes — zamrożone struktury

Wszystkie typy z `src/validators/offerSchemas.ts` (oraz docelowo z `offerSchemasCommon.ts`, `offerSchemasRury.ts`, `offerSchemasStudnie.ts`) są zamrożone. Nie zmieniać:

- Nazw pól w obiektach JSON
- Typów pól (string, number, boolean, array, object)
- Struktury zagnieżdżonych obiektów
- Pól opcjonalnych vs wymaganych

### Serializacja

- **Dat**: format ISO 8601 (`YYYY-MM-DD`) — nie zmieniać
- **Decimal/kwoty**: string z kropką jako separatorem dziesiętnym — nie zmieniać
- **Paginacja**: `{data: [...], total: number, page: number, limit: number}` — nie zmieniać
- **Błędy API**: `{error: string, message?: string, details?: any}` — nie zmieniać

### Klucze specyficzne dla modułów

**Studnie:** `wells[]` każdy obiekt zawiera: `{uid, dn, type, segments: [...], rings: [...], transitions: [...], discounts, ...}`
**Rury:** `items[]` każdy obiekt zawiera: `{uid, productId, category, quantity, lengthM, diameter, price, ...}`
**Karta budowy:** `{client, offer, address, payment, insurance, contact, transport, ...}`

---

## Pliki

### Template filenames (nie zmieniać ścieżek ani nazw)

```
public/templates/etykieta.html
public/templates/kartaBudowy.html
public/templates/ofertaRury.html
public/templates/ofertaStudnie.docx
public/templates/ofertaStudnie.html
public/templates/zlecenie.html
```

### Pliki HTML (nie zmieniać nazw)

```
public/studnie.html
public/rury.html
public/kartoteka.html
public/zlecenia.html
public/app.html
public/index.html
```

### Pliki CSS (istniejące — nie zmieniać nazw, można dodawać nowe)

```
public/css/style.css
public/css/studnie.css
public/css/index.css
public/css/style.base.css
public/css/style.responsive.css
public/css/rury.css
public/css/style.cards.css
public/css/style.utilities.css
public/css/spa.css
public/css/zlecenia.css
public/css/printModal.css
public/css/inter.css
```

### Pliki JS (istniejące — nie zmieniać nazw, chyba że plan przewiduje zastąpienie)

Wszystkie istniejące pliki w `public/js/` zachowują nazwy. Nowe pliki mogą być dodawane zgodnie z master planem (np. `solverCore.js`, `diagramSvgShapes.js` itp.), ale istniejące nie mogą być przemianowane.

### Katalogi (nie zmieniać struktury)

```
public/js/studnie/
public/js/rury/
public/js/sales/
public/js/shared/
public/js/spa/
public/js/admin/
public/js/import-export/
public/js/import-export/studnie/
public/css/studnie/                (docelowo — nowy, ale struktura zamrożona po utworzeniu)
public/partials/                   (docelowo — nowy, ale struktura zamrożona po utworzeniu)
public/partials/studnie/
public/partials/rury/
src/routes/offers/
src/routes/orders/
src/validators/
src/services/docx/studnie/
src/services/docx/rury/
src/services/pdf/
src/services/telemetry/
src/services/ml/
```

### Import paths (nie zmieniać ścieżek importów w backendzie TS)

Wszystkie istniejące `import`/`require` ścieżki w plikach TypeScript są zamrożone. Podczas dzielenia plików (np. `offerSchemas.ts` → 3 pliki) importy w plikach klienckich muszą zostać zaktualizowane, ale ścieżki docelowe nowych plików muszą być zgodne z master planem.

---

## Postanowienia końcowe

1. Niniejszy freeze obowiązuje przez cały okres refaktoryzacji.
2. Każde naruszenie freeze'a wymaga: (a) uzasadnienia w commit message, (b) aktualizacji tego dokumentu, (c) przeglądu kodu (code review).
3. Po zakończeniu refaktoryzacji freeze może być stopniowo znoszony dla wybranych kategorii.
4. Wszelkie wątpliwości rozstrzygać na korzyść zachowania istniejącego stanu („nie ruszać, jeśli nie trzeba”).

---

_Dokument utworzony: 2026-07-20_
_Wersja: 1.0_
_Powiązany z: `docs/plans/master-plan-refaktoryzacji.md`_
