[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / orders\_rury\_relDelegate

# Interface: orders\_rury\_relDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:22032

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`orders_rury_relFieldRefs`](orders_rury_relFieldRefs.md)

Defined in: generated/prisma/index.d.ts:22404

Fields of the orders_rury_rel model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrders_rury_relAggregateType`](../type-aliases/GetOrders_rury_relAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:22323

Allows you to perform aggregations operations on a Orders_rury_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Orders_rury_relAggregateArgs`](../type-aliases/Orders_rury_relAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Orders_rury_relAggregateArgs`](../type-aliases/Orders_rury_relAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrders_rury_relAggregateType`](../type-aliases/GetOrders_rury_relAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Orders\_rury\_relCountAggregateOutputType ? Orders\_rury\_relCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:22289

Count the number of Orders_rury_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relCountArgs`](../type-aliases/orders_rury_relCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`orders_rury_relCountArgs`](../type-aliases/orders_rury_relCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Orders_rury_rels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Orders\_rury\_relCountAggregateOutputType ? Orders\_rury\_relCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Orders_rury_rels
const count = await prisma.orders_rury_rel.count({
  where: {
    // ... the filter for the Orders_rury_rels we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22122

Create a Orders_rury_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relCreateArgs`](../type-aliases/orders_rury_relCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relCreateArgs`](../type-aliases/orders_rury_relCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Orders_rury_rel.

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Orders_rury_rel
const Orders_rury_rel = await prisma.orders_rury_rel.create({
  data: {
    // ... data to create a Orders_rury_rel
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:22136

Create many Orders_rury_rels.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relCreateManyArgs`](../type-aliases/orders_rury_relCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relCreateManyArgs`](../type-aliases/orders_rury_relCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Orders_rury_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Orders_rury_rels
const orders_rury_rel = await prisma.orders_rury_rel.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:22160

Create many Orders_rury_rels and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relCreateManyAndReturnArgs`](../type-aliases/orders_rury_relCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relCreateManyAndReturnArgs`](../type-aliases/orders_rury_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Orders_rury_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Orders_rury_rels
const orders_rury_rel = await prisma.orders_rury_rel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Orders_rury_rels and only return the `id`
const orders_rury_relWithIdOnly = await prisma.orders_rury_rel.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22174

Delete a Orders_rury_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relDeleteArgs`](../type-aliases/orders_rury_relDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relDeleteArgs`](../type-aliases/orders_rury_relDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Orders_rury_rel.

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Orders_rury_rel
const Orders_rury_rel = await prisma.orders_rury_rel.delete({
  where: {
    // ... filter to delete one Orders_rury_rel
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:22205

Delete zero or more Orders_rury_rels.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relDeleteManyArgs`](../type-aliases/orders_rury_relDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relDeleteManyArgs`](../type-aliases/orders_rury_relDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Orders_rury_rels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Orders_rury_rels
const { count } = await prisma.orders_rury_rel.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22074

Find the first Orders_rury_rel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relFindFirstArgs`](../type-aliases/orders_rury_relFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relFindFirstArgs`](../type-aliases/orders_rury_relFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_rury_rel

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_rury_rel
const orders_rury_rel = await prisma.orders_rury_rel.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22090

Find the first Orders_rury_rel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relFindFirstOrThrowArgs`](../type-aliases/orders_rury_relFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relFindFirstOrThrowArgs`](../type-aliases/orders_rury_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_rury_rel

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_rury_rel
const orders_rury_rel = await prisma.orders_rury_rel.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:22108

Find zero or more Orders_rury_rels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relFindManyArgs`](../type-aliases/orders_rury_relFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relFindManyArgs`](../type-aliases/orders_rury_relFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Orders_rury_rels
const orders_rury_rels = await prisma.orders_rury_rel.findMany()

// Get first 10 Orders_rury_rels
const orders_rury_rels = await prisma.orders_rury_rel.findMany({ take: 10 })

// Only select the `id`
const orders_rury_relWithIdOnly = await prisma.orders_rury_rel.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22045

Find zero or one Orders_rury_rel that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relFindUniqueArgs`](../type-aliases/orders_rury_relFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relFindUniqueArgs`](../type-aliases/orders_rury_relFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_rury_rel

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_rury_rel
const orders_rury_rel = await prisma.orders_rury_rel.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22059

Find one Orders_rury_rel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relFindUniqueOrThrowArgs`](../type-aliases/orders_rury_relFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relFindUniqueOrThrowArgs`](../type-aliases/orders_rury_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Orders_rury_rel

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Orders_rury_rel
const orders_rury_rel = await prisma.orders_rury_rel.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetOrders_rury_relGroupByPayload`](../type-aliases/GetOrders_rury_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:22343

Group by Orders_rury_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relGroupByArgs`](../type-aliases/orders_rury_relGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`orders_rury_relOrderByWithAggregationInput`](../type-aliases/orders_rury_relOrderByWithAggregationInput.md) \| [`orders_rury_relOrderByWithAggregationInput`](../type-aliases/orders_rury_relOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`orders_rury_relOrderByWithAggregationInput`](../type-aliases/orders_rury_relOrderByWithAggregationInput.md) \| [`orders_rury_relOrderByWithAggregationInput`](../type-aliases/orders_rury_relOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"userId"` \| `"data"` \| `"status"` \| `"offerId"`

##### ByFields

`ByFields` *extends* [`Orders_rury_relScalarFieldEnum`](../type-aliases/Orders_rury_relScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof orders\_rury\_relGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetOrders_rury_relGroupByPayload`](../type-aliases/GetOrders_rury_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22191

Update one Orders_rury_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relUpdateArgs`](../type-aliases/orders_rury_relUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relUpdateArgs`](../type-aliases/orders_rury_relUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Orders_rury_rel.

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Orders_rury_rel
const orders_rury_rel = await prisma.orders_rury_rel.update({
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

Defined in: generated/prisma/index.d.ts:22224

Update zero or more Orders_rury_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relUpdateManyArgs`](../type-aliases/orders_rury_relUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relUpdateManyArgs`](../type-aliases/orders_rury_relUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Orders_rury_rels
const orders_rury_rel = await prisma.orders_rury_rel.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:22254

Update zero or more Orders_rury_rels and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relUpdateManyAndReturnArgs`](../type-aliases/orders_rury_relUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relUpdateManyAndReturnArgs`](../type-aliases/orders_rury_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Orders_rury_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Orders_rury_rels
const orders_rury_rel = await prisma.orders_rury_rel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Orders_rury_rels and only return the `id`
const orders_rury_relWithIdOnly = await prisma.orders_rury_rel.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:22273

Create or update one Orders_rury_rel.

#### Type Parameters

##### T

`T` *extends* [`orders_rury_relUpsertArgs`](../type-aliases/orders_rury_relUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`orders_rury_relUpsertArgs`](../type-aliases/orders_rury_relUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Orders_rury_rel.

#### Returns

[`Prisma__orders_rury_relClient`](Prisma__orders_rury_relClient.md)\<`GetFindResult`\<[`$orders_rury_relPayload`](../type-aliases/$orders_rury_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Orders_rury_rel
const orders_rury_rel = await prisma.orders_rury_rel.upsert({
  create: {
    // ... data to create a Orders_rury_rel
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Orders_rury_rel we want to update
  }
})
```
