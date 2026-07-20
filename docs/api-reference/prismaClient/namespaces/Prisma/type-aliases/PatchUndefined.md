[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / PatchUndefined

# Type Alias: PatchUndefined\<O, O1\>

> **PatchUndefined**\<`O`, `O1`\> = `{ [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K] }` & `object`

Defined in: generated/prisma/index.d.ts:879

## Type Parameters

### O

`O` *extends* `object`

### O1

`O1` *extends* `object`
