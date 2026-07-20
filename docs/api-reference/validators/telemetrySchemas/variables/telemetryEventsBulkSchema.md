[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../README.md)

---

[WITROS Oferty PV — Backend API Reference](../../../README.md) / [validators/telemetrySchemas](../README.md) / telemetryEventsBulkSchema

# Variable: telemetryEventsBulkSchema

> `const` **telemetryEventsBulkSchema**: `ZodObject`\<\{ `events`: `ZodArray`\<`ZodObject`\<\{ `changeReason`: `ZodOptional`\<`ZodString`>\>; `componentId`: `ZodOptional`\<`ZodString`>\>; `eventType`: `ZodEnum`\<\{ `accept`: `"accept"`; `auto_run`: `"auto_run"`; `create_order`: `"create_order"`; `fallback_triggered`: `"fallback_triggered"`; `reject`: `"reject"`; `rule_violation`: `"rule_violation"`; `save_offer`: `"save_offer"`; `telemetry_reason`: `"telemetry_reason"`; `user_change`: `"user_change"`; \}\>; `msSinceConfig`: `ZodOptional`\<`ZodNumber`>\>; `newValue`: `ZodOptional`\<`ZodString`>\>; `orderInSession`: `ZodOptional`\<`ZodNumber`>\>; `previousValue`: `ZodOptional`\<`ZodString`>\>; `sequenceNo`: `ZodOptional`\<`ZodNumber`>\>; `telemetryId`: `ZodOptional`\<`ZodString`>\>; `wellId`: `ZodOptional`\<`ZodString`>\>; \}, `$strip`>>\>\>; \}, `$strip`>\>

Defined in: [src/validators/telemetrySchemas.ts:182](https://github.com/blodytrav3l3r/Oferty_PV/blob/1ea8d64735797c220332cd09d00dac564c72e93c/src/validators/telemetrySchemas.ts#L182)
