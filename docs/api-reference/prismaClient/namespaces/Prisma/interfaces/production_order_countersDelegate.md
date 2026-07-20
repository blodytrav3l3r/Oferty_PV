[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_order\_countersDelegate

# Interface: production\_order\_countersDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:23040

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`production_order_countersFieldRefs`](production_order_countersFieldRefs.md)

Defined in: generated/prisma/index.d.ts:23412

Fields of the production_order_counters model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProduction_order_countersAggregateType`](../type-aliases/GetProduction_order_countersAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:23331

Allows you to perform aggregations operations on a Production_order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Production_order_countersAggregateArgs`](../type-aliases/Production_order_countersAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Production_order_countersAggregateArgs`](../type-aliases/Production_order_countersAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProduction_order_countersAggregateType`](../type-aliases/GetProduction_order_countersAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Production\_order\_countersCountAggregateOutputType ? Production\_order\_countersCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:23297

Count the number of Production_order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_order_countersCountArgs`](../type-aliases/production_order_countersCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`production_order_countersCountArgs`](../type-aliases/production_order_countersCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Production_order_counters to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Production\_order\_countersCountAggregateOutputType ? Production\_order\_countersCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Production_order_counters
const count = await prisma.production_order_counters.count({
  where: {
    // ... the filter for the Production_order_counters we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23130

Create a Production_order_counters.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersCreateArgs`](../type-aliases/production_order_countersCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersCreateArgs`](../type-aliases/production_order_countersCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Production_order_counters.

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Production_order_counters
const Production_order_counters = await prisma.production_order_counters.create({
  data: {
    // ... data to create a Production_order_counters
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:23144

Create many Production_order_counters.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersCreateManyArgs`](../type-aliases/production_order_countersCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersCreateManyArgs`](../type-aliases/production_order_countersCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Production_order_counters.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Production_order_counters
const production_order_counters = await prisma.production_order_counters.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:23168

Create many Production_order_counters and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersCreateManyAndReturnArgs`](../type-aliases/production_order_countersCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersCreateManyAndReturnArgs`](../type-aliases/production_order_countersCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Production_order_counters.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Production_order_counters
const production_order_counters = await prisma.production_order_counters.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Production_order_counters and only return the `userId`
const production_order_countersWithUserIdOnly = await prisma.production_order_counters.createManyAndReturn({
  select: { userId: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

***

### delete()

> **delete**\<`T`\>(`args`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23182

Delete a Production_order_counters.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersDeleteArgs`](../type-aliases/production_order_countersDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersDeleteArgs`](../type-aliases/production_order_countersDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Production_order_counters.

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Production_order_counters
const Production_order_counters = await prisma.production_order_counters.delete({
  where: {
    // ... filter to delete one Production_order_counters
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:23213

Delete zero or more Production_order_counters.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersDeleteManyArgs`](../type-aliases/production_order_countersDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersDeleteManyArgs`](../type-aliases/production_order_countersDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Production_order_counters to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Production_order_counters
const { count } = await prisma.production_order_counters.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23082

Find the first Production_order_counters that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_order_countersFindFirstArgs`](../type-aliases/production_order_countersFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersFindFirstArgs`](../type-aliases/production_order_countersFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_order_counters

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_order_counters
const production_order_counters = await prisma.production_order_counters.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23098

Find the first Production_order_counters that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_order_countersFindFirstOrThrowArgs`](../type-aliases/production_order_countersFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersFindFirstOrThrowArgs`](../type-aliases/production_order_countersFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_order_counters

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_order_counters
const production_order_counters = await prisma.production_order_counters.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:23116

Find zero or more Production_order_counters that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_order_countersFindManyArgs`](../type-aliases/production_order_countersFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersFindManyArgs`](../type-aliases/production_order_countersFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Production_order_counters
const production_order_counters = await prisma.production_order_counters.findMany()

// Get first 10 Production_order_counters
const production_order_counters = await prisma.production_order_counters.findMany({ take: 10 })

// Only select the `userId`
const production_order_countersWithUserIdOnly = await prisma.production_order_counters.findMany({ select: { userId: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23053

Find zero or one Production_order_counters that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersFindUniqueArgs`](../type-aliases/production_order_countersFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersFindUniqueArgs`](../type-aliases/production_order_countersFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_order_counters

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_order_counters
const production_order_counters = await prisma.production_order_counters.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23067

Find one Production_order_counters that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersFindUniqueOrThrowArgs`](../type-aliases/production_order_countersFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersFindUniqueOrThrowArgs`](../type-aliases/production_order_countersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Production_order_counters

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Production_order_counters
const production_order_counters = await prisma.production_order_counters.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetProduction_order_countersGroupByPayload`](../type-aliases/GetProduction_order_countersGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:23351

Group by Production_order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_order_countersGroupByArgs`](../type-aliases/production_order_countersGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`production_order_countersOrderByWithAggregationInput`](../type-aliases/production_order_countersOrderByWithAggregationInput.md) \| [`production_order_countersOrderByWithAggregationInput`](../type-aliases/production_order_countersOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`production_order_countersOrderByWithAggregationInput`](../type-aliases/production_order_countersOrderByWithAggregationInput.md) \| [`production_order_countersOrderByWithAggregationInput`](../type-aliases/production_order_countersOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"userId"` \| `"year"` \| `"lastNumber"`

##### ByFields

`ByFields` *extends* [`Production_order_countersScalarFieldEnum`](../type-aliases/Production_order_countersScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof production\_order\_countersGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetProduction_order_countersGroupByPayload`](../type-aliases/GetProduction_order_countersGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23199

Update one Production_order_counters.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersUpdateArgs`](../type-aliases/production_order_countersUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersUpdateArgs`](../type-aliases/production_order_countersUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Production_order_counters.

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Production_order_counters
const production_order_counters = await prisma.production_order_counters.update({
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

Defined in: generated/prisma/index.d.ts:23232

Update zero or more Production_order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`production_order_countersUpdateManyArgs`](../type-aliases/production_order_countersUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersUpdateManyArgs`](../type-aliases/production_order_countersUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Production_order_counters
const production_order_counters = await prisma.production_order_counters.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:23262

Update zero or more Production_order_counters and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersUpdateManyAndReturnArgs`](../type-aliases/production_order_countersUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersUpdateManyAndReturnArgs`](../type-aliases/production_order_countersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Production_order_counters.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Production_order_counters
const production_order_counters = await prisma.production_order_counters.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Production_order_counters and only return the `userId`
const production_order_countersWithUserIdOnly = await prisma.production_order_counters.updateManyAndReturn({
  select: { userId: true },
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

> **upsert**\<`T`\>(`args`): [`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:23281

Create or update one Production_order_counters.

#### Type Parameters

##### T

`T` *extends* [`production_order_countersUpsertArgs`](../type-aliases/production_order_countersUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`production_order_countersUpsertArgs`](../type-aliases/production_order_countersUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Production_order_counters.

#### Returns

[`Prisma__production_order_countersClient`](Prisma__production_order_countersClient.md)\<`GetFindResult`\<[`$production_order_countersPayload`](../type-aliases/$production_order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Production_order_counters
const production_order_counters = await prisma.production_order_counters.upsert({
  create: {
    // ... data to create a Production_order_counters
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Production_order_counters we want to update
  }
})
```
