# Zaokrąglanie cen (PLN)

Reguła obowiązująca w całym projekcie: **każda kwota pieniężna ma 2 miejsca po przecinku**.

Tryb: **half-up, od zera** (handlowy). `1.005 → 1.01`, `2.675 → 2.68`, `-1.005 → -1.01`.

## Jedno źródło prawdy

| Warstwa  | Plik                             | Funkcja             |
| -------- | -------------------------------- | ------------------- |
| Frontend | `public/js/shared/formatters.js` | `roundMoney(value)` |
| Backend  | `src/utils/money.ts`             | `roundMoney(value)` |

Obie implementacje są identyczne: `sign * Math.round((abs + Number.EPSILON) * 100) / 100`.
`Number.EPSILON` koryguje błąd zapisu binarnego (`1.005` bez korekty daje `1.00`).
Wartości `NaN` / `Infinity` / `null` → `0`.

## Gdzie stosować

Zaokrąglaj na **granicy kwoty**, nie w środku obliczeń:

- cena jednostkowa po rabacie (pozycja),
- wartość pozycji (cena × ilość),
- suma netto oferty/zamówienia,
- koszt transportu (stawka × kursy, udział wagowy),
- VAT (od zaokrąglonej sumy netto),
- brutto (netto + zaokrąglony VAT),
- każda kwota zapisywana do bazy lub drukowana w PDF.

Nie zaokrąglaj: procentów rabatów, wag, ilości, wymiarów w mm.

## Gdzie jest już wdrożone

Frontend:

- `public/js/studnie/actionsWellPricing.js` — cena pozycji, składniki, `calcWellStats`
- `public/js/studnie/pricingCalculator.js` — sumy oferty studni
- `public/js/studnie/offerSave.js` — `totalNetto` / `totalBrutto`, telemetria
- `public/js/studnie/orderCrud.js` — sumy zamówień (wszystkie ścieżki)
- `public/js/rury/transport.js` — pozycje, transport, netto/VAT/brutto
- `public/js/rury/offerCrud.js` — zapis oferty rur
- `public/js/rury/offerExports.js`, `offerExportsHelpers.js` — wydruk i XLSX
- `public/js/studnie/actionsWellDiscounts.js` — podgląd ceny PEHD/m²

Backend:

- `src/routes/offers/studnieCrud.ts` — `deriveStudnieTotalPrice`
- `src/services/pdf/helpers.ts`, `studnieHtml.ts`, `ruryHtml.ts`, `combinedHtml.ts` — sumy dokumentów

## Fallback w modułach frontendu

Moduły classic-script wołają globalne `roundMoney`, ale mają lokalny fallback
(`typeof roundMoney === 'function' ? roundMoney : <ta sama formuła>`), bo testy vm
ładują pojedyncze pliki bez `shared/formatters.js`. Fallback **musi** być identyczny
z SSoT — pilnuje tego `tests/frontend/moneyRounding.test.ts`.

## Dodajesz nową kwotę? Checklist

1. Wynik policz na pełnej precyzji, zaokrąglij `roundMoney(...)` przy zapisie/prezentacji.
2. Nie zaokrąglaj tego samego pola dwa razy w różnych miejscach.
3. Dopisz przypadek do `tests/frontend/moneyRounding.test.ts` lub `tests/moneyRounding.test.ts`.
4. Nowy moduł frontendu → skopiuj fallback 1:1 i dopisz do listy w teście konsumentów.

## Czego NIE robić

- `Math.round(x * 100) / 100` bez obsługi znaku — psuje wartości ujemne (`-1.005 → -1.00`).
- `toFixed(2)` jako źródło wartości liczbowej — używaj go tylko do wyświetlania.
- Zaokrąglanie procentów rabatu przed mnożeniem ceny.
- Własnych, lokalnych reguł zaokrągleń w nowych plikach.
