[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / ProductsStudnieDelegate

# Interface: ProductsStudnieDelegate\<ExtArgs, GlobalOmitOptions\>

Defined in: generated/prisma/index.d.ts:31837

## Type Parameters

### ExtArgs

`ExtArgs` _extends_ `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}

## Indexable

> \[`K`: `symbol`\]: `object`

## Properties

### fields

> `readonly` **fields**: [`ProductsStudnieFieldRefs`](ProductsStudnieFieldRefs.md)

Defined in: generated/prisma/index.d.ts:32209

Fields of the ProductsStudnie model

## Methods

### aggregate()

> **aggregate**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProductsStudnieAggregateType`](../type-aliases/GetProductsStudnieAggregateType.md)\<`T`>>\>\>

Defined in: generated/prisma/index.d.ts:32128

Allows you to perform aggregations operations on a ProductsStudnie.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieAggregateArgs`](../type-aliases/ProductsStudnieAggregateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ProductsStudnieAggregateArgs`](../type-aliases/ProductsStudnieAggregateArgs.md)\>

Select which aggregations you would like to apply and on what fields.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`GetProductsStudnieAggregateType`](../type-aliases/GetProductsStudnieAggregateType.md)\<`T`\>\>

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

> **count**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`> \> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof ProductsStudnieCountAggregateOutputType ? ProductsStudnieCountAggregateOutputType\[P\] : never \} : `number`>\>

Defined in: generated/prisma/index.d.ts:32094

Count the number of ProductsStudnies.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieCountArgs`](../type-aliases/ProductsStudnieCountArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`Subset`](../type-aliases/Subset.md)\<`T`, [`ProductsStudnieCountArgs`](../type-aliases/ProductsStudnieCountArgs.md)\<`DefaultArgs`\>\>

Arguments to filter ProductsStudnies to count.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`T` _extends_ `Record_2`\<`"select"`, `any`\> ? `T`\[`"select"`\] _extends_ `true` ? `number` : \{ \[P in string \| number \| symbol\]: P extends keyof ProductsStudnieCountAggregateOutputType ? ProductsStudnieCountAggregateOutputType\[P\] : never \} : `number`\>

#### Example

```ts
// Count the number of ProductsStudnies
const count = await prisma.productsStudnie.count({
    where: {
        // ... the filter for the ProductsStudnies we want to count
    }
});
```

---

### create()

> **create**\<`T`>\>(`args`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:31927

Create a ProductsStudnie.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieCreateArgs`](../type-aliases/ProductsStudnieCreateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieCreateArgs`](../type-aliases/ProductsStudnieCreateArgs.md)\<`ExtArgs`\>\>

