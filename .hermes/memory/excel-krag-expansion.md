# Excel: krag/krag_ot expandowane na osobne pozycje

## Zasada
- W `well.config` każdy krąg (krag/krag_ot) to osobna pozycja z `quantity: 1`
- W Excelu pokazywana jest SUMA (ilość kręgów danego typu/wysokości)

## Implementacja
- `_excelInsertConfigItem` — po wstawieniu sortuje, a dla krag/krag_ot z qty>1 rozwija na N osobnych wpisów (każdy qty=1)
- `excelOnCompChange` post-processing — przy konwersji krag↔krag_ot zbiera SUMĘ ze wszystkich istniejących pozycji dobrego typu, usuwa je wszystkie, i dodaje skumulowaną ilość przez `_excelInsertConfigItem` (który rozwinie)
- `_excelCountProductInConfig` — sumuje item.quantity po wszystkich pasujących pozycjach → działa poprawnie z expanded

## Pliki
- `public/js/studnie/excelTableManager.js` — `_excelInsertConfigItem` (linia ~1815), `excelOnCompChange` (linia ~1957)
