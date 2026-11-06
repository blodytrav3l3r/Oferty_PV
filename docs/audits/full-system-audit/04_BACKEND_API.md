# Backend i kontrakty API

## A3 i A5 · Granice i reguły

Express rejestruje osobne limity JSON 320 KiB/1 MiB/50 MiB/128 MiB (src/mountRoutes.ts:49–84). Zastosowano Zod, limitery per domena, audyt, transakcje zapisów oraz mechanizmy ownership, share, lock i idempotency. Część tras zawiera bezpośredni dostęp do Prisma i łączy autoryzację, obróbkę payloadu, logikę i odpowiedź. Przykładem jest src/routes/offers/studnieCrud.ts, 1439 linii. Obecny podział działa jako monolit, a potencjalny podział handlerów powinien zachować kontrakty wejścia, błędów i transakcji.

| Frontend / konsument          | Rodziny API                                                                                       | Warstwa i trwałe dane                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Auth, nagłówek, administracja | auth, users, users/me, users-for-assignment, admin, settings, feature-flags                       | auth i ownership → users, sessions, ustawienia i preferencje                              |
| Rury, Studnie, Kartoteka      | offers-rury, offers-studnie, offers/search, drafts, locks, shares, audit                          | CRUD, search, draft/lock/share, audyt → oferty, pozycje, drafty i tabele pomocnicze       |
| Menedżer cen i kalkulatory    | products, products-studnie, preco-pricing, pricelist-versions                                     | lifecycle, usage, preview, active → wersje, pozycje, ustawienia                           |
| Zlecenia, produkcja           | orders-studnie, orders-rury, orders-studnie/production/search                                     | CRUD i produkcja → zlecenia, produkcja i liczniki                                         |
| Kartoteka i opieka            | care, offers/search, clients                                                                      | careService, klienci, FTS → oferty, klienci, follow-upy i projekcja najnowszej aktywności |
| Druk                          | endpointy ofert/zleceń i export-combined                                                          | konteksty dokumentów, HTML, PDF/DOCX; odczyt ofert i metadanych                           |
| Telemetria i ML               | telemetry, podtrasy AI, predykcja i transfer                                                      | telemetryService, TrainingPipeline, transfer → logi, cechy, modele, fingerprint           |
| Operacje                      | health, health/live, health/ready, health/pdf, health/backup, metrics, api/version, api/docs.json | diagnostyka, stan DB, PDF, backup i agregaty                                              |

Zestawienie wynika z src/mountRoutes.ts:85–148, src/app.ts:98–251 i routerów domenowych. Deklaracje niżej podają lokalne ścieżki, nie pełne URL. Prefiks wynika z montowania routera, część ścieżek jest przepisywana (np. studnie), a zagnieżdżone mounty mogą tworzyć dodatkowe osiągalne ścieżki. To indeks przeglądu, nie ślad wykonania każdego endpointu ani dowód, że endpoint bez literalnego wywołania jest martwy.

## Konkretne usterki

- API-01: PUT klientów zastępuje zbiór bez oczekiwanej rewizji. Zapis starszej wersji może usunąć nowszy rekord lub odpiąć oferty. src/routes/clients/index.ts:102–153,218–248 i public/js/shared/clientManager.js:226–238,441,470,1003.
- API-02: odrzucenie Promise w czterech async handlerach shares bez wrappera może dotrzeć do process unhandledRejection kończącego serwer. Express 4 w package.json:139, src/routes/shares.ts:59,105,215,279, server.ts:42–48.
- API-03: count + insert dla limitu udostępnień może zaakceptować ponad 50 przy dwóch równoległych zapisach. src/routes/shares.ts:148–188 oraz prisma/schema.prisma:740.
- API-04: rekonstrukcja historii nie rozróżnia skróconego payloadu od kompletnej bazy. src/routes/audit.ts:167–225, src/services/auditPayload.ts:46–70, public/js/kartoteka/kartotekaAudit.js:378–407.
- DB-01 oraz FE-01/04 stanowią niespójności kontraktu sortowania/kursora, liczby wyników i dat. Dokumentowanie limitów i testy przekrojowe mają większą wartość niż mechaniczne przenoszenie wszystkich handlerów do nowych warstw.

Kontrola dodatkowa wskazała 195 z 205 deklaracji z jawnym argumentem requireAuth (GET 99, POST 69, DELETE 12, PUT 22, PATCH 3). Wyjątki obejmują m.in. logowanie i endpointy statusu. Health PDF weryfikuje uprawnienia wewnątrz ścieżki smoke (src/routes/healthPdf.ts:45–55). Zliczanie strażników nie dowodzi poprawności kontroli obiektowej.

