[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / CategoriesStudnieDelegate

# Interface: CategoriesStudnieDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:30281

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`CategoriesStudnieFieldRefs`](CategoriesStudnieFieldRefs.md)

Defined in: generated/prisma/index.d.ts:30653

Fields of the CategoriesStudnie model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetCategoriesStudnieAggregateType`](../type-aliases/GetCategoriesStudnieAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:30572

Allows you to perform aggregations operations on a CategoriesStudnie.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieAggregateArgs`](../type-aliases/CategoriesStudnieAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`CategoriesStudnieAggregateArgs`](../type-aliases/CategoriesStudnieAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetCategoriesStudnieAggregateType`](../type-aliases/GetCategoriesStudnieAggregateType.md)\<`T`\>\>

#### Example

```ts
// Ordered by age ascending
// Where email contains prisma.io
// Limited to the 10 users
const aggregations = await prisma.user.aggregate({
  _avg: {
    age: true,
  },
  where: {
    email: {
      contains: "prisma.io",
    },
  },
  orderBy: {
    age: "asc",
  },
  take: 10,
})
```

***

### count()

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof CategoriesStudnieCountAggregateOutputType ? CategoriesStudnieCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:30538

Count the number of CategoriesStudnies.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieCountArgs`](../type-aliases/CategoriesStudnieCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`CategoriesStudnieCountArgs`](../type-aliases/CategoriesStudnieCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter CategoriesStudnies to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof CategoriesStudnieCountAggregateOutputType ? CategoriesStudnieCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of CategoriesStudnies
const count = await prisma.categoriesStudnie.count({
  where: {
    // ... the filter for the CategoriesStudnies we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30371

Create a CategoriesStudnie.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieCreateArgs`](../type-aliases/CategoriesStudnieCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieCreateArgs`](../type-aliases/CategoriesStudnieCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a CategoriesStudnie.

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one CategoriesStudnie
const CategoriesStudnie = await prisma.categoriesStudnie.create({
  data: {
    // ... data to create a CategoriesStudnie
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:30385

Create many CategoriesStudnies.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieCreateManyArgs`](../type-aliases/CategoriesStudnieCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieCreateManyArgs`](../type-aliases/CategoriesStudnieCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many CategoriesStudnies.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many CategoriesStudnies
const categoriesStudnie = await prisma.categoriesStudnie.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:30409

Create many CategoriesStudnies and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieCreateManyAndReturnArgs`](../type-aliases/CategoriesStudnieCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieCreateManyAndReturnArgs`](../type-aliases/CategoriesStudnieCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many CategoriesStudnies.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many CategoriesStudnies
const categoriesStudnie = await prisma.categoriesStudnie.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many CategoriesStudnies and only return the `name`
const categoriesStudnieWithNameOnly = await prisma.categoriesStudnie.createManyAndReturn({
  select: { name: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### delete()

> **delete**\<`T`\>(`args`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30423

Delete a CategoriesStudnie.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieDeleteArgs`](../type-aliases/CategoriesStudnieDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieDeleteArgs`](../type-aliases/CategoriesStudnieDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one CategoriesStudnie.

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one CategoriesStudnie
const CategoriesStudnie = await prisma.categoriesStudnie.delete({
  where: {
    // ... filter to delete one CategoriesStudnie
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:30454

Delete zero or more CategoriesStudnies.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieDeleteManyArgs`](../type-aliases/CategoriesStudnieDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieDeleteManyArgs`](../type-aliases/CategoriesStudnieDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter CategoriesStudnies to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few CategoriesStudnies
const { count } = await prisma.categoriesStudnie.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30323

Find the first CategoriesStudnie that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieFindFirstArgs`](../type-aliases/CategoriesStudnieFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieFindFirstArgs`](../type-aliases/CategoriesStudnieFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesStudnie

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesStudnie
const categoriesStudnie = await prisma.categoriesStudnie.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30339

Find the first CategoriesStudnie that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieFindFirstOrThrowArgs`](../type-aliases/CategoriesStudnieFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieFindFirstOrThrowArgs`](../type-aliases/CategoriesStudnieFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesStudnie

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesStudnie
const categoriesStudnie = await prisma.categoriesStudnie.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:30357

Find zero or more CategoriesStudnies that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieFindManyArgs`](../type-aliases/CategoriesStudnieFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieFindManyArgs`](../type-aliases/CategoriesStudnieFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all CategoriesStudnies
const categoriesStudnies = await prisma.categoriesStudnie.findMany()

// Get first 10 CategoriesStudnies
const categoriesStudnies = await prisma.categoriesStudnie.findMany({ take: 10 })

// Only select the `name`
const categoriesStudnieWithNameOnly = await prisma.categoriesStudnie.findMany({ select: { name: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30294

Find zero or one CategoriesStudnie that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieFindUniqueArgs`](../type-aliases/CategoriesStudnieFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieFindUniqueArgs`](../type-aliases/CategoriesStudnieFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesStudnie

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesStudnie
const categoriesStudnie = await prisma.categoriesStudnie.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30308

Find one CategoriesStudnie that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieFindUniqueOrThrowArgs`](../type-aliases/CategoriesStudnieFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieFindUniqueOrThrowArgs`](../type-aliases/CategoriesStudnieFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesStudnie

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesStudnie
const categoriesStudnie = await prisma.categoriesStudnie.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetCategoriesStudnieGroupByPayload`](../type-aliases/GetCategoriesStudnieGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:30592

Group by CategoriesStudnie.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieGroupByArgs`](../type-aliases/CategoriesStudnieGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`CategoriesStudnieOrderByWithAggregationInput`](../type-aliases/CategoriesStudnieOrderByWithAggregationInput.md) \| [`CategoriesStudnieOrderByWithAggregationInput`](../type-aliases/CategoriesStudnieOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`CategoriesStudnieOrderByWithAggregationInput`](../type-aliases/CategoriesStudnieOrderByWithAggregationInput.md) \| [`CategoriesStudnieOrderByWithAggregationInput`](../type-aliases/CategoriesStudnieOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"order"` \| `"name"` \| `"componentType"`

##### ByFields

`ByFields` *extends* [`CategoriesStudnieScalarFieldEnum`](../type-aliases/CategoriesStudnieScalarFieldEnum.md)

##### ByValid

`ByValid` *extends* `0` \| `1`

##### HavingFields

`HavingFields` *extends* `string` \| `number` \| `symbol`

##### HavingValid

`HavingValid`

##### ByEmpty

`ByEmpty` *extends* `0` \| `1`

##### InputErrors

`InputErrors`

#### Parameters

##### args

\{ \[key in string \| number \| symbol\]: key extends keyof CategoriesStudnieGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetCategoriesStudnieGroupByPayload`](../type-aliases/GetCategoriesStudnieGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

#### Example

```ts
// Group by city, order by createdAt, get count
const result = await prisma.user.groupBy({
  by: ['city', 'createdAt'],
  orderBy: {
    createdAt: true
  },
  _count: {
    _all: true
  },
})
```

***

### update()

> **update**\<`T`\>(`args`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30440

Update one CategoriesStudnie.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieUpdateArgs`](../type-aliases/CategoriesStudnieUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieUpdateArgs`](../type-aliases/CategoriesStudnieUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one CategoriesStudnie.

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one CategoriesStudnie
const categoriesStudnie = await prisma.categoriesStudnie.update({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
```

***

### updateMany()

> **updateMany**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:30473

Update zero or more CategoriesStudnies.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieUpdateManyArgs`](../type-aliases/CategoriesStudnieUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieUpdateManyArgs`](../type-aliases/CategoriesStudnieUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many CategoriesStudnies
const categoriesStudnie = await prisma.categoriesStudnie.updateMany({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
```

***

### updateManyAndReturn()

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:30503

Update zero or more CategoriesStudnies and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieUpdateManyAndReturnArgs`](../type-aliases/CategoriesStudnieUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieUpdateManyAndReturnArgs`](../type-aliases/CategoriesStudnieUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many CategoriesStudnies.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many CategoriesStudnies
const categoriesStudnie = await prisma.categoriesStudnie.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more CategoriesStudnies and only return the `name`
const categoriesStudnieWithNameOnly = await prisma.categoriesStudnie.updateManyAndReturn({
  select: { name: true },
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### upsert()

> **upsert**\<`T`\>(`args`): [`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:30522

Create or update one CategoriesStudnie.

#### Type Parameters

##### T

`T` *extends* [`CategoriesStudnieUpsertArgs`](../type-aliases/CategoriesStudnieUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesStudnieUpsertArgs`](../type-aliases/CategoriesStudnieUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a CategoriesStudnie.

#### Returns

[`Prisma__CategoriesStudnieClient`](Prisma__CategoriesStudnieClient.md)\<`GetFindResult`\<[`$CategoriesStudniePayload`](../type-aliases/$CategoriesStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a CategoriesStudnie
const categoriesStudnie = await prisma.categoriesStudnie.upsert({
  create: {
    // ... data to create a CategoriesStudnie
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the CategoriesStudnie we want to update
  }
})
```
