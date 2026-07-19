[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / recycled\_production\_numbersDelegate

# Interface: recycled\_production\_numbersDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:25124

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`recycled_production_numbersFieldRefs`](recycled_production_numbersFieldRefs.md)

Defined in: generated/prisma/index.d.ts:25496

Fields of the recycled_production_numbers model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetRecycled_production_numbersAggregateType`](../type-aliases/GetRecycled_production_numbersAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:25415

Allows you to perform aggregations operations on a Recycled_production_numbers.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Recycled_production_numbersAggregateArgs`](../type-aliases/Recycled_production_numbersAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Recycled_production_numbersAggregateArgs`](../type-aliases/Recycled_production_numbersAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetRecycled_production_numbersAggregateType`](../type-aliases/GetRecycled_production_numbersAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Recycled\_production\_numbersCountAggregateOutputType ? Recycled\_production\_numbersCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:25381

Count the number of Recycled_production_numbers.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersCountArgs`](../type-aliases/recycled_production_numbersCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`recycled_production_numbersCountArgs`](../type-aliases/recycled_production_numbersCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Recycled_production_numbers to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Recycled\_production\_numbersCountAggregateOutputType ? Recycled\_production\_numbersCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Recycled_production_numbers
const count = await prisma.recycled_production_numbers.count({
    where: {
        // ... the filter for the Recycled_production_numbers we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25214

Create a Recycled_production_numbers.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersCreateArgs`](../type-aliases/recycled_production_numbersCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersCreateArgs`](../type-aliases/recycled_production_numbersCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Recycled_production_numbers.

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Recycled_production_numbers
const Recycled_production_numbers = await prisma.recycled_production_numbers.create({
    data: {
        // ... data to create a Recycled_production_numbers
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:25228

Create many Recycled_production_numbers.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersCreateManyArgs`](../type-aliases/recycled_production_numbersCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersCreateManyArgs`](../type-aliases/recycled_production_numbersCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Recycled_production_numbers.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:25252

Create many Recycled_production_numbers and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersCreateManyAndReturnArgs`](../type-aliases/recycled_production_numbersCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersCreateManyAndReturnArgs`](../type-aliases/recycled_production_numbersCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Recycled_production_numbers.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Recycled_production_numbers and only return the `userId`
const recycled_production_numbersWithUserIdOnly = await prisma.recycled_production_numbers.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25266

Delete a Recycled_production_numbers.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersDeleteArgs`](../type-aliases/recycled_production_numbersDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersDeleteArgs`](../type-aliases/recycled_production_numbersDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Recycled_production_numbers.

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Recycled_production_numbers
const Recycled_production_numbers = await prisma.recycled_production_numbers.delete({
    where: {
        // ... filter to delete one Recycled_production_numbers
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:25297

Delete zero or more Recycled_production_numbers.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersDeleteManyArgs`](../type-aliases/recycled_production_numbersDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersDeleteManyArgs`](../type-aliases/recycled_production_numbersDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Recycled_production_numbers to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Recycled_production_numbers
const { count } = await prisma.recycled_production_numbers.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25166

Find the first Recycled_production_numbers that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersFindFirstArgs`](../type-aliases/recycled_production_numbersFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersFindFirstArgs`](../type-aliases/recycled_production_numbersFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Recycled_production_numbers

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25182

Find the first Recycled_production_numbers that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersFindFirstOrThrowArgs`](../type-aliases/recycled_production_numbersFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersFindFirstOrThrowArgs`](../type-aliases/recycled_production_numbersFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Recycled_production_numbers

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:25200

Find zero or more Recycled_production_numbers that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersFindManyArgs`](../type-aliases/recycled_production_numbersFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersFindManyArgs`](../type-aliases/recycled_production_numbersFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.findMany();

// Get first 10 Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.findMany({ take: 10 });

// Only select the `userId`
const recycled_production_numbersWithUserIdOnly = await prisma.recycled_production_numbers.findMany(
    { select: { userId: true } }
);
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25137

Find zero or one Recycled_production_numbers that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersFindUniqueArgs`](../type-aliases/recycled_production_numbersFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersFindUniqueArgs`](../type-aliases/recycled_production_numbersFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Recycled_production_numbers

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25151

Find one Recycled_production_numbers that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersFindUniqueOrThrowArgs`](../type-aliases/recycled_production_numbersFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersFindUniqueOrThrowArgs`](../type-aliases/recycled_production_numbersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Recycled_production_numbers

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetRecycled_production_numbersGroupByPayload`](../type-aliases/GetRecycled_production_numbersGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:25435

Group by Recycled_production_numbers.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersGroupByArgs`](../type-aliases/recycled_production_numbersGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`recycled_production_numbersOrderByWithAggregationInput`](../type-aliases/recycled_production_numbersOrderByWithAggregationInput.md) \| [`recycled_production_numbersOrderByWithAggregationInput`](../type-aliases/recycled_production_numbersOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`recycled_production_numbersOrderByWithAggregationInput`](../type-aliases/recycled_production_numbersOrderByWithAggregationInput.md) \| [`recycled_production_numbersOrderByWithAggregationInput`](../type-aliases/recycled_production_numbersOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"userId"` \| `"year"` \| `"seqNumber"`

##### ByFields

`ByFields` _extends_ [`Recycled_production_numbersScalarFieldEnum`](../type-aliases/Recycled_production_numbersScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof recycled\_production\_numbersGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetRecycled_production_numbersGroupByPayload`](../type-aliases/GetRecycled_production_numbersGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25283

Update one Recycled_production_numbers.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersUpdateArgs`](../type-aliases/recycled_production_numbersUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersUpdateArgs`](../type-aliases/recycled_production_numbersUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Recycled_production_numbers.

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.update({
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

Defined in: generated/prisma/index.d.ts:25316

Update zero or more Recycled_production_numbers.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersUpdateManyArgs`](../type-aliases/recycled_production_numbersUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersUpdateManyArgs`](../type-aliases/recycled_production_numbersUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:25346

Update zero or more Recycled_production_numbers and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersUpdateManyAndReturnArgs`](../type-aliases/recycled_production_numbersUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersUpdateManyAndReturnArgs`](../type-aliases/recycled_production_numbersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Recycled_production_numbers.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Recycled_production_numbers and only return the `userId`
const recycled_production_numbersWithUserIdOnly = await prisma.recycled_production_numbers.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:25365

Create or update one Recycled_production_numbers.

#### Type Parameters

##### T

`T` _extends_ [`recycled_production_numbersUpsertArgs`](../type-aliases/recycled_production_numbersUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`recycled_production_numbersUpsertArgs`](../type-aliases/recycled_production_numbersUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Recycled_production_numbers.

#### Returns

[`Prisma__recycled_production_numbersClient`](Prisma__recycled_production_numbersClient.md)\<`GetFindResult`\<[`$recycled_production_numbersPayload`](../type-aliases/$recycled_production_numbersPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Recycled_production_numbers
const recycled_production_numbers = await prisma.recycled_production_numbers.upsert({
    create: {
        // ... data to create a Recycled_production_numbers
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Recycled_production_numbers we want to update
    }
});
```
