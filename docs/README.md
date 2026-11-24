# Dokumentacja S.O.K.

**Wersja:** 1.64.26

**Nawigację zweryfikowano:** 2026-11-24 · **HEAD kodu:** `0aa625c2` · **Wersja aplikacji przy weryfikacji:** `1.64.24` · **Zakres:** sprawdzono lokalne cele linków tego indeksu. Stan i ograniczenia przeglądu opisuje [`documentation-audit.md`](documentation-audit.md); to nie jest potwierdzenie pełnej aktualności każdego dokumentu.

Wyniki uzgodnienia dokumentacji z 2026-11-24, poprawione rozbieżności i ograniczenia przeglądu są w [`documentation-audit.md`](documentation-audit.md). Modułowe indeksy: [przewodniki agentów](agents/README.md) i [ADR](adr/README.md).

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
- [Decyzje architektoniczne](adr/README.md)
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
- [Licencje zależności i kontrola dystrybucji](LICENCJE_ZALEZNOSCI.md)
- [Pochodzenie kodu, autorstwo i wykorzystanie AI](POCHODZENIE_KODU_I_AI.md) oraz [załącznik licencyjny do umowy](ZALACZNIK_LICENCYJNY_POCHODZENIE_KODU.md)
- [Testy, PostgreSQL i CI](testing/postgres-install-ci-matrix.md)
- [Procedury wdrożenia i aktualizacji](DEPLOYMENT.md), [HTTPS/reverse proxy](DEPLOY_HTTPS_IT.md)
- [Znane błędy](errors-known.md), [proces wydania](RELEASE_PROCESS.md), [wersjonowanie](VERSIONING.md)
- [Instrukcje agentów](agents/README.md)
- [Audyt dokumentacji](documentation-audit.md). Szczegółowe raporty i plany robocze pozostają w lokalnym obszarze projektu.

## Status i ograniczenia

Stan zależności SQLite, pokrycie dokumentacji, źródła i pozycje nierozstrzygnięte są w [`documentation-audit.md`](documentation-audit.md). Dokumenty historyczne i ADR oznaczone jako superseded służą do śledzenia decyzji; nie stanowią instrukcji aktywnego runtime.
