[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_orders\_relDelegate

# Interface: production\_orders\_relDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:24113

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`production_orders_relFieldRefs`](production_orders_relFieldRefs.md)

Defined in: generated/prisma/index.d.ts:24485

Fields of the production_orders_rel model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProduction_orders_relAggregateType`](../type-aliases/GetProduction_orders_relAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:24404

Allows you to perform aggregations operations on a Production_orders_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Production_orders_relAggregateArgs`](../type-aliases/Production_orders_relAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Production_orders_relAggregateArgs`](../type-aliases/Production_orders_relAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProduction_orders_relAggregateType`](../type-aliases/GetProduction_orders_relAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Production\_orders\_relCountAggregateOutputType ? Production\_orders\_relCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:24370

Count the number of Production_orders_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_orders_relCountArgs`](../type-aliases/production_orders_relCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`production_orders_relCountArgs`](../type-aliases/production_orders_relCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Production_orders_rels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Production\_orders\_relCountAggregateOutputType ? Production\_orders\_relCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Production_orders_rels
const count = await prisma.production_orders_rel.count({
  where: {
    // ... the filter for the Production_orders_rels we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24203

Create a Production_orders_rel.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relCreateArgs`](../type-aliases/production_orders_relCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relCreateArgs`](../type-aliases/production_orders_relCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Production_orders_rel.

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Production_orders_rel
const Production_orders_rel = await prisma.production_orders_rel.create({
  data: {
    // ... data to create a Production_orders_rel
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:24217

Create many Production_orders_rels.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relCreateManyArgs`](../type-aliases/production_orders_relCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relCreateManyArgs`](../type-aliases/production_orders_relCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Production_orders_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Production_orders_rels
const production_orders_rel = await prisma.production_orders_rel.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:24241

Create many Production_orders_rels and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relCreateManyAndReturnArgs`](../type-aliases/production_orders_relCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relCreateManyAndReturnArgs`](../type-aliases/production_orders_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Production_orders_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Production_orders_rels
const production_orders_rel = await prisma.production_orders_rel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Production_orders_rels and only return the `id`
const production_orders_relWithIdOnly = await prisma.production_orders_rel.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24255

Delete a Production_orders_rel.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relDeleteArgs`](../type-aliases/production_orders_relDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relDeleteArgs`](../type-aliases/production_orders_relDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Production_orders_rel.

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Production_orders_rel
const Production_orders_rel = await prisma.production_orders_rel.delete({
  where: {
    // ... filter to delete one Production_orders_rel
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:24286

Delete zero or more Production_orders_rels.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relDeleteManyArgs`](../type-aliases/production_orders_relDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relDeleteManyArgs`](../type-aliases/production_orders_relDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Production_orders_rels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Production_orders_rels
const { count } = await prisma.production_orders_rel.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24155

Find the first Production_orders_rel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_orders_relFindFirstArgs`](../type-aliases/production_orders_relFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relFindFirstArgs`](../type-aliases/production_orders_relFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_orders_rel

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_orders_rel
const production_orders_rel = await prisma.production_orders_rel.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24171

Find the first Production_orders_rel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_orders_relFindFirstOrThrowArgs`](../type-aliases/production_orders_relFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relFindFirstOrThrowArgs`](../type-aliases/production_orders_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_orders_rel

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_orders_rel
const production_orders_rel = await prisma.production_orders_rel.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:24189

Find zero or more Production_orders_rels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_orders_relFindManyArgs`](../type-aliases/production_orders_relFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relFindManyArgs`](../type-aliases/production_orders_relFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Production_orders_rels
const production_orders_rels = await prisma.production_orders_rel.findMany()

// Get first 10 Production_orders_rels
const production_orders_rels = await prisma.production_orders_rel.findMany({ take: 10 })

// Only select the `id`
const production_orders_relWithIdOnly = await prisma.production_orders_rel.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24126

Find zero or one Production_orders_rel that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relFindUniqueArgs`](../type-aliases/production_orders_relFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relFindUniqueArgs`](../type-aliases/production_orders_relFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_orders_rel

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_orders_rel
const production_orders_rel = await prisma.production_orders_rel.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24140

Find one Production_orders_rel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relFindUniqueOrThrowArgs`](../type-aliases/production_orders_relFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relFindUniqueOrThrowArgs`](../type-aliases/production_orders_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_orders_rel

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_orders_rel
const production_orders_rel = await prisma.production_orders_rel.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetProduction_orders_relGroupByPayload`](../type-aliases/GetProduction_orders_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:24424

Group by Production_orders_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_orders_relGroupByArgs`](../type-aliases/production_orders_relGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`production_orders_relOrderByWithAggregationInput`](../type-aliases/production_orders_relOrderByWithAggregationInput.md) \| [`production_orders_relOrderByWithAggregationInput`](../type-aliases/production_orders_relOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`production_orders_relOrderByWithAggregationInput`](../type-aliases/production_orders_relOrderByWithAggregationInput.md) \| [`production_orders_relOrderByWithAggregationInput`](../type-aliases/production_orders_relOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"userId"` \| `"orderId"` \| `"wellId"` \| `"elementIndex"` \| `"updatedAt"` \| `"data"` \| `"creatorId"`

##### ByFields

`ByFields` *extends* [`Production_orders_relScalarFieldEnum`](../type-aliases/Production_orders_relScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof production\_orders\_relGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetProduction_orders_relGroupByPayload`](../type-aliases/GetProduction_orders_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24272

Update one Production_orders_rel.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relUpdateArgs`](../type-aliases/production_orders_relUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relUpdateArgs`](../type-aliases/production_orders_relUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Production_orders_rel.

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Production_orders_rel
const production_orders_rel = await prisma.production_orders_rel.update({
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

Defined in: generated/prisma/index.d.ts:24305

Update zero or more Production_orders_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_orders_relUpdateManyArgs`](../type-aliases/production_orders_relUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relUpdateManyArgs`](../type-aliases/production_orders_relUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Production_orders_rels
const production_orders_rel = await prisma.production_orders_rel.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:24335

Update zero or more Production_orders_rels and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relUpdateManyAndReturnArgs`](../type-aliases/production_orders_relUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relUpdateManyAndReturnArgs`](../type-aliases/production_orders_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Production_orders_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Production_orders_rels
const production_orders_rel = await prisma.production_orders_rel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Production_orders_rels and only return the `id`
const production_orders_relWithIdOnly = await prisma.production_orders_rel.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:24354

Create or update one Production_orders_rel.

#### Type Parameters

##### T

`T` *extends* [`production_orders_relUpsertArgs`](../type-aliases/production_orders_relUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_orders_relUpsertArgs`](../type-aliases/production_orders_relUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Production_orders_rel.

#### Returns

[`Prisma__production_orders_relClient`](Prisma__production_orders_relClient.md)\<`GetFindResult`\<[`$production_orders_relPayload`](../type-aliases/$production_orders_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Production_orders_rel
const production_orders_rel = await prisma.production_orders_rel.upsert({
  create: {
    // ... data to create a Production_orders_rel
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Production_orders_rel we want to update
  }
})
```
