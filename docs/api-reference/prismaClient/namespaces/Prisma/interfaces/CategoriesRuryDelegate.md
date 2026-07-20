[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / CategoriesRuryDelegate

# Interface: CategoriesRuryDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:28078

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`CategoriesRuryFieldRefs`](CategoriesRuryFieldRefs.md)

Defined in: generated/prisma/index.d.ts:28450

Fields of the CategoriesRury model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetCategoriesRuryAggregateType`](../type-aliases/GetCategoriesRuryAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:28369

Allows you to perform aggregations operations on a CategoriesRury.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryAggregateArgs`](../type-aliases/CategoriesRuryAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`CategoriesRuryAggregateArgs`](../type-aliases/CategoriesRuryAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetCategoriesRuryAggregateType`](../type-aliases/GetCategoriesRuryAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof CategoriesRuryCountAggregateOutputType ? CategoriesRuryCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:28335

Count the number of CategoriesRuries.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryCountArgs`](../type-aliases/CategoriesRuryCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`CategoriesRuryCountArgs`](../type-aliases/CategoriesRuryCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter CategoriesRuries to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof CategoriesRuryCountAggregateOutputType ? CategoriesRuryCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of CategoriesRuries
const count = await prisma.categoriesRury.count({
  where: {
    // ... the filter for the CategoriesRuries we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28168

Create a CategoriesRury.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryCreateArgs`](../type-aliases/CategoriesRuryCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryCreateArgs`](../type-aliases/CategoriesRuryCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a CategoriesRury.

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one CategoriesRury
const CategoriesRury = await prisma.categoriesRury.create({
  data: {
    // ... data to create a CategoriesRury
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:28182

Create many CategoriesRuries.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryCreateManyArgs`](../type-aliases/CategoriesRuryCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryCreateManyArgs`](../type-aliases/CategoriesRuryCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many CategoriesRuries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many CategoriesRuries
const categoriesRury = await prisma.categoriesRury.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:28206

Create many CategoriesRuries and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryCreateManyAndReturnArgs`](../type-aliases/CategoriesRuryCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryCreateManyAndReturnArgs`](../type-aliases/CategoriesRuryCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many CategoriesRuries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many CategoriesRuries
const categoriesRury = await prisma.categoriesRury.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many CategoriesRuries and only return the `name`
const categoriesRuryWithNameOnly = await prisma.categoriesRury.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28220

Delete a CategoriesRury.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryDeleteArgs`](../type-aliases/CategoriesRuryDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryDeleteArgs`](../type-aliases/CategoriesRuryDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one CategoriesRury.

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one CategoriesRury
const CategoriesRury = await prisma.categoriesRury.delete({
  where: {
    // ... filter to delete one CategoriesRury
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:28251

Delete zero or more CategoriesRuries.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryDeleteManyArgs`](../type-aliases/CategoriesRuryDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryDeleteManyArgs`](../type-aliases/CategoriesRuryDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter CategoriesRuries to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few CategoriesRuries
const { count } = await prisma.categoriesRury.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28120

Find the first CategoriesRury that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryFindFirstArgs`](../type-aliases/CategoriesRuryFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryFindFirstArgs`](../type-aliases/CategoriesRuryFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesRury

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesRury
const categoriesRury = await prisma.categoriesRury.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28136

Find the first CategoriesRury that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryFindFirstOrThrowArgs`](../type-aliases/CategoriesRuryFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryFindFirstOrThrowArgs`](../type-aliases/CategoriesRuryFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesRury

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesRury
const categoriesRury = await prisma.categoriesRury.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:28154

Find zero or more CategoriesRuries that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryFindManyArgs`](../type-aliases/CategoriesRuryFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryFindManyArgs`](../type-aliases/CategoriesRuryFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all CategoriesRuries
const categoriesRuries = await prisma.categoriesRury.findMany()

// Get first 10 CategoriesRuries
const categoriesRuries = await prisma.categoriesRury.findMany({ take: 10 })

// Only select the `name`
const categoriesRuryWithNameOnly = await prisma.categoriesRury.findMany({ select: { name: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28091

Find zero or one CategoriesRury that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryFindUniqueArgs`](../type-aliases/CategoriesRuryFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryFindUniqueArgs`](../type-aliases/CategoriesRuryFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesRury

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesRury
const categoriesRury = await prisma.categoriesRury.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28105

Find one CategoriesRury that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryFindUniqueOrThrowArgs`](../type-aliases/CategoriesRuryFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryFindUniqueOrThrowArgs`](../type-aliases/CategoriesRuryFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a CategoriesRury

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one CategoriesRury
const categoriesRury = await prisma.categoriesRury.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetCategoriesRuryGroupByPayload`](../type-aliases/GetCategoriesRuryGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:28389

Group by CategoriesRury.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryGroupByArgs`](../type-aliases/CategoriesRuryGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`CategoriesRuryOrderByWithAggregationInput`](../type-aliases/CategoriesRuryOrderByWithAggregationInput.md) \| [`CategoriesRuryOrderByWithAggregationInput`](../type-aliases/CategoriesRuryOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`CategoriesRuryOrderByWithAggregationInput`](../type-aliases/CategoriesRuryOrderByWithAggregationInput.md) \| [`CategoriesRuryOrderByWithAggregationInput`](../type-aliases/CategoriesRuryOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"order"` \| `"name"`

##### ByFields

`ByFields` *extends* [`CategoriesRuryScalarFieldEnum`](../type-aliases/CategoriesRuryScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof CategoriesRuryGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetCategoriesRuryGroupByPayload`](../type-aliases/GetCategoriesRuryGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28237

Update one CategoriesRury.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryUpdateArgs`](../type-aliases/CategoriesRuryUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryUpdateArgs`](../type-aliases/CategoriesRuryUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one CategoriesRury.

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one CategoriesRury
const categoriesRury = await prisma.categoriesRury.update({
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

Defined in: generated/prisma/index.d.ts:28270

Update zero or more CategoriesRuries.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryUpdateManyArgs`](../type-aliases/CategoriesRuryUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryUpdateManyArgs`](../type-aliases/CategoriesRuryUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many CategoriesRuries
const categoriesRury = await prisma.categoriesRury.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:28300

Update zero or more CategoriesRuries and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryUpdateManyAndReturnArgs`](../type-aliases/CategoriesRuryUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryUpdateManyAndReturnArgs`](../type-aliases/CategoriesRuryUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many CategoriesRuries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many CategoriesRuries
const categoriesRury = await prisma.categoriesRury.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more CategoriesRuries and only return the `name`
const categoriesRuryWithNameOnly = await prisma.categoriesRury.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:28319

Create or update one CategoriesRury.

#### Type Parameters

##### T

`T` *extends* [`CategoriesRuryUpsertArgs`](../type-aliases/CategoriesRuryUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`CategoriesRuryUpsertArgs`](../type-aliases/CategoriesRuryUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a CategoriesRury.

#### Returns

[`Prisma__CategoriesRuryClient`](Prisma__CategoriesRuryClient.md)\<`GetFindResult`\<[`$CategoriesRuryPayload`](../type-aliases/$CategoriesRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a CategoriesRury
const categoriesRury = await prisma.categoriesRury.upsert({
  create: {
    // ... data to create a CategoriesRury
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the CategoriesRury we want to update
  }
})
```
