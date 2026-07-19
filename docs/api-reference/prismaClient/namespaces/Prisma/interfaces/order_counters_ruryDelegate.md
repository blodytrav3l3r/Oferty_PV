[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / order\_counters\_ruryDelegate

# Interface: order\_counters\_ruryDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:20023

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`order_counters_ruryFieldRefs`](order_counters_ruryFieldRefs.md)

Defined in: generated/prisma/index.d.ts:20395

Fields of the order_counters_rury model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrder_counters_ruryAggregateType`](../type-aliases/GetOrder_counters_ruryAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:20314

Allows you to perform aggregations operations on a Order_counters_rury.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Order_counters_ruryAggregateArgs`](../type-aliases/Order_counters_ruryAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Order_counters_ruryAggregateArgs`](../type-aliases/Order_counters_ruryAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOrder_counters_ruryAggregateType`](../type-aliases/GetOrder_counters_ruryAggregateType.md)\<`T`\>\>

#### Example

```ts
// Ordered by age ascending
// Where email contains prisma.io
// Limited to the 10 users
const aggregations = await prisma.user.aggregate({
    _avg: {
        age: true
    },
    where: {
        email: {
            contains: 'prisma.io'
        }
    },
    orderBy: {
        age: 'asc'
    },
    take: 10
});
```

---

### count()

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Order\_counters\_ruryCountAggregateOutputType ? Order\_counters\_ruryCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:20280

