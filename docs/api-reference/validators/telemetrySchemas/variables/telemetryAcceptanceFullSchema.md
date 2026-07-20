[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/telemetrySchemas](../README.md) / telemetryAcceptanceFullSchema

# Variable: telemetryAcceptanceFullSchema

> `const` **telemetryAcceptanceFullSchema**: `ZodObject`\<\{ `accepted`: `ZodBoolean`; `configSnapshot`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; `finalConfig`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; `offerId`: `ZodOptional`\<`ZodString`\>; `originalConfig`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; `telemetryId`: `ZodString`; `transitions`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>\>; `warehouse`: `ZodOptional`\<`ZodString`\>; `wellId`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/validators/telemetrySchemas.ts:217](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/telemetrySchemas.ts#L217)
