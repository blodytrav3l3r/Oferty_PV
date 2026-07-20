[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / clients\_relDelegate

# Interface: clients\_relDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:13634

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`clients_relFieldRefs`](clients_relFieldRefs.md)

Defined in: generated/prisma/index.d.ts:14006

Fields of the clients_rel model

## Methods

### aggregate()

> **aggregate**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetClients_relAggregateType`](../type-aliases/GetClients_relAggregateType.md)\<`T`\>\>

Defined in: generated/prisma/index.d.ts:13925

Allows you to perform aggregations operations on a Clients_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`Clients_relAggregateArgs`](../type-aliases/Clients_relAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`Clients_relAggregateArgs`](../type-aliases/Clients_relAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetClients_relAggregateType`](../type-aliases/GetClients_relAggregateType.md)\<`T`\>\>

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

> **count**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Clients\_relCountAggregateOutputType ? Clients\_relCountAggregateOutputType\[P\] : never \} : `number`\>

Defined in: generated/prisma/index.d.ts:13891

Count the number of Clients_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`clients_relCountArgs`](../type-aliases/clients_relCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`clients_relCountArgs`](../type-aliases/clients_relCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter Clients_rels to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` *extends* `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] *extends* `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof Clients\_relCountAggregateOutputType ? Clients\_relCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of Clients_rels
const count = await prisma.clients_rel.count({
  where: {
    // ... the filter for the Clients_rels we want to count
  }
})
```

***

### create()

