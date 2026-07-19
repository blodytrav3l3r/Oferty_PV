[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetAi\_config\_historyGroupByPayload

# Type Alias: GetAi\_config\_historyGroupByPayload\<T\>

> **GetAi\_config\_historyGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`Ai_config_historyGroupByOutputType`](Ai_config_historyGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof Ai_config_historyGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], Ai_config_historyGroupByOutputType[P]> : GetScalarType<T[P], Ai_config_historyGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:6827

## Type Parameters

### T

`T` _extends_ [`ai_config_historyGroupByArgs`](ai_config_historyGroupByArgs.md)
