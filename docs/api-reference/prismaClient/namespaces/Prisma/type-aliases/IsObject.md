[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / IsObject

# Type Alias: IsObject\<T\>

> **IsObject**\<`T`> \> = `T` _extends_ `any`[] ? [`False`](False.md) : `T` _extends_ `Date` ? [`False`](False.md) : `T` _extends_ `Uint8Array` ? [`False`](False.md) : `T` _extends_ `BigInt` ? [`False`](False.md) : `T` _extends_ `object` ? [`True`](True.md) : [`False`](False.md)

Defined in: generated/prisma/index.d.ts:830

Is T a Record?

## Type Parameters

### T

`T` _extends_ `any`
