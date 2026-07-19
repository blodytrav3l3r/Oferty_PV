[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offers\_studnie\_relDelegate

# Interface: offers\_studnie\_relDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:18003

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`offers_studnie_relFieldRefs`](offers_studnie_relFieldRefs.md)

Defined in: generated/prisma/index.d.ts:18375

Fields of the offers_studnie_rel model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOffers_studnie_relAggregateType`](../type-aliases/GetOffers_studnie_relAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:18294

Allows you to perform aggregations operations on a Offers_studnie_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`Offers_studnie_relAggregateArgs`](../type-aliases/Offers_studnie_relAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Offers_studnie_relAggregateArgs`](../type-aliases/Offers_studnie_relAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOffers_studnie_relAggregateType`](../type-aliases/GetOffers_studnie_relAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Offers\_studnie\_relCountAggregateOutputType ? Offers\_studnie\_relCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:18260

Count the number of Offers_studnie_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relCountArgs`](../type-aliases/offers_studnie_relCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`offers_studnie_relCountArgs`](../type-aliases/offers_studnie_relCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Offers_studnie_rels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Offers\_studnie\_relCountAggregateOutputType ? Offers\_studnie\_relCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Offers_studnie_rels
const count = await prisma.offers_studnie_rel.count({
    where: {
        // ... the filter for the Offers_studnie_rels we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18093

Create a Offers_studnie_rel.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relCreateArgs`](../type-aliases/offers_studnie_relCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relCreateArgs`](../type-aliases/offers_studnie_relCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Offers_studnie_rel.

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Offers_studnie_rel
const Offers_studnie_rel = await prisma.offers_studnie_rel.create({
    data: {
        // ... data to create a Offers_studnie_rel
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:18107

Create many Offers_studnie_rels.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relCreateManyArgs`](../type-aliases/offers_studnie_relCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relCreateManyArgs`](../type-aliases/offers_studnie_relCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Offers_studnie_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Offers_studnie_rels
const offers_studnie_rel = await prisma.offers_studnie_rel.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:18131

Create many Offers_studnie_rels and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relCreateManyAndReturnArgs`](../type-aliases/offers_studnie_relCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relCreateManyAndReturnArgs`](../type-aliases/offers_studnie_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Offers_studnie_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Offers_studnie_rels
const offers_studnie_rel = await prisma.offers_studnie_rel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Offers_studnie_rels and only return the `id`
const offers_studnie_relWithIdOnly = await prisma.offers_studnie_rel.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18145

Delete a Offers_studnie_rel.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relDeleteArgs`](../type-aliases/offers_studnie_relDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relDeleteArgs`](../type-aliases/offers_studnie_relDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Offers_studnie_rel.

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Offers_studnie_rel
const Offers_studnie_rel = await prisma.offers_studnie_rel.delete({
    where: {
        // ... filter to delete one Offers_studnie_rel
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:18176

Delete zero or more Offers_studnie_rels.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relDeleteManyArgs`](../type-aliases/offers_studnie_relDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relDeleteManyArgs`](../type-aliases/offers_studnie_relDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Offers_studnie_rels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Offers_studnie_rels
const { count } = await prisma.offers_studnie_rel.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18045

Find the first Offers_studnie_rel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relFindFirstArgs`](../type-aliases/offers_studnie_relFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relFindFirstArgs`](../type-aliases/offers_studnie_relFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_studnie_rel

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_studnie_rel
const offers_studnie_rel = await prisma.offers_studnie_rel.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18061

Find the first Offers_studnie_rel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relFindFirstOrThrowArgs`](../type-aliases/offers_studnie_relFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relFindFirstOrThrowArgs`](../type-aliases/offers_studnie_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_studnie_rel

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_studnie_rel
const offers_studnie_rel = await prisma.offers_studnie_rel.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:18079

Find zero or more Offers_studnie_rels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relFindManyArgs`](../type-aliases/offers_studnie_relFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relFindManyArgs`](../type-aliases/offers_studnie_relFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Offers_studnie_rels
const offers_studnie_rels = await prisma.offers_studnie_rel.findMany();

// Get first 10 Offers_studnie_rels
const offers_studnie_rels = await prisma.offers_studnie_rel.findMany({ take: 10 });

// Only select the `id`
const offers_studnie_relWithIdOnly = await prisma.offers_studnie_rel.findMany({
    select: { id: true }
});
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18016

Find zero or one Offers_studnie_rel that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relFindUniqueArgs`](../type-aliases/offers_studnie_relFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relFindUniqueArgs`](../type-aliases/offers_studnie_relFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_studnie_rel

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_studnie_rel
const offers_studnie_rel = await prisma.offers_studnie_rel.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18030

Find one Offers_studnie_rel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relFindUniqueOrThrowArgs`](../type-aliases/offers_studnie_relFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relFindUniqueOrThrowArgs`](../type-aliases/offers_studnie_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_studnie_rel

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_studnie_rel
const offers_studnie_rel = await prisma.offers_studnie_rel.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetOffers_studnie_relGroupByPayload`](../type-aliases/GetOffers_studnie_relGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:18314

Group by Offers_studnie_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relGroupByArgs`](../type-aliases/offers_studnie_relGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`offers_studnie_relOrderByWithAggregationInput`](../type-aliases/offers_studnie_relOrderByWithAggregationInput.md) \| [`offers_studnie_relOrderByWithAggregationInput`](../type-aliases/offers_studnie_relOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`offers_studnie_relOrderByWithAggregationInput`](../type-aliases/offers_studnie_relOrderByWithAggregationInput.md) \| [`offers_studnie_relOrderByWithAggregationInput`](../type-aliases/offers_studnie_relOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"createdAt"` \| `"userId"` \| `"updatedAt"` \| `"data"` \| `"offer_number"` \| `"clientId"` \| `"state"` \| `"transportCost"` \| `"clientName"` \| `"clientNip"` \| `"investName"` \| `"history"`

##### ByFields

`ByFields` _extends_ [`Offers_studnie_relScalarFieldEnum`](../type-aliases/Offers_studnie_relScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof offers\_studnie\_relGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetOffers_studnie_relGroupByPayload`](../type-aliases/GetOffers_studnie_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18162

Update one Offers_studnie_rel.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relUpdateArgs`](../type-aliases/offers_studnie_relUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relUpdateArgs`](../type-aliases/offers_studnie_relUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Offers_studnie_rel.

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Offers_studnie_rel
const offers_studnie_rel = await prisma.offers_studnie_rel.update({
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

Defined in: generated/prisma/index.d.ts:18195

Update zero or more Offers_studnie_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relUpdateManyArgs`](../type-aliases/offers_studnie_relUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relUpdateManyArgs`](../type-aliases/offers_studnie_relUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Offers_studnie_rels
const offers_studnie_rel = await prisma.offers_studnie_rel.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:18225

Update zero or more Offers_studnie_rels and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relUpdateManyAndReturnArgs`](../type-aliases/offers_studnie_relUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relUpdateManyAndReturnArgs`](../type-aliases/offers_studnie_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Offers_studnie_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Offers_studnie_rels
const offers_studnie_rel = await prisma.offers_studnie_rel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Offers_studnie_rels and only return the `id`
const offers_studnie_relWithIdOnly = await prisma.offers_studnie_rel.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:18244

Create or update one Offers_studnie_rel.

#### Type Parameters

##### T

`T` _extends_ [`offers_studnie_relUpsertArgs`](../type-aliases/offers_studnie_relUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_studnie_relUpsertArgs`](../type-aliases/offers_studnie_relUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Offers_studnie_rel.

#### Returns

[`Prisma__offers_studnie_relClient`](Prisma__offers_studnie_relClient.md)\<`GetFindResult`\<[`$offers_studnie_relPayload`](../type-aliases/$offers_studnie_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Offers_studnie_rel
const offers_studnie_rel = await prisma.offers_studnie_rel.upsert({
    create: {
        // ... data to create a Offers_studnie_rel
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the Offers_studnie_rel we want to update
    }
});
```
