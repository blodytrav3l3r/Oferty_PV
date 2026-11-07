# Dokumentacja S.O.K.

**Nawigację zweryfikowano:** 2026-11-07 · **HEAD:** `fe8bbb3b` · **Wersja:** `1.56.6` · **Zakres:** sprawdzono lokalne cele linków i strukturę indeksu; aktualny status pokrycia opisuje [`documentation-audit.md`](documentation-audit.md).

## Rozpoczęcie

- [README projektu](../README.md) — instalacja, uruchomienie, aktualizacja oraz komendy.
- [Instrukcja instalacji dla operatora](instalacja-krok-po-kroku-dla-laika.md)
- [Przenoszenie instalacji](instalacja-przenoszenie-systemu.md)
- [Zasady wdrożenia](DEPLOYMENT.md) i [aktualizacji](DEPLOY_UPDATE.md)
- [Baza PostgreSQL 18](DATABASE.md) oraz [pakiet aktywnych cenników](cutover/active-pricelists.md)

## Architektura i kontrakty

- [Architektura systemu](ARCHITECTURE.md)
- [Diagramy przepływu danych](architecture/data-flows.md)
- [Mapa runtime, modułów i grup API](architecture/runtime-and-module-map.md)
- [API](API.md) — endpointy i znane kontrakty.
- [Kontrakty systemowe](SYSTEM_INVARIANTS.md)
- [Decyzje architektoniczne](adr/)
- [Komponenty UI](COMPONENTS.md), [wytyczne UI](UI_GUIDELINES.md), [inwentarz projektu UI](design/frontend-inventory.md)

## Funkcje i reguły biznesowe

- [Przewodnik po modułach i potwierdzonych przepływach](user-guide/modules-and-workflows.md)
- [Kalkulacje i Protected Zone Excela](business-logic/calculations-and-excel.md)
- [Oferty, cenniki, drafty i przepływy cen](business-logic/offer-pricelist-draft-flows.md)
- [Cenniki — instrukcja administratora](CENNIKI-INSTRUKCJA-ADMINA.md)
- [Import/eksport ofert](import-export/ARCHITECTURE.md)
- [Zaokrąglanie pieniędzy](MONEY_ROUNDING.md)
- [Opieka nad ofertą i SLA](OPIEKA.md)

## Bezpieczeństwo i utrzymanie

- [Bezpieczeństwo aplikacji](SECURITY.md) i [macierz uprawnień](security/permission-matrix.md)
- [Testy, PostgreSQL i CI](testing/postgres-install-ci-matrix.md)
- [Procedury wdrożenia i aktualizacji](DEPLOYMENT.md), [HTTPS/reverse proxy](DEPLOY_HTTPS_IT.md)
- [Znane błędy](errors-known.md), [proces wydania](RELEASE_PROCESS.md), [wersjonowanie](VERSIONING.md)
- [Instrukcje agentów](agents/)
- [Audyt dokumentacji](documentation-audit.md) i [pełny inwentarz dopasowań SQLite dla HEAD 5ab15ac0](audits/SQLITE_REFERENCES_HEAD_5AB15AC0.md)
- Pozostałe [audyty](audits/) i [plany](plans/)

## Status i ograniczenia

Stan zależności SQLite, pokrycie dokumentacji, źródła i pozycje nierozstrzygnięte są w [`documentation-audit.md`](documentation-audit.md). Dokumenty historyczne i ADR oznaczone jako superseded służą do śledzenia decyzji; nie stanowią instrukcji aktywnego runtime.
