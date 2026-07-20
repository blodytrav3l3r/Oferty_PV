[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / production\_order\_countersFindManyArgs

# Type Alias: production\_order\_countersFindManyArgs\<ExtArgs\>

> **production\_order\_countersFindManyArgs**\<`ExtArgs`\> = `object`

Defined in: generated/prisma/index.d.ts:23594

production_order_counters findMany

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

## Properties

### cursor?

> `optional` **cursor?**: [`production_order_countersWhereUniqueInput`](production_order_countersWhereUniqueInput.md)

Defined in: generated/prisma/index.d.ts:23618

[Cursor Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination)

Sets the position for listing production_order_counters.

***

### distinct?

> `optional` **distinct?**: [`Production_order_countersScalarFieldEnum`](Production_order_countersScalarFieldEnum.md) \| [`Production_order_countersScalarFieldEnum`](Production_order_countersScalarFieldEnum.md)[]

Defined in: generated/prisma/index.d.ts:23631

***

### omit?

> `optional` **omit?**: [`production_order_countersOmit`](production_order_countersOmit.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:23602

Omit specific fields from the production_order_counters

***

### orderBy?

> `optional` **orderBy?**: [`production_order_countersOrderByWithRelationInput`](production_order_countersOrderByWithRelationInput.md) \| [`production_order_countersOrderByWithRelationInput`](production_order_countersOrderByWithRelationInput.md)[]

Defined in: generated/prisma/index.d.ts:23612

[Sorting Docs](https://www.prisma.io/docs/concepts/components/prisma-client/sorting)

Determine the order of production_order_counters to fetch.

***

### select?

> `optional` **select?**: [`production_order_countersSelect`](production_order_countersSelect.md)\<`ExtArgs`\> \| `null`

Defined in: generated/prisma/index.d.ts:23598

Select specific fields to fetch from the production_order_counters

***

### skip?

> `optional` **skip?**: `number`

Defined in: generated/prisma/index.d.ts:23630

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Skip the first `n` production_order_counters.

***

### take?

> `optional` **take?**: `number`

Defined in: generated/prisma/index.d.ts:23624

[Pagination Docs](https://www.prisma.io/docs/concepts/components/prisma-client/pagination)

Take `±n` production_order_counters from the position of the cursor.

***

### where?

> `optional` **where?**: [`production_order_countersWhereInput`](production_order_countersWhereInput.md)

Defined in: generated/prisma/index.d.ts:23606

Filter, which production_order_counters to fetch.
