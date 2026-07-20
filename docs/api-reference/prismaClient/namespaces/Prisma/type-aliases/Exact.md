[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Exact

# Type Alias: Exact\<A, W\>

> **Exact**\<`A`, `W`\> = `A` *extends* `unknown` ? `W` *extends* `A` ? `{ [K in keyof A]: Exact<A[K], W[K]> }` : `W` : `never` \| `A` *extends* `Narrowable` ? `A` : `never`

Defined in: generated/prisma/runtime/library.d.ts:1192

## Type Parameters

### A

`A`

### W

`W`