Arguments to create a ProductsStudnie.

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Create one ProductsStudnie
const ProductsStudnie = await prisma.productsStudnie.create({
    data: {
        // ... data to create a ProductsStudnie
    }
});
```

---

### createMany()

> **createMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:31941

Create many ProductsStudnies.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieCreateManyArgs`](../type-aliases/ProductsStudnieCreateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieCreateManyArgs`](../type-aliases/ProductsStudnieCreateManyArgs.md)\<`ExtArgs`\>\>

Arguments to create many ProductsStudnies.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Create many ProductsStudnies
const productsStudnie = await prisma.productsStudnie.createMany({
    data: [
        // ... provide data here
    ]
});
```

---

### createManyAndReturn()

> **createManyAndReturn**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:31965

Create many ProductsStudnies and returns the data saved in the database.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieCreateManyAndReturnArgs`](../type-aliases/ProductsStudnieCreateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieCreateManyAndReturnArgs`](../type-aliases/ProductsStudnieCreateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to create many ProductsStudnies.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Create many ProductsStudnies
const productsStudnie = await prisma.productsStudnie.createManyAndReturn({
  data: [
    // ... provide data here
  ]
})

// Create many ProductsStudnies and only return the `id`
const productsStudnieWithIdOnly = await prisma.productsStudnie.createManyAndReturn({
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

> **delete**\<`T`>\>(`args`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:31979

Delete a ProductsStudnie.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieDeleteArgs`](../type-aliases/ProductsStudnieDeleteArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieDeleteArgs`](../type-aliases/ProductsStudnieDeleteArgs.md)\<`ExtArgs`\>\>

Arguments to delete one ProductsStudnie.

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Delete one ProductsStudnie
const ProductsStudnie = await prisma.productsStudnie.delete({
    where: {
        // ... filter to delete one ProductsStudnie
    }
});
```

---

### deleteMany()

> **deleteMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)>\>

Defined in: generated/prisma/index.d.ts:32010

Delete zero or more ProductsStudnies.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieDeleteManyArgs`](../type-aliases/ProductsStudnieDeleteManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieDeleteManyArgs`](../type-aliases/ProductsStudnieDeleteManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter ProductsStudnies to delete.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Delete a few ProductsStudnies
const { count } = await prisma.productsStudnie.deleteMany({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirst()

> **findFirst**\<`T`>\>(`args?`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:31879

Find the first ProductsStudnie that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieFindFirstArgs`](../type-aliases/ProductsStudnieFindFirstArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieFindFirstArgs`](../type-aliases/ProductsStudnieFindFirstArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsStudnie

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsStudnie
const productsStudnie = await prisma.productsStudnie.findFirst({
    where: {
        // ... provide filter here
    }
});
```

---

### findFirstOrThrow()

> **findFirstOrThrow**\<`T`>\>(`args?`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:31895

Find the first ProductsStudnie that matches the filter or
throw `PrismaKnownClientError` with `P2025` code if no matches were found.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieFindFirstOrThrowArgs`](../type-aliases/ProductsStudnieFindFirstOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieFindFirstOrThrowArgs`](../type-aliases/ProductsStudnieFindFirstOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsStudnie

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsStudnie
const productsStudnie = await prisma.productsStudnie.findFirstOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### findMany()

> **findMany**\<`T`>\>(`args?`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:31913

Find zero or more ProductsStudnies that matches the filter.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieFindManyArgs`](../type-aliases/ProductsStudnieFindManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args?

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieFindManyArgs`](../type-aliases/ProductsStudnieFindManyArgs.md)\<`ExtArgs`\>\>

Arguments to filter and select certain fields only.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Get all ProductsStudnies
const productsStudnies = await prisma.productsStudnie.findMany();

// Get first 10 ProductsStudnies
const productsStudnies = await prisma.productsStudnie.findMany({ take: 10 });

// Only select the `id`
const productsStudnieWithIdOnly = await prisma.productsStudnie.findMany({ select: { id: true } });
```

---

### findUnique()

> **findUnique**\<`T`>\>(`args`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`> \> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:31850

Find zero or one ProductsStudnie that matches the filter.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieFindUniqueArgs`](../type-aliases/ProductsStudnieFindUniqueArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieFindUniqueArgs`](../type-aliases/ProductsStudnieFindUniqueArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsStudnie

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\> \| `null`, `null`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsStudnie
const productsStudnie = await prisma.productsStudnie.findUnique({
    where: {
        // ... provide filter here
    }
});
```

---

### findUniqueOrThrow()

> **findUniqueOrThrow**\<`T`>\>(`args`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:31864

Find one ProductsStudnie that matches the filter or throw an error with `error.code='P2025'`
if no matches were found.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieFindUniqueOrThrowArgs`](../type-aliases/ProductsStudnieFindUniqueOrThrowArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieFindUniqueOrThrowArgs`](../type-aliases/ProductsStudnieFindUniqueOrThrowArgs.md)\<`ExtArgs`\>\>

Arguments to find a ProductsStudnie

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Get one ProductsStudnie
const productsStudnie = await prisma.productsStudnie.findUniqueOrThrow({
    where: {
        // ... provide filter here
    }
});
```

---

### groupBy()

> **groupBy**\<`T`, `HasSelectOrTake`, `OrderByArg`, `OrderFields`, `ByFields`, `ByValid`, `HavingFields`, `HavingValid`, `ByEmpty`, `InputErrors`>\>(`args`): `object` _extends_ `InputErrors` ? [`GetProductsStudnieGroupByPayload`](../type-aliases/GetProductsStudnieGroupByPayload.md)\<`T`> \> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`>\>

Defined in: generated/prisma/index.d.ts:32148

Group by ProductsStudnie.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieGroupByArgs`](../type-aliases/ProductsStudnieGroupByArgs.md)\<`DefaultArgs`\>

##### HasSelectOrTake

`HasSelectOrTake` _extends_ `0` \| `1`

##### OrderByArg

`OrderByArg` _extends_ \{ `orderBy`: [`ProductsStudnieOrderByWithAggregationInput`](../type-aliases/ProductsStudnieOrderByWithAggregationInput.md) \| [`ProductsStudnieOrderByWithAggregationInput`](../type-aliases/ProductsStudnieOrderByWithAggregationInput.md)[] \| `undefined`; \} \| \{ `orderBy?`: [`ProductsStudnieOrderByWithAggregationInput`](../type-aliases/ProductsStudnieOrderByWithAggregationInput.md) \| [`ProductsStudnieOrderByWithAggregationInput`](../type-aliases/ProductsStudnieOrderByWithAggregationInput.md)[]; \}

##### OrderFields

`OrderFields` _extends_ `"id"` \| `"active"` \| `"name"` \| `"dn"` \| `"category"` \| `"price"` \| `"transport"` \| `"weight"` \| `"area"` \| `"componentType"` \| `"height"` \| `"areaExt"` \| `"magazynWL"` \| `"magazynKLB"` \| `"formaStandardowa"` \| `"formaStandardowaKLB"` \| `"zapasDol"` \| `"zapasGora"` \| `"zapasDolMin"` \| `"zapasGoraMin"` \| `"spocznikH"` \| `"hMin1"` \| `"hMax1"` \| `"cena1"` \| `"hMin2"` \| `"hMax2"` \| `"cena2"` \| `"hMin3"` \| `"hMax3"` \| `"cena3"` \| `"doplataPEHD"` \| `"doplataZelbet"` \| `"doplataDrabNierdzewna"` \| `"malowanieWewnetrzne"` \| `"malowanieZewnetrzne"`

##### ByFields

`ByFields` _extends_ [`ProductsStudnieScalarFieldEnum`](../type-aliases/ProductsStudnieScalarFieldEnum.md)

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

\{ \[key in string \| number \| symbol\]: key extends keyof ProductsStudnieGroupByArgs\<DefaultArgs\> ? T\[key\] : never \} & `OrderByArg` & `InputErrors`

Group by arguments.

#### Returns

`object` _extends_ `InputErrors` ? [`GetProductsStudnieGroupByPayload`](../type-aliases/GetProductsStudnieGroupByPayload.md)\<`T`\> : [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`InputErrors`\>

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

> **update**\<`T`>\>(`args`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:31996

Update one ProductsStudnie.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieUpdateArgs`](../type-aliases/ProductsStudnieUpdateArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieUpdateArgs`](../type-aliases/ProductsStudnieUpdateArgs.md)\<`ExtArgs`\>\>

Arguments to update one ProductsStudnie.

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update one ProductsStudnie
const productsStudnie = await prisma.productsStudnie.update({
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

Defined in: generated/prisma/index.d.ts:32029

Update zero or more ProductsStudnies.
Note, that providing `undefined` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieUpdateManyArgs`](../type-aliases/ProductsStudnieUpdateManyArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieUpdateManyArgs`](../type-aliases/ProductsStudnieUpdateManyArgs.md)\<`ExtArgs`\>\>

Arguments to update one or more rows.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<[`BatchPayload`](../type-aliases/BatchPayload.md)\>

#### Example

```ts
// Update many ProductsStudnies
const productsStudnie = await prisma.productsStudnie.updateMany({
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

> **updateManyAndReturn**\<`T`>\>(`args`): [`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>[]\>

Defined in: generated/prisma/index.d.ts:32059

Update zero or more ProductsStudnies and returns the data updated in the database.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieUpdateManyAndReturnArgs`](../type-aliases/ProductsStudnieUpdateManyAndReturnArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieUpdateManyAndReturnArgs`](../type-aliases/ProductsStudnieUpdateManyAndReturnArgs.md)\<`ExtArgs`\>\>

Arguments to update many ProductsStudnies.

#### Returns

[`PrismaPromise`](../type-aliases/PrismaPromise.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>[]\>

#### Example

```ts
// Update many ProductsStudnies
const productsStudnie = await prisma.productsStudnie.updateManyAndReturn({
  where: {
    // ... provide filter here
  },
  data: [
    // ... provide data here
  ]
})

// Update zero or more ProductsStudnies and only return the `id`
const productsStudnieWithIdOnly = await prisma.productsStudnie.updateManyAndReturn({
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

> **upsert**\<`T`>\>(`args`): [`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`>\>, `T`, `GlobalOmitOptions`>\>, `never`, `ExtArgs`, `GlobalOmitOptions`>\>

Defined in: generated/prisma/index.d.ts:32078

Create or update one ProductsStudnie.

#### Type Parameters

##### T

`T` _extends_ [`ProductsStudnieUpsertArgs`](../type-aliases/ProductsStudnieUpsertArgs.md)\<`DefaultArgs`\>

#### Parameters

##### args

[`SelectSubset`](../type-aliases/SelectSubset.md)\<`T`, [`ProductsStudnieUpsertArgs`](../type-aliases/ProductsStudnieUpsertArgs.md)\<`ExtArgs`\>\>

Arguments to update or create a ProductsStudnie.

#### Returns

[`Prisma__ProductsStudnieClient`](Prisma__ProductsStudnieClient.md)\<`GetFindResult`\<[`$ProductsStudniePayload`](../type-aliases/$ProductsStudniePayload.md)\<`ExtArgs`\>, `T`, `GlobalOmitOptions`\>, `never`, `ExtArgs`, `GlobalOmitOptions`\>

#### Example

```ts
// Update or create a ProductsStudnie
const productsStudnie = await prisma.productsStudnie.upsert({
    create: {
        // ... data to create a ProductsStudnie
    },
    update: {
        // ... in case it already exists, update
    },
    where: {
        // ... the filter for the ProductsStudnie we want to update
    }
});
```
