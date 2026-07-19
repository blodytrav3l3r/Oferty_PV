[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / GetSettingsGroupByPayload

# Type Alias: GetSettingsGroupByPayload\<T\>

> **GetSettingsGroupByPayload**\<`T`> \> = [`PrismaPromise`](PrismaPromise.md)\<[`PickEnumerable`](PickEnumerable.md)\<[`SettingsGroupByOutputType`](SettingsGroupByOutputType.md), `T`\[`"by"`\]\> & `{ [P in keyof T & keyof SettingsGroupByOutputType]: P extends "_count" ? T[P] extends boolean ? number : GetScalarType<T[P], SettingsGroupByOutputType[P]> : GetScalarType<T[P], SettingsGroupByOutputType[P]> }`[]\>

Defined in: generated/prisma/index.d.ts:27027

## Type Parameters

### T

`T` _extends_ [`settingsGroupByArgs`](settingsGroupByArgs.md)
