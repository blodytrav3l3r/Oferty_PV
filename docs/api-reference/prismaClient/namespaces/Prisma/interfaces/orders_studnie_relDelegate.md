[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / orders\_studnie\_relDelegate

# Interface: orders\_studnie\_relDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:21026

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`orders_studnie_relFieldRefs`](orders_studnie_relFieldRefs.md)

Defined in: generated/prisma/index.d.ts:21398

Fields of the orders_studnie_rel model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrders_studnie_relAggregateType`](../type-aliases/GetOrders_studnie_relAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:21317

Allows you to perform aggregations operations on a Orders_studnie_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Orders_studnie_relAggregateArgs`](../type-aliases/Orders_studnie_relAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Orders_studnie_relAggregateArgs`](../type-aliases/Orders_studnie_relAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrders_studnie_relAggregateType`](../type-aliases/GetOrders_studnie_relAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Orders\_studnie\_relCountAggregateOutputType ? Orders\_studnie\_relCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:21283

Count the number of Orders_studnie_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relCountArgs`](../type-aliases/orders_studnie_relCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`orders_studnie_relCountArgs`](../type-aliases/orders_studnie_relCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Orders_studnie_rels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Orders\_studnie\_relCountAggregateOutputType ? Orders\_studnie\_relCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Orders_studnie_rels
const count = await prisma.orders_studnie_rel.count({
  where: {
    // ... the filter for the Orders_studnie_rels we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21116

Create a Orders_studnie_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relCreateArgs`](../type-aliases/orders_studnie_relCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relCreateArgs`](../type-aliases/orders_studnie_relCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Orders_studnie_rel.

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Orders_studnie_rel
const Orders_studnie_rel = await prisma.orders_studnie_rel.create({
  data: {
    // ... data to create a Orders_studnie_rel
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:21130

Create many Orders_studnie_rels.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relCreateManyArgs`](../type-aliases/orders_studnie_relCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relCreateManyArgs`](../type-aliases/orders_studnie_relCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Orders_studnie_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Orders_studnie_rels
const orders_studnie_rel = await prisma.orders_studnie_rel.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:21154

Create many Orders_studnie_rels and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relCreateManyAndReturnArgs`](../type-aliases/orders_studnie_relCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relCreateManyAndReturnArgs`](../type-aliases/orders_studnie_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Orders_studnie_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Orders_studnie_rels
const orders_studnie_rel = await prisma.orders_studnie_rel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Orders_studnie_rels and only return the `id`
const orders_studnie_relWithIdOnly = await prisma.orders_studnie_rel.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21168

Delete a Orders_studnie_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relDeleteArgs`](../type-aliases/orders_studnie_relDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relDeleteArgs`](../type-aliases/orders_studnie_relDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Orders_studnie_rel.

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Orders_studnie_rel
const Orders_studnie_rel = await prisma.orders_studnie_rel.delete({
  where: {
    // ... filter to delete one Orders_studnie_rel
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:21199

Delete zero or more Orders_studnie_rels.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relDeleteManyArgs`](../type-aliases/orders_studnie_relDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relDeleteManyArgs`](../type-aliases/orders_studnie_relDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Orders_studnie_rels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Orders_studnie_rels
const { count } = await prisma.orders_studnie_rel.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21068

Find the first Orders_studnie_rel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relFindFirstArgs`](../type-aliases/orders_studnie_relFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relFindFirstArgs`](../type-aliases/orders_studnie_relFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_studnie_rel

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_studnie_rel
const orders_studnie_rel = await prisma.orders_studnie_rel.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21084

Find the first Orders_studnie_rel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relFindFirstOrThrowArgs`](../type-aliases/orders_studnie_relFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relFindFirstOrThrowArgs`](../type-aliases/orders_studnie_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_studnie_rel

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_studnie_rel
const orders_studnie_rel = await prisma.orders_studnie_rel.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:21102

Find zero or more Orders_studnie_rels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relFindManyArgs`](../type-aliases/orders_studnie_relFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relFindManyArgs`](../type-aliases/orders_studnie_relFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Orders_studnie_rels
const orders_studnie_rels = await prisma.orders_studnie_rel.findMany()

// Get first 10 Orders_studnie_rels
const orders_studnie_rels = await prisma.orders_studnie_rel.findMany({ take: 10 })

// Only select the `id`
const orders_studnie_relWithIdOnly = await prisma.orders_studnie_rel.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21039

Find zero or one Orders_studnie_rel that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relFindUniqueArgs`](../type-aliases/orders_studnie_relFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relFindUniqueArgs`](../type-aliases/orders_studnie_relFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_studnie_rel

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_studnie_rel
const orders_studnie_rel = await prisma.orders_studnie_rel.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21053

Find one Orders_studnie_rel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relFindUniqueOrThrowArgs`](../type-aliases/orders_studnie_relFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relFindUniqueOrThrowArgs`](../type-aliases/orders_studnie_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_studnie_rel

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_studnie_rel
const orders_studnie_rel = await prisma.orders_studnie_rel.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetOrders_studnie_relGroupByPayload`](../type-aliases/GetOrders_studnie_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:21337

Group by Orders_studnie_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relGroupByArgs`](../type-aliases/orders_studnie_relGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`orders_studnie_relOrderByWithAggregationInput`](../type-aliases/orders_studnie_relOrderByWithAggregationInput.md) \| [`orders_studnie_relOrderByWithAggregationInput`](../type-aliases/orders_studnie_relOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`orders_studnie_relOrderByWithAggregationInput`](../type-aliases/orders_studnie_relOrderByWithAggregationInput.md) \| [`orders_studnie_relOrderByWithAggregationInput`](../type-aliases/orders_studnie_relOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"userId"` \| `"data"` \| `"status"` \| `"offerStudnieId"`

##### ByFields

`ByFields` *extends* [`Orders_studnie_relScalarFieldEnum`](../type-aliases/Orders_studnie_relScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof orders\_studnie\_relGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetOrders_studnie_relGroupByPayload`](../type-aliases/GetOrders_studnie_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21185

Update one Orders_studnie_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relUpdateArgs`](../type-aliases/orders_studnie_relUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relUpdateArgs`](../type-aliases/orders_studnie_relUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Orders_studnie_rel.

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Orders_studnie_rel
const orders_studnie_rel = await prisma.orders_studnie_rel.update({
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

Defined in: generated/prisma/index.d.ts:21218

Update zero or more Orders_studnie_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relUpdateManyArgs`](../type-aliases/orders_studnie_relUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relUpdateManyArgs`](../type-aliases/orders_studnie_relUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Orders_studnie_rels
const orders_studnie_rel = await prisma.orders_studnie_rel.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:21248

Update zero or more Orders_studnie_rels and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relUpdateManyAndReturnArgs`](../type-aliases/orders_studnie_relUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relUpdateManyAndReturnArgs`](../type-aliases/orders_studnie_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Orders_studnie_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Orders_studnie_rels
const orders_studnie_rel = await prisma.orders_studnie_rel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Orders_studnie_rels and only return the `id`
const orders_studnie_relWithIdOnly = await prisma.orders_studnie_rel.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:21267

Create or update one Orders_studnie_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_studnie_relUpsertArgs`](../type-aliases/orders_studnie_relUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_studnie_relUpsertArgs`](../type-aliases/orders_studnie_relUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Orders_studnie_rel.

#### Returns

[`Prisma__orders_studnie_relClient`](Prisma__orders_studnie_relClient.md)\<`GetFindResult`\<[`$orders_studnie_relPayload`](../type-aliases/$orders_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Orders_studnie_rel
const orders_studnie_rel = await prisma.orders_studnie_rel.upsert({
  create: {
    // ... data to create a Orders_studnie_rel
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Orders_studnie_rel we want to update
  }
})
```
