[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / IsObject

# Type Alias: IsObject\<T\>

> **IsObject**\<`T`\> = `T` *extends* `any`[] ? [`False`](False.md) : `T` *extends* `Date` ? [`False`](False.md) : `T` *extends* `Uint8Array` ? [`False`](False.md) : `T` *extends* `BigInt` ? [`False`](False.md) : `T` *extends* `object` ? [`True`](True.md) : [`False`](False.md)

Defined in: generated/prisma/index.d.ts:830

Is T a Record?

## Type Parameters

### T

`T` *extends* `any`
