[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / TruthyKeys

# Type Alias: TruthyKeys\<T\>

> **TruthyKeys**\<`T`\> = keyof \{ \[K in keyof T as T\[K\] extends false \| undefined \| null ? never : K\]: K \}

Defined in: generated/prisma/index.d.ts:777

## Type Parameters

### T

`T`
