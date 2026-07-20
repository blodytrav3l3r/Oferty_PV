[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [utils/productionSearchUtils](../README.md) / mapProductionOrderRow

# Function: mapProductionOrderRow()

> **mapProductionOrderRow**(`row`): `object`

Defined in: [src/utils/productionSearchUtils.ts:35](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/utils/productionSearchUtils.ts#L35)

## Parameters

### row

`Record`\<`string`, `unknown`\>

## Returns

`object`

### createdAt

> **createdAt**: `unknown` = `row.createdAt`

### creatorName

> **creatorName**: \{ \} \| `undefined`

### dbSalesOrderId

> **dbSalesOrderId**: \{ \} \| `undefined`

### dbSalesOrderNumber

> **dbSalesOrderNumber**: `string` \| `undefined`

### elementIndex

> **elementIndex**: `unknown` = `row.elementIndex`

### handlerName

> **handlerName**: \{ \} \| `undefined`

### id

> **id**: `unknown` = `row.id`

### orderId

> **orderId**: `unknown` = `row.orderId`

### type

> **type**: `string` = `'production_order'`

### updatedAt

> **updatedAt**: `unknown` = `row.updatedAt`

### userId

> **userId**: `unknown` = `row.userId`

### wellId

> **wellId**: `unknown` = `row.wellId`
