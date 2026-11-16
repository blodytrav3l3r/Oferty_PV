# Chrome for Testing — informacje licencyjne (wersja 156.0.8078.47)

Plik `credits.html` to zapis strony `chrome://credits` z przeglądarki Chrome for
Testing w wersji **156.0.8078.47** — tej samej, którą instaluje `puppeteer@25.16.0`
(`node_modules/puppeteer-core/lib/puppeteer/revisions.js`, wpis `chrome`).
Zawiera listę komponentów przeglądarki wraz z tekstami ich licencji.

- Wersja: 156.0.8078.47
- Pochodzenie danych: `chrome://credits` z binarki Chrome for Testing dla tej wersji
- Źródło binarki: <https://storage.googleapis.com/chrome-for-testing-public/156.0.8078.47/>
- Data zapisu: 2026-11-16
- SHA-256 pliku: `683030f35139884b084a8d53abdb9116fd61f1aff924e1e68f1a5ef33687e97f`
- Rozmiar: 5 280 057 bajtów

## Jak odtworzyć

`PUPPETEER_CACHE_DIR` musi wskazywać cache z zainstalowaną wersją 156.0.8078.47:

```js
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto('chrome://credits', { waitUntil: 'domcontentloaded' });
const html = await page.content();
```

## Ograniczenia

- Zapis dotyczy jednej wersji przeglądarki. Po podniesieniu Puppeteer lub
  zmiany wersji Chrome for Testing plik trzeba wygenerować ponownie dla nowej
  wersji i zachować obok (nie nadpisywać historii wydań).
- Zawartość `chrome://credits` odpowiada stronie atrybucji Chromium dla danej
  kompilacji. Nie zastępuje informacji licencyjnych systemu bazowego obrazu ani
  pakietów npm.
- Plik jest generowany — nie formatować i nie edytować ręcznie.
