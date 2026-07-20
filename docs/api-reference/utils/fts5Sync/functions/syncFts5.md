[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/fts5Sync](../README.md) / syncFts5

# Function: syncFts5()

> **syncFts5**(`type`, `data`): `Promise`\<`void`\>

Defined in: [src/utils/fts5Sync.ts:14](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/fts5Sync.ts#L14)

Sync a single offer into FTS5 index.
Uses DELETE + INSERT to avoid rowid conflicts.

## Parameters

### type

`"rury"` \| `"studnie"`

### data

[`OfferFts5Data`](../interfaces/OfferFts5Data.md)

## Returns

`Promise`\<`void`\>
