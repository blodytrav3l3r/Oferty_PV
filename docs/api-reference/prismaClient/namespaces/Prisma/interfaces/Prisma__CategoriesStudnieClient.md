[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Prisma\_\_CategoriesStudnieClient

# Interface: Prisma\_\_CategoriesStudnieClient\<T, Null, ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:30662

The delegate class that acts as a "Promise-like" for CategoriesStudnie.
Why is this prefixed with `Prisma__`?
Because we want to prevent naming conflicts as mentioned in
https://github.com/prisma/prisma-client-js/issues/707

## Extends

- [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T`\>

## Type Parameters

### T

`T`

### Null

`Null` = `never`

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Properties

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"PrismaPromise"`

Defined in: generated/prisma/index.d.ts:30663

#### Overrides

`Prisma.PrismaPromise.[toStringTag]`

## Methods

### catch()

> **catch**\<`TResult`>\>(`onrejected?`): `Promise`\<`T` \| `TResult`>\>

Defined in: generated/prisma/index.d.ts:30677

Attaches a callback for only the rejection of the Promise.

#### Type Parameters

##### TResult

`TResult` = `never`

#### Parameters

##### onrejected?

((`reason`) => `TResult` \| `PromiseLike`\<`TResult`\>) \| `null`

The callback to execute when the Promise is rejected.

#### Returns

`Promise`\<`T` \| `TResult`\>

A Promise for the completion of the callback.

#### Overrides

`Prisma.PrismaPromise.catch`

---

### finally()

> **finally**(`onfinally?`): `Promise`\<`T`>\>

Defined in: generated/prisma/index.d.ts:30684

Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
resolved value cannot be modified from the callback.

#### Parameters

##### onfinally?

(() => `void`) \| `null`

The callback to execute when the Promise is settled (fulfilled or rejected).

#### Returns

`Promise`\<`T`\>

A Promise for the completion of the callback.

#### Overrides

`Prisma.PrismaPromise.finally`

---

### products()

> **products**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`Null` \| `GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:30664

#### Type Parameters

##### T

`T` _extends_ [`CategoriesStudnie$productsArgs`](../type-aliases/CategoriesStudnie$productsArgs.md)\<`ExtArgs`\> = \{ \}

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`CategoriesStudnie$productsArgs`](../type-aliases/CategoriesStudnie$productsArgs.md)\<`ExtArgs`\>\>

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`Null` \| `GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

---

### then()

> **then**\<`TResult1`, `TResult2`>\>(`onfulfilled?`, `onrejected?`): `Promise`\<`TResult1` \| `TResult2`>\>

Defined in: generated/prisma/index.d.ts:30671

Attaches callbacks for the resolution and/or rejection of the Promise.

#### Type Parameters

##### TResult1

`TResult1` = `T`

##### TResult2

`TResult2` = `never`

#### Parameters

##### onfulfilled?

((`value`) => `TResult1` \| `PromiseLike`\<`TResult1`\>) \| `null`

The callback to execute when the Promise is resolved.

##### onrejected?

((`reason`) => `TResult2` \| `PromiseLike`\<`TResult2`\>) \| `null`

The callback to execute when the Promise is rejected.

#### Returns

`Promise`\<`TResult1` \| `TResult2`\>

A Promise for the completion of which ever callback is executed.

#### Overrides

`Prisma.PrismaPromise.then`
