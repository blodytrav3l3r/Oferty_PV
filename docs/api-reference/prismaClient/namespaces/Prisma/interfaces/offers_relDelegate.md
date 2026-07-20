[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / offers\_relDelegate

# Interface: offers\_relDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:16872

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`offers_relFieldRefs`](offers_relFieldRefs.md)

Defined in: generated/prisma/index.d.ts:17244

Fields of the offers_rel model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOffers_relAggregateType`](../type-aliases/GetOffers_relAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:17163

Allows you to perform aggregations operations on a Offers_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Offers_relAggregateArgs`](../type-aliases/Offers_relAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Offers_relAggregateArgs`](../type-aliases/Offers_relAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetOffers_relAggregateType`](../type-aliases/GetOffers_relAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Offers\_relCountAggregateOutputType ? Offers\_relCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:17129

Count the number of Offers_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`offers_relCountArgs`](../type-aliases/offers_relCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`offers_relCountArgs`](../type-aliases/offers_relCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Offers_rels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Offers\_relCountAggregateOutputType ? Offers\_relCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Offers_rels
const count = await prisma.offers_rel.count({
  where: {
    // ... the filter for the Offers_rels we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:16962

Create a Offers_rel.

#### Type Parameters

##### T

`T` *extends* [`offers_relCreateArgs`](../type-aliases/offers_relCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relCreateArgs`](../type-aliases/offers_relCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Offers_rel.

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Offers_rel
const Offers_rel = await prisma.offers_rel.create({
  data: {
    // ... data to create a Offers_rel
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:16976

Create many Offers_rels.

#### Type Parameters

##### T

`T` *extends* [`offers_relCreateManyArgs`](../type-aliases/offers_relCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relCreateManyArgs`](../type-aliases/offers_relCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Offers_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Offers_rels
const offers_rel = await prisma.offers_rel.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:17000

Create many Offers_rels and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`offers_relCreateManyAndReturnArgs`](../type-aliases/offers_relCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relCreateManyAndReturnArgs`](../type-aliases/offers_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Offers_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Offers_rels
const offers_rel = await prisma.offers_rel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Offers_rels and only return the `id`
const offers_relWithIdOnly = await prisma.offers_rel.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:17014

Delete a Offers_rel.

#### Type Parameters

##### T

`T` *extends* [`offers_relDeleteArgs`](../type-aliases/offers_relDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relDeleteArgs`](../type-aliases/offers_relDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Offers_rel.

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Offers_rel
const Offers_rel = await prisma.offers_rel.delete({
  where: {
    // ... filter to delete one Offers_rel
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:17045

Delete zero or more Offers_rels.

#### Type Parameters

##### T

`T` *extends* [`offers_relDeleteManyArgs`](../type-aliases/offers_relDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relDeleteManyArgs`](../type-aliases/offers_relDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Offers_rels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Offers_rels
const { count } = await prisma.offers_rel.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:16914

Find the first Offers_rel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`offers_relFindFirstArgs`](../type-aliases/offers_relFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relFindFirstArgs`](../type-aliases/offers_relFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_rel

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_rel
const offers_rel = await prisma.offers_rel.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:16930

Find the first Offers_rel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`offers_relFindFirstOrThrowArgs`](../type-aliases/offers_relFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relFindFirstOrThrowArgs`](../type-aliases/offers_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_rel

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_rel
const offers_rel = await prisma.offers_rel.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:16948

Find zero or more Offers_rels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`offers_relFindManyArgs`](../type-aliases/offers_relFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relFindManyArgs`](../type-aliases/offers_relFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Offers_rels
const offers_rels = await prisma.offers_rel.findMany()

// Get first 10 Offers_rels
const offers_rels = await prisma.offers_rel.findMany({ take: 10 })

// Only select the `id`
const offers_relWithIdOnly = await prisma.offers_rel.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:16885

Find zero or one Offers_rel that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`offers_relFindUniqueArgs`](../type-aliases/offers_relFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relFindUniqueArgs`](../type-aliases/offers_relFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_rel

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_rel
const offers_rel = await prisma.offers_rel.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:16899

Find one Offers_rel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`offers_relFindUniqueOrThrowArgs`](../type-aliases/offers_relFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relFindUniqueOrThrowArgs`](../type-aliases/offers_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Offers_rel

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Offers_rel
const offers_rel = await prisma.offers_rel.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetOffers_relGroupByPayload`](../type-aliases/GetOffers_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:17183

Group by Offers_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`offers_relGroupByArgs`](../type-aliases/offers_relGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`offers_relOrderByWithAggregationInput`](../type-aliases/offers_relOrderByWithAggregationInput.md) \| [`offers_relOrderByWithAggregationInput`](../type-aliases/offers_relOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`offers_relOrderByWithAggregationInput`](../type-aliases/offers_relOrderByWithAggregationInput.md) \| [`offers_relOrderByWithAggregationInput`](../type-aliases/offers_relOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"userId"` \| `"updatedAt"` \| `"data"` \| `"offer_number"` \| `"clientId"` \| `"state"` \| `"transportCost"` \| `"clientName"` \| `"clientNip"` \| `"investName"` \| `"history"`

##### ByFields

`ByFields` *extends* [`Offers_relScalarFieldEnum`](../type-aliases/Offers_relScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof offers\_relGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetOffers_relGroupByPayload`](../type-aliases/GetOffers_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:17031

Update one Offers_rel.

#### Type Parameters

##### T

`T` *extends* [`offers_relUpdateArgs`](../type-aliases/offers_relUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relUpdateArgs`](../type-aliases/offers_relUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Offers_rel.

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Offers_rel
const offers_rel = await prisma.offers_rel.update({
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

Defined in: generated/prisma/index.d.ts:17064

Update zero or more Offers_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`offers_relUpdateManyArgs`](../type-aliases/offers_relUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relUpdateManyArgs`](../type-aliases/offers_relUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Offers_rels
const offers_rel = await prisma.offers_rel.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:17094

Update zero or more Offers_rels and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`offers_relUpdateManyAndReturnArgs`](../type-aliases/offers_relUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relUpdateManyAndReturnArgs`](../type-aliases/offers_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Offers_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Offers_rels
const offers_rel = await prisma.offers_rel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Offers_rels and only return the `id`
const offers_relWithIdOnly = await prisma.offers_rel.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:17113

Create or update one Offers_rel.

#### Type Parameters

##### T

`T` *extends* [`offers_relUpsertArgs`](../type-aliases/offers_relUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`offers_relUpsertArgs`](../type-aliases/offers_relUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Offers_rel.

#### Returns

[`Prisma__offers_relClient`](Prisma__offers_relClient.md)\<`GetFindResult`\<[`$offers_relPayload`](../type-aliases/$offers_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Offers_rel
const offers_rel = await prisma.offers_rel.upsert({
  create: {
    // ... data to create a Offers_rel
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Offers_rel we want to update
  }
})
```
