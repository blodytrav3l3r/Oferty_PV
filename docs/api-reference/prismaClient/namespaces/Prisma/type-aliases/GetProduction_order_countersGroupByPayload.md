[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetProduction\_order\_countersGroupByPayload

# Type Alias: GetProduction\_order\_countersGroupByPayload\<T\>

> **GetProduction\_order\_countersGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Production_order_countersGroupByOutputType`](Production_order_countersGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Production_order_countersGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Production_order_countersGroupByOutputType[P]> : GetScalarType<T[P], Production_order_countersGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:22982

## Type Parameters

### T

`T` *extends* [`production_order_countersGroupByArgs`](production_order_countersGroupByArgs.md)
