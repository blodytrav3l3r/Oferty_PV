# Konwencje Projektowe WITROS

## Język Dokumentacji i Komentarzy

Kluczową zasadą tego projektu jest utrzymanie spójności językowej w warstwie opisowej kodu.

- **Komentarze w kodzie**: Wszystkie komentarze (liniowe, blokowe, JSDoc) muszą być pisane w języku polskim.
- **Opisy plików**: Nagłówki plików i opisy ich przeznaczenia muszą być po polsku.
- **Dokumentacja (Markdown)**: Wszystkie pliki `.md` (instrukcje, plany, dzienniki zmian) muszą być tworzone w języku polskim.

## Przykłady

```javascript
// DOBRZE:
// Oblicz całkowitą długość rury uwzględniając zakładkę
const totalLength = length + overlap;

// ŹLE:
// Calculate total length including overlap
const totalLength = length + overlap;
```

## Nazewnictwo w Kodzie

Sama składnia kodu (zmienne, funkcje, klasy) pozostaje w języku angielskim zgodnie z powszechnymi standardami programistycznymi, aby zapewnić kompatybilność z narzędziami i bibliotekami.