> **create**\<`T`\>(`args`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13724

Create a Clients_rel.

#### Type Parameters

##### T

`T` *extends* [`clients_relCreateArgs`](../type-aliases/clients_relCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relCreateArgs`](../type-aliases/clients_relCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a Clients_rel.

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one Clients_rel
const Clients_rel = await prisma.clients_rel.create({
  data: {
    // ... data to create a Clients_rel
  }
})
```

***

### createMany()

> **createMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:13738

Create many Clients_rels.

#### Type Parameters

##### T

`T` *extends* [`clients_relCreateManyArgs`](../type-aliases/clients_relCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relCreateManyArgs`](../type-aliases/clients_relCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many Clients_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many Clients_rels
const clients_rel = await prisma.clients_rel.createMany({
  data: [
    // ... provide data here
  ]
})
```

***

### createManyAndReturn()

> **createManyAndReturn**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:13762

Create many Clients_rels and returns the data saved in the database.

#### Type Parameters

##### T

`T` *extends* [`clients_relCreateManyAndReturnArgs`](../type-aliases/clients_relCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relCreateManyAndReturnArgs`](../type-aliases/clients_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many Clients_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many Clients_rels
const clients_rel = await prisma.clients_rel.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many Clients_rels and only return the `id`
const clients_relWithIdOnly = await prisma.clients_rel.createManyAndReturn({
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

> **delete**\<`T`\>(`args`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13776

Delete a Clients_rel.

#### Type Parameters

##### T

`T` *extends* [`clients_relDeleteArgs`](../type-aliases/clients_relDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relDeleteArgs`](../type-aliases/clients_relDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one Clients_rel.

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one Clients_rel
const Clients_rel = await prisma.clients_rel.delete({
  where: {
    // ... filter to delete one Clients_rel
  }
})
```

***

### deleteMany()

> **deleteMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

Defined in: generated/prisma/index.d.ts:13807

Delete zero or more Clients_rels.

#### Type Parameters

##### T

`T` *extends* [`clients_relDeleteManyArgs`](../type-aliases/clients_relDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relDeleteManyArgs`](../type-aliases/clients_relDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter Clients_rels to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few Clients_rels
const { count } = await prisma.clients_rel.deleteMany({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirst()

> **findFirst**\<`T`\>(`args?`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13676

Find the first Clients_rel that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`clients_relFindFirstArgs`](../type-aliases/clients_relFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relFindFirstArgs`](../type-aliases/clients_relFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a Clients_rel

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Clients_rel
const clients_rel = await prisma.clients_rel.findFirst({
  where: {
    // ... provide filter here
  }
})
```

***

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`\>(`args?`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13692

Find the first Clients_rel that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`clients_relFindFirstOrThrowArgs`](../type-aliases/clients_relFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relFindFirstOrThrowArgs`](../type-aliases/clients_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Clients_rel

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Clients_rel
const clients_rel = await prisma.clients_rel.findFirstOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### findMany()

> **findMany**\<`T`\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:13710

Find zero or more Clients_rels that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`clients_relFindManyArgs`](../type-aliases/clients_relFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relFindManyArgs`](../type-aliases/clients_relFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all Clients_rels
const clients_rels = await prisma.clients_rel.findMany()

// Get first 10 Clients_rels
const clients_rels = await prisma.clients_rel.findMany({ take: 10 })

// Only select the `id`
const clients_relWithIdOnly = await prisma.clients_rel.findMany({ select: { id: true } })
```

***

### findUnique()

> **findUnique**\<`T`\>(`args`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13647

Find zero or one Clients_rel that matches the filter.

#### Type Parameters

##### T

`T` *extends* [`clients_relFindUniqueArgs`](../type-aliases/clients_relFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relFindUniqueArgs`](../type-aliases/clients_relFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a Clients_rel

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Clients_rel
const clients_rel = await prisma.clients_rel.findUnique({
  where: {
    // ... provide filter here
  }
})
```

***

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`\>(`args`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13661

Find one Clients_rel that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` *extends* [`clients_relFindUniqueOrThrowArgs`](../type-aliases/clients_relFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relFindUniqueOrThrowArgs`](../type-aliases/clients_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a Clients_rel

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one Clients_rel
const clients_rel = await prisma.clients_rel.findUniqueOrThrow({
  where: {
    // ... provide filter here
  }
})
```

***

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`\>(`args`): `object` *extends* `InputErrors` ? [`GetClients_relGroupByPayload`](../type-aliases/GetClients_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

Defined in: generated/prisma/index.d.ts:13945

Group by Clients_rel.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`clients_relGroupByArgs`](../type-aliases/clients_relGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` *extends* `0` \| `1`

##### OrderByArg

`OrderByArg` *extends* \{ `orderBy`: [`clients_relOrderByWithAggregationInput`](../type-aliases/clients_relOrderByWithAggregationInput.md) \| [`clients_relOrderByWithAggregationInput`](../type-aliases/clients_relOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`clients_relOrderByWithAggregationInput`](../type-aliases/clients_relOrderByWithAggregationInput.md) \| [`clients_relOrderByWithAggregationInput`](../type-aliases/clients_relOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` *extends* `"id"` \| `"createdAt"` \| `"name"` \| `"userId"` \| `"updatedAt"` \| `"phone"` \| `"email"` \| `"nip"` \| `"address"` \| `"contact"` \| `"clientNumber"`

##### ByFields

`ByFields` *extends* [`Clients_relScalarFieldEnum`](../type-aliases/Clients_relScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof clients\_relGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` *extends* `InputErrors` ? [`GetClients_relGroupByPayload`](../type-aliases/GetClients_relGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`\>(`args`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13793

Update one Clients_rel.

#### Type Parameters

##### T

`T` *extends* [`clients_relUpdateArgs`](../type-aliases/clients_relUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relUpdateArgs`](../type-aliases/clients_relUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one Clients_rel.

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one Clients_rel
const clients_rel = await prisma.clients_rel.update({
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

Defined in: generated/prisma/index.d.ts:13826

Update zero or more Clients_rels.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` *extends* [`clients_relUpdateManyArgs`](../type-aliases/clients_relUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relUpdateManyArgs`](../type-aliases/clients_relUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many Clients_rels
const clients_rel = await prisma.clients_rel.updateMany({
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

> **updateManyAndReturn**\<`T`\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

Defined in: generated/prisma/index.d.ts:13856

Update zero or more Clients_rels and returns the data updated in the database.

#### Type Parameters

##### T

`T` *extends* [`clients_relUpdateManyAndReturnArgs`](../type-aliases/clients_relUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relUpdateManyAndReturnArgs`](../type-aliases/clients_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many Clients_rels.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many Clients_rels
const clients_rel = await prisma.clients_rel.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more Clients_rels and only return the `id`
const clients_relWithIdOnly = await prisma.clients_rel.updateManyAndReturn({
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

> **upsert**\<`T`\>(`args`): [`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

Defined in: generated/prisma/index.d.ts:13875

Create or update one Clients_rel.

#### Type Parameters

##### T

`T` *extends* [`clients_relUpsertArgs`](../type-aliases/clients_relUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`clients_relUpsertArgs`](../type-aliases/clients_relUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a Clients_rel.

#### Returns

[`Prisma__clients_relClient`](Prisma__clients_relClient.md)\<`GetFindResult`\<[`$clients_relPayload`](../type-aliases/$clients_relPayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a Clients_rel
const clients_rel = await prisma.clients_rel.upsert({
  create: {
    // ... data to create a Clients_rel
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the Clients_rel we want to update
  }
})
```
