[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / Prisma\_\_ProductsStudnieClient

# Interface: Prisma\_\_ProductsStudnieClient\<T, Null, ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:32218

The delegate class that acts as a "Promise-like" for ProductsStudnie.
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

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Properties

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"PrismaPromise"`

Defined in: generated/prisma/index.d.ts:32219

#### Overrides

`Prisma.PrismaPromise.[toStringTag]`

## Methods

### catch()

> **catch**\<`TResult`\>(`onrejected?`): `Promise`\<`T` \| `TResult`\>

Defined in: generated/prisma/index.d.ts:32233

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

***

### category\_rel()

> **category\_rel**\<`T`\>(`args?`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`Null` \| `GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `Null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:32220

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieDefaultArgs`](../type-aliases/CategoriesStudnieDefaultArgs.md)\<`ExtArgs`\> = \{ \}

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`CategoriesStudnieDefaultArgs`](../type-aliases/CategoriesStudnieDefaultArgs.md)\<`ExtArgs`\>\>

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`Null` \| `GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `Null`, `ExtArgs`, `GlobalOmitOptions`\>

***

### finally()

> **finally**(`onfinally?`): `Promise`\<`T`\>

Defined in: generated/prisma/index.d.ts:32240

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

***

### then()

> **then**\<`TResult1`, `TResult2`\>(`onfulfilled?`, `onrejected?`): `Promise`\<`TResult1` \| `TResult2`\>

Defined in: generated/prisma/index.d.ts:32227

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