API-05. Lokalnie wygenerowana specyfikacja OpenAPI 3.0.0 zawiera jedną operację (/health/pdf), a schemat cookie określa token zamiast authToken. src/swagger.ts:23,59, src/routes/auth.ts:62. To luka dokumentacji i kontraktów klienta. Próba importu modułu Swagger nie uruchamiała Express ani DB.

## Indeks deklaracji HTTP

205 literalnych deklaracji app/router znalezionych analizą TypeScript AST w src/. Licznik nie uwzględnia tras dynamicznych, metod rejestrowanych przez inną nazwę obiektu ani mapowania runtime.

| Plik:linia                                    | Metoda | Ścieżka lokalna                       |
| --------------------------------------------- | ------ | ------------------------------------- |
| src/app.ts:98                                 | GET    | /api/version                          |
| src/app.ts:117                                | GET    | /health                               |
| src/app.ts:134                                | GET    | /health/live                          |
| src/app.ts:150                                | GET    | /health/ready                         |
| src/app.ts:180                                | GET    | /health/backup                        |
| src/app.ts:210                                | GET    | /api/admin/system-info                |
| src/app.ts:232                                | GET    | /metrics                              |
| src/app.ts:251                                | GET    | /api/docs.json                        |
| src/mountRoutes.ts:136                        | POST   | /api/csp-report                       |
| src/routes/admin.ts:16                        | GET    | /fts-status                           |
| src/routes/admin.ts:28                        | POST   | /fts-rebuild                          |
| src/routes/admin.ts:46                        | GET    | /sessions                             |
| src/routes/admin.ts:69                        | DELETE | /sessions/:userId                     |
| src/routes/aiTransfer.ts:76                   | GET    | /ai/transfer/preview-export           |
| src/routes/aiTransfer.ts:98                   | POST   | /ai/transfer/export                   |
| src/routes/aiTransfer.ts:141                  | POST   | /ai/transfer/dry-run                  |
| src/routes/aiTransfer.ts:171                  | POST   | /ai/transfer/import                   |
| src/routes/aiTransfer.ts:203                  | GET    | /ai/transfer/history                  |
| src/routes/aiTransfer.ts:218                  | GET    | /ai/transfer/:transferId              |
| src/routes/audit.ts:54                        | GET    | /:entityType/:entityId                |
| src/routes/audit.ts:136                       | GET    | /rebuild/:entityType/:entityId/:logId |
| src/routes/auth.ts:36                         | POST   | /login                                |
| src/routes/auth.ts:91                         | POST   | /register                             |
| src/routes/auth.ts:168                        | POST   | /logout                               |
| src/routes/auth.ts:187                        | GET    | /me                                   |
| src/routes/auth.ts:202                        | POST   | /change-password                      |
| src/routes/care.ts:111                        | GET    | /summary                              |
| src/routes/care.ts:137                        | GET    | /queue                                |
| src/routes/care.ts:184                        | GET    | /panel                                |
| src/routes/care.ts:499                        | POST   | /:kind/:id/snooze                     |
| src/routes/care.ts:502                        | POST   | /:kind/:id/done                       |
| src/routes/care.ts:505                        | POST   | /:kind/:id/reopen                     |
| src/routes/care.ts:509                        | GET    | /sla                                  |
| src/routes/care.ts:534                        | PUT    | /sla                                  |
| src/routes/care.ts:604                        | GET    | /notifications                        |
| src/routes/care.ts:647                        | POST   | /notifications/read                   |
| src/routes/care.ts:666                        | POST   | /notifications/:id/read               |
| src/routes/care.ts:682                        | POST   | /notifications/:id/unread             |
| src/routes/clients/contacts.ts:94             | GET    | /:clientId/contacts                   |
| src/routes/clients/contacts.ts:115            | PUT    | /:clientId/contacts/sync              |
| src/routes/clients/index.ts:35                | GET    | /                                     |
| src/routes/clients/index.ts:73                | PUT    | /                                     |
| src/routes/drafts.ts:55                       | GET    | /                                     |
| src/routes/drafts.ts:68                       | GET    | /:kind/:docId                         |
| src/routes/drafts.ts:82                       | PUT    | /:kind/:docId                         |
| src/routes/drafts.ts:160                      | DELETE | /:kind/:docId                         |
| src/routes/exportCombined.ts:88               | POST   | /pdf                                  |
| src/routes/exportCombined.ts:137              | POST   | /docx                                 |
| src/routes/featureFlags.ts:11                 | GET    | /                                     |
| src/routes/featureFlags.ts:33                 | PUT    | /import-export                        |
| src/routes/featureFlags.ts:72                 | PUT    | /ai-ml                                |
| src/routes/featureFlags.ts:122                | POST   | /audit                                |
| src/routes/healthPdf.ts:45                    | GET    | /                                     |
| src/routes/locks.ts:33                        | POST   | /acquire                              |
| src/routes/locks.ts:57                        | POST   | /heartbeat                            |
| src/routes/locks.ts:93                        | POST   | /release                              |
| src/routes/locks.ts:115                       | POST   | /force                                |
| src/routes/locks.ts:139                       | GET    | /:docType/:docId                      |
| src/routes/offers/clientContact.ts:78         | PUT    | /:kind/:id/client-contact             |
| src/routes/offers/crud.ts:22                  | GET    | /:id                                  |
| src/routes/offers/crud.ts:150                 | DELETE | /:id                                  |
| src/routes/offers/exports.ts:17               | GET    | /:id/export-pdf                       |
| src/routes/offers/exports.ts:46               | GET    | /studnie/:id/export-pdf               |
| src/routes/offers/exports.ts:74               | GET    | /:id/export-docx                      |
| src/routes/offers/exports.ts:104              | GET    | /studnie/:id/export-docx              |
| src/routes/offers/followUps.ts:125            | POST   | /:kind/:id/followups                  |
| src/routes/offers/followUps.ts:265            | PUT    | /:kind/:id/followups/:fuId            |
| src/routes/offers/followUps.ts:374            | DELETE | /:kind/:id/followups/:fuId            |
| src/routes/offers/followUps.ts:430            | GET    | /:kind/:id/followups                  |
| src/routes/offers/followUpStats.ts:183        | GET    | /followups/stats                      |
| src/routes/offers/ruryCrud.ts:47              | GET    | /                                     |
| src/routes/offers/ruryCrud.ts:136             | POST   | /                                     |
| src/routes/offers/ruryCrud.ts:603             | PUT    | /                                     |
| src/routes/offers/ruryCrud.ts:988             | POST   | /:id/duplicate                        |
| src/routes/offers/search.ts:28                | GET    | /                                     |
| src/routes/offers/search.ts:307               | GET    | /orders                               |
| src/routes/offers/studnieCrud.ts:313          | GET    | /studnie                              |
| src/routes/offers/studnieCrud.ts:457          | GET    | /studnie/:id                          |
| src/routes/offers/studnieCrud.ts:509          | POST   | /studnie                              |
| src/routes/offers/studnieCrud.ts:994          | PUT    | /studnie                              |
| src/routes/offers/studnieCrud.ts:1351         | DELETE | /studnie/:id                          |
| src/routes/orders/numbering.ts:98             | GET    | /recycled                             |
| src/routes/orders/numbering.ts:127            | GET    | /next-number/:userId                  |
| src/routes/orders/numbering.ts:163            | POST   | /claim-number/:userId                 |
| src/routes/orders/numbering.ts:225            | POST   | /claim-production-number/:userId      |
| src/routes/orders/numbering.ts:303            | POST   | /claim-production-numbers/:userId     |
| src/routes/orders/production.ts:138           | GET    | /                                     |
| src/routes/orders/production.ts:193           | GET    | /index                                |
| src/routes/orders/production.ts:251           | PUT    | /                                     |
| src/routes/orders/production.ts:534           | POST   | /                                     |
| src/routes/orders/production.ts:760           | POST   | /batch-delete                         |
| src/routes/orders/production.ts:880           | POST   | /recycle-numbers                      |
| src/routes/orders/production.ts:909           | POST   | /print-count-batch                    |
| src/routes/orders/production.ts:943           | POST   | /:id/print-count                      |
| src/routes/orders/production.ts:974           | GET    | /:id                                  |
| src/routes/orders/production.ts:1030          | DELETE | /:id                                  |
| src/routes/orders/productionSearch.ts:20      | GET    | /                                     |
| src/routes/orders/ruryOrders.crud.ts:36       | GET    | /                                     |
| src/routes/orders/ruryOrders.crud.ts:110      | POST   | /claim-rury-number/:userId            |
| src/routes/orders/ruryOrders.crud.ts:171      | PUT    | /                                     |
| src/routes/orders/ruryOrders.crud.ts:304      | GET    | /:id                                  |
| src/routes/orders/ruryOrders.crud.ts:340      | PATCH  | /:id                                  |
| src/routes/orders/ruryOrders.crud.ts:437      | DELETE | /:id                                  |
| src/routes/orders/ruryOrders.export.ts:26     | GET    | /:id/export-karta-pdf                 |
| src/routes/orders/ruryOrders.export.ts:56     | GET    | /:id/export-karta-docx                |
| src/routes/orders/ruryOrders.export.ts:90     | GET    | /:id/export-pdf                       |
| src/routes/orders/ruryOrders.export.ts:120    | GET    | /:id/export-docx                      |
| src/routes/orders/ruryOrders.export.ts:156    | POST   | /:id/export-offer-pdf                 |
| src/routes/orders/ruryOrders.export.ts:228    | POST   | /:id/export-offer-docx                |
| src/routes/orders/studnieOrders.crud.ts:77    | GET    | /                                     |
| src/routes/orders/studnieOrders.crud.ts:151   | PUT    | /                                     |
| src/routes/orders/studnieOrders.crud.ts:378   | GET    | /:id                                  |
| src/routes/orders/studnieOrders.crud.ts:416   | PATCH  | /:id                                  |
| src/routes/orders/studnieOrders.crud.ts:562   | DELETE | /:id                                  |
| src/routes/orders/studnieOrders.export.ts:28  | GET    | /:id/export-karta-pdf                 |
| src/routes/orders/studnieOrders.export.ts:58  | GET    | /:id/export-karta-docx                |
| src/routes/orders/studnieOrders.export.ts:93  | GET    | /:id/export-pdf                       |
| src/routes/orders/studnieOrders.export.ts:123 | GET    | /:id/export-docx                      |
| src/routes/orders/studnieOrders.export.ts:161 | POST   | /:id/export-offer-pdf                 |
| src/routes/orders/studnieOrders.export.ts:236 | POST   | /:id/export-offer-docx                |
| src/routes/precoPricingV2.ts:43               | GET    | /                                     |
| src/routes/precoPricingV2.ts:80               | PUT    | /                                     |
| src/routes/precoPricingV2.ts:151              | GET    | /export.xlsx                          |
| src/routes/precoPricingV2.ts:228              | GET    | /default                              |
| src/routes/pricelistVersions.ts:112           | GET    | /                                     |
| src/routes/pricelistVersions.ts:206           | GET    | /labels                               |
| src/routes/pricelistVersions.ts:289           | GET    | /summary                              |
| src/routes/pricelistVersions.ts:299           | POST   | /:type/drafts                         |
| src/routes/pricelistVersions.ts:332           | DELETE | /:id                                  |
| src/routes/pricelistVersions.ts:362           | PUT    | /:id                                  |
| src/routes/pricelistVersions.ts:400           | PATCH  | /:id/label                            |
| src/routes/pricelistVersions.ts:428           | POST   | /:id/publish                          |
| src/routes/pricelistVersions.ts:464           | POST   | /:id/approve                          |
| src/routes/pricelistVersions.ts:518           | POST   | /:id/cancel-schedule                  |
| src/routes/pricelistVersions.ts:539           | POST   | /:id/active                           |
| src/routes/pricelistVersions.ts:554           | POST   | /active/reset                         |
| src/routes/pricelistVersions.ts:578           | POST   | /:id/activate                         |
| src/routes/pricelistVersions.ts:601           | POST   | /:id/backdate                         |
| src/routes/pricelistVersions.ts:626           | POST   | /:id/clone-draft                      |
| src/routes/pricelistVersions.ts:647           | POST   | /activate-due                         |
| src/routes/pricelistVersions.ts:655           | GET    | /:id/checks                           |
| src/routes/pricelistVersions.ts:670           | GET    | /:id/preview                          |
| src/routes/pricelistVersions.ts:688           | GET    | /:id/diff                             |
| src/routes/pricelistVersions.ts:728           | GET    | /:id/rows                             |
| src/routes/pricelistVersions.ts:772           | GET    | /:id/export                           |
| src/routes/productsStudnieV2.ts:203           | GET    | /                                     |
| src/routes/productsStudnieV2.ts:242           | PUT    | /                                     |
| src/routes/productsStudnieV2.ts:310           | GET    | /export.xlsx                          |
| src/routes/productsStudnieV2.ts:402           | GET    | /default                              |
| src/routes/productsV2.ts:43                   | GET    | /                                     |
| src/routes/productsV2.ts:80                   | PUT    | /                                     |
| src/routes/productsV2.ts:158                  | GET    | /export.xlsx                          |
| src/routes/productsV2.ts:240                  | GET    | /default                              |
| src/routes/settings.ts:16                     | GET    | /year-letter                          |
| src/routes/settings.ts:31                     | PUT    | /year-letter                          |
| src/routes/settings.ts:78                     | GET    | /magazyn-codes                        |
| src/routes/settings.ts:91                     | PUT    | /magazyn-codes                        |
| src/routes/settings.ts:126                    | GET    | /:key                                 |
| src/routes/shares.ts:59                       | GET    | /                                     |
| src/routes/shares.ts:105                      | POST   | /                                     |
| src/routes/shares.ts:215                      | POST   | /revoke                               |
| src/routes/shares.ts:279                      | DELETE | /:id                                  |
| src/routes/telemetry.ts:14                    | POST   | /override                             |
| src/routes/telemetry.ts:47                    | POST   | /draft-failure                        |
| src/routes/telemetry.ts:61                    | GET    | /logs                                 |
| src/routes/telemetryAi.ts:37                  | POST   | /ai/config                            |
| src/routes/telemetryAi.ts:73                  | POST   | /ai/config-batch                      |
| src/routes/telemetryAi.ts:144                 | POST   | /ai/acceptance-batch                  |
| src/routes/telemetryAi.ts:223                 | POST   | /ai/event                             |
| src/routes/telemetryAi.ts:262                 | POST   | /ai/version                           |
| src/routes/telemetryAi.ts:284                 | POST   | /ai/acceptance-full                   |
| src/routes/telemetryAiDashboard.ts:26         | POST   | /ai/learning/run                      |
| src/routes/telemetryAiDashboard.ts:54         | GET    | /ai/knowledge/patterns                |
| src/routes/telemetryAiDashboard.ts:85         | GET    | /ai/knowledge/stats                   |
| src/routes/telemetryAiMl.ts:94                | POST   | /ai/predict/batch                     |
| src/routes/telemetryAiMl.ts:220               | POST   | /ai/reward                            |
| src/routes/telemetryAiMl.ts:421               | POST   | /ai/reward-batch                      |
| src/routes/telemetryAiMl.ts:600               | GET    | /ai/well-selections                   |
| src/routes/telemetryAiMl.ts:616               | GET    | /ai/settings                          |
| src/routes/telemetryAiMl.ts:632               | POST   | /ai/settings                          |
| src/routes/telemetryAiMl.ts:669               | GET    | /ai/training-users                    |
| src/routes/telemetryAiMl.ts:679               | PUT    | /ai/training-users                    |
| src/routes/telemetryAiMl.ts:714               | GET    | /ai/ml-status                         |
| src/routes/telemetryAiMl.ts:808               | GET    | /ai/health                            |
| src/routes/telemetryAiMl.ts:907               | GET    | /ai/models                            |
| src/routes/telemetryAiMl.ts:922               | DELETE | /ai/models/:id                        |
| src/routes/telemetryAiMl.ts:951               | POST   | /ai/models/:id/activate               |
| src/routes/telemetryAiMl.ts:983               | GET    | /ai/drift                             |
| src/routes/telemetryAiMl.ts:1000              | POST   | /ai/models/:id/promote                |
| src/routes/telemetryAiMl.ts:1027              | POST   | /ai/models/:id/approve                |
| src/routes/telemetryAiMl.ts:1053              | POST   | /ai/train                             |
| src/routes/telemetryAiMl.ts:1090              | GET    | /ai/feature-importance                |
| src/routes/telemetryAiMl.ts:1113              | GET    | /ai/feature-schema                    |
| src/routes/telemetryAiMl.ts:1126              | POST   | /ai/rollback                          |
| src/routes/telemetryAiMl.ts:1149              | GET    | /ai/training/runs                     |
| src/routes/telemetryAiMl.ts:1164              | GET    | /ai/training/runs/:id                 |
| src/routes/telemetryAiMl.ts:1184              | GET    | /ai/models/:id                        |
| src/routes/telemetryAiMl.ts:1205              | GET    | /ai/predictions/stats                 |
| src/routes/userPreferences.ts:15              | GET    | /preferences                          |
| src/routes/userPreferences.ts:32              | PUT    | /preferences                          |
| src/routes/users.ts:22                        | GET    | /                                     |
| src/routes/users.ts:72                        | PUT    | /:id                                  |
| src/routes/users.ts:176                       | DELETE | /:id                                  |
| src/routes/users.ts:230                       | GET    | /shareable                            |
| src/routes/users.ts:259                       | GET    | /for-assignment                       |
