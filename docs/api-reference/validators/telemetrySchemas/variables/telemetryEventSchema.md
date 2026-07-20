[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/telemetrySchemas](../README.md) / telemetryEventSchema

# Variable: telemetryEventSchema

> `const` **telemetryEventSchema**: `ZodObject`\<\{ `changeReason`: `ZodOptional`\<`ZodString`\>; `componentId`: `ZodOptional`\<`ZodString`\>; `eventType`: `ZodEnum`\<\{ `accept`: `"accept"`; `auto_run`: `"auto_run"`; `create_order`: `"create_order"`; `fallback_triggered`: `"fallback_triggered"`; `reject`: `"reject"`; `rule_violation`: `"rule_violation"`; `save_offer`: `"save_offer"`; `telemetry_reason`: `"telemetry_reason"`; `user_change`: `"user_change"`; \}\>; `msSinceConfig`: `ZodOptional`\<`ZodNumber`\>; `newValue`: `ZodOptional`\<`ZodString`\>; `orderInSession`: `ZodOptional`\<`ZodNumber`\>; `previousValue`: `ZodOptional`\<`ZodString`\>; `sequenceNo`: `ZodOptional`\<`ZodNumber`\>; `telemetryId`: `ZodOptional`\<`ZodString`\>; `wellId`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/validators/telemetrySchemas.ts:153](https://github.com/blodytrav3l3r/Oferty_PV/blob/31aceca21d78721aaaf4b7ce00f0688e6197beec/src/validators/telemetrySchemas.ts#L153)
