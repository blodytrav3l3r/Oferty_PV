# Strategiczne Decyzje Projektowe

Ten dokument śledzi kluczowe decyzje techniczne i logiczne, aby zachować spójność między sesjami AI.

## 🧱 Logika Konfiguracji Studni

### 1. Konwencje sufiksów stopni (23.04.2026)
- **Standardowe**: Produkty kończące się na `-D`.
- **Nierdzewne**: Produkty kończące się na `-N-D`.
- **Brak**: Produkty kończące się na `-B`.
- *Uzasadnienie*: Spójność z istniejącym schematem nazewnictwa w bazie danych produktów. Konfigurator musi ściśle mapować parametr UI `stopnie` na te sufiksy.

### 2. Obsługa kręgów wierconych (OT) (23.04.2026)
- **Normalizacja**: Sufiksy `-OT` oraz `_OT` są traktowane jako ta sama kategoria funkcjonalna.
- **Uniwersalna dostępność**: Kręgi "OT" powinny być dostępne niezależnie od wybranego materiału bazowego (Beton/Żelbet), ponieważ są one zazwyczaj dostosowywane indywidualnie.

### 3. Filtrowanie na podstawie materiału (KDB/KDZ) (23.04.2026)
- **Betonowa**: Priorytetyzacja wariantów KDB/KDZ bez oznaczeń żelbetowych.
- **Żelbetowa**: Musi zawierać specyficzne komponenty wzmocnione (żelbetowe).
- *Decyzja*: Logika filtrowania w `wellConfigRules.js` musi przekazywać właściwość `material` do solvera komponentów, aby zapobiec błędom "Nie znaleziono produktu" przy zmianie typu studni.

### 4. Wykrywanie zmian w zamówieniu (21.04.2026)
- **Komponenty techniczne**: Elementy oznaczone jako `autoAdded` (np. uszczelki) są ignorowane podczas porównywania stanu "Zmieniono".
- **Precyzja numeryczna**: Porównania rzędnych i wymiarów używają `parseFloat` oraz normalizacji ciągów znaków, aby uniknąć fałszywych alarmów wynikających z różnic w typach danych lub precyzji zmiennoprzecinkowej.
- *Uzasadnienie*: Zapobiega oznaczaniu studni jako "Zmieniona" tylko dlatego, że system automatycznie zastosował poprawkę techniczną.

### 5. Parowanie elementów odciążających (23.04.2026)
- **Zasada Kompletu**: Płyta odciążająca (`plyta_najazdowa`/`plyta_zamykajaca`) i pierścień odciążający (`pierscien_odciazajacy`) zawsze stanowią nierozerwalny komplet.
- **Automatyzacja**: Dodanie jednego elementu z pary wymusza automatyczne dodanie drugiego (zarówno w sekcji głównej, jak i w sekcji redukcji).
- *Uzasadnienie*: Wymóg technologiczny – płyta i pierścień współpracują w rozkładzie obciążeń i nie mogą występować samodzielnie.

### 6. Restrykcja pojedynczego zakończenia (23.04.2026)
- **Tylko jedno zamknięcie**: Studnia może posiadać tylko jeden element typu zakończenie (konus lub płyta). Dodanie nowego elementu tego typu automatycznie usuwa poprzedni.
- **Wyjątek**: Para odciążająca jest traktowana jako jedno logiczne zakończenie.
- **Płyta redukcyjna**: W danej studni może wystąpić tylko jedna płyta redukcyjna.

### 7. Dynamiczna obsługa średnic redukcji (DN1000/DN1200) (23.04.2026)
- **Parametr `redukcjaTargetDN`**: System musi dynamicznie filtrować komponenty zakończenia komina na podstawie średnicy wybranej redukcji.
- **Spójność UI**: Wszystkie przyciski, toasty i nagłówki popupów muszą dynamicznie wyświetlać aktualną średnicę (DN1000 lub DN1200).

### 8. Inteligentne dzielenie kręgów (OT) (23.04.2026)
- **Dynamiczne rozbijanie ilości**: Jeśli tylko część kręgów w stosie (np. 1 z 3) wymaga otworu, system musi automatycznie rozdzielić pozycję `quantity` na oddzielne linie (np. 1x OT + 2x Std).
- **Konsolidacja**: Po usunięciu przejścia, system musi ponownie złączyć identyczne sąsiadujące kręgi w jedną pozycję `quantity`.

## 🛠️ Infrastruktura

### 1. System Trwałości Kontekstu (23.04.2026)
- **Lokalizacja**: `.agent/context/`
- **Cel**: Pomost między sesjami AI a ograniczeniami pamięci (komenda `/compact`).
- **Pliki**: `status.md` (zadania), `decisions.md` (strategia), `session.md` (stan doraźny).
