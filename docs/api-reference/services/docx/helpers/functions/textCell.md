[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [services/docx/helpers](../README.md) / textCell

# Function: textCell()

> **textCell**(`text`, `opts?`): `TableCell`

Defined in: [src/services/docx/helpers.ts:28](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/services/docx/helpers.ts#L28)

Tworzy komórkę tabeli z tekstem — reużywalny helper

## Parameters

### text

`string`

### opts?

#### alignment?

`"start"` \| `"center"` \| `"end"` \| `"both"` \| `"mediumKashida"` \| `"distribute"` \| `"numTab"` \| `"highKashida"` \| `"lowKashida"` \| `"thaiDistribute"` \| `"left"` \| `"right"`

#### bold?

`boolean`

#### borders?

[`CellBorders`](../../constants/type-aliases/CellBorders.md)

#### color?

`string`

#### columnSpan?

`number`

#### fill?

`string`

#### size?

`number`

#### width?

`number`

## Returns

`TableCell`
