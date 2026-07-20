[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / XOR

# Type Alias: XOR\<T, U\>

> **XOR**\<`T`, `U`> \> = `T` _extends_ `object` ? `U` _extends_ `object` ? [`Without`](Without.md)\<`T`, `U`> \> & `U` \| [`Without`](Without.md)\<`U`, `T`> \> & `T` : `U` : `T`

Defined in: generated/prisma/index.d.ts:820

XOR is needed to have a real mutually exclusive union type
https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types

## Type Parameters

### T

`T`

### U

`U`
