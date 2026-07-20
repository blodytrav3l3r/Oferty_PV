[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_countersDelegate

# Interface: order\_countersDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:19018

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`order_countersFieldRefs`](order_countersFieldRefs.md)

Defined in: generated/prisma/index.d.ts:19390

Fields of the order_counters model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrder_countersAggregateType`](../type-aliases/GetOrder_countersAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:19309

Allows you to perform aggregations operations on a Order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Order_countersAggregateArgs`](../type-aliases/Order_countersAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Order_countersAggregateArgs`](../type-aliases/Order_countersAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrder_countersAggregateType`](../type-aliases/GetOrder_countersAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Order\_countersCountAggregateOutputType ? Order\_countersCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:19275

Count the number of Order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`order_countersCountArgs`](../type-aliases/order_countersCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`order_countersCountArgs`](../type-aliases/order_countersCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Order_counters to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Order\_countersCountAggregateOutputType ? Order\_countersCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Order_counters
const count = await prisma.order_counters.count({
  where: {
    // ... the filter for the Order_counters we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19108

Create a Order_counters.

#### Type Parameters

##### T

`T` *extends* [`order_countersCreateArgs`](../type-aliases/order_countersCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersCreateArgs`](../type-aliases/order_countersCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Order_counters.

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Order_counters
const Order_counters = await prisma.order_counters.create({
  data: {
    // ... data to create a Order_counters
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:19122

Create many Order_counters.

#### Type Parameters

##### T

`T` *extends* [`order_countersCreateManyArgs`](../type-aliases/order_countersCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersCreateManyArgs`](../type-aliases/order_countersCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Order_counters.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Order_counters
const order_counters = await prisma.order_counters.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:19146

Create many Order_counters and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`order_countersCreateManyAndReturnArgs`](../type-aliases/order_countersCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersCreateManyAndReturnArgs`](../type-aliases/order_countersCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Order_counters.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Order_counters
const order_counters = await prisma.order_counters.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Order_counters and only return the `userId`
const order_countersWithUserIdOnly = await prisma.order_counters.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19160

Delete a Order_counters.

#### Type Parameters

##### T

`T` *extends* [`order_countersDeleteArgs`](../type-aliases/order_countersDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersDeleteArgs`](../type-aliases/order_countersDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Order_counters.

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Order_counters
const Order_counters = await prisma.order_counters.delete({
  where: {
    // ... filter to delete one Order_counters
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:19191

Delete zero or more Order_counters.

#### Type Parameters

##### T

`T` *extends* [`order_countersDeleteManyArgs`](../type-aliases/order_countersDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersDeleteManyArgs`](../type-aliases/order_countersDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Order_counters to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Order_counters
const { count } = await prisma.order_counters.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19060

Find the first Order_counters that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`order_countersFindFirstArgs`](../type-aliases/order_countersFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersFindFirstArgs`](../type-aliases/order_countersFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters
const order_counters = await prisma.order_counters.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19076

Find the first Order_counters that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`order_countersFindFirstOrThrowArgs`](../type-aliases/order_countersFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersFindFirstOrThrowArgs`](../type-aliases/order_countersFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters
const order_counters = await prisma.order_counters.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:19094

Find zero or more Order_counters that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`order_countersFindManyArgs`](../type-aliases/order_countersFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersFindManyArgs`](../type-aliases/order_countersFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Order_counters
const order_counters = await prisma.order_counters.findMany()

// Get first 10 Order_counters
const order_counters = await prisma.order_counters.findMany({ take: 10 })

// Only select the `userId`
const order_countersWithUserIdOnly = await prisma.order_counters.findMany({ select: { userId: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19031

Find zero or one Order_counters that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`order_countersFindUniqueArgs`](../type-aliases/order_countersFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersFindUniqueArgs`](../type-aliases/order_countersFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters
const order_counters = await prisma.order_counters.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19045

Find one Order_counters that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`order_countersFindUniqueOrThrowArgs`](../type-aliases/order_countersFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersFindUniqueOrThrowArgs`](../type-aliases/order_countersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters
const order_counters = await prisma.order_counters.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetOrder_countersGroupByPayload`](../type-aliases/GetOrder_countersGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:19329

Group by Order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`order_countersGroupByArgs`](../type-aliases/order_countersGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`order_countersOrderByWithAggregationInput`](../type-aliases/order_countersOrderByWithAggregationInput.md) \| [`order_countersOrderByWithAggregationInput`](../type-aliases/order_countersOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`order_countersOrderByWithAggregationInput`](../type-aliases/order_countersOrderByWithAggregationInput.md) \| [`order_countersOrderByWithAggregationInput`](../type-aliases/order_countersOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"userId"` \| `"year"` \| `"lastNumber"`

##### ByFields

`ByFields` *extends* [`Order_countersScalarFieldEnum`](../type-aliases/Order_countersScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof order\_countersGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetOrder_countersGroupByPayload`](../type-aliases/GetOrder_countersGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19177

Update one Order_counters.

#### Type Parameters

##### T

`T` *extends* [`order_countersUpdateArgs`](../type-aliases/order_countersUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersUpdateArgs`](../type-aliases/order_countersUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Order_counters.

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Order_counters
const order_counters = await prisma.order_counters.update({
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

Defined in: generated/prisma/index.d.ts:19210

Update zero or more Order_counters.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`order_countersUpdateManyArgs`](../type-aliases/order_countersUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersUpdateManyArgs`](../type-aliases/order_countersUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Order_counters
const order_counters = await prisma.order_counters.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:19240

Update zero or more Order_counters and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`order_countersUpdateManyAndReturnArgs`](../type-aliases/order_countersUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersUpdateManyAndReturnArgs`](../type-aliases/order_countersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Order_counters.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Order_counters
const order_counters = await prisma.order_counters.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Order_counters and only return the `userId`
const order_countersWithUserIdOnly = await prisma.order_counters.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:19259

Create or update one Order_counters.

#### Type Parameters

##### T

`T` *extends* [`order_countersUpsertArgs`](../type-aliases/order_countersUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_countersUpsertArgs`](../type-aliases/order_countersUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Order_counters.

#### Returns

[`Prisma__order_countersClient`](Prisma__order_countersClient.md)\<`GetFindResult`\<[`$order_countersPayload`](../type-aliases/$order_countersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Order_counters
const order_counters = await prisma.order_counters.upsert({
  create: {
    // ... data to create a Order_counters
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Order_counters we want to update
  }
})
```
