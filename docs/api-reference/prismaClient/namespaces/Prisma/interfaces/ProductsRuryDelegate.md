[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsRuryDelegate

# Interface: ProductsRuryDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:29217

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ProductsRuryFieldRefs`](ProductsRuryFieldRefs.md)

Defined in: generated/prisma/index.d.ts:29589

Fields of the ProductsRury model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProductsRuryAggregateType`](../type-aliases/GetProductsRuryAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:29508

Allows you to perform aggregations operations on a ProductsRury.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryAggregateArgs`](../type-aliases/ProductsRuryAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ProductsRuryAggregateArgs`](../type-aliases/ProductsRuryAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProductsRuryAggregateType`](../type-aliases/GetProductsRuryAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof ProductsRuryCountAggregateOutputType ? ProductsRuryCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:29474

Count the number of ProductsRuries.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryCountArgs`](../type-aliases/ProductsRuryCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ProductsRuryCountArgs`](../type-aliases/ProductsRuryCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter ProductsRuries to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof ProductsRuryCountAggregateOutputType ? ProductsRuryCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of ProductsRuries
const count = await prisma.productsRury.count({
  where: {
    // ... the filter for the ProductsRuries we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29307

Create a ProductsRury.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryCreateArgs`](../type-aliases/ProductsRuryCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryCreateArgs`](../type-aliases/ProductsRuryCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a ProductsRury.

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one ProductsRury
const ProductsRury = await prisma.productsRury.create({
  data: {
    // ... data to create a ProductsRury
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:29321

Create many ProductsRuries.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryCreateManyArgs`](../type-aliases/ProductsRuryCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryCreateManyArgs`](../type-aliases/ProductsRuryCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many ProductsRuries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many ProductsRuries
const productsRury = await prisma.productsRury.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:29345

Create many ProductsRuries and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryCreateManyAndReturnArgs`](../type-aliases/ProductsRuryCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryCreateManyAndReturnArgs`](../type-aliases/ProductsRuryCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many ProductsRuries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many ProductsRuries
const productsRury = await prisma.productsRury.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many ProductsRuries and only return the `id`
const productsRuryWithIdOnly = await prisma.productsRury.createManyAndReturn({
  select: { id: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### delete()

> **delete**\<`T`\>(`args`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29359

Delete a ProductsRury.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryDeleteArgs`](../type-aliases/ProductsRuryDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryDeleteArgs`](../type-aliases/ProductsRuryDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one ProductsRury.

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one ProductsRury
const ProductsRury = await prisma.productsRury.delete({
  where: {
    // ... filter to delete one ProductsRury
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:29390

Delete zero or more ProductsRuries.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryDeleteManyArgs`](../type-aliases/ProductsRuryDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryDeleteManyArgs`](../type-aliases/ProductsRuryDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter ProductsRuries to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few ProductsRuries
const { count } = await prisma.productsRury.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29259

Find the first ProductsRury that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryFindFirstArgs`](../type-aliases/ProductsRuryFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryFindFirstArgs`](../type-aliases/ProductsRuryFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsRury

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsRury
const productsRury = await prisma.productsRury.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29275

Find the first ProductsRury that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryFindFirstOrThrowArgs`](../type-aliases/ProductsRuryFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryFindFirstOrThrowArgs`](../type-aliases/ProductsRuryFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsRury

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsRury
const productsRury = await prisma.productsRury.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:29293

Find zero or more ProductsRuries that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryFindManyArgs`](../type-aliases/ProductsRuryFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryFindManyArgs`](../type-aliases/ProductsRuryFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all ProductsRuries
const productsRuries = await prisma.productsRury.findMany()

// Get first 10 ProductsRuries
const productsRuries = await prisma.productsRury.findMany({ take: 10 })

// Only select the `id`
const productsRuryWithIdOnly = await prisma.productsRury.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29230

Find zero or one ProductsRury that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryFindUniqueArgs`](../type-aliases/ProductsRuryFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryFindUniqueArgs`](../type-aliases/ProductsRuryFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsRury

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsRury
const productsRury = await prisma.productsRury.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29244

Find one ProductsRury that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryFindUniqueOrThrowArgs`](../type-aliases/ProductsRuryFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryFindUniqueOrThrowArgs`](../type-aliases/ProductsRuryFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsRury

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsRury
const productsRury = await prisma.productsRury.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetProductsRuryGroupByPayload`](../type-aliases/GetProductsRuryGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:29528

Group by ProductsRury.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryGroupByArgs`](../type-aliases/ProductsRuryGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`ProductsRuryOrderByWithAggregationInput`](../type-aliases/ProductsRuryOrderByWithAggregationInput.md) \| [`ProductsRuryOrderByWithAggregationInput`](../type-aliases/ProductsRuryOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ProductsRuryOrderByWithAggregationInput`](../type-aliases/ProductsRuryOrderByWithAggregationInput.md) \| [`ProductsRuryOrderByWithAggregationInput`](../type-aliases/ProductsRuryOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"name"` \| `"category"` \| `"price"` \| `"transport"` \| `"weight"` \| `"area"`

##### ByFields

`ByFields` *extends* [`ProductsRuryScalarFieldEnum`](../type-aliases/ProductsRuryScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ProductsRuryGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetProductsRuryGroupByPayload`](../type-aliases/GetProductsRuryGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29376

Update one ProductsRury.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryUpdateArgs`](../type-aliases/ProductsRuryUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryUpdateArgs`](../type-aliases/ProductsRuryUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one ProductsRury.

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one ProductsRury
const productsRury = await prisma.productsRury.update({
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

Defined in: generated/prisma/index.d.ts:29409

Update zero or more ProductsRuries.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryUpdateManyArgs`](../type-aliases/ProductsRuryUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryUpdateManyArgs`](../type-aliases/ProductsRuryUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many ProductsRuries
const productsRury = await prisma.productsRury.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:29439

Update zero or more ProductsRuries and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryUpdateManyAndReturnArgs`](../type-aliases/ProductsRuryUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryUpdateManyAndReturnArgs`](../type-aliases/ProductsRuryUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many ProductsRuries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many ProductsRuries
const productsRury = await prisma.productsRury.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more ProductsRuries and only return the `id`
const productsRuryWithIdOnly = await prisma.productsRury.updateManyAndReturn({
  select: { id: true },
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

> **upsert**\<`T`\>(`args`): [`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:29458

Create or update one ProductsRury.

#### Type Parameters

##### T

`T` *extends* [`ProductsRuryUpsertArgs`](../type-aliases/ProductsRuryUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsRuryUpsertArgs`](../type-aliases/ProductsRuryUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a ProductsRury.

#### Returns

[`Prisma__ProductsRuryClient`](Prisma__ProductsRuryClient.md)\<`GetFindResult`\<[`$ProductsRuryPayload`](../type-aliases/$ProductsRuryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a ProductsRury
const productsRury = await prisma.productsRury.upsert({
  create: {
    // ... data to create a ProductsRury
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the ProductsRury we want to update
  }
})
```
