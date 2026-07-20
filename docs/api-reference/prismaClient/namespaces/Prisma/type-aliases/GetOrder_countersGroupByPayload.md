[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetOrder\_countersGroupByPayload

# Type Alias: GetOrder\_countersGroupByPayload\<T\>

> **GetOrder\_countersGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Order_countersGroupByOutputType`](Order_countersGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Order_countersGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Order_countersGroupByOutputType[P]> : GetScalarType<T[P], Order_countersGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:18960

## Type Parameters

### T

`T` _extends_ [`order_countersGroupByArgs`](order_countersGroupByArgs.md)
