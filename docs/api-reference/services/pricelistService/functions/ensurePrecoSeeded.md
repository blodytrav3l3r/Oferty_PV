[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [services/pricelistService](../README.md) / ensurePrecoSeeded

# Function: ensurePrecoSeeded()

> **ensurePrecoSeeded**(): `Promise`\<`void`>\>

Defined in: [src/services/pricelistService.ts:49](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/services/pricelistService.ts#L49)

Jednorazowe seedowanie: jeśli brak bieżącego cennika w settings,
ładuje produkty z pliku seed i zapisuje jako bieżący oraz domyślny.

## Returns

`Promise`\<`void`\>
