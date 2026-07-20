[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/searchCache](../README.md) / SearchCache

# Class: SearchCache

Defined in: [src/utils/searchCache.ts:1](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/searchCache.ts#L1)

## Constructors

### Constructor

> **new SearchCache**(`maxSize?`, `ttl?`): `SearchCache`

Defined in: [src/utils/searchCache.ts:6](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/searchCache.ts#L6)

#### Parameters

##### maxSize?

`number` = `100`

##### ttl?

`number` = `30000`

#### Returns

`SearchCache`

## Methods

### get()

> **get**(`namespace`, `params`): `unknown`

Defined in: [src/utils/searchCache.ts:16](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/searchCache.ts#L16)

#### Parameters

##### namespace

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`unknown`

***

### invalidateAll()

> **invalidateAll**(): `void`

Defined in: [src/utils/searchCache.ts:46](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/searchCache.ts#L46)

#### Returns

`void`

***

### invalidateNamespace()

> **invalidateNamespace**(`namespace`): `void`

Defined in: [src/utils/searchCache.ts:38](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/searchCache.ts#L38)

#### Parameters

##### namespace

`string`

#### Returns

`void`

***

### set()

> **set**(`namespace`, `params`, `data`): `void`

Defined in: [src/utils/searchCache.ts:29](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/searchCache.ts#L29)

#### Parameters

##### namespace

`string`

##### params

`Record`\<`string`, `unknown`\>

##### data

`unknown`

#### Returns

`void`
