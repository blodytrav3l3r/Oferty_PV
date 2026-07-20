[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrder\_counters\_ruryGroupByPayload

# Type Alias: GetOrder\_counters\_ruryGroupByPayload\<T\>

> **GetOrder\_counters\_ruryGroupByPayload**\<`T`\> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Order_counters_ruryGroupByOutputType`](Order_counters_ruryGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Order_counters_ruryGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Order_counters_ruryGroupByOutputType[P]> : GetScalarType<T[P], Order_counters_ruryGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:19965

## Type Parameters

### T

`T` *extends* [`order_counters_ruryGroupByArgs`](order_counters_ruryGroupByArgs.md)
