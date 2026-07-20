[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetClients\_relGroupByPayload

# Type Alias: GetClients\_relGroupByPayload\<T\>

> **GetClients\_relGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Clients_relGroupByOutputType`](Clients_relGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Clients_relGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Clients_relGroupByOutputType[P]> : GetScalarType<T[P], Clients_relGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:13536

## Type Parameters

### T

`T` _extends_ [`clients_relGroupByArgs`](clients_relGroupByArgs.md)