Count the number of Order_counters_ruries.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryCountArgs`](../type-aliases/order_counters_ruryCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`order_counters_ruryCountArgs`](../type-aliases/order_counters_ruryCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Order_counters_ruries to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Order\_counters\_ruryCountAggregateOutputType ? Order\_counters\_ruryCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Order_counters_ruries
const count = await prisma.order_counters_rury.count({
    where: {
        // ... the filter for the Order_counters_ruries we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20113

Create a Order_counters_rury.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryCreateArgs`](../type-aliases/order_counters_ruryCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryCreateArgs`](../type-aliases/order_counters_ruryCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Order_counters_rury.

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Order_counters_rury
const Order_counters_rury = await prisma.order_counters_rury.create({
    data: {
        // ... data to create a Order_counters_rury
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:20127

Create many Order_counters_ruries.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryCreateManyArgs`](../type-aliases/order_counters_ruryCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryCreateManyArgs`](../type-aliases/order_counters_ruryCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Order_counters_ruries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Order_counters_ruries
const order_counters_rury = await prisma.order_counters_rury.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:20151

Create many Order_counters_ruries and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryCreateManyAndReturnArgs`](../type-aliases/order_counters_ruryCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryCreateManyAndReturnArgs`](../type-aliases/order_counters_ruryCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Order_counters_ruries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Order_counters_ruries
const order_counters_rury = await prisma.order_counters_rury.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Order_counters_ruries and only return the `userId`
const order_counters_ruryWithUserIdOnly = await prisma.order_counters_rury.createManyAndReturn({
  select: { userId: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

---

### delete()

> **delete**\<`T`>\>(`args`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20165

Delete a Order_counters_rury.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryDeleteArgs`](../type-aliases/order_counters_ruryDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryDeleteArgs`](../type-aliases/order_counters_ruryDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Order_counters_rury.

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Order_counters_rury
const Order_counters_rury = await prisma.order_counters_rury.delete({
    where: {
        // ... filter to delete one Order_counters_rury
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:20196

Delete zero or more Order_counters_ruries.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryDeleteManyArgs`](../type-aliases/order_counters_ruryDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryDeleteManyArgs`](../type-aliases/order_counters_ruryDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Order_counters_ruries to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Order_counters_ruries
const { count } = await prisma.order_counters_rury.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20065

Find the first Order_counters_rury that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryFindFirstArgs`](../type-aliases/order_counters_ruryFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryFindFirstArgs`](../type-aliases/order_counters_ruryFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters_rury

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters_rury
const order_counters_rury = await prisma.order_counters_rury.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20081

Find the first Order_counters_rury that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryFindFirstOrThrowArgs`](../type-aliases/order_counters_ruryFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryFindFirstOrThrowArgs`](../type-aliases/order_counters_ruryFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters_rury

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters_rury
const order_counters_rury = await prisma.order_counters_rury.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:20099

Find zero or more Order_counters_ruries that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryFindManyArgs`](../type-aliases/order_counters_ruryFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryFindManyArgs`](../type-aliases/order_counters_ruryFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Order_counters_ruries
const order_counters_ruries = await prisma.order_counters_rury.findMany();

// Get first 10 Order_counters_ruries
const order_counters_ruries = await prisma.order_counters_rury.findMany({ take: 10 });

// Only select the `userId`
const order_counters_ruryWithUserIdOnly = await prisma.order_counters_rury.findMany({
    select: { userId: true }
});
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20036

Find zero or one Order_counters_rury that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryFindUniqueArgs`](../type-aliases/order_counters_ruryFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryFindUniqueArgs`](../type-aliases/order_counters_ruryFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters_rury

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters_rury
const order_counters_rury = await prisma.order_counters_rury.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20050

Find one Order_counters_rury that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryFindUniqueOrThrowArgs`](../type-aliases/order_counters_ruryFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryFindUniqueOrThrowArgs`](../type-aliases/order_counters_ruryFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Order_counters_rury

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Order_counters_rury
const order_counters_rury = await prisma.order_counters_rury.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetOrder_counters_ruryGroupByPayload`](../type-aliases/GetOrder_counters_ruryGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:20334

Group by Order_counters_rury.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryGroupByArgs`](../type-aliases/order_counters_ruryGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`order_counters_ruryOrderByWithAggregationInput`](../type-aliases/order_counters_ruryOrderByWithAggregationInput.md) \| [`order_counters_ruryOrderByWithAggregationInput`](../type-aliases/order_counters_ruryOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`order_counters_ruryOrderByWithAggregationInput`](../type-aliases/order_counters_ruryOrderByWithAggregationInput.md) \| [`order_counters_ruryOrderByWithAggregationInput`](../type-aliases/order_counters_ruryOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"userId"` \| `"year"` \| `"lastNumber"`

##### ByFields

`ByFields` _extends_ [`Order_counters_ruryScalarFieldEnum`](../type-aliases/Order_counters_ruryScalarFieldEnum.md)

##### ByValid

`ByValid` _extends_ `0` \| `1`

##### HavingFields

`HavingFields` _extends_ `string` \| `number` \| `symbol`

##### HavingValid

`HavingValid`

##### ByEmpty

`ByEmpty` _extends_ `0` \| `1`

##### InputErrors

`InputErrors`

#### Parameters

##### args

\{ \[key in string \| number \| symbol\]: key extends keyof order\_counters\_ruryGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetOrder_counters_ruryGroupByPayload`](../type-aliases/GetOrder_counters_ruryGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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
    }
});
```

---

### update()

> **update**\<`T`>\>(`args`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20182

Update one Order_counters_rury.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryUpdateArgs`](../type-aliases/order_counters_ruryUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryUpdateArgs`](../type-aliases/order_counters_ruryUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Order_counters_rury.

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Order_counters_rury
const order_counters_rury = await prisma.order_counters_rury.update({
    where: {
        // ... provide filter here
    },
    data: {
        // ... provide data here
    }
});
```

---

### updateMany()

> **updateMany**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:20215

Update zero or more Order_counters_ruries.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryUpdateManyArgs`](../type-aliases/order_counters_ruryUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryUpdateManyArgs`](../type-aliases/order_counters_ruryUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Order_counters_ruries
const order_counters_rury = await prisma.order_counters_rury.updateMany({
    where: {
        // ... provide filter here
    },
    data: {
        // ... provide data here
    }
});
```

---

### updateManyAndReturn()

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:20245

Update zero or more Order_counters_ruries and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryUpdateManyAndReturnArgs`](../type-aliases/order_counters_ruryUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryUpdateManyAndReturnArgs`](../type-aliases/order_counters_ruryUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Order_counters_ruries.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Order_counters_ruries
const order_counters_rury = await prisma.order_counters_rury.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Order_counters_ruries and only return the `userId`
const order_counters_ruryWithUserIdOnly = await prisma.order_counters_rury.updateManyAndReturn({
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

---

### upsert()

> **upsert**\<`T`>\>(`args`): [`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:20264

Create or update one Order_counters_rury.

#### Type Parameters

##### T

`T` _extends_ [`order_counters_ruryUpsertArgs`](../type-aliases/order_counters_ruryUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`order_counters_ruryUpsertArgs`](../type-aliases/order_counters_ruryUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Order_counters_rury.

#### Returns

[`Prisma__order_counters_ruryClient`](Prisma__order_counters_ruryClient.md)\<`GetFindResult`\<[`$order_counters_ruryPayload`](../type-aliases/$order_counters_ruryPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Order_counters_rury
const order_counters_rury = await prisma.order_counters_rury.upsert({
    create: {
        // ... data to create a Order_counters_rury
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Order_counters_rury we want to update
    }
});
```
