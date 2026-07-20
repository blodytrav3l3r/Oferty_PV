[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [services/pricelistService](../README.md) / ensurePrecoSeeded

# Function: ensurePrecoSeeded()

> **ensurePrecoSeeded**(): `Promise`\<`void`\>

Defined in: [src/services/pricelistService.ts:49](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/pricelistService.ts#L49)

Jednorazowe seedowanie: jeśli brak bieżącego cennika w settings,
ładuje produkty z pliku seed i zapisuje jako bieżący oraz domyślny.

## Returns

`Promise`\<`void`\>
