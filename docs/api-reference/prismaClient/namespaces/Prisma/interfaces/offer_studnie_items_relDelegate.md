[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offer\_studnie\_items\_relDelegate

# Interface: offer\_studnie\_items\_relDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:15747

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`offer_studnie_items_relFieldRefs`](offer_studnie_items_relFieldRefs.md)

Defined in: generated/prisma/index.d.ts:16119

Fields of the offer_studnie_items_rel model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOffer_studnie_items_relAggregateType`](../type-aliases/GetOffer_studnie_items_relAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:16038

Allows you to perform aggregations operations on a Offer_studnie_items_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Offer_studnie_items_relAggregateArgs`](../type-aliases/Offer_studnie_items_relAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Offer_studnie_items_relAggregateArgs`](../type-aliases/Offer_studnie_items_relAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOffer_studnie_items_relAggregateType`](../type-aliases/GetOffer_studnie_items_relAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Offer\_studnie\_items\_relCountAggregateOutputType ? Offer\_studnie\_items\_relCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:16004

Count the number of Offer_studnie_items_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relCountArgs`](../type-aliases/offer_studnie_items_relCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`offer_studnie_items_relCountArgs`](../type-aliases/offer_studnie_items_relCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Offer_studnie_items_rels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Offer\_studnie\_items\_relCountAggregateOutputType ? Offer\_studnie\_items\_relCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Offer_studnie_items_rels
const count = await prisma.offer_studnie_items_rel.count({
    where: {
        // ... the filter for the Offer_studnie_items_rels we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15837

Create a Offer_studnie_items_rel.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relCreateArgs`](../type-aliases/offer_studnie_items_relCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relCreateArgs`](../type-aliases/offer_studnie_items_relCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Offer_studnie_items_rel.

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Offer_studnie_items_rel
const Offer_studnie_items_rel = await prisma.offer_studnie_items_rel.create({
    data: {
        // ... data to create a Offer_studnie_items_rel
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:15851

Create many Offer_studnie_items_rels.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relCreateManyArgs`](../type-aliases/offer_studnie_items_relCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relCreateManyArgs`](../type-aliases/offer_studnie_items_relCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Offer_studnie_items_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Offer_studnie_items_rels
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:15875

Create many Offer_studnie_items_rels and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relCreateManyAndReturnArgs`](../type-aliases/offer_studnie_items_relCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relCreateManyAndReturnArgs`](../type-aliases/offer_studnie_items_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Offer_studnie_items_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Offer_studnie_items_rels
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Offer_studnie_items_rels and only return the `id`
const offer_studnie_items_relWithIdOnly = await prisma.offer_studnie_items_rel.createManyAndReturn({
  select: { id: true },
  data: [
    // ... provide data here
  ]
})
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined
```

---

### delete()

> **delete**\<`T`>\>(`args`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15889

Delete a Offer_studnie_items_rel.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relDeleteArgs`](../type-aliases/offer_studnie_items_relDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relDeleteArgs`](../type-aliases/offer_studnie_items_relDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Offer_studnie_items_rel.

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Offer_studnie_items_rel
const Offer_studnie_items_rel = await prisma.offer_studnie_items_rel.delete({
    where: {
        // ... filter to delete one Offer_studnie_items_rel
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:15920

Delete zero or more Offer_studnie_items_rels.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relDeleteManyArgs`](../type-aliases/offer_studnie_items_relDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relDeleteManyArgs`](../type-aliases/offer_studnie_items_relDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Offer_studnie_items_rels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Offer_studnie_items_rels
const { count } = await prisma.offer_studnie_items_rel.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15789

Find the first Offer_studnie_items_rel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relFindFirstArgs`](../type-aliases/offer_studnie_items_relFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relFindFirstArgs`](../type-aliases/offer_studnie_items_relFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offer_studnie_items_rel

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offer_studnie_items_rel
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15805

Find the first Offer_studnie_items_rel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relFindFirstOrThrowArgs`](../type-aliases/offer_studnie_items_relFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relFindFirstOrThrowArgs`](../type-aliases/offer_studnie_items_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offer_studnie_items_rel

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offer_studnie_items_rel
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:15823

Find zero or more Offer_studnie_items_rels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relFindManyArgs`](../type-aliases/offer_studnie_items_relFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relFindManyArgs`](../type-aliases/offer_studnie_items_relFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Offer_studnie_items_rels
const offer_studnie_items_rels = await prisma.offer_studnie_items_rel.findMany();

// Get first 10 Offer_studnie_items_rels
const offer_studnie_items_rels = await prisma.offer_studnie_items_rel.findMany({ take: 10 });

// Only select the `id`
const offer_studnie_items_relWithIdOnly = await prisma.offer_studnie_items_rel.findMany({
    select: { id: true }
});
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15760

Find zero or one Offer_studnie_items_rel that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relFindUniqueArgs`](../type-aliases/offer_studnie_items_relFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relFindUniqueArgs`](../type-aliases/offer_studnie_items_relFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offer_studnie_items_rel

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offer_studnie_items_rel
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15774

Find one Offer_studnie_items_rel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relFindUniqueOrThrowArgs`](../type-aliases/offer_studnie_items_relFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relFindUniqueOrThrowArgs`](../type-aliases/offer_studnie_items_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offer_studnie_items_rel

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offer_studnie_items_rel
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetOffer_studnie_items_relGroupByPayload`](../type-aliases/GetOffer_studnie_items_relGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:16058

Group by Offer_studnie_items_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relGroupByArgs`](../type-aliases/offer_studnie_items_relGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`offer_studnie_items_relOrderByWithAggregationInput`](../type-aliases/offer_studnie_items_relOrderByWithAggregationInput.md) \| [`offer_studnie_items_relOrderByWithAggregationInput`](../type-aliases/offer_studnie_items_relOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`offer_studnie_items_relOrderByWithAggregationInput`](../type-aliases/offer_studnie_items_relOrderByWithAggregationInput.md) \| [`offer_studnie_items_relOrderByWithAggregationInput`](../type-aliases/offer_studnie_items_relOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"price"` \| `"productId"` \| `"quantity"` \| `"discount"` \| `"offerId"` \| `"dodatkowe_info"`

##### ByFields

`ByFields` _extends_ [`Offer_studnie_items_relScalarFieldEnum`](../type-aliases/Offer_studnie_items_relScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof offer\_studnie\_items\_relGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetOffer_studnie_items_relGroupByPayload`](../type-aliases/GetOffer_studnie_items_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15906

Update one Offer_studnie_items_rel.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relUpdateArgs`](../type-aliases/offer_studnie_items_relUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relUpdateArgs`](../type-aliases/offer_studnie_items_relUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Offer_studnie_items_rel.

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Offer_studnie_items_rel
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.update({
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

Defined in: generated/prisma/index.d.ts:15939

Update zero or more Offer_studnie_items_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relUpdateManyArgs`](../type-aliases/offer_studnie_items_relUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relUpdateManyArgs`](../type-aliases/offer_studnie_items_relUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Offer_studnie_items_rels
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:15969

Update zero or more Offer_studnie_items_rels and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relUpdateManyAndReturnArgs`](../type-aliases/offer_studnie_items_relUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relUpdateManyAndReturnArgs`](../type-aliases/offer_studnie_items_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Offer_studnie_items_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Offer_studnie_items_rels
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Offer_studnie_items_rels and only return the `id`
const offer_studnie_items_relWithIdOnly = await prisma.offer_studnie_items_rel.updateManyAndReturn({
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

---

### upsert()

> **upsert**\<`T`>\>(`args`): [`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:15988

Create or update one Offer_studnie_items_rel.

#### Type Parameters

##### T

`T` _extends_ [`offer_studnie_items_relUpsertArgs`](../type-aliases/offer_studnie_items_relUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offer_studnie_items_relUpsertArgs`](../type-aliases/offer_studnie_items_relUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Offer_studnie_items_rel.

#### Returns

[`Prisma__offer_studnie_items_relClient`](Prisma__offer_studnie_items_relClient.md)\<`GetFindResult`\<[`$offer_studnie_items_relPayload`](../type-aliases/$offer_studnie_items_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Offer_studnie_items_rel
const offer_studnie_items_rel = await prisma.offer_studnie_items_rel.upsert({
    create: {
        // ... data to create a Offer_studnie_items_rel
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Offer_studnie_items_rel we want to update
    }
});
```
