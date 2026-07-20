[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_order\_countersFindFirstOrThrowArgs

# Type Alias: production\_order\_countersFindFirstOrThrowArgs\<ExtArgs\>

> **production\_order\_countersFindFirstOrThrowArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:23546

production_order_counters findFirstOrThrow

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`production_order_countersWhereUniqueInput`](production_order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:23570

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for searching for production_order_counters.

***

### distinct?

> `optional` **distinct?**: [`Production_order_countersScalarFieldEnum`](Production_order_countersScalarFieldEnum.md) \| [`Production_order_countersScalarFieldEnum`](Production_order_countersScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:23588

[Distinct Docs](https://www.prisma.io/docs/concepts/components/prisma-client/distinct)

Filter by unique combinations of production_order_counters.

***

### omit?

> `optional` **omit?**: [`production_order_countersOmit`](production_order_countersOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:23554

Omit specific fields from the production_order_counters

***

### orderBy?

> `optional` **orderBy?**: [`production_order_countersOrderByWithRelationInput`](production_order_countersOrderByWithRelationInput.md) \| [`production_order_countersOrderByWithRelationInput`](production_order_countersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:23564

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of production_order_counters to fetch.

***

### select?

> `optional` **select?**: [`production_order_countersSelect`](production_order_countersSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:23550

Select specific fields to fetch from the production_order_counters

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:23582

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` production_order_counters.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:23576

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` production_order_counters from the position of the cursor.

***

### where?

> `optional` **where?**: [`production_order_countersWhereInput`](production_order_countersWhereInput.md)

Defined in: generated/prisma/index.d.ts:23558

Filter, which production_order_counters to fetch.
