[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../../../README.md) / [prismaClient](../../../README.md) / [Prisma](../README.md) / TypeMap

# Type Alias: TypeMap\<ExtArgs, GlobalOmitOptions\>

> **TypeMap**\<`ExtArgs`, `GlobalOmitOptions`\> = `object` & `object`

Defined in: generated/prisma/index.d.ts:1084

## Type Declaration

### globalOmitOptions

> **globalOmitOptions**: `object`

#### globalOmitOptions.omit

> **omit**: `GlobalOmitOptions`

### meta

> **meta**: `object`

#### meta.modelProps

> **modelProps**: `"ai_telemetry_logs"` \| `"ai_telemetry_events"` \| `"ai_config_history"` \| `"ai_telemetry_versions"` \| `"ai_knowledge_base"` \| `"ai_recommendations"` \| `"ai_transition_snapshots"` \| `"audit_logs"` \| `"clients_rel"` \| `"offer_items_rel"` \| `"offer_studnie_items_rel"` \| `"offers_rel"` \| `"offers_studnie_rel"` \| `"order_counters"` \| `"order_counters_rury"` \| `"orders_studnie_rel"` \| `"orders_rury_rel"` \| `"production_order_counters"` \| `"production_orders_rel"` \| `"recycled_production_numbers"` \| `"sessions"` \| `"settings"` \| `"categoriesRury"` \| `"productsRury"` \| `"categoriesStudnie"` \| `"productsStudnie"` \| `"aiFeature"` \| `"aiModel"` \| `"aiEvaluation"` \| `"aiRewardLog"` \| `"users"`

#### meta.txIsolationLevel

> **txIsolationLevel**: [`TransactionIsolationLevel`](TransactionIsolationLevel.md)

### model

> **model**: `object`

#### model.ai\_config\_history

> **ai\_config\_history**: `object`

#### model.ai\_config\_history.fields

> **fields**: [`ai_config_historyFieldRefs`](../interfaces/ai_config_historyFieldRefs.md)

#### model.ai\_config\_history.operations

> **operations**: `object`

#### model.ai\_config\_history.operations.aggregate

> **aggregate**: `object`

#### model.ai\_config\_history.operations.aggregate.args

> **args**: [`Ai_config_historyAggregateArgs`](Ai_config_historyAggregateArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAi_config_history`](AggregateAi_config_history.md)\>

#### model.ai\_config\_history.operations.count

> **count**: `object`

#### model.ai\_config\_history.operations.count.args

> **args**: [`ai_config_historyCountArgs`](ai_config_historyCountArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.count.result

> **result**: `$Utils.Optional`\<[`Ai_config_historyCountAggregateOutputType`](Ai_config_historyCountAggregateOutputType.md)\> \| `number`

#### model.ai\_config\_history.operations.create

> **create**: `object`

#### model.ai\_config\_history.operations.create.args

> **args**: [`ai_config_historyCreateArgs`](ai_config_historyCreateArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>

#### model.ai\_config\_history.operations.createMany

> **createMany**: `object`

#### model.ai\_config\_history.operations.createMany.args

> **args**: [`ai_config_historyCreateManyArgs`](ai_config_historyCreateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_config\_history.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ai\_config\_history.operations.createManyAndReturn.args

> **args**: [`ai_config_historyCreateManyAndReturnArgs`](ai_config_historyCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>[]

#### model.ai\_config\_history.operations.delete

> **delete**: `object`

#### model.ai\_config\_history.operations.delete.args

> **args**: [`ai_config_historyDeleteArgs`](ai_config_historyDeleteArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>

#### model.ai\_config\_history.operations.deleteMany

> **deleteMany**: `object`

#### model.ai\_config\_history.operations.deleteMany.args

> **args**: [`ai_config_historyDeleteManyArgs`](ai_config_historyDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_config\_history.operations.findFirst

> **findFirst**: `object`

#### model.ai\_config\_history.operations.findFirst.args

> **args**: [`ai_config_historyFindFirstArgs`](ai_config_historyFindFirstArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\> \| `null`

#### model.ai\_config\_history.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ai\_config\_history.operations.findFirstOrThrow.args

> **args**: [`ai_config_historyFindFirstOrThrowArgs`](ai_config_historyFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>

#### model.ai\_config\_history.operations.findMany

> **findMany**: `object`

#### model.ai\_config\_history.operations.findMany.args

> **args**: [`ai_config_historyFindManyArgs`](ai_config_historyFindManyArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>[]

#### model.ai\_config\_history.operations.findUnique

> **findUnique**: `object`

#### model.ai\_config\_history.operations.findUnique.args

> **args**: [`ai_config_historyFindUniqueArgs`](ai_config_historyFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\> \| `null`

#### model.ai\_config\_history.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ai\_config\_history.operations.findUniqueOrThrow.args

> **args**: [`ai_config_historyFindUniqueOrThrowArgs`](ai_config_historyFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>

#### model.ai\_config\_history.operations.groupBy

> **groupBy**: `object`

#### model.ai\_config\_history.operations.groupBy.args

> **args**: [`ai_config_historyGroupByArgs`](ai_config_historyGroupByArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Ai_config_historyGroupByOutputType`](Ai_config_historyGroupByOutputType.md)\>[]

#### model.ai\_config\_history.operations.update

> **update**: `object`

#### model.ai\_config\_history.operations.update.args

> **args**: [`ai_config_historyUpdateArgs`](ai_config_historyUpdateArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>

#### model.ai\_config\_history.operations.updateMany

> **updateMany**: `object`

#### model.ai\_config\_history.operations.updateMany.args

> **args**: [`ai_config_historyUpdateManyArgs`](ai_config_historyUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_config\_history.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ai\_config\_history.operations.updateManyAndReturn.args

> **args**: [`ai_config_historyUpdateManyAndReturnArgs`](ai_config_historyUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>[]

#### model.ai\_config\_history.operations.upsert

> **upsert**: `object`

#### model.ai\_config\_history.operations.upsert.args

> **args**: [`ai_config_historyUpsertArgs`](ai_config_historyUpsertArgs.md)\<`ExtArgs`\>

#### model.ai\_config\_history.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_config_historyPayload`]($ai_config_historyPayload.md)\>

#### model.ai\_config\_history.payload

> **payload**: [`$ai_config_historyPayload`]($ai_config_historyPayload.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base

> **ai\_knowledge\_base**: `object`

#### model.ai\_knowledge\_base.fields

> **fields**: [`ai_knowledge_baseFieldRefs`](../interfaces/ai_knowledge_baseFieldRefs.md)

#### model.ai\_knowledge\_base.operations

> **operations**: `object`

#### model.ai\_knowledge\_base.operations.aggregate

> **aggregate**: `object`

#### model.ai\_knowledge\_base.operations.aggregate.args

> **args**: [`Ai_knowledge_baseAggregateArgs`](Ai_knowledge_baseAggregateArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAi_knowledge_base`](AggregateAi_knowledge_base.md)\>

#### model.ai\_knowledge\_base.operations.count

> **count**: `object`

#### model.ai\_knowledge\_base.operations.count.args

> **args**: [`ai_knowledge_baseCountArgs`](ai_knowledge_baseCountArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.count.result

> **result**: `$Utils.Optional`\<[`Ai_knowledge_baseCountAggregateOutputType`](Ai_knowledge_baseCountAggregateOutputType.md)\> \| `number`

#### model.ai\_knowledge\_base.operations.create

> **create**: `object`

#### model.ai\_knowledge\_base.operations.create.args

> **args**: [`ai_knowledge_baseCreateArgs`](ai_knowledge_baseCreateArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>

#### model.ai\_knowledge\_base.operations.createMany

> **createMany**: `object`

#### model.ai\_knowledge\_base.operations.createMany.args

> **args**: [`ai_knowledge_baseCreateManyArgs`](ai_knowledge_baseCreateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_knowledge\_base.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ai\_knowledge\_base.operations.createManyAndReturn.args

> **args**: [`ai_knowledge_baseCreateManyAndReturnArgs`](ai_knowledge_baseCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>[]

#### model.ai\_knowledge\_base.operations.delete

> **delete**: `object`

#### model.ai\_knowledge\_base.operations.delete.args

> **args**: [`ai_knowledge_baseDeleteArgs`](ai_knowledge_baseDeleteArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>

#### model.ai\_knowledge\_base.operations.deleteMany

> **deleteMany**: `object`

#### model.ai\_knowledge\_base.operations.deleteMany.args

> **args**: [`ai_knowledge_baseDeleteManyArgs`](ai_knowledge_baseDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_knowledge\_base.operations.findFirst

> **findFirst**: `object`

#### model.ai\_knowledge\_base.operations.findFirst.args

> **args**: [`ai_knowledge_baseFindFirstArgs`](ai_knowledge_baseFindFirstArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\> \| `null`

#### model.ai\_knowledge\_base.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ai\_knowledge\_base.operations.findFirstOrThrow.args

> **args**: [`ai_knowledge_baseFindFirstOrThrowArgs`](ai_knowledge_baseFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>

#### model.ai\_knowledge\_base.operations.findMany

> **findMany**: `object`

#### model.ai\_knowledge\_base.operations.findMany.args

> **args**: [`ai_knowledge_baseFindManyArgs`](ai_knowledge_baseFindManyArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>[]

#### model.ai\_knowledge\_base.operations.findUnique

> **findUnique**: `object`

#### model.ai\_knowledge\_base.operations.findUnique.args

> **args**: [`ai_knowledge_baseFindUniqueArgs`](ai_knowledge_baseFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\> \| `null`

#### model.ai\_knowledge\_base.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ai\_knowledge\_base.operations.findUniqueOrThrow.args

> **args**: [`ai_knowledge_baseFindUniqueOrThrowArgs`](ai_knowledge_baseFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>

#### model.ai\_knowledge\_base.operations.groupBy

> **groupBy**: `object`

#### model.ai\_knowledge\_base.operations.groupBy.args

> **args**: [`ai_knowledge_baseGroupByArgs`](ai_knowledge_baseGroupByArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Ai_knowledge_baseGroupByOutputType`](Ai_knowledge_baseGroupByOutputType.md)\>[]

#### model.ai\_knowledge\_base.operations.update

> **update**: `object`

#### model.ai\_knowledge\_base.operations.update.args

> **args**: [`ai_knowledge_baseUpdateArgs`](ai_knowledge_baseUpdateArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>

#### model.ai\_knowledge\_base.operations.updateMany

> **updateMany**: `object`

#### model.ai\_knowledge\_base.operations.updateMany.args

> **args**: [`ai_knowledge_baseUpdateManyArgs`](ai_knowledge_baseUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_knowledge\_base.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ai\_knowledge\_base.operations.updateManyAndReturn.args

> **args**: [`ai_knowledge_baseUpdateManyAndReturnArgs`](ai_knowledge_baseUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>[]

#### model.ai\_knowledge\_base.operations.upsert

> **upsert**: `object`

#### model.ai\_knowledge\_base.operations.upsert.args

> **args**: [`ai_knowledge_baseUpsertArgs`](ai_knowledge_baseUpsertArgs.md)\<`ExtArgs`\>

#### model.ai\_knowledge\_base.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\>

#### model.ai\_knowledge\_base.payload

> **payload**: [`$ai_knowledge_basePayload`]($ai_knowledge_basePayload.md)\<`ExtArgs`\>

#### model.ai\_recommendations

> **ai\_recommendations**: `object`

#### model.ai\_recommendations.fields

> **fields**: [`ai_recommendationsFieldRefs`](../interfaces/ai_recommendationsFieldRefs.md)

#### model.ai\_recommendations.operations

> **operations**: `object`

#### model.ai\_recommendations.operations.aggregate

> **aggregate**: `object`

#### model.ai\_recommendations.operations.aggregate.args

> **args**: [`Ai_recommendationsAggregateArgs`](Ai_recommendationsAggregateArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAi_recommendations`](AggregateAi_recommendations.md)\>

#### model.ai\_recommendations.operations.count

> **count**: `object`

#### model.ai\_recommendations.operations.count.args

> **args**: [`ai_recommendationsCountArgs`](ai_recommendationsCountArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.count.result

> **result**: `$Utils.Optional`\<[`Ai_recommendationsCountAggregateOutputType`](Ai_recommendationsCountAggregateOutputType.md)\> \| `number`

#### model.ai\_recommendations.operations.create

> **create**: `object`

#### model.ai\_recommendations.operations.create.args

> **args**: [`ai_recommendationsCreateArgs`](ai_recommendationsCreateArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>

#### model.ai\_recommendations.operations.createMany

> **createMany**: `object`

#### model.ai\_recommendations.operations.createMany.args

> **args**: [`ai_recommendationsCreateManyArgs`](ai_recommendationsCreateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_recommendations.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ai\_recommendations.operations.createManyAndReturn.args

> **args**: [`ai_recommendationsCreateManyAndReturnArgs`](ai_recommendationsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>[]

#### model.ai\_recommendations.operations.delete

> **delete**: `object`

#### model.ai\_recommendations.operations.delete.args

> **args**: [`ai_recommendationsDeleteArgs`](ai_recommendationsDeleteArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>

#### model.ai\_recommendations.operations.deleteMany

> **deleteMany**: `object`

#### model.ai\_recommendations.operations.deleteMany.args

> **args**: [`ai_recommendationsDeleteManyArgs`](ai_recommendationsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_recommendations.operations.findFirst

> **findFirst**: `object`

#### model.ai\_recommendations.operations.findFirst.args

> **args**: [`ai_recommendationsFindFirstArgs`](ai_recommendationsFindFirstArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\> \| `null`

#### model.ai\_recommendations.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ai\_recommendations.operations.findFirstOrThrow.args

> **args**: [`ai_recommendationsFindFirstOrThrowArgs`](ai_recommendationsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>

#### model.ai\_recommendations.operations.findMany

> **findMany**: `object`

#### model.ai\_recommendations.operations.findMany.args

> **args**: [`ai_recommendationsFindManyArgs`](ai_recommendationsFindManyArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>[]

#### model.ai\_recommendations.operations.findUnique

> **findUnique**: `object`

#### model.ai\_recommendations.operations.findUnique.args

> **args**: [`ai_recommendationsFindUniqueArgs`](ai_recommendationsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\> \| `null`

#### model.ai\_recommendations.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ai\_recommendations.operations.findUniqueOrThrow.args

> **args**: [`ai_recommendationsFindUniqueOrThrowArgs`](ai_recommendationsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>

#### model.ai\_recommendations.operations.groupBy

> **groupBy**: `object`

#### model.ai\_recommendations.operations.groupBy.args

> **args**: [`ai_recommendationsGroupByArgs`](ai_recommendationsGroupByArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Ai_recommendationsGroupByOutputType`](Ai_recommendationsGroupByOutputType.md)\>[]

#### model.ai\_recommendations.operations.update

> **update**: `object`

#### model.ai\_recommendations.operations.update.args

> **args**: [`ai_recommendationsUpdateArgs`](ai_recommendationsUpdateArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>

#### model.ai\_recommendations.operations.updateMany

> **updateMany**: `object`

#### model.ai\_recommendations.operations.updateMany.args

> **args**: [`ai_recommendationsUpdateManyArgs`](ai_recommendationsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_recommendations.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ai\_recommendations.operations.updateManyAndReturn.args

> **args**: [`ai_recommendationsUpdateManyAndReturnArgs`](ai_recommendationsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>[]

#### model.ai\_recommendations.operations.upsert

> **upsert**: `object`

#### model.ai\_recommendations.operations.upsert.args

> **args**: [`ai_recommendationsUpsertArgs`](ai_recommendationsUpsertArgs.md)\<`ExtArgs`\>

#### model.ai\_recommendations.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\>

#### model.ai\_recommendations.payload

> **payload**: [`$ai_recommendationsPayload`]($ai_recommendationsPayload.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events

> **ai\_telemetry\_events**: `object`

#### model.ai\_telemetry\_events.fields

> **fields**: [`ai_telemetry_eventsFieldRefs`](../interfaces/ai_telemetry_eventsFieldRefs.md)

#### model.ai\_telemetry\_events.operations

> **operations**: `object`

#### model.ai\_telemetry\_events.operations.aggregate

> **aggregate**: `object`

#### model.ai\_telemetry\_events.operations.aggregate.args

> **args**: [`Ai_telemetry_eventsAggregateArgs`](Ai_telemetry_eventsAggregateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAi_telemetry_events`](AggregateAi_telemetry_events.md)\>

#### model.ai\_telemetry\_events.operations.count

> **count**: `object`

#### model.ai\_telemetry\_events.operations.count.args

> **args**: [`ai_telemetry_eventsCountArgs`](ai_telemetry_eventsCountArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.count.result

> **result**: `$Utils.Optional`\<[`Ai_telemetry_eventsCountAggregateOutputType`](Ai_telemetry_eventsCountAggregateOutputType.md)\> \| `number`

#### model.ai\_telemetry\_events.operations.create

> **create**: `object`

#### model.ai\_telemetry\_events.operations.create.args

> **args**: [`ai_telemetry_eventsCreateArgs`](ai_telemetry_eventsCreateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>

#### model.ai\_telemetry\_events.operations.createMany

> **createMany**: `object`

#### model.ai\_telemetry\_events.operations.createMany.args

> **args**: [`ai_telemetry_eventsCreateManyArgs`](ai_telemetry_eventsCreateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_events.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ai\_telemetry\_events.operations.createManyAndReturn.args

> **args**: [`ai_telemetry_eventsCreateManyAndReturnArgs`](ai_telemetry_eventsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>[]

#### model.ai\_telemetry\_events.operations.delete

> **delete**: `object`

#### model.ai\_telemetry\_events.operations.delete.args

> **args**: [`ai_telemetry_eventsDeleteArgs`](ai_telemetry_eventsDeleteArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>

#### model.ai\_telemetry\_events.operations.deleteMany

> **deleteMany**: `object`

#### model.ai\_telemetry\_events.operations.deleteMany.args

> **args**: [`ai_telemetry_eventsDeleteManyArgs`](ai_telemetry_eventsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_events.operations.findFirst

> **findFirst**: `object`

#### model.ai\_telemetry\_events.operations.findFirst.args

> **args**: [`ai_telemetry_eventsFindFirstArgs`](ai_telemetry_eventsFindFirstArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\> \| `null`

#### model.ai\_telemetry\_events.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ai\_telemetry\_events.operations.findFirstOrThrow.args

> **args**: [`ai_telemetry_eventsFindFirstOrThrowArgs`](ai_telemetry_eventsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>

#### model.ai\_telemetry\_events.operations.findMany

> **findMany**: `object`

#### model.ai\_telemetry\_events.operations.findMany.args

> **args**: [`ai_telemetry_eventsFindManyArgs`](ai_telemetry_eventsFindManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>[]

#### model.ai\_telemetry\_events.operations.findUnique

> **findUnique**: `object`

#### model.ai\_telemetry\_events.operations.findUnique.args

> **args**: [`ai_telemetry_eventsFindUniqueArgs`](ai_telemetry_eventsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\> \| `null`

#### model.ai\_telemetry\_events.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ai\_telemetry\_events.operations.findUniqueOrThrow.args

> **args**: [`ai_telemetry_eventsFindUniqueOrThrowArgs`](ai_telemetry_eventsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>

#### model.ai\_telemetry\_events.operations.groupBy

> **groupBy**: `object`

#### model.ai\_telemetry\_events.operations.groupBy.args

> **args**: [`ai_telemetry_eventsGroupByArgs`](ai_telemetry_eventsGroupByArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Ai_telemetry_eventsGroupByOutputType`](Ai_telemetry_eventsGroupByOutputType.md)\>[]

#### model.ai\_telemetry\_events.operations.update

> **update**: `object`

#### model.ai\_telemetry\_events.operations.update.args

> **args**: [`ai_telemetry_eventsUpdateArgs`](ai_telemetry_eventsUpdateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>

#### model.ai\_telemetry\_events.operations.updateMany

> **updateMany**: `object`

#### model.ai\_telemetry\_events.operations.updateMany.args

> **args**: [`ai_telemetry_eventsUpdateManyArgs`](ai_telemetry_eventsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_events.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ai\_telemetry\_events.operations.updateManyAndReturn.args

> **args**: [`ai_telemetry_eventsUpdateManyAndReturnArgs`](ai_telemetry_eventsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>[]

#### model.ai\_telemetry\_events.operations.upsert

> **upsert**: `object`

#### model.ai\_telemetry\_events.operations.upsert.args

> **args**: [`ai_telemetry_eventsUpsertArgs`](ai_telemetry_eventsUpsertArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_events.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\>

#### model.ai\_telemetry\_events.payload

> **payload**: [`$ai_telemetry_eventsPayload`]($ai_telemetry_eventsPayload.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs

> **ai\_telemetry\_logs**: `object`

#### model.ai\_telemetry\_logs.fields

> **fields**: [`ai_telemetry_logsFieldRefs`](../interfaces/ai_telemetry_logsFieldRefs.md)

#### model.ai\_telemetry\_logs.operations

> **operations**: `object`

#### model.ai\_telemetry\_logs.operations.aggregate

> **aggregate**: `object`

#### model.ai\_telemetry\_logs.operations.aggregate.args

> **args**: [`Ai_telemetry_logsAggregateArgs`](Ai_telemetry_logsAggregateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAi_telemetry_logs`](AggregateAi_telemetry_logs.md)\>

#### model.ai\_telemetry\_logs.operations.count

> **count**: `object`

#### model.ai\_telemetry\_logs.operations.count.args

> **args**: [`ai_telemetry_logsCountArgs`](ai_telemetry_logsCountArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.count.result

> **result**: `$Utils.Optional`\<[`Ai_telemetry_logsCountAggregateOutputType`](Ai_telemetry_logsCountAggregateOutputType.md)\> \| `number`

#### model.ai\_telemetry\_logs.operations.create

> **create**: `object`

#### model.ai\_telemetry\_logs.operations.create.args

> **args**: [`ai_telemetry_logsCreateArgs`](ai_telemetry_logsCreateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>

#### model.ai\_telemetry\_logs.operations.createMany

> **createMany**: `object`

#### model.ai\_telemetry\_logs.operations.createMany.args

> **args**: [`ai_telemetry_logsCreateManyArgs`](ai_telemetry_logsCreateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_logs.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ai\_telemetry\_logs.operations.createManyAndReturn.args

> **args**: [`ai_telemetry_logsCreateManyAndReturnArgs`](ai_telemetry_logsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>[]

#### model.ai\_telemetry\_logs.operations.delete

> **delete**: `object`

#### model.ai\_telemetry\_logs.operations.delete.args

> **args**: [`ai_telemetry_logsDeleteArgs`](ai_telemetry_logsDeleteArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>

#### model.ai\_telemetry\_logs.operations.deleteMany

> **deleteMany**: `object`

#### model.ai\_telemetry\_logs.operations.deleteMany.args

> **args**: [`ai_telemetry_logsDeleteManyArgs`](ai_telemetry_logsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_logs.operations.findFirst

> **findFirst**: `object`

#### model.ai\_telemetry\_logs.operations.findFirst.args

> **args**: [`ai_telemetry_logsFindFirstArgs`](ai_telemetry_logsFindFirstArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\> \| `null`

#### model.ai\_telemetry\_logs.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ai\_telemetry\_logs.operations.findFirstOrThrow.args

> **args**: [`ai_telemetry_logsFindFirstOrThrowArgs`](ai_telemetry_logsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>

#### model.ai\_telemetry\_logs.operations.findMany

> **findMany**: `object`

#### model.ai\_telemetry\_logs.operations.findMany.args

> **args**: [`ai_telemetry_logsFindManyArgs`](ai_telemetry_logsFindManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>[]

#### model.ai\_telemetry\_logs.operations.findUnique

> **findUnique**: `object`

#### model.ai\_telemetry\_logs.operations.findUnique.args

> **args**: [`ai_telemetry_logsFindUniqueArgs`](ai_telemetry_logsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\> \| `null`

#### model.ai\_telemetry\_logs.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ai\_telemetry\_logs.operations.findUniqueOrThrow.args

> **args**: [`ai_telemetry_logsFindUniqueOrThrowArgs`](ai_telemetry_logsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>

#### model.ai\_telemetry\_logs.operations.groupBy

> **groupBy**: `object`

#### model.ai\_telemetry\_logs.operations.groupBy.args

> **args**: [`ai_telemetry_logsGroupByArgs`](ai_telemetry_logsGroupByArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Ai_telemetry_logsGroupByOutputType`](Ai_telemetry_logsGroupByOutputType.md)\>[]

#### model.ai\_telemetry\_logs.operations.update

> **update**: `object`

#### model.ai\_telemetry\_logs.operations.update.args

> **args**: [`ai_telemetry_logsUpdateArgs`](ai_telemetry_logsUpdateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>

#### model.ai\_telemetry\_logs.operations.updateMany

> **updateMany**: `object`

#### model.ai\_telemetry\_logs.operations.updateMany.args

> **args**: [`ai_telemetry_logsUpdateManyArgs`](ai_telemetry_logsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_logs.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ai\_telemetry\_logs.operations.updateManyAndReturn.args

> **args**: [`ai_telemetry_logsUpdateManyAndReturnArgs`](ai_telemetry_logsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>[]

#### model.ai\_telemetry\_logs.operations.upsert

> **upsert**: `object`

#### model.ai\_telemetry\_logs.operations.upsert.args

> **args**: [`ai_telemetry_logsUpsertArgs`](ai_telemetry_logsUpsertArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_logs.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\>

#### model.ai\_telemetry\_logs.payload

> **payload**: [`$ai_telemetry_logsPayload`]($ai_telemetry_logsPayload.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions

> **ai\_telemetry\_versions**: `object`

#### model.ai\_telemetry\_versions.fields

> **fields**: [`ai_telemetry_versionsFieldRefs`](../interfaces/ai_telemetry_versionsFieldRefs.md)

#### model.ai\_telemetry\_versions.operations

> **operations**: `object`

#### model.ai\_telemetry\_versions.operations.aggregate

> **aggregate**: `object`

#### model.ai\_telemetry\_versions.operations.aggregate.args

> **args**: [`Ai_telemetry_versionsAggregateArgs`](Ai_telemetry_versionsAggregateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAi_telemetry_versions`](AggregateAi_telemetry_versions.md)\>

#### model.ai\_telemetry\_versions.operations.count

> **count**: `object`

#### model.ai\_telemetry\_versions.operations.count.args

> **args**: [`ai_telemetry_versionsCountArgs`](ai_telemetry_versionsCountArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.count.result

> **result**: `$Utils.Optional`\<[`Ai_telemetry_versionsCountAggregateOutputType`](Ai_telemetry_versionsCountAggregateOutputType.md)\> \| `number`

#### model.ai\_telemetry\_versions.operations.create

> **create**: `object`

#### model.ai\_telemetry\_versions.operations.create.args

> **args**: [`ai_telemetry_versionsCreateArgs`](ai_telemetry_versionsCreateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>

#### model.ai\_telemetry\_versions.operations.createMany

> **createMany**: `object`

#### model.ai\_telemetry\_versions.operations.createMany.args

> **args**: [`ai_telemetry_versionsCreateManyArgs`](ai_telemetry_versionsCreateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_versions.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ai\_telemetry\_versions.operations.createManyAndReturn.args

> **args**: [`ai_telemetry_versionsCreateManyAndReturnArgs`](ai_telemetry_versionsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>[]

#### model.ai\_telemetry\_versions.operations.delete

> **delete**: `object`

#### model.ai\_telemetry\_versions.operations.delete.args

> **args**: [`ai_telemetry_versionsDeleteArgs`](ai_telemetry_versionsDeleteArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>

#### model.ai\_telemetry\_versions.operations.deleteMany

> **deleteMany**: `object`

#### model.ai\_telemetry\_versions.operations.deleteMany.args

> **args**: [`ai_telemetry_versionsDeleteManyArgs`](ai_telemetry_versionsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_versions.operations.findFirst

> **findFirst**: `object`

#### model.ai\_telemetry\_versions.operations.findFirst.args

> **args**: [`ai_telemetry_versionsFindFirstArgs`](ai_telemetry_versionsFindFirstArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\> \| `null`

#### model.ai\_telemetry\_versions.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ai\_telemetry\_versions.operations.findFirstOrThrow.args

> **args**: [`ai_telemetry_versionsFindFirstOrThrowArgs`](ai_telemetry_versionsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>

#### model.ai\_telemetry\_versions.operations.findMany

> **findMany**: `object`

#### model.ai\_telemetry\_versions.operations.findMany.args

> **args**: [`ai_telemetry_versionsFindManyArgs`](ai_telemetry_versionsFindManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>[]

#### model.ai\_telemetry\_versions.operations.findUnique

> **findUnique**: `object`

#### model.ai\_telemetry\_versions.operations.findUnique.args

> **args**: [`ai_telemetry_versionsFindUniqueArgs`](ai_telemetry_versionsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\> \| `null`

#### model.ai\_telemetry\_versions.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ai\_telemetry\_versions.operations.findUniqueOrThrow.args

> **args**: [`ai_telemetry_versionsFindUniqueOrThrowArgs`](ai_telemetry_versionsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>

#### model.ai\_telemetry\_versions.operations.groupBy

> **groupBy**: `object`

#### model.ai\_telemetry\_versions.operations.groupBy.args

> **args**: [`ai_telemetry_versionsGroupByArgs`](ai_telemetry_versionsGroupByArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Ai_telemetry_versionsGroupByOutputType`](Ai_telemetry_versionsGroupByOutputType.md)\>[]

#### model.ai\_telemetry\_versions.operations.update

> **update**: `object`

#### model.ai\_telemetry\_versions.operations.update.args

> **args**: [`ai_telemetry_versionsUpdateArgs`](ai_telemetry_versionsUpdateArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>

#### model.ai\_telemetry\_versions.operations.updateMany

> **updateMany**: `object`

#### model.ai\_telemetry\_versions.operations.updateMany.args

> **args**: [`ai_telemetry_versionsUpdateManyArgs`](ai_telemetry_versionsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_telemetry\_versions.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ai\_telemetry\_versions.operations.updateManyAndReturn.args

> **args**: [`ai_telemetry_versionsUpdateManyAndReturnArgs`](ai_telemetry_versionsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>[]

#### model.ai\_telemetry\_versions.operations.upsert

> **upsert**: `object`

#### model.ai\_telemetry\_versions.operations.upsert.args

> **args**: [`ai_telemetry_versionsUpsertArgs`](ai_telemetry_versionsUpsertArgs.md)\<`ExtArgs`\>

#### model.ai\_telemetry\_versions.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\>

#### model.ai\_telemetry\_versions.payload

> **payload**: [`$ai_telemetry_versionsPayload`]($ai_telemetry_versionsPayload.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots

> **ai\_transition\_snapshots**: `object`

#### model.ai\_transition\_snapshots.fields

> **fields**: [`ai_transition_snapshotsFieldRefs`](../interfaces/ai_transition_snapshotsFieldRefs.md)

#### model.ai\_transition\_snapshots.operations

> **operations**: `object`

#### model.ai\_transition\_snapshots.operations.aggregate

> **aggregate**: `object`

#### model.ai\_transition\_snapshots.operations.aggregate.args

> **args**: [`Ai_transition_snapshotsAggregateArgs`](Ai_transition_snapshotsAggregateArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAi_transition_snapshots`](AggregateAi_transition_snapshots.md)\>

#### model.ai\_transition\_snapshots.operations.count

> **count**: `object`

#### model.ai\_transition\_snapshots.operations.count.args

> **args**: [`ai_transition_snapshotsCountArgs`](ai_transition_snapshotsCountArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.count.result

> **result**: `$Utils.Optional`\<[`Ai_transition_snapshotsCountAggregateOutputType`](Ai_transition_snapshotsCountAggregateOutputType.md)\> \| `number`

#### model.ai\_transition\_snapshots.operations.create

> **create**: `object`

#### model.ai\_transition\_snapshots.operations.create.args

> **args**: [`ai_transition_snapshotsCreateArgs`](ai_transition_snapshotsCreateArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>

#### model.ai\_transition\_snapshots.operations.createMany

> **createMany**: `object`

#### model.ai\_transition\_snapshots.operations.createMany.args

> **args**: [`ai_transition_snapshotsCreateManyArgs`](ai_transition_snapshotsCreateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_transition\_snapshots.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ai\_transition\_snapshots.operations.createManyAndReturn.args

> **args**: [`ai_transition_snapshotsCreateManyAndReturnArgs`](ai_transition_snapshotsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>[]

#### model.ai\_transition\_snapshots.operations.delete

> **delete**: `object`

#### model.ai\_transition\_snapshots.operations.delete.args

> **args**: [`ai_transition_snapshotsDeleteArgs`](ai_transition_snapshotsDeleteArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>

#### model.ai\_transition\_snapshots.operations.deleteMany

> **deleteMany**: `object`

#### model.ai\_transition\_snapshots.operations.deleteMany.args

> **args**: [`ai_transition_snapshotsDeleteManyArgs`](ai_transition_snapshotsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_transition\_snapshots.operations.findFirst

> **findFirst**: `object`

#### model.ai\_transition\_snapshots.operations.findFirst.args

> **args**: [`ai_transition_snapshotsFindFirstArgs`](ai_transition_snapshotsFindFirstArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\> \| `null`

#### model.ai\_transition\_snapshots.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ai\_transition\_snapshots.operations.findFirstOrThrow.args

> **args**: [`ai_transition_snapshotsFindFirstOrThrowArgs`](ai_transition_snapshotsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>

#### model.ai\_transition\_snapshots.operations.findMany

> **findMany**: `object`

#### model.ai\_transition\_snapshots.operations.findMany.args

> **args**: [`ai_transition_snapshotsFindManyArgs`](ai_transition_snapshotsFindManyArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>[]

#### model.ai\_transition\_snapshots.operations.findUnique

> **findUnique**: `object`

#### model.ai\_transition\_snapshots.operations.findUnique.args

> **args**: [`ai_transition_snapshotsFindUniqueArgs`](ai_transition_snapshotsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\> \| `null`

#### model.ai\_transition\_snapshots.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ai\_transition\_snapshots.operations.findUniqueOrThrow.args

> **args**: [`ai_transition_snapshotsFindUniqueOrThrowArgs`](ai_transition_snapshotsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>

#### model.ai\_transition\_snapshots.operations.groupBy

> **groupBy**: `object`

#### model.ai\_transition\_snapshots.operations.groupBy.args

> **args**: [`ai_transition_snapshotsGroupByArgs`](ai_transition_snapshotsGroupByArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Ai_transition_snapshotsGroupByOutputType`](Ai_transition_snapshotsGroupByOutputType.md)\>[]

#### model.ai\_transition\_snapshots.operations.update

> **update**: `object`

#### model.ai\_transition\_snapshots.operations.update.args

> **args**: [`ai_transition_snapshotsUpdateArgs`](ai_transition_snapshotsUpdateArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>

#### model.ai\_transition\_snapshots.operations.updateMany

> **updateMany**: `object`

#### model.ai\_transition\_snapshots.operations.updateMany.args

> **args**: [`ai_transition_snapshotsUpdateManyArgs`](ai_transition_snapshotsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ai\_transition\_snapshots.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ai\_transition\_snapshots.operations.updateManyAndReturn.args

> **args**: [`ai_transition_snapshotsUpdateManyAndReturnArgs`](ai_transition_snapshotsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>[]

#### model.ai\_transition\_snapshots.operations.upsert

> **upsert**: `object`

#### model.ai\_transition\_snapshots.operations.upsert.args

> **args**: [`ai_transition_snapshotsUpsertArgs`](ai_transition_snapshotsUpsertArgs.md)\<`ExtArgs`\>

#### model.ai\_transition\_snapshots.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\>

#### model.ai\_transition\_snapshots.payload

> **payload**: [`$ai_transition_snapshotsPayload`]($ai_transition_snapshotsPayload.md)\<`ExtArgs`\>

#### model.AiEvaluation

> **AiEvaluation**: `object`

#### model.AiEvaluation.fields

> **fields**: [`AiEvaluationFieldRefs`](../interfaces/AiEvaluationFieldRefs.md)

#### model.AiEvaluation.operations

> **operations**: `object`

#### model.AiEvaluation.operations.aggregate

> **aggregate**: `object`

#### model.AiEvaluation.operations.aggregate.args

> **args**: [`AiEvaluationAggregateArgs`](AiEvaluationAggregateArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAiEvaluation`](AggregateAiEvaluation.md)\>

#### model.AiEvaluation.operations.count

> **count**: `object`

#### model.AiEvaluation.operations.count.args

> **args**: [`AiEvaluationCountArgs`](AiEvaluationCountArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.count.result

> **result**: `$Utils.Optional`\<[`AiEvaluationCountAggregateOutputType`](AiEvaluationCountAggregateOutputType.md)\> \| `number`

#### model.AiEvaluation.operations.create

> **create**: `object`

#### model.AiEvaluation.operations.create.args

> **args**: [`AiEvaluationCreateArgs`](AiEvaluationCreateArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>

#### model.AiEvaluation.operations.createMany

> **createMany**: `object`

#### model.AiEvaluation.operations.createMany.args

> **args**: [`AiEvaluationCreateManyArgs`](AiEvaluationCreateManyArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiEvaluation.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.AiEvaluation.operations.createManyAndReturn.args

> **args**: [`AiEvaluationCreateManyAndReturnArgs`](AiEvaluationCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>[]

#### model.AiEvaluation.operations.delete

> **delete**: `object`

#### model.AiEvaluation.operations.delete.args

> **args**: [`AiEvaluationDeleteArgs`](AiEvaluationDeleteArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>

#### model.AiEvaluation.operations.deleteMany

> **deleteMany**: `object`

#### model.AiEvaluation.operations.deleteMany.args

> **args**: [`AiEvaluationDeleteManyArgs`](AiEvaluationDeleteManyArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiEvaluation.operations.findFirst

> **findFirst**: `object`

#### model.AiEvaluation.operations.findFirst.args

> **args**: [`AiEvaluationFindFirstArgs`](AiEvaluationFindFirstArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\> \| `null`

#### model.AiEvaluation.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.AiEvaluation.operations.findFirstOrThrow.args

> **args**: [`AiEvaluationFindFirstOrThrowArgs`](AiEvaluationFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>

#### model.AiEvaluation.operations.findMany

> **findMany**: `object`

#### model.AiEvaluation.operations.findMany.args

> **args**: [`AiEvaluationFindManyArgs`](AiEvaluationFindManyArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>[]

#### model.AiEvaluation.operations.findUnique

> **findUnique**: `object`

#### model.AiEvaluation.operations.findUnique.args

> **args**: [`AiEvaluationFindUniqueArgs`](AiEvaluationFindUniqueArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\> \| `null`

#### model.AiEvaluation.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.AiEvaluation.operations.findUniqueOrThrow.args

> **args**: [`AiEvaluationFindUniqueOrThrowArgs`](AiEvaluationFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>

#### model.AiEvaluation.operations.groupBy

> **groupBy**: `object`

#### model.AiEvaluation.operations.groupBy.args

> **args**: [`AiEvaluationGroupByArgs`](AiEvaluationGroupByArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`AiEvaluationGroupByOutputType`](AiEvaluationGroupByOutputType.md)\>[]

#### model.AiEvaluation.operations.update

> **update**: `object`

#### model.AiEvaluation.operations.update.args

> **args**: [`AiEvaluationUpdateArgs`](AiEvaluationUpdateArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>

#### model.AiEvaluation.operations.updateMany

> **updateMany**: `object`

#### model.AiEvaluation.operations.updateMany.args

> **args**: [`AiEvaluationUpdateManyArgs`](AiEvaluationUpdateManyArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiEvaluation.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.AiEvaluation.operations.updateManyAndReturn.args

> **args**: [`AiEvaluationUpdateManyAndReturnArgs`](AiEvaluationUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>[]

#### model.AiEvaluation.operations.upsert

> **upsert**: `object`

#### model.AiEvaluation.operations.upsert.args

> **args**: [`AiEvaluationUpsertArgs`](AiEvaluationUpsertArgs.md)\<`ExtArgs`\>

#### model.AiEvaluation.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$AiEvaluationPayload`]($AiEvaluationPayload.md)\>

#### model.AiEvaluation.payload

> **payload**: [`$AiEvaluationPayload`]($AiEvaluationPayload.md)\<`ExtArgs`\>

#### model.AiFeature

> **AiFeature**: `object`

#### model.AiFeature.fields

> **fields**: [`AiFeatureFieldRefs`](../interfaces/AiFeatureFieldRefs.md)

#### model.AiFeature.operations

> **operations**: `object`

#### model.AiFeature.operations.aggregate

> **aggregate**: `object`

#### model.AiFeature.operations.aggregate.args

> **args**: [`AiFeatureAggregateArgs`](AiFeatureAggregateArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAiFeature`](AggregateAiFeature.md)\>

#### model.AiFeature.operations.count

> **count**: `object`

#### model.AiFeature.operations.count.args

> **args**: [`AiFeatureCountArgs`](AiFeatureCountArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.count.result

> **result**: `$Utils.Optional`\<[`AiFeatureCountAggregateOutputType`](AiFeatureCountAggregateOutputType.md)\> \| `number`

#### model.AiFeature.operations.create

> **create**: `object`

#### model.AiFeature.operations.create.args

> **args**: [`AiFeatureCreateArgs`](AiFeatureCreateArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>

#### model.AiFeature.operations.createMany

> **createMany**: `object`

#### model.AiFeature.operations.createMany.args

> **args**: [`AiFeatureCreateManyArgs`](AiFeatureCreateManyArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiFeature.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.AiFeature.operations.createManyAndReturn.args

> **args**: [`AiFeatureCreateManyAndReturnArgs`](AiFeatureCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>[]

#### model.AiFeature.operations.delete

> **delete**: `object`

#### model.AiFeature.operations.delete.args

> **args**: [`AiFeatureDeleteArgs`](AiFeatureDeleteArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>

#### model.AiFeature.operations.deleteMany

> **deleteMany**: `object`

#### model.AiFeature.operations.deleteMany.args

> **args**: [`AiFeatureDeleteManyArgs`](AiFeatureDeleteManyArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiFeature.operations.findFirst

> **findFirst**: `object`

#### model.AiFeature.operations.findFirst.args

> **args**: [`AiFeatureFindFirstArgs`](AiFeatureFindFirstArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\> \| `null`

#### model.AiFeature.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.AiFeature.operations.findFirstOrThrow.args

> **args**: [`AiFeatureFindFirstOrThrowArgs`](AiFeatureFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>

#### model.AiFeature.operations.findMany

> **findMany**: `object`

#### model.AiFeature.operations.findMany.args

> **args**: [`AiFeatureFindManyArgs`](AiFeatureFindManyArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>[]

#### model.AiFeature.operations.findUnique

> **findUnique**: `object`

#### model.AiFeature.operations.findUnique.args

> **args**: [`AiFeatureFindUniqueArgs`](AiFeatureFindUniqueArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\> \| `null`

#### model.AiFeature.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.AiFeature.operations.findUniqueOrThrow.args

> **args**: [`AiFeatureFindUniqueOrThrowArgs`](AiFeatureFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>

#### model.AiFeature.operations.groupBy

> **groupBy**: `object`

#### model.AiFeature.operations.groupBy.args

> **args**: [`AiFeatureGroupByArgs`](AiFeatureGroupByArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`AiFeatureGroupByOutputType`](AiFeatureGroupByOutputType.md)\>[]

#### model.AiFeature.operations.update

> **update**: `object`

#### model.AiFeature.operations.update.args

> **args**: [`AiFeatureUpdateArgs`](AiFeatureUpdateArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>

#### model.AiFeature.operations.updateMany

> **updateMany**: `object`

#### model.AiFeature.operations.updateMany.args

> **args**: [`AiFeatureUpdateManyArgs`](AiFeatureUpdateManyArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiFeature.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.AiFeature.operations.updateManyAndReturn.args

> **args**: [`AiFeatureUpdateManyAndReturnArgs`](AiFeatureUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>[]

#### model.AiFeature.operations.upsert

> **upsert**: `object`

#### model.AiFeature.operations.upsert.args

> **args**: [`AiFeatureUpsertArgs`](AiFeatureUpsertArgs.md)\<`ExtArgs`\>

#### model.AiFeature.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$AiFeaturePayload`]($AiFeaturePayload.md)\>

#### model.AiFeature.payload

> **payload**: [`$AiFeaturePayload`]($AiFeaturePayload.md)\<`ExtArgs`\>

#### model.AiModel

> **AiModel**: `object`

#### model.AiModel.fields

> **fields**: [`AiModelFieldRefs`](../interfaces/AiModelFieldRefs.md)

#### model.AiModel.operations

> **operations**: `object`

#### model.AiModel.operations.aggregate

> **aggregate**: `object`

#### model.AiModel.operations.aggregate.args

> **args**: [`AiModelAggregateArgs`](AiModelAggregateArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAiModel`](AggregateAiModel.md)\>

#### model.AiModel.operations.count

> **count**: `object`

#### model.AiModel.operations.count.args

> **args**: [`AiModelCountArgs`](AiModelCountArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.count.result

> **result**: `$Utils.Optional`\<[`AiModelCountAggregateOutputType`](AiModelCountAggregateOutputType.md)\> \| `number`

#### model.AiModel.operations.create

> **create**: `object`

#### model.AiModel.operations.create.args

> **args**: [`AiModelCreateArgs`](AiModelCreateArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>

#### model.AiModel.operations.createMany

> **createMany**: `object`

#### model.AiModel.operations.createMany.args

> **args**: [`AiModelCreateManyArgs`](AiModelCreateManyArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiModel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.AiModel.operations.createManyAndReturn.args

> **args**: [`AiModelCreateManyAndReturnArgs`](AiModelCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>[]

#### model.AiModel.operations.delete

> **delete**: `object`

#### model.AiModel.operations.delete.args

> **args**: [`AiModelDeleteArgs`](AiModelDeleteArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>

#### model.AiModel.operations.deleteMany

> **deleteMany**: `object`

#### model.AiModel.operations.deleteMany.args

> **args**: [`AiModelDeleteManyArgs`](AiModelDeleteManyArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiModel.operations.findFirst

> **findFirst**: `object`

#### model.AiModel.operations.findFirst.args

> **args**: [`AiModelFindFirstArgs`](AiModelFindFirstArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\> \| `null`

#### model.AiModel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.AiModel.operations.findFirstOrThrow.args

> **args**: [`AiModelFindFirstOrThrowArgs`](AiModelFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>

#### model.AiModel.operations.findMany

> **findMany**: `object`

#### model.AiModel.operations.findMany.args

> **args**: [`AiModelFindManyArgs`](AiModelFindManyArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>[]

#### model.AiModel.operations.findUnique

> **findUnique**: `object`

#### model.AiModel.operations.findUnique.args

> **args**: [`AiModelFindUniqueArgs`](AiModelFindUniqueArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\> \| `null`

#### model.AiModel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.AiModel.operations.findUniqueOrThrow.args

> **args**: [`AiModelFindUniqueOrThrowArgs`](AiModelFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>

#### model.AiModel.operations.groupBy

> **groupBy**: `object`

#### model.AiModel.operations.groupBy.args

> **args**: [`AiModelGroupByArgs`](AiModelGroupByArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`AiModelGroupByOutputType`](AiModelGroupByOutputType.md)\>[]

#### model.AiModel.operations.update

> **update**: `object`

#### model.AiModel.operations.update.args

> **args**: [`AiModelUpdateArgs`](AiModelUpdateArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>

#### model.AiModel.operations.updateMany

> **updateMany**: `object`

#### model.AiModel.operations.updateMany.args

> **args**: [`AiModelUpdateManyArgs`](AiModelUpdateManyArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.AiModel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.AiModel.operations.updateManyAndReturn.args

> **args**: [`AiModelUpdateManyAndReturnArgs`](AiModelUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>[]

#### model.AiModel.operations.upsert

> **upsert**: `object`

#### model.AiModel.operations.upsert.args

> **args**: [`AiModelUpsertArgs`](AiModelUpsertArgs.md)\<`ExtArgs`\>

#### model.AiModel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$AiModelPayload`]($AiModelPayload.md)\>

#### model.AiModel.payload

> **payload**: [`$AiModelPayload`]($AiModelPayload.md)\<`ExtArgs`\>

#### model.aiRewardLog

> **aiRewardLog**: `object`

#### model.aiRewardLog.fields

> **fields**: [`aiRewardLogFieldRefs`](../interfaces/aiRewardLogFieldRefs.md)

#### model.aiRewardLog.operations

> **operations**: `object`

#### model.aiRewardLog.operations.aggregate

> **aggregate**: `object`

#### model.aiRewardLog.operations.aggregate.args

> **args**: [`AiRewardLogAggregateArgs`](AiRewardLogAggregateArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAiRewardLog`](AggregateAiRewardLog.md)\>

#### model.aiRewardLog.operations.count

> **count**: `object`

#### model.aiRewardLog.operations.count.args

> **args**: [`aiRewardLogCountArgs`](aiRewardLogCountArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.count.result

> **result**: `$Utils.Optional`\<[`AiRewardLogCountAggregateOutputType`](AiRewardLogCountAggregateOutputType.md)\> \| `number`

#### model.aiRewardLog.operations.create

> **create**: `object`

#### model.aiRewardLog.operations.create.args

> **args**: [`aiRewardLogCreateArgs`](aiRewardLogCreateArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>

#### model.aiRewardLog.operations.createMany

> **createMany**: `object`

#### model.aiRewardLog.operations.createMany.args

> **args**: [`aiRewardLogCreateManyArgs`](aiRewardLogCreateManyArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.aiRewardLog.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.aiRewardLog.operations.createManyAndReturn.args

> **args**: [`aiRewardLogCreateManyAndReturnArgs`](aiRewardLogCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>[]

#### model.aiRewardLog.operations.delete

> **delete**: `object`

#### model.aiRewardLog.operations.delete.args

> **args**: [`aiRewardLogDeleteArgs`](aiRewardLogDeleteArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>

#### model.aiRewardLog.operations.deleteMany

> **deleteMany**: `object`

#### model.aiRewardLog.operations.deleteMany.args

> **args**: [`aiRewardLogDeleteManyArgs`](aiRewardLogDeleteManyArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.aiRewardLog.operations.findFirst

> **findFirst**: `object`

#### model.aiRewardLog.operations.findFirst.args

> **args**: [`aiRewardLogFindFirstArgs`](aiRewardLogFindFirstArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\> \| `null`

#### model.aiRewardLog.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.aiRewardLog.operations.findFirstOrThrow.args

> **args**: [`aiRewardLogFindFirstOrThrowArgs`](aiRewardLogFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>

#### model.aiRewardLog.operations.findMany

> **findMany**: `object`

#### model.aiRewardLog.operations.findMany.args

> **args**: [`aiRewardLogFindManyArgs`](aiRewardLogFindManyArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>[]

#### model.aiRewardLog.operations.findUnique

> **findUnique**: `object`

#### model.aiRewardLog.operations.findUnique.args

> **args**: [`aiRewardLogFindUniqueArgs`](aiRewardLogFindUniqueArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\> \| `null`

#### model.aiRewardLog.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.aiRewardLog.operations.findUniqueOrThrow.args

> **args**: [`aiRewardLogFindUniqueOrThrowArgs`](aiRewardLogFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>

#### model.aiRewardLog.operations.groupBy

> **groupBy**: `object`

#### model.aiRewardLog.operations.groupBy.args

> **args**: [`aiRewardLogGroupByArgs`](aiRewardLogGroupByArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`AiRewardLogGroupByOutputType`](AiRewardLogGroupByOutputType.md)\>[]

#### model.aiRewardLog.operations.update

> **update**: `object`

#### model.aiRewardLog.operations.update.args

> **args**: [`aiRewardLogUpdateArgs`](aiRewardLogUpdateArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>

#### model.aiRewardLog.operations.updateMany

> **updateMany**: `object`

#### model.aiRewardLog.operations.updateMany.args

> **args**: [`aiRewardLogUpdateManyArgs`](aiRewardLogUpdateManyArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.aiRewardLog.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.aiRewardLog.operations.updateManyAndReturn.args

> **args**: [`aiRewardLogUpdateManyAndReturnArgs`](aiRewardLogUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>[]

#### model.aiRewardLog.operations.upsert

> **upsert**: `object`

#### model.aiRewardLog.operations.upsert.args

> **args**: [`aiRewardLogUpsertArgs`](aiRewardLogUpsertArgs.md)\<`ExtArgs`\>

#### model.aiRewardLog.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$aiRewardLogPayload`]($aiRewardLogPayload.md)\>

#### model.aiRewardLog.payload

> **payload**: [`$aiRewardLogPayload`]($aiRewardLogPayload.md)\<`ExtArgs`\>

#### model.audit\_logs

> **audit\_logs**: `object`

#### model.audit\_logs.fields

> **fields**: [`audit_logsFieldRefs`](../interfaces/audit_logsFieldRefs.md)

#### model.audit\_logs.operations

> **operations**: `object`

#### model.audit\_logs.operations.aggregate

> **aggregate**: `object`

#### model.audit\_logs.operations.aggregate.args

> **args**: [`Audit_logsAggregateArgs`](Audit_logsAggregateArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateAudit_logs`](AggregateAudit_logs.md)\>

#### model.audit\_logs.operations.count

> **count**: `object`

#### model.audit\_logs.operations.count.args

> **args**: [`audit_logsCountArgs`](audit_logsCountArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.count.result

> **result**: `$Utils.Optional`\<[`Audit_logsCountAggregateOutputType`](Audit_logsCountAggregateOutputType.md)\> \| `number`

#### model.audit\_logs.operations.create

> **create**: `object`

#### model.audit\_logs.operations.create.args

> **args**: [`audit_logsCreateArgs`](audit_logsCreateArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>

#### model.audit\_logs.operations.createMany

> **createMany**: `object`

#### model.audit\_logs.operations.createMany.args

> **args**: [`audit_logsCreateManyArgs`](audit_logsCreateManyArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.audit\_logs.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.audit\_logs.operations.createManyAndReturn.args

> **args**: [`audit_logsCreateManyAndReturnArgs`](audit_logsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>[]

#### model.audit\_logs.operations.delete

> **delete**: `object`

#### model.audit\_logs.operations.delete.args

> **args**: [`audit_logsDeleteArgs`](audit_logsDeleteArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>

#### model.audit\_logs.operations.deleteMany

> **deleteMany**: `object`

#### model.audit\_logs.operations.deleteMany.args

> **args**: [`audit_logsDeleteManyArgs`](audit_logsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.audit\_logs.operations.findFirst

> **findFirst**: `object`

#### model.audit\_logs.operations.findFirst.args

> **args**: [`audit_logsFindFirstArgs`](audit_logsFindFirstArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\> \| `null`

#### model.audit\_logs.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.audit\_logs.operations.findFirstOrThrow.args

> **args**: [`audit_logsFindFirstOrThrowArgs`](audit_logsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>

#### model.audit\_logs.operations.findMany

> **findMany**: `object`

#### model.audit\_logs.operations.findMany.args

> **args**: [`audit_logsFindManyArgs`](audit_logsFindManyArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>[]

#### model.audit\_logs.operations.findUnique

> **findUnique**: `object`

#### model.audit\_logs.operations.findUnique.args

> **args**: [`audit_logsFindUniqueArgs`](audit_logsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\> \| `null`

#### model.audit\_logs.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.audit\_logs.operations.findUniqueOrThrow.args

> **args**: [`audit_logsFindUniqueOrThrowArgs`](audit_logsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>

#### model.audit\_logs.operations.groupBy

> **groupBy**: `object`

#### model.audit\_logs.operations.groupBy.args

> **args**: [`audit_logsGroupByArgs`](audit_logsGroupByArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Audit_logsGroupByOutputType`](Audit_logsGroupByOutputType.md)\>[]

#### model.audit\_logs.operations.update

> **update**: `object`

#### model.audit\_logs.operations.update.args

> **args**: [`audit_logsUpdateArgs`](audit_logsUpdateArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>

#### model.audit\_logs.operations.updateMany

> **updateMany**: `object`

#### model.audit\_logs.operations.updateMany.args

> **args**: [`audit_logsUpdateManyArgs`](audit_logsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.audit\_logs.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.audit\_logs.operations.updateManyAndReturn.args

> **args**: [`audit_logsUpdateManyAndReturnArgs`](audit_logsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>[]

#### model.audit\_logs.operations.upsert

> **upsert**: `object`

#### model.audit\_logs.operations.upsert.args

> **args**: [`audit_logsUpsertArgs`](audit_logsUpsertArgs.md)\<`ExtArgs`\>

#### model.audit\_logs.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$audit_logsPayload`]($audit_logsPayload.md)\>

#### model.audit\_logs.payload

> **payload**: [`$audit_logsPayload`]($audit_logsPayload.md)\<`ExtArgs`\>

#### model.CategoriesRury

> **CategoriesRury**: `object`

#### model.CategoriesRury.fields

> **fields**: [`CategoriesRuryFieldRefs`](../interfaces/CategoriesRuryFieldRefs.md)

#### model.CategoriesRury.operations

> **operations**: `object`

#### model.CategoriesRury.operations.aggregate

> **aggregate**: `object`

#### model.CategoriesRury.operations.aggregate.args

> **args**: [`CategoriesRuryAggregateArgs`](CategoriesRuryAggregateArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateCategoriesRury`](AggregateCategoriesRury.md)\>

#### model.CategoriesRury.operations.count

> **count**: `object`

#### model.CategoriesRury.operations.count.args

> **args**: [`CategoriesRuryCountArgs`](CategoriesRuryCountArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.count.result

> **result**: `$Utils.Optional`\<[`CategoriesRuryCountAggregateOutputType`](CategoriesRuryCountAggregateOutputType.md)\> \| `number`

#### model.CategoriesRury.operations.create

> **create**: `object`

#### model.CategoriesRury.operations.create.args

> **args**: [`CategoriesRuryCreateArgs`](CategoriesRuryCreateArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>

#### model.CategoriesRury.operations.createMany

> **createMany**: `object`

#### model.CategoriesRury.operations.createMany.args

> **args**: [`CategoriesRuryCreateManyArgs`](CategoriesRuryCreateManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.CategoriesRury.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.CategoriesRury.operations.createManyAndReturn.args

> **args**: [`CategoriesRuryCreateManyAndReturnArgs`](CategoriesRuryCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>[]

#### model.CategoriesRury.operations.delete

> **delete**: `object`

#### model.CategoriesRury.operations.delete.args

> **args**: [`CategoriesRuryDeleteArgs`](CategoriesRuryDeleteArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>

#### model.CategoriesRury.operations.deleteMany

> **deleteMany**: `object`

#### model.CategoriesRury.operations.deleteMany.args

> **args**: [`CategoriesRuryDeleteManyArgs`](CategoriesRuryDeleteManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.CategoriesRury.operations.findFirst

> **findFirst**: `object`

#### model.CategoriesRury.operations.findFirst.args

> **args**: [`CategoriesRuryFindFirstArgs`](CategoriesRuryFindFirstArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\> \| `null`

#### model.CategoriesRury.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.CategoriesRury.operations.findFirstOrThrow.args

> **args**: [`CategoriesRuryFindFirstOrThrowArgs`](CategoriesRuryFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>

#### model.CategoriesRury.operations.findMany

> **findMany**: `object`

#### model.CategoriesRury.operations.findMany.args

> **args**: [`CategoriesRuryFindManyArgs`](CategoriesRuryFindManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>[]

#### model.CategoriesRury.operations.findUnique

> **findUnique**: `object`

#### model.CategoriesRury.operations.findUnique.args

> **args**: [`CategoriesRuryFindUniqueArgs`](CategoriesRuryFindUniqueArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\> \| `null`

#### model.CategoriesRury.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.CategoriesRury.operations.findUniqueOrThrow.args

> **args**: [`CategoriesRuryFindUniqueOrThrowArgs`](CategoriesRuryFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>

#### model.CategoriesRury.operations.groupBy

> **groupBy**: `object`

#### model.CategoriesRury.operations.groupBy.args

> **args**: [`CategoriesRuryGroupByArgs`](CategoriesRuryGroupByArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`CategoriesRuryGroupByOutputType`](CategoriesRuryGroupByOutputType.md)\>[]

#### model.CategoriesRury.operations.update

> **update**: `object`

#### model.CategoriesRury.operations.update.args

> **args**: [`CategoriesRuryUpdateArgs`](CategoriesRuryUpdateArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>

#### model.CategoriesRury.operations.updateMany

> **updateMany**: `object`

#### model.CategoriesRury.operations.updateMany.args

> **args**: [`CategoriesRuryUpdateManyArgs`](CategoriesRuryUpdateManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.CategoriesRury.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.CategoriesRury.operations.updateManyAndReturn.args

> **args**: [`CategoriesRuryUpdateManyAndReturnArgs`](CategoriesRuryUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>[]

#### model.CategoriesRury.operations.upsert

> **upsert**: `object`

#### model.CategoriesRury.operations.upsert.args

> **args**: [`CategoriesRuryUpsertArgs`](CategoriesRuryUpsertArgs.md)\<`ExtArgs`\>

#### model.CategoriesRury.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\>

#### model.CategoriesRury.payload

> **payload**: [`$CategoriesRuryPayload`]($CategoriesRuryPayload.md)\<`ExtArgs`\>

#### model.CategoriesStudnie

> **CategoriesStudnie**: `object`

#### model.CategoriesStudnie.fields

> **fields**: [`CategoriesStudnieFieldRefs`](../interfaces/CategoriesStudnieFieldRefs.md)

#### model.CategoriesStudnie.operations

> **operations**: `object`

#### model.CategoriesStudnie.operations.aggregate

> **aggregate**: `object`

#### model.CategoriesStudnie.operations.aggregate.args

> **args**: [`CategoriesStudnieAggregateArgs`](CategoriesStudnieAggregateArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateCategoriesStudnie`](AggregateCategoriesStudnie.md)\>

#### model.CategoriesStudnie.operations.count

> **count**: `object`

#### model.CategoriesStudnie.operations.count.args

> **args**: [`CategoriesStudnieCountArgs`](CategoriesStudnieCountArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.count.result

> **result**: `$Utils.Optional`\<[`CategoriesStudnieCountAggregateOutputType`](CategoriesStudnieCountAggregateOutputType.md)\> \| `number`

#### model.CategoriesStudnie.operations.create

> **create**: `object`

#### model.CategoriesStudnie.operations.create.args

> **args**: [`CategoriesStudnieCreateArgs`](CategoriesStudnieCreateArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>

#### model.CategoriesStudnie.operations.createMany

> **createMany**: `object`

#### model.CategoriesStudnie.operations.createMany.args

> **args**: [`CategoriesStudnieCreateManyArgs`](CategoriesStudnieCreateManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.CategoriesStudnie.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.CategoriesStudnie.operations.createManyAndReturn.args

> **args**: [`CategoriesStudnieCreateManyAndReturnArgs`](CategoriesStudnieCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>[]

#### model.CategoriesStudnie.operations.delete

> **delete**: `object`

#### model.CategoriesStudnie.operations.delete.args

> **args**: [`CategoriesStudnieDeleteArgs`](CategoriesStudnieDeleteArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>

#### model.CategoriesStudnie.operations.deleteMany

> **deleteMany**: `object`

#### model.CategoriesStudnie.operations.deleteMany.args

> **args**: [`CategoriesStudnieDeleteManyArgs`](CategoriesStudnieDeleteManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.CategoriesStudnie.operations.findFirst

> **findFirst**: `object`

#### model.CategoriesStudnie.operations.findFirst.args

> **args**: [`CategoriesStudnieFindFirstArgs`](CategoriesStudnieFindFirstArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\> \| `null`

#### model.CategoriesStudnie.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.CategoriesStudnie.operations.findFirstOrThrow.args

> **args**: [`CategoriesStudnieFindFirstOrThrowArgs`](CategoriesStudnieFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>

#### model.CategoriesStudnie.operations.findMany

> **findMany**: `object`

#### model.CategoriesStudnie.operations.findMany.args

> **args**: [`CategoriesStudnieFindManyArgs`](CategoriesStudnieFindManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>[]

#### model.CategoriesStudnie.operations.findUnique

> **findUnique**: `object`

#### model.CategoriesStudnie.operations.findUnique.args

> **args**: [`CategoriesStudnieFindUniqueArgs`](CategoriesStudnieFindUniqueArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\> \| `null`

#### model.CategoriesStudnie.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.CategoriesStudnie.operations.findUniqueOrThrow.args

> **args**: [`CategoriesStudnieFindUniqueOrThrowArgs`](CategoriesStudnieFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>

#### model.CategoriesStudnie.operations.groupBy

> **groupBy**: `object`

#### model.CategoriesStudnie.operations.groupBy.args

> **args**: [`CategoriesStudnieGroupByArgs`](CategoriesStudnieGroupByArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`CategoriesStudnieGroupByOutputType`](CategoriesStudnieGroupByOutputType.md)\>[]

#### model.CategoriesStudnie.operations.update

> **update**: `object`

#### model.CategoriesStudnie.operations.update.args

> **args**: [`CategoriesStudnieUpdateArgs`](CategoriesStudnieUpdateArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>

#### model.CategoriesStudnie.operations.updateMany

> **updateMany**: `object`

#### model.CategoriesStudnie.operations.updateMany.args

> **args**: [`CategoriesStudnieUpdateManyArgs`](CategoriesStudnieUpdateManyArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.CategoriesStudnie.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.CategoriesStudnie.operations.updateManyAndReturn.args

> **args**: [`CategoriesStudnieUpdateManyAndReturnArgs`](CategoriesStudnieUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>[]

#### model.CategoriesStudnie.operations.upsert

> **upsert**: `object`

#### model.CategoriesStudnie.operations.upsert.args

> **args**: [`CategoriesStudnieUpsertArgs`](CategoriesStudnieUpsertArgs.md)\<`ExtArgs`\>

#### model.CategoriesStudnie.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\>

#### model.CategoriesStudnie.payload

> **payload**: [`$CategoriesStudniePayload`]($CategoriesStudniePayload.md)\<`ExtArgs`\>

#### model.clients\_rel

> **clients\_rel**: `object`

#### model.clients\_rel.fields

> **fields**: [`clients_relFieldRefs`](../interfaces/clients_relFieldRefs.md)

#### model.clients\_rel.operations

> **operations**: `object`

#### model.clients\_rel.operations.aggregate

> **aggregate**: `object`

#### model.clients\_rel.operations.aggregate.args

> **args**: [`Clients_relAggregateArgs`](Clients_relAggregateArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateClients_rel`](AggregateClients_rel.md)\>

#### model.clients\_rel.operations.count

> **count**: `object`

#### model.clients\_rel.operations.count.args

> **args**: [`clients_relCountArgs`](clients_relCountArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Clients_relCountAggregateOutputType`](Clients_relCountAggregateOutputType.md)\> \| `number`

#### model.clients\_rel.operations.create

> **create**: `object`

#### model.clients\_rel.operations.create.args

> **args**: [`clients_relCreateArgs`](clients_relCreateArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>

#### model.clients\_rel.operations.createMany

> **createMany**: `object`

#### model.clients\_rel.operations.createMany.args

> **args**: [`clients_relCreateManyArgs`](clients_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.clients\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.clients\_rel.operations.createManyAndReturn.args

> **args**: [`clients_relCreateManyAndReturnArgs`](clients_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>[]

#### model.clients\_rel.operations.delete

> **delete**: `object`

#### model.clients\_rel.operations.delete.args

> **args**: [`clients_relDeleteArgs`](clients_relDeleteArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>

#### model.clients\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.clients\_rel.operations.deleteMany.args

> **args**: [`clients_relDeleteManyArgs`](clients_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.clients\_rel.operations.findFirst

> **findFirst**: `object`

#### model.clients\_rel.operations.findFirst.args

> **args**: [`clients_relFindFirstArgs`](clients_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\> \| `null`

#### model.clients\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.clients\_rel.operations.findFirstOrThrow.args

> **args**: [`clients_relFindFirstOrThrowArgs`](clients_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>

#### model.clients\_rel.operations.findMany

> **findMany**: `object`

#### model.clients\_rel.operations.findMany.args

> **args**: [`clients_relFindManyArgs`](clients_relFindManyArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>[]

#### model.clients\_rel.operations.findUnique

> **findUnique**: `object`

#### model.clients\_rel.operations.findUnique.args

> **args**: [`clients_relFindUniqueArgs`](clients_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\> \| `null`

#### model.clients\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.clients\_rel.operations.findUniqueOrThrow.args

> **args**: [`clients_relFindUniqueOrThrowArgs`](clients_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>

#### model.clients\_rel.operations.groupBy

> **groupBy**: `object`

#### model.clients\_rel.operations.groupBy.args

> **args**: [`clients_relGroupByArgs`](clients_relGroupByArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Clients_relGroupByOutputType`](Clients_relGroupByOutputType.md)\>[]

#### model.clients\_rel.operations.update

> **update**: `object`

#### model.clients\_rel.operations.update.args

> **args**: [`clients_relUpdateArgs`](clients_relUpdateArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>

#### model.clients\_rel.operations.updateMany

> **updateMany**: `object`

#### model.clients\_rel.operations.updateMany.args

> **args**: [`clients_relUpdateManyArgs`](clients_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.clients\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.clients\_rel.operations.updateManyAndReturn.args

> **args**: [`clients_relUpdateManyAndReturnArgs`](clients_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>[]

#### model.clients\_rel.operations.upsert

> **upsert**: `object`

#### model.clients\_rel.operations.upsert.args

> **args**: [`clients_relUpsertArgs`](clients_relUpsertArgs.md)\<`ExtArgs`\>

#### model.clients\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$clients_relPayload`]($clients_relPayload.md)\>

#### model.clients\_rel.payload

> **payload**: [`$clients_relPayload`]($clients_relPayload.md)\<`ExtArgs`\>

#### model.offer\_items\_rel

> **offer\_items\_rel**: `object`

#### model.offer\_items\_rel.fields

> **fields**: [`offer_items_relFieldRefs`](../interfaces/offer_items_relFieldRefs.md)

#### model.offer\_items\_rel.operations

> **operations**: `object`

#### model.offer\_items\_rel.operations.aggregate

> **aggregate**: `object`

#### model.offer\_items\_rel.operations.aggregate.args

> **args**: [`Offer_items_relAggregateArgs`](Offer_items_relAggregateArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOffer_items_rel`](AggregateOffer_items_rel.md)\>

#### model.offer\_items\_rel.operations.count

> **count**: `object`

#### model.offer\_items\_rel.operations.count.args

> **args**: [`offer_items_relCountArgs`](offer_items_relCountArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Offer_items_relCountAggregateOutputType`](Offer_items_relCountAggregateOutputType.md)\> \| `number`

#### model.offer\_items\_rel.operations.create

> **create**: `object`

#### model.offer\_items\_rel.operations.create.args

> **args**: [`offer_items_relCreateArgs`](offer_items_relCreateArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>

#### model.offer\_items\_rel.operations.createMany

> **createMany**: `object`

#### model.offer\_items\_rel.operations.createMany.args

> **args**: [`offer_items_relCreateManyArgs`](offer_items_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offer\_items\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.offer\_items\_rel.operations.createManyAndReturn.args

> **args**: [`offer_items_relCreateManyAndReturnArgs`](offer_items_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>[]

#### model.offer\_items\_rel.operations.delete

> **delete**: `object`

#### model.offer\_items\_rel.operations.delete.args

> **args**: [`offer_items_relDeleteArgs`](offer_items_relDeleteArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>

#### model.offer\_items\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.offer\_items\_rel.operations.deleteMany.args

> **args**: [`offer_items_relDeleteManyArgs`](offer_items_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offer\_items\_rel.operations.findFirst

> **findFirst**: `object`

#### model.offer\_items\_rel.operations.findFirst.args

> **args**: [`offer_items_relFindFirstArgs`](offer_items_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\> \| `null`

#### model.offer\_items\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.offer\_items\_rel.operations.findFirstOrThrow.args

> **args**: [`offer_items_relFindFirstOrThrowArgs`](offer_items_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>

#### model.offer\_items\_rel.operations.findMany

> **findMany**: `object`

#### model.offer\_items\_rel.operations.findMany.args

> **args**: [`offer_items_relFindManyArgs`](offer_items_relFindManyArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>[]

#### model.offer\_items\_rel.operations.findUnique

> **findUnique**: `object`

#### model.offer\_items\_rel.operations.findUnique.args

> **args**: [`offer_items_relFindUniqueArgs`](offer_items_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\> \| `null`

#### model.offer\_items\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.offer\_items\_rel.operations.findUniqueOrThrow.args

> **args**: [`offer_items_relFindUniqueOrThrowArgs`](offer_items_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>

#### model.offer\_items\_rel.operations.groupBy

> **groupBy**: `object`

#### model.offer\_items\_rel.operations.groupBy.args

> **args**: [`offer_items_relGroupByArgs`](offer_items_relGroupByArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Offer_items_relGroupByOutputType`](Offer_items_relGroupByOutputType.md)\>[]

#### model.offer\_items\_rel.operations.update

> **update**: `object`

#### model.offer\_items\_rel.operations.update.args

> **args**: [`offer_items_relUpdateArgs`](offer_items_relUpdateArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>

#### model.offer\_items\_rel.operations.updateMany

> **updateMany**: `object`

#### model.offer\_items\_rel.operations.updateMany.args

> **args**: [`offer_items_relUpdateManyArgs`](offer_items_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offer\_items\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.offer\_items\_rel.operations.updateManyAndReturn.args

> **args**: [`offer_items_relUpdateManyAndReturnArgs`](offer_items_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>[]

#### model.offer\_items\_rel.operations.upsert

> **upsert**: `object`

#### model.offer\_items\_rel.operations.upsert.args

> **args**: [`offer_items_relUpsertArgs`](offer_items_relUpsertArgs.md)\<`ExtArgs`\>

#### model.offer\_items\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_items_relPayload`]($offer_items_relPayload.md)\>

#### model.offer\_items\_rel.payload

> **payload**: [`$offer_items_relPayload`]($offer_items_relPayload.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel

> **offer\_studnie\_items\_rel**: `object`

#### model.offer\_studnie\_items\_rel.fields

> **fields**: [`offer_studnie_items_relFieldRefs`](../interfaces/offer_studnie_items_relFieldRefs.md)

#### model.offer\_studnie\_items\_rel.operations

> **operations**: `object`

#### model.offer\_studnie\_items\_rel.operations.aggregate

> **aggregate**: `object`

#### model.offer\_studnie\_items\_rel.operations.aggregate.args

> **args**: [`Offer_studnie_items_relAggregateArgs`](Offer_studnie_items_relAggregateArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOffer_studnie_items_rel`](AggregateOffer_studnie_items_rel.md)\>

#### model.offer\_studnie\_items\_rel.operations.count

> **count**: `object`

#### model.offer\_studnie\_items\_rel.operations.count.args

> **args**: [`offer_studnie_items_relCountArgs`](offer_studnie_items_relCountArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Offer_studnie_items_relCountAggregateOutputType`](Offer_studnie_items_relCountAggregateOutputType.md)\> \| `number`

#### model.offer\_studnie\_items\_rel.operations.create

> **create**: `object`

#### model.offer\_studnie\_items\_rel.operations.create.args

> **args**: [`offer_studnie_items_relCreateArgs`](offer_studnie_items_relCreateArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>

#### model.offer\_studnie\_items\_rel.operations.createMany

> **createMany**: `object`

#### model.offer\_studnie\_items\_rel.operations.createMany.args

> **args**: [`offer_studnie_items_relCreateManyArgs`](offer_studnie_items_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offer\_studnie\_items\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.offer\_studnie\_items\_rel.operations.createManyAndReturn.args

> **args**: [`offer_studnie_items_relCreateManyAndReturnArgs`](offer_studnie_items_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>[]

#### model.offer\_studnie\_items\_rel.operations.delete

> **delete**: `object`

#### model.offer\_studnie\_items\_rel.operations.delete.args

> **args**: [`offer_studnie_items_relDeleteArgs`](offer_studnie_items_relDeleteArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>

#### model.offer\_studnie\_items\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.offer\_studnie\_items\_rel.operations.deleteMany.args

> **args**: [`offer_studnie_items_relDeleteManyArgs`](offer_studnie_items_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offer\_studnie\_items\_rel.operations.findFirst

> **findFirst**: `object`

#### model.offer\_studnie\_items\_rel.operations.findFirst.args

> **args**: [`offer_studnie_items_relFindFirstArgs`](offer_studnie_items_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\> \| `null`

#### model.offer\_studnie\_items\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.offer\_studnie\_items\_rel.operations.findFirstOrThrow.args

> **args**: [`offer_studnie_items_relFindFirstOrThrowArgs`](offer_studnie_items_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>

#### model.offer\_studnie\_items\_rel.operations.findMany

> **findMany**: `object`

#### model.offer\_studnie\_items\_rel.operations.findMany.args

> **args**: [`offer_studnie_items_relFindManyArgs`](offer_studnie_items_relFindManyArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>[]

#### model.offer\_studnie\_items\_rel.operations.findUnique

> **findUnique**: `object`

#### model.offer\_studnie\_items\_rel.operations.findUnique.args

> **args**: [`offer_studnie_items_relFindUniqueArgs`](offer_studnie_items_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\> \| `null`

#### model.offer\_studnie\_items\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.offer\_studnie\_items\_rel.operations.findUniqueOrThrow.args

> **args**: [`offer_studnie_items_relFindUniqueOrThrowArgs`](offer_studnie_items_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>

#### model.offer\_studnie\_items\_rel.operations.groupBy

> **groupBy**: `object`

#### model.offer\_studnie\_items\_rel.operations.groupBy.args

> **args**: [`offer_studnie_items_relGroupByArgs`](offer_studnie_items_relGroupByArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Offer_studnie_items_relGroupByOutputType`](Offer_studnie_items_relGroupByOutputType.md)\>[]

#### model.offer\_studnie\_items\_rel.operations.update

> **update**: `object`

#### model.offer\_studnie\_items\_rel.operations.update.args

> **args**: [`offer_studnie_items_relUpdateArgs`](offer_studnie_items_relUpdateArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>

#### model.offer\_studnie\_items\_rel.operations.updateMany

> **updateMany**: `object`

#### model.offer\_studnie\_items\_rel.operations.updateMany.args

> **args**: [`offer_studnie_items_relUpdateManyArgs`](offer_studnie_items_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offer\_studnie\_items\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.offer\_studnie\_items\_rel.operations.updateManyAndReturn.args

> **args**: [`offer_studnie_items_relUpdateManyAndReturnArgs`](offer_studnie_items_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>[]

#### model.offer\_studnie\_items\_rel.operations.upsert

> **upsert**: `object`

#### model.offer\_studnie\_items\_rel.operations.upsert.args

> **args**: [`offer_studnie_items_relUpsertArgs`](offer_studnie_items_relUpsertArgs.md)\<`ExtArgs`\>

#### model.offer\_studnie\_items\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\>

#### model.offer\_studnie\_items\_rel.payload

> **payload**: [`$offer_studnie_items_relPayload`]($offer_studnie_items_relPayload.md)\<`ExtArgs`\>

#### model.offers\_rel

> **offers\_rel**: `object`

#### model.offers\_rel.fields

> **fields**: [`offers_relFieldRefs`](../interfaces/offers_relFieldRefs.md)

#### model.offers\_rel.operations

> **operations**: `object`

#### model.offers\_rel.operations.aggregate

> **aggregate**: `object`

#### model.offers\_rel.operations.aggregate.args

> **args**: [`Offers_relAggregateArgs`](Offers_relAggregateArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOffers_rel`](AggregateOffers_rel.md)\>

#### model.offers\_rel.operations.count

> **count**: `object`

#### model.offers\_rel.operations.count.args

> **args**: [`offers_relCountArgs`](offers_relCountArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Offers_relCountAggregateOutputType`](Offers_relCountAggregateOutputType.md)\> \| `number`

#### model.offers\_rel.operations.create

> **create**: `object`

#### model.offers\_rel.operations.create.args

> **args**: [`offers_relCreateArgs`](offers_relCreateArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>

#### model.offers\_rel.operations.createMany

> **createMany**: `object`

#### model.offers\_rel.operations.createMany.args

> **args**: [`offers_relCreateManyArgs`](offers_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offers\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.offers\_rel.operations.createManyAndReturn.args

> **args**: [`offers_relCreateManyAndReturnArgs`](offers_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>[]

#### model.offers\_rel.operations.delete

> **delete**: `object`

#### model.offers\_rel.operations.delete.args

> **args**: [`offers_relDeleteArgs`](offers_relDeleteArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>

#### model.offers\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.offers\_rel.operations.deleteMany.args

> **args**: [`offers_relDeleteManyArgs`](offers_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offers\_rel.operations.findFirst

> **findFirst**: `object`

#### model.offers\_rel.operations.findFirst.args

> **args**: [`offers_relFindFirstArgs`](offers_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\> \| `null`

#### model.offers\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.offers\_rel.operations.findFirstOrThrow.args

> **args**: [`offers_relFindFirstOrThrowArgs`](offers_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>

#### model.offers\_rel.operations.findMany

> **findMany**: `object`

#### model.offers\_rel.operations.findMany.args

> **args**: [`offers_relFindManyArgs`](offers_relFindManyArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>[]

#### model.offers\_rel.operations.findUnique

> **findUnique**: `object`

#### model.offers\_rel.operations.findUnique.args

> **args**: [`offers_relFindUniqueArgs`](offers_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\> \| `null`

#### model.offers\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.offers\_rel.operations.findUniqueOrThrow.args

> **args**: [`offers_relFindUniqueOrThrowArgs`](offers_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>

#### model.offers\_rel.operations.groupBy

> **groupBy**: `object`

#### model.offers\_rel.operations.groupBy.args

> **args**: [`offers_relGroupByArgs`](offers_relGroupByArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Offers_relGroupByOutputType`](Offers_relGroupByOutputType.md)\>[]

#### model.offers\_rel.operations.update

> **update**: `object`

#### model.offers\_rel.operations.update.args

> **args**: [`offers_relUpdateArgs`](offers_relUpdateArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>

#### model.offers\_rel.operations.updateMany

> **updateMany**: `object`

#### model.offers\_rel.operations.updateMany.args

> **args**: [`offers_relUpdateManyArgs`](offers_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offers\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.offers\_rel.operations.updateManyAndReturn.args

> **args**: [`offers_relUpdateManyAndReturnArgs`](offers_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>[]

#### model.offers\_rel.operations.upsert

> **upsert**: `object`

#### model.offers\_rel.operations.upsert.args

> **args**: [`offers_relUpsertArgs`](offers_relUpsertArgs.md)\<`ExtArgs`\>

#### model.offers\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_relPayload`]($offers_relPayload.md)\>

#### model.offers\_rel.payload

> **payload**: [`$offers_relPayload`]($offers_relPayload.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel

> **offers\_studnie\_rel**: `object`

#### model.offers\_studnie\_rel.fields

> **fields**: [`offers_studnie_relFieldRefs`](../interfaces/offers_studnie_relFieldRefs.md)

#### model.offers\_studnie\_rel.operations

> **operations**: `object`

#### model.offers\_studnie\_rel.operations.aggregate

> **aggregate**: `object`

#### model.offers\_studnie\_rel.operations.aggregate.args

> **args**: [`Offers_studnie_relAggregateArgs`](Offers_studnie_relAggregateArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOffers_studnie_rel`](AggregateOffers_studnie_rel.md)\>

#### model.offers\_studnie\_rel.operations.count

> **count**: `object`

#### model.offers\_studnie\_rel.operations.count.args

> **args**: [`offers_studnie_relCountArgs`](offers_studnie_relCountArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Offers_studnie_relCountAggregateOutputType`](Offers_studnie_relCountAggregateOutputType.md)\> \| `number`

#### model.offers\_studnie\_rel.operations.create

> **create**: `object`

#### model.offers\_studnie\_rel.operations.create.args

> **args**: [`offers_studnie_relCreateArgs`](offers_studnie_relCreateArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>

#### model.offers\_studnie\_rel.operations.createMany

> **createMany**: `object`

#### model.offers\_studnie\_rel.operations.createMany.args

> **args**: [`offers_studnie_relCreateManyArgs`](offers_studnie_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offers\_studnie\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.offers\_studnie\_rel.operations.createManyAndReturn.args

> **args**: [`offers_studnie_relCreateManyAndReturnArgs`](offers_studnie_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>[]

#### model.offers\_studnie\_rel.operations.delete

> **delete**: `object`

#### model.offers\_studnie\_rel.operations.delete.args

> **args**: [`offers_studnie_relDeleteArgs`](offers_studnie_relDeleteArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>

#### model.offers\_studnie\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.offers\_studnie\_rel.operations.deleteMany.args

> **args**: [`offers_studnie_relDeleteManyArgs`](offers_studnie_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offers\_studnie\_rel.operations.findFirst

> **findFirst**: `object`

#### model.offers\_studnie\_rel.operations.findFirst.args

> **args**: [`offers_studnie_relFindFirstArgs`](offers_studnie_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\> \| `null`

#### model.offers\_studnie\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.offers\_studnie\_rel.operations.findFirstOrThrow.args

> **args**: [`offers_studnie_relFindFirstOrThrowArgs`](offers_studnie_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>

#### model.offers\_studnie\_rel.operations.findMany

> **findMany**: `object`

#### model.offers\_studnie\_rel.operations.findMany.args

> **args**: [`offers_studnie_relFindManyArgs`](offers_studnie_relFindManyArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>[]

#### model.offers\_studnie\_rel.operations.findUnique

> **findUnique**: `object`

#### model.offers\_studnie\_rel.operations.findUnique.args

> **args**: [`offers_studnie_relFindUniqueArgs`](offers_studnie_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\> \| `null`

#### model.offers\_studnie\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.offers\_studnie\_rel.operations.findUniqueOrThrow.args

> **args**: [`offers_studnie_relFindUniqueOrThrowArgs`](offers_studnie_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>

#### model.offers\_studnie\_rel.operations.groupBy

> **groupBy**: `object`

#### model.offers\_studnie\_rel.operations.groupBy.args

> **args**: [`offers_studnie_relGroupByArgs`](offers_studnie_relGroupByArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Offers_studnie_relGroupByOutputType`](Offers_studnie_relGroupByOutputType.md)\>[]

#### model.offers\_studnie\_rel.operations.update

> **update**: `object`

#### model.offers\_studnie\_rel.operations.update.args

> **args**: [`offers_studnie_relUpdateArgs`](offers_studnie_relUpdateArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>

#### model.offers\_studnie\_rel.operations.updateMany

> **updateMany**: `object`

#### model.offers\_studnie\_rel.operations.updateMany.args

> **args**: [`offers_studnie_relUpdateManyArgs`](offers_studnie_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.offers\_studnie\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.offers\_studnie\_rel.operations.updateManyAndReturn.args

> **args**: [`offers_studnie_relUpdateManyAndReturnArgs`](offers_studnie_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>[]

#### model.offers\_studnie\_rel.operations.upsert

> **upsert**: `object`

#### model.offers\_studnie\_rel.operations.upsert.args

> **args**: [`offers_studnie_relUpsertArgs`](offers_studnie_relUpsertArgs.md)\<`ExtArgs`\>

#### model.offers\_studnie\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\>

#### model.offers\_studnie\_rel.payload

> **payload**: [`$offers_studnie_relPayload`]($offers_studnie_relPayload.md)\<`ExtArgs`\>

#### model.order\_counters

> **order\_counters**: `object`

#### model.order\_counters.fields

> **fields**: [`order_countersFieldRefs`](../interfaces/order_countersFieldRefs.md)

#### model.order\_counters.operations

> **operations**: `object`

#### model.order\_counters.operations.aggregate

> **aggregate**: `object`

#### model.order\_counters.operations.aggregate.args

> **args**: [`Order_countersAggregateArgs`](Order_countersAggregateArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOrder_counters`](AggregateOrder_counters.md)\>

#### model.order\_counters.operations.count

> **count**: `object`

#### model.order\_counters.operations.count.args

> **args**: [`order_countersCountArgs`](order_countersCountArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.count.result

> **result**: `$Utils.Optional`\<[`Order_countersCountAggregateOutputType`](Order_countersCountAggregateOutputType.md)\> \| `number`

#### model.order\_counters.operations.create

> **create**: `object`

#### model.order\_counters.operations.create.args

> **args**: [`order_countersCreateArgs`](order_countersCreateArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>

#### model.order\_counters.operations.createMany

> **createMany**: `object`

#### model.order\_counters.operations.createMany.args

> **args**: [`order_countersCreateManyArgs`](order_countersCreateManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.order\_counters.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.order\_counters.operations.createManyAndReturn.args

> **args**: [`order_countersCreateManyAndReturnArgs`](order_countersCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>[]

#### model.order\_counters.operations.delete

> **delete**: `object`

#### model.order\_counters.operations.delete.args

> **args**: [`order_countersDeleteArgs`](order_countersDeleteArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>

#### model.order\_counters.operations.deleteMany

> **deleteMany**: `object`

#### model.order\_counters.operations.deleteMany.args

> **args**: [`order_countersDeleteManyArgs`](order_countersDeleteManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.order\_counters.operations.findFirst

> **findFirst**: `object`

#### model.order\_counters.operations.findFirst.args

> **args**: [`order_countersFindFirstArgs`](order_countersFindFirstArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\> \| `null`

#### model.order\_counters.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.order\_counters.operations.findFirstOrThrow.args

> **args**: [`order_countersFindFirstOrThrowArgs`](order_countersFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>

#### model.order\_counters.operations.findMany

> **findMany**: `object`

#### model.order\_counters.operations.findMany.args

> **args**: [`order_countersFindManyArgs`](order_countersFindManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>[]

#### model.order\_counters.operations.findUnique

> **findUnique**: `object`

#### model.order\_counters.operations.findUnique.args

> **args**: [`order_countersFindUniqueArgs`](order_countersFindUniqueArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\> \| `null`

#### model.order\_counters.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.order\_counters.operations.findUniqueOrThrow.args

> **args**: [`order_countersFindUniqueOrThrowArgs`](order_countersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>

#### model.order\_counters.operations.groupBy

> **groupBy**: `object`

#### model.order\_counters.operations.groupBy.args

> **args**: [`order_countersGroupByArgs`](order_countersGroupByArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Order_countersGroupByOutputType`](Order_countersGroupByOutputType.md)\>[]

#### model.order\_counters.operations.update

> **update**: `object`

#### model.order\_counters.operations.update.args

> **args**: [`order_countersUpdateArgs`](order_countersUpdateArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>

#### model.order\_counters.operations.updateMany

> **updateMany**: `object`

#### model.order\_counters.operations.updateMany.args

> **args**: [`order_countersUpdateManyArgs`](order_countersUpdateManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.order\_counters.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.order\_counters.operations.updateManyAndReturn.args

> **args**: [`order_countersUpdateManyAndReturnArgs`](order_countersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>[]

#### model.order\_counters.operations.upsert

> **upsert**: `object`

#### model.order\_counters.operations.upsert.args

> **args**: [`order_countersUpsertArgs`](order_countersUpsertArgs.md)\<`ExtArgs`\>

#### model.order\_counters.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$order_countersPayload`]($order_countersPayload.md)\>

#### model.order\_counters.payload

> **payload**: [`$order_countersPayload`]($order_countersPayload.md)\<`ExtArgs`\>

#### model.order\_counters\_rury

> **order\_counters\_rury**: `object`

#### model.order\_counters\_rury.fields

> **fields**: [`order_counters_ruryFieldRefs`](../interfaces/order_counters_ruryFieldRefs.md)

#### model.order\_counters\_rury.operations

> **operations**: `object`

#### model.order\_counters\_rury.operations.aggregate

> **aggregate**: `object`

#### model.order\_counters\_rury.operations.aggregate.args

> **args**: [`Order_counters_ruryAggregateArgs`](Order_counters_ruryAggregateArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOrder_counters_rury`](AggregateOrder_counters_rury.md)\>

#### model.order\_counters\_rury.operations.count

> **count**: `object`

#### model.order\_counters\_rury.operations.count.args

> **args**: [`order_counters_ruryCountArgs`](order_counters_ruryCountArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.count.result

> **result**: `$Utils.Optional`\<[`Order_counters_ruryCountAggregateOutputType`](Order_counters_ruryCountAggregateOutputType.md)\> \| `number`

#### model.order\_counters\_rury.operations.create

> **create**: `object`

#### model.order\_counters\_rury.operations.create.args

> **args**: [`order_counters_ruryCreateArgs`](order_counters_ruryCreateArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>

#### model.order\_counters\_rury.operations.createMany

> **createMany**: `object`

#### model.order\_counters\_rury.operations.createMany.args

> **args**: [`order_counters_ruryCreateManyArgs`](order_counters_ruryCreateManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.order\_counters\_rury.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.order\_counters\_rury.operations.createManyAndReturn.args

> **args**: [`order_counters_ruryCreateManyAndReturnArgs`](order_counters_ruryCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>[]

#### model.order\_counters\_rury.operations.delete

> **delete**: `object`

#### model.order\_counters\_rury.operations.delete.args

> **args**: [`order_counters_ruryDeleteArgs`](order_counters_ruryDeleteArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>

#### model.order\_counters\_rury.operations.deleteMany

> **deleteMany**: `object`

#### model.order\_counters\_rury.operations.deleteMany.args

> **args**: [`order_counters_ruryDeleteManyArgs`](order_counters_ruryDeleteManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.order\_counters\_rury.operations.findFirst

> **findFirst**: `object`

#### model.order\_counters\_rury.operations.findFirst.args

> **args**: [`order_counters_ruryFindFirstArgs`](order_counters_ruryFindFirstArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\> \| `null`

#### model.order\_counters\_rury.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.order\_counters\_rury.operations.findFirstOrThrow.args

> **args**: [`order_counters_ruryFindFirstOrThrowArgs`](order_counters_ruryFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>

#### model.order\_counters\_rury.operations.findMany

> **findMany**: `object`

#### model.order\_counters\_rury.operations.findMany.args

> **args**: [`order_counters_ruryFindManyArgs`](order_counters_ruryFindManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>[]

#### model.order\_counters\_rury.operations.findUnique

> **findUnique**: `object`

#### model.order\_counters\_rury.operations.findUnique.args

> **args**: [`order_counters_ruryFindUniqueArgs`](order_counters_ruryFindUniqueArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\> \| `null`

#### model.order\_counters\_rury.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.order\_counters\_rury.operations.findUniqueOrThrow.args

> **args**: [`order_counters_ruryFindUniqueOrThrowArgs`](order_counters_ruryFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>

#### model.order\_counters\_rury.operations.groupBy

> **groupBy**: `object`

#### model.order\_counters\_rury.operations.groupBy.args

> **args**: [`order_counters_ruryGroupByArgs`](order_counters_ruryGroupByArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Order_counters_ruryGroupByOutputType`](Order_counters_ruryGroupByOutputType.md)\>[]

#### model.order\_counters\_rury.operations.update

> **update**: `object`

#### model.order\_counters\_rury.operations.update.args

> **args**: [`order_counters_ruryUpdateArgs`](order_counters_ruryUpdateArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>

#### model.order\_counters\_rury.operations.updateMany

> **updateMany**: `object`

#### model.order\_counters\_rury.operations.updateMany.args

> **args**: [`order_counters_ruryUpdateManyArgs`](order_counters_ruryUpdateManyArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.order\_counters\_rury.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.order\_counters\_rury.operations.updateManyAndReturn.args

> **args**: [`order_counters_ruryUpdateManyAndReturnArgs`](order_counters_ruryUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>[]

#### model.order\_counters\_rury.operations.upsert

> **upsert**: `object`

#### model.order\_counters\_rury.operations.upsert.args

> **args**: [`order_counters_ruryUpsertArgs`](order_counters_ruryUpsertArgs.md)\<`ExtArgs`\>

#### model.order\_counters\_rury.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\>

#### model.order\_counters\_rury.payload

> **payload**: [`$order_counters_ruryPayload`]($order_counters_ruryPayload.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel

> **orders\_rury\_rel**: `object`

#### model.orders\_rury\_rel.fields

> **fields**: [`orders_rury_relFieldRefs`](../interfaces/orders_rury_relFieldRefs.md)

#### model.orders\_rury\_rel.operations

> **operations**: `object`

#### model.orders\_rury\_rel.operations.aggregate

> **aggregate**: `object`

#### model.orders\_rury\_rel.operations.aggregate.args

> **args**: [`Orders_rury_relAggregateArgs`](Orders_rury_relAggregateArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOrders_rury_rel`](AggregateOrders_rury_rel.md)\>

#### model.orders\_rury\_rel.operations.count

> **count**: `object`

#### model.orders\_rury\_rel.operations.count.args

> **args**: [`orders_rury_relCountArgs`](orders_rury_relCountArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Orders_rury_relCountAggregateOutputType`](Orders_rury_relCountAggregateOutputType.md)\> \| `number`

#### model.orders\_rury\_rel.operations.create

> **create**: `object`

#### model.orders\_rury\_rel.operations.create.args

> **args**: [`orders_rury_relCreateArgs`](orders_rury_relCreateArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>

#### model.orders\_rury\_rel.operations.createMany

> **createMany**: `object`

#### model.orders\_rury\_rel.operations.createMany.args

> **args**: [`orders_rury_relCreateManyArgs`](orders_rury_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.orders\_rury\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.orders\_rury\_rel.operations.createManyAndReturn.args

> **args**: [`orders_rury_relCreateManyAndReturnArgs`](orders_rury_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>[]

#### model.orders\_rury\_rel.operations.delete

> **delete**: `object`

#### model.orders\_rury\_rel.operations.delete.args

> **args**: [`orders_rury_relDeleteArgs`](orders_rury_relDeleteArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>

#### model.orders\_rury\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.orders\_rury\_rel.operations.deleteMany.args

> **args**: [`orders_rury_relDeleteManyArgs`](orders_rury_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.orders\_rury\_rel.operations.findFirst

> **findFirst**: `object`

#### model.orders\_rury\_rel.operations.findFirst.args

> **args**: [`orders_rury_relFindFirstArgs`](orders_rury_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\> \| `null`

#### model.orders\_rury\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.orders\_rury\_rel.operations.findFirstOrThrow.args

> **args**: [`orders_rury_relFindFirstOrThrowArgs`](orders_rury_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>

#### model.orders\_rury\_rel.operations.findMany

> **findMany**: `object`

#### model.orders\_rury\_rel.operations.findMany.args

> **args**: [`orders_rury_relFindManyArgs`](orders_rury_relFindManyArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>[]

#### model.orders\_rury\_rel.operations.findUnique

> **findUnique**: `object`

#### model.orders\_rury\_rel.operations.findUnique.args

> **args**: [`orders_rury_relFindUniqueArgs`](orders_rury_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\> \| `null`

#### model.orders\_rury\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.orders\_rury\_rel.operations.findUniqueOrThrow.args

> **args**: [`orders_rury_relFindUniqueOrThrowArgs`](orders_rury_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>

#### model.orders\_rury\_rel.operations.groupBy

> **groupBy**: `object`

#### model.orders\_rury\_rel.operations.groupBy.args

> **args**: [`orders_rury_relGroupByArgs`](orders_rury_relGroupByArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Orders_rury_relGroupByOutputType`](Orders_rury_relGroupByOutputType.md)\>[]

#### model.orders\_rury\_rel.operations.update

> **update**: `object`

#### model.orders\_rury\_rel.operations.update.args

> **args**: [`orders_rury_relUpdateArgs`](orders_rury_relUpdateArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>

#### model.orders\_rury\_rel.operations.updateMany

> **updateMany**: `object`

#### model.orders\_rury\_rel.operations.updateMany.args

> **args**: [`orders_rury_relUpdateManyArgs`](orders_rury_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.orders\_rury\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.orders\_rury\_rel.operations.updateManyAndReturn.args

> **args**: [`orders_rury_relUpdateManyAndReturnArgs`](orders_rury_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>[]

#### model.orders\_rury\_rel.operations.upsert

> **upsert**: `object`

#### model.orders\_rury\_rel.operations.upsert.args

> **args**: [`orders_rury_relUpsertArgs`](orders_rury_relUpsertArgs.md)\<`ExtArgs`\>

#### model.orders\_rury\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_rury_relPayload`]($orders_rury_relPayload.md)\>

#### model.orders\_rury\_rel.payload

> **payload**: [`$orders_rury_relPayload`]($orders_rury_relPayload.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel

> **orders\_studnie\_rel**: `object`

#### model.orders\_studnie\_rel.fields

> **fields**: [`orders_studnie_relFieldRefs`](../interfaces/orders_studnie_relFieldRefs.md)

#### model.orders\_studnie\_rel.operations

> **operations**: `object`

#### model.orders\_studnie\_rel.operations.aggregate

> **aggregate**: `object`

#### model.orders\_studnie\_rel.operations.aggregate.args

> **args**: [`Orders_studnie_relAggregateArgs`](Orders_studnie_relAggregateArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateOrders_studnie_rel`](AggregateOrders_studnie_rel.md)\>

#### model.orders\_studnie\_rel.operations.count

> **count**: `object`

#### model.orders\_studnie\_rel.operations.count.args

> **args**: [`orders_studnie_relCountArgs`](orders_studnie_relCountArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Orders_studnie_relCountAggregateOutputType`](Orders_studnie_relCountAggregateOutputType.md)\> \| `number`

#### model.orders\_studnie\_rel.operations.create

> **create**: `object`

#### model.orders\_studnie\_rel.operations.create.args

> **args**: [`orders_studnie_relCreateArgs`](orders_studnie_relCreateArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>

#### model.orders\_studnie\_rel.operations.createMany

> **createMany**: `object`

#### model.orders\_studnie\_rel.operations.createMany.args

> **args**: [`orders_studnie_relCreateManyArgs`](orders_studnie_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.orders\_studnie\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.orders\_studnie\_rel.operations.createManyAndReturn.args

> **args**: [`orders_studnie_relCreateManyAndReturnArgs`](orders_studnie_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>[]

#### model.orders\_studnie\_rel.operations.delete

> **delete**: `object`

#### model.orders\_studnie\_rel.operations.delete.args

> **args**: [`orders_studnie_relDeleteArgs`](orders_studnie_relDeleteArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>

#### model.orders\_studnie\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.orders\_studnie\_rel.operations.deleteMany.args

> **args**: [`orders_studnie_relDeleteManyArgs`](orders_studnie_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.orders\_studnie\_rel.operations.findFirst

> **findFirst**: `object`

#### model.orders\_studnie\_rel.operations.findFirst.args

> **args**: [`orders_studnie_relFindFirstArgs`](orders_studnie_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\> \| `null`

#### model.orders\_studnie\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.orders\_studnie\_rel.operations.findFirstOrThrow.args

> **args**: [`orders_studnie_relFindFirstOrThrowArgs`](orders_studnie_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>

#### model.orders\_studnie\_rel.operations.findMany

> **findMany**: `object`

#### model.orders\_studnie\_rel.operations.findMany.args

> **args**: [`orders_studnie_relFindManyArgs`](orders_studnie_relFindManyArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>[]

#### model.orders\_studnie\_rel.operations.findUnique

> **findUnique**: `object`

#### model.orders\_studnie\_rel.operations.findUnique.args

> **args**: [`orders_studnie_relFindUniqueArgs`](orders_studnie_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\> \| `null`

#### model.orders\_studnie\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.orders\_studnie\_rel.operations.findUniqueOrThrow.args

> **args**: [`orders_studnie_relFindUniqueOrThrowArgs`](orders_studnie_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>

#### model.orders\_studnie\_rel.operations.groupBy

> **groupBy**: `object`

#### model.orders\_studnie\_rel.operations.groupBy.args

> **args**: [`orders_studnie_relGroupByArgs`](orders_studnie_relGroupByArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Orders_studnie_relGroupByOutputType`](Orders_studnie_relGroupByOutputType.md)\>[]

#### model.orders\_studnie\_rel.operations.update

> **update**: `object`

#### model.orders\_studnie\_rel.operations.update.args

> **args**: [`orders_studnie_relUpdateArgs`](orders_studnie_relUpdateArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>

#### model.orders\_studnie\_rel.operations.updateMany

> **updateMany**: `object`

#### model.orders\_studnie\_rel.operations.updateMany.args

> **args**: [`orders_studnie_relUpdateManyArgs`](orders_studnie_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.orders\_studnie\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.orders\_studnie\_rel.operations.updateManyAndReturn.args

> **args**: [`orders_studnie_relUpdateManyAndReturnArgs`](orders_studnie_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>[]

#### model.orders\_studnie\_rel.operations.upsert

> **upsert**: `object`

#### model.orders\_studnie\_rel.operations.upsert.args

> **args**: [`orders_studnie_relUpsertArgs`](orders_studnie_relUpsertArgs.md)\<`ExtArgs`\>

#### model.orders\_studnie\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\>

#### model.orders\_studnie\_rel.payload

> **payload**: [`$orders_studnie_relPayload`]($orders_studnie_relPayload.md)\<`ExtArgs`\>

#### model.production\_order\_counters

> **production\_order\_counters**: `object`

#### model.production\_order\_counters.fields

> **fields**: [`production_order_countersFieldRefs`](../interfaces/production_order_countersFieldRefs.md)

#### model.production\_order\_counters.operations

> **operations**: `object`

#### model.production\_order\_counters.operations.aggregate

> **aggregate**: `object`

#### model.production\_order\_counters.operations.aggregate.args

> **args**: [`Production_order_countersAggregateArgs`](Production_order_countersAggregateArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateProduction_order_counters`](AggregateProduction_order_counters.md)\>

#### model.production\_order\_counters.operations.count

> **count**: `object`

#### model.production\_order\_counters.operations.count.args

> **args**: [`production_order_countersCountArgs`](production_order_countersCountArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.count.result

> **result**: `$Utils.Optional`\<[`Production_order_countersCountAggregateOutputType`](Production_order_countersCountAggregateOutputType.md)\> \| `number`

#### model.production\_order\_counters.operations.create

> **create**: `object`

#### model.production\_order\_counters.operations.create.args

> **args**: [`production_order_countersCreateArgs`](production_order_countersCreateArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>

#### model.production\_order\_counters.operations.createMany

> **createMany**: `object`

#### model.production\_order\_counters.operations.createMany.args

> **args**: [`production_order_countersCreateManyArgs`](production_order_countersCreateManyArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.production\_order\_counters.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.production\_order\_counters.operations.createManyAndReturn.args

> **args**: [`production_order_countersCreateManyAndReturnArgs`](production_order_countersCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>[]

#### model.production\_order\_counters.operations.delete

> **delete**: `object`

#### model.production\_order\_counters.operations.delete.args

> **args**: [`production_order_countersDeleteArgs`](production_order_countersDeleteArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>

#### model.production\_order\_counters.operations.deleteMany

> **deleteMany**: `object`

#### model.production\_order\_counters.operations.deleteMany.args

> **args**: [`production_order_countersDeleteManyArgs`](production_order_countersDeleteManyArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.production\_order\_counters.operations.findFirst

> **findFirst**: `object`

#### model.production\_order\_counters.operations.findFirst.args

> **args**: [`production_order_countersFindFirstArgs`](production_order_countersFindFirstArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\> \| `null`

#### model.production\_order\_counters.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.production\_order\_counters.operations.findFirstOrThrow.args

> **args**: [`production_order_countersFindFirstOrThrowArgs`](production_order_countersFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>

#### model.production\_order\_counters.operations.findMany

> **findMany**: `object`

#### model.production\_order\_counters.operations.findMany.args

> **args**: [`production_order_countersFindManyArgs`](production_order_countersFindManyArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>[]

#### model.production\_order\_counters.operations.findUnique

> **findUnique**: `object`

#### model.production\_order\_counters.operations.findUnique.args

> **args**: [`production_order_countersFindUniqueArgs`](production_order_countersFindUniqueArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\> \| `null`

#### model.production\_order\_counters.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.production\_order\_counters.operations.findUniqueOrThrow.args

> **args**: [`production_order_countersFindUniqueOrThrowArgs`](production_order_countersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>

#### model.production\_order\_counters.operations.groupBy

> **groupBy**: `object`

#### model.production\_order\_counters.operations.groupBy.args

> **args**: [`production_order_countersGroupByArgs`](production_order_countersGroupByArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Production_order_countersGroupByOutputType`](Production_order_countersGroupByOutputType.md)\>[]

#### model.production\_order\_counters.operations.update

> **update**: `object`

#### model.production\_order\_counters.operations.update.args

> **args**: [`production_order_countersUpdateArgs`](production_order_countersUpdateArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>

#### model.production\_order\_counters.operations.updateMany

> **updateMany**: `object`

#### model.production\_order\_counters.operations.updateMany.args

> **args**: [`production_order_countersUpdateManyArgs`](production_order_countersUpdateManyArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.production\_order\_counters.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.production\_order\_counters.operations.updateManyAndReturn.args

> **args**: [`production_order_countersUpdateManyAndReturnArgs`](production_order_countersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>[]

#### model.production\_order\_counters.operations.upsert

> **upsert**: `object`

#### model.production\_order\_counters.operations.upsert.args

> **args**: [`production_order_countersUpsertArgs`](production_order_countersUpsertArgs.md)\<`ExtArgs`\>

#### model.production\_order\_counters.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$production_order_countersPayload`]($production_order_countersPayload.md)\>

#### model.production\_order\_counters.payload

> **payload**: [`$production_order_countersPayload`]($production_order_countersPayload.md)\<`ExtArgs`\>

#### model.production\_orders\_rel

> **production\_orders\_rel**: `object`

#### model.production\_orders\_rel.fields

> **fields**: [`production_orders_relFieldRefs`](../interfaces/production_orders_relFieldRefs.md)

#### model.production\_orders\_rel.operations

> **operations**: `object`

#### model.production\_orders\_rel.operations.aggregate

> **aggregate**: `object`

#### model.production\_orders\_rel.operations.aggregate.args

> **args**: [`Production_orders_relAggregateArgs`](Production_orders_relAggregateArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateProduction_orders_rel`](AggregateProduction_orders_rel.md)\>

#### model.production\_orders\_rel.operations.count

> **count**: `object`

#### model.production\_orders\_rel.operations.count.args

> **args**: [`production_orders_relCountArgs`](production_orders_relCountArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.count.result

> **result**: `$Utils.Optional`\<[`Production_orders_relCountAggregateOutputType`](Production_orders_relCountAggregateOutputType.md)\> \| `number`

#### model.production\_orders\_rel.operations.create

> **create**: `object`

#### model.production\_orders\_rel.operations.create.args

> **args**: [`production_orders_relCreateArgs`](production_orders_relCreateArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>

#### model.production\_orders\_rel.operations.createMany

> **createMany**: `object`

#### model.production\_orders\_rel.operations.createMany.args

> **args**: [`production_orders_relCreateManyArgs`](production_orders_relCreateManyArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.production\_orders\_rel.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.production\_orders\_rel.operations.createManyAndReturn.args

> **args**: [`production_orders_relCreateManyAndReturnArgs`](production_orders_relCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>[]

#### model.production\_orders\_rel.operations.delete

> **delete**: `object`

#### model.production\_orders\_rel.operations.delete.args

> **args**: [`production_orders_relDeleteArgs`](production_orders_relDeleteArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>

#### model.production\_orders\_rel.operations.deleteMany

> **deleteMany**: `object`

#### model.production\_orders\_rel.operations.deleteMany.args

> **args**: [`production_orders_relDeleteManyArgs`](production_orders_relDeleteManyArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.production\_orders\_rel.operations.findFirst

> **findFirst**: `object`

#### model.production\_orders\_rel.operations.findFirst.args

> **args**: [`production_orders_relFindFirstArgs`](production_orders_relFindFirstArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\> \| `null`

#### model.production\_orders\_rel.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.production\_orders\_rel.operations.findFirstOrThrow.args

> **args**: [`production_orders_relFindFirstOrThrowArgs`](production_orders_relFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>

#### model.production\_orders\_rel.operations.findMany

> **findMany**: `object`

#### model.production\_orders\_rel.operations.findMany.args

> **args**: [`production_orders_relFindManyArgs`](production_orders_relFindManyArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>[]

#### model.production\_orders\_rel.operations.findUnique

> **findUnique**: `object`

#### model.production\_orders\_rel.operations.findUnique.args

> **args**: [`production_orders_relFindUniqueArgs`](production_orders_relFindUniqueArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\> \| `null`

#### model.production\_orders\_rel.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.production\_orders\_rel.operations.findUniqueOrThrow.args

> **args**: [`production_orders_relFindUniqueOrThrowArgs`](production_orders_relFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>

#### model.production\_orders\_rel.operations.groupBy

> **groupBy**: `object`

#### model.production\_orders\_rel.operations.groupBy.args

> **args**: [`production_orders_relGroupByArgs`](production_orders_relGroupByArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Production_orders_relGroupByOutputType`](Production_orders_relGroupByOutputType.md)\>[]

#### model.production\_orders\_rel.operations.update

> **update**: `object`

#### model.production\_orders\_rel.operations.update.args

> **args**: [`production_orders_relUpdateArgs`](production_orders_relUpdateArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>

#### model.production\_orders\_rel.operations.updateMany

> **updateMany**: `object`

#### model.production\_orders\_rel.operations.updateMany.args

> **args**: [`production_orders_relUpdateManyArgs`](production_orders_relUpdateManyArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.production\_orders\_rel.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.production\_orders\_rel.operations.updateManyAndReturn.args

> **args**: [`production_orders_relUpdateManyAndReturnArgs`](production_orders_relUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>[]

#### model.production\_orders\_rel.operations.upsert

> **upsert**: `object`

#### model.production\_orders\_rel.operations.upsert.args

> **args**: [`production_orders_relUpsertArgs`](production_orders_relUpsertArgs.md)\<`ExtArgs`\>

#### model.production\_orders\_rel.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$production_orders_relPayload`]($production_orders_relPayload.md)\>

#### model.production\_orders\_rel.payload

> **payload**: [`$production_orders_relPayload`]($production_orders_relPayload.md)\<`ExtArgs`\>

#### model.ProductsRury

> **ProductsRury**: `object`

#### model.ProductsRury.fields

> **fields**: [`ProductsRuryFieldRefs`](../interfaces/ProductsRuryFieldRefs.md)

#### model.ProductsRury.operations

> **operations**: `object`

#### model.ProductsRury.operations.aggregate

> **aggregate**: `object`

#### model.ProductsRury.operations.aggregate.args

> **args**: [`ProductsRuryAggregateArgs`](ProductsRuryAggregateArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateProductsRury`](AggregateProductsRury.md)\>

#### model.ProductsRury.operations.count

> **count**: `object`

#### model.ProductsRury.operations.count.args

> **args**: [`ProductsRuryCountArgs`](ProductsRuryCountArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.count.result

> **result**: `$Utils.Optional`\<[`ProductsRuryCountAggregateOutputType`](ProductsRuryCountAggregateOutputType.md)\> \| `number`

#### model.ProductsRury.operations.create

> **create**: `object`

#### model.ProductsRury.operations.create.args

> **args**: [`ProductsRuryCreateArgs`](ProductsRuryCreateArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>

#### model.ProductsRury.operations.createMany

> **createMany**: `object`

#### model.ProductsRury.operations.createMany.args

> **args**: [`ProductsRuryCreateManyArgs`](ProductsRuryCreateManyArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ProductsRury.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ProductsRury.operations.createManyAndReturn.args

> **args**: [`ProductsRuryCreateManyAndReturnArgs`](ProductsRuryCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>[]

#### model.ProductsRury.operations.delete

> **delete**: `object`

#### model.ProductsRury.operations.delete.args

> **args**: [`ProductsRuryDeleteArgs`](ProductsRuryDeleteArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>

#### model.ProductsRury.operations.deleteMany

> **deleteMany**: `object`

#### model.ProductsRury.operations.deleteMany.args

> **args**: [`ProductsRuryDeleteManyArgs`](ProductsRuryDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ProductsRury.operations.findFirst

> **findFirst**: `object`

#### model.ProductsRury.operations.findFirst.args

> **args**: [`ProductsRuryFindFirstArgs`](ProductsRuryFindFirstArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\> \| `null`

#### model.ProductsRury.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ProductsRury.operations.findFirstOrThrow.args

> **args**: [`ProductsRuryFindFirstOrThrowArgs`](ProductsRuryFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>

#### model.ProductsRury.operations.findMany

> **findMany**: `object`

#### model.ProductsRury.operations.findMany.args

> **args**: [`ProductsRuryFindManyArgs`](ProductsRuryFindManyArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>[]

#### model.ProductsRury.operations.findUnique

> **findUnique**: `object`

#### model.ProductsRury.operations.findUnique.args

> **args**: [`ProductsRuryFindUniqueArgs`](ProductsRuryFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\> \| `null`

#### model.ProductsRury.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ProductsRury.operations.findUniqueOrThrow.args

> **args**: [`ProductsRuryFindUniqueOrThrowArgs`](ProductsRuryFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>

#### model.ProductsRury.operations.groupBy

> **groupBy**: `object`

#### model.ProductsRury.operations.groupBy.args

> **args**: [`ProductsRuryGroupByArgs`](ProductsRuryGroupByArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`ProductsRuryGroupByOutputType`](ProductsRuryGroupByOutputType.md)\>[]

#### model.ProductsRury.operations.update

> **update**: `object`

#### model.ProductsRury.operations.update.args

> **args**: [`ProductsRuryUpdateArgs`](ProductsRuryUpdateArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>

#### model.ProductsRury.operations.updateMany

> **updateMany**: `object`

#### model.ProductsRury.operations.updateMany.args

> **args**: [`ProductsRuryUpdateManyArgs`](ProductsRuryUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ProductsRury.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ProductsRury.operations.updateManyAndReturn.args

> **args**: [`ProductsRuryUpdateManyAndReturnArgs`](ProductsRuryUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>[]

#### model.ProductsRury.operations.upsert

> **upsert**: `object`

#### model.ProductsRury.operations.upsert.args

> **args**: [`ProductsRuryUpsertArgs`](ProductsRuryUpsertArgs.md)\<`ExtArgs`\>

#### model.ProductsRury.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsRuryPayload`]($ProductsRuryPayload.md)\>

#### model.ProductsRury.payload

> **payload**: [`$ProductsRuryPayload`]($ProductsRuryPayload.md)\<`ExtArgs`\>

#### model.ProductsStudnie

> **ProductsStudnie**: `object`

#### model.ProductsStudnie.fields

> **fields**: [`ProductsStudnieFieldRefs`](../interfaces/ProductsStudnieFieldRefs.md)

#### model.ProductsStudnie.operations

> **operations**: `object`

#### model.ProductsStudnie.operations.aggregate

> **aggregate**: `object`

#### model.ProductsStudnie.operations.aggregate.args

> **args**: [`ProductsStudnieAggregateArgs`](ProductsStudnieAggregateArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateProductsStudnie`](AggregateProductsStudnie.md)\>

#### model.ProductsStudnie.operations.count

> **count**: `object`

#### model.ProductsStudnie.operations.count.args

> **args**: [`ProductsStudnieCountArgs`](ProductsStudnieCountArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.count.result

> **result**: `$Utils.Optional`\<[`ProductsStudnieCountAggregateOutputType`](ProductsStudnieCountAggregateOutputType.md)\> \| `number`

#### model.ProductsStudnie.operations.create

> **create**: `object`

#### model.ProductsStudnie.operations.create.args

> **args**: [`ProductsStudnieCreateArgs`](ProductsStudnieCreateArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>

#### model.ProductsStudnie.operations.createMany

> **createMany**: `object`

#### model.ProductsStudnie.operations.createMany.args

> **args**: [`ProductsStudnieCreateManyArgs`](ProductsStudnieCreateManyArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ProductsStudnie.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.ProductsStudnie.operations.createManyAndReturn.args

> **args**: [`ProductsStudnieCreateManyAndReturnArgs`](ProductsStudnieCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>[]

#### model.ProductsStudnie.operations.delete

> **delete**: `object`

#### model.ProductsStudnie.operations.delete.args

> **args**: [`ProductsStudnieDeleteArgs`](ProductsStudnieDeleteArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>

#### model.ProductsStudnie.operations.deleteMany

> **deleteMany**: `object`

#### model.ProductsStudnie.operations.deleteMany.args

> **args**: [`ProductsStudnieDeleteManyArgs`](ProductsStudnieDeleteManyArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ProductsStudnie.operations.findFirst

> **findFirst**: `object`

#### model.ProductsStudnie.operations.findFirst.args

> **args**: [`ProductsStudnieFindFirstArgs`](ProductsStudnieFindFirstArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\> \| `null`

#### model.ProductsStudnie.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.ProductsStudnie.operations.findFirstOrThrow.args

> **args**: [`ProductsStudnieFindFirstOrThrowArgs`](ProductsStudnieFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>

#### model.ProductsStudnie.operations.findMany

> **findMany**: `object`

#### model.ProductsStudnie.operations.findMany.args

> **args**: [`ProductsStudnieFindManyArgs`](ProductsStudnieFindManyArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>[]

#### model.ProductsStudnie.operations.findUnique

> **findUnique**: `object`

#### model.ProductsStudnie.operations.findUnique.args

> **args**: [`ProductsStudnieFindUniqueArgs`](ProductsStudnieFindUniqueArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\> \| `null`

#### model.ProductsStudnie.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.ProductsStudnie.operations.findUniqueOrThrow.args

> **args**: [`ProductsStudnieFindUniqueOrThrowArgs`](ProductsStudnieFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>

#### model.ProductsStudnie.operations.groupBy

> **groupBy**: `object`

#### model.ProductsStudnie.operations.groupBy.args

> **args**: [`ProductsStudnieGroupByArgs`](ProductsStudnieGroupByArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`ProductsStudnieGroupByOutputType`](ProductsStudnieGroupByOutputType.md)\>[]

#### model.ProductsStudnie.operations.update

> **update**: `object`

#### model.ProductsStudnie.operations.update.args

> **args**: [`ProductsStudnieUpdateArgs`](ProductsStudnieUpdateArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>

#### model.ProductsStudnie.operations.updateMany

> **updateMany**: `object`

#### model.ProductsStudnie.operations.updateMany.args

> **args**: [`ProductsStudnieUpdateManyArgs`](ProductsStudnieUpdateManyArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.ProductsStudnie.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.ProductsStudnie.operations.updateManyAndReturn.args

> **args**: [`ProductsStudnieUpdateManyAndReturnArgs`](ProductsStudnieUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>[]

#### model.ProductsStudnie.operations.upsert

> **upsert**: `object`

#### model.ProductsStudnie.operations.upsert.args

> **args**: [`ProductsStudnieUpsertArgs`](ProductsStudnieUpsertArgs.md)\<`ExtArgs`\>

#### model.ProductsStudnie.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$ProductsStudniePayload`]($ProductsStudniePayload.md)\>

#### model.ProductsStudnie.payload

> **payload**: [`$ProductsStudniePayload`]($ProductsStudniePayload.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers

> **recycled\_production\_numbers**: `object`

#### model.recycled\_production\_numbers.fields

> **fields**: [`recycled_production_numbersFieldRefs`](../interfaces/recycled_production_numbersFieldRefs.md)

#### model.recycled\_production\_numbers.operations

> **operations**: `object`

#### model.recycled\_production\_numbers.operations.aggregate

> **aggregate**: `object`

#### model.recycled\_production\_numbers.operations.aggregate.args

> **args**: [`Recycled_production_numbersAggregateArgs`](Recycled_production_numbersAggregateArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateRecycled_production_numbers`](AggregateRecycled_production_numbers.md)\>

#### model.recycled\_production\_numbers.operations.count

> **count**: `object`

#### model.recycled\_production\_numbers.operations.count.args

> **args**: [`recycled_production_numbersCountArgs`](recycled_production_numbersCountArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.count.result

> **result**: `$Utils.Optional`\<[`Recycled_production_numbersCountAggregateOutputType`](Recycled_production_numbersCountAggregateOutputType.md)\> \| `number`

#### model.recycled\_production\_numbers.operations.create

> **create**: `object`

#### model.recycled\_production\_numbers.operations.create.args

> **args**: [`recycled_production_numbersCreateArgs`](recycled_production_numbersCreateArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>

#### model.recycled\_production\_numbers.operations.createMany

> **createMany**: `object`

#### model.recycled\_production\_numbers.operations.createMany.args

> **args**: [`recycled_production_numbersCreateManyArgs`](recycled_production_numbersCreateManyArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.recycled\_production\_numbers.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.recycled\_production\_numbers.operations.createManyAndReturn.args

> **args**: [`recycled_production_numbersCreateManyAndReturnArgs`](recycled_production_numbersCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>[]

#### model.recycled\_production\_numbers.operations.delete

> **delete**: `object`

#### model.recycled\_production\_numbers.operations.delete.args

> **args**: [`recycled_production_numbersDeleteArgs`](recycled_production_numbersDeleteArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>

#### model.recycled\_production\_numbers.operations.deleteMany

> **deleteMany**: `object`

#### model.recycled\_production\_numbers.operations.deleteMany.args

> **args**: [`recycled_production_numbersDeleteManyArgs`](recycled_production_numbersDeleteManyArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.recycled\_production\_numbers.operations.findFirst

> **findFirst**: `object`

#### model.recycled\_production\_numbers.operations.findFirst.args

> **args**: [`recycled_production_numbersFindFirstArgs`](recycled_production_numbersFindFirstArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\> \| `null`

#### model.recycled\_production\_numbers.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.recycled\_production\_numbers.operations.findFirstOrThrow.args

> **args**: [`recycled_production_numbersFindFirstOrThrowArgs`](recycled_production_numbersFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>

#### model.recycled\_production\_numbers.operations.findMany

> **findMany**: `object`

#### model.recycled\_production\_numbers.operations.findMany.args

> **args**: [`recycled_production_numbersFindManyArgs`](recycled_production_numbersFindManyArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>[]

#### model.recycled\_production\_numbers.operations.findUnique

> **findUnique**: `object`

#### model.recycled\_production\_numbers.operations.findUnique.args

> **args**: [`recycled_production_numbersFindUniqueArgs`](recycled_production_numbersFindUniqueArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\> \| `null`

#### model.recycled\_production\_numbers.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.recycled\_production\_numbers.operations.findUniqueOrThrow.args

> **args**: [`recycled_production_numbersFindUniqueOrThrowArgs`](recycled_production_numbersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>

#### model.recycled\_production\_numbers.operations.groupBy

> **groupBy**: `object`

#### model.recycled\_production\_numbers.operations.groupBy.args

> **args**: [`recycled_production_numbersGroupByArgs`](recycled_production_numbersGroupByArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`Recycled_production_numbersGroupByOutputType`](Recycled_production_numbersGroupByOutputType.md)\>[]

#### model.recycled\_production\_numbers.operations.update

> **update**: `object`

#### model.recycled\_production\_numbers.operations.update.args

> **args**: [`recycled_production_numbersUpdateArgs`](recycled_production_numbersUpdateArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>

#### model.recycled\_production\_numbers.operations.updateMany

> **updateMany**: `object`

#### model.recycled\_production\_numbers.operations.updateMany.args

> **args**: [`recycled_production_numbersUpdateManyArgs`](recycled_production_numbersUpdateManyArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.recycled\_production\_numbers.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.recycled\_production\_numbers.operations.updateManyAndReturn.args

> **args**: [`recycled_production_numbersUpdateManyAndReturnArgs`](recycled_production_numbersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>[]

#### model.recycled\_production\_numbers.operations.upsert

> **upsert**: `object`

#### model.recycled\_production\_numbers.operations.upsert.args

> **args**: [`recycled_production_numbersUpsertArgs`](recycled_production_numbersUpsertArgs.md)\<`ExtArgs`\>

#### model.recycled\_production\_numbers.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\>

#### model.recycled\_production\_numbers.payload

> **payload**: [`$recycled_production_numbersPayload`]($recycled_production_numbersPayload.md)\<`ExtArgs`\>

#### model.sessions

> **sessions**: `object`

#### model.sessions.fields

> **fields**: [`sessionsFieldRefs`](../interfaces/sessionsFieldRefs.md)

#### model.sessions.operations

> **operations**: `object`

#### model.sessions.operations.aggregate

> **aggregate**: `object`

#### model.sessions.operations.aggregate.args

> **args**: [`SessionsAggregateArgs`](SessionsAggregateArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateSessions`](AggregateSessions.md)\>

#### model.sessions.operations.count

> **count**: `object`

#### model.sessions.operations.count.args

> **args**: [`sessionsCountArgs`](sessionsCountArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.count.result

> **result**: `$Utils.Optional`\<[`SessionsCountAggregateOutputType`](SessionsCountAggregateOutputType.md)\> \| `number`

#### model.sessions.operations.create

> **create**: `object`

#### model.sessions.operations.create.args

> **args**: [`sessionsCreateArgs`](sessionsCreateArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>

#### model.sessions.operations.createMany

> **createMany**: `object`

#### model.sessions.operations.createMany.args

> **args**: [`sessionsCreateManyArgs`](sessionsCreateManyArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.sessions.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.sessions.operations.createManyAndReturn.args

> **args**: [`sessionsCreateManyAndReturnArgs`](sessionsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>[]

#### model.sessions.operations.delete

> **delete**: `object`

#### model.sessions.operations.delete.args

> **args**: [`sessionsDeleteArgs`](sessionsDeleteArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>

#### model.sessions.operations.deleteMany

> **deleteMany**: `object`

#### model.sessions.operations.deleteMany.args

> **args**: [`sessionsDeleteManyArgs`](sessionsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.sessions.operations.findFirst

> **findFirst**: `object`

#### model.sessions.operations.findFirst.args

> **args**: [`sessionsFindFirstArgs`](sessionsFindFirstArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\> \| `null`

#### model.sessions.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.sessions.operations.findFirstOrThrow.args

> **args**: [`sessionsFindFirstOrThrowArgs`](sessionsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>

#### model.sessions.operations.findMany

> **findMany**: `object`

#### model.sessions.operations.findMany.args

> **args**: [`sessionsFindManyArgs`](sessionsFindManyArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>[]

#### model.sessions.operations.findUnique

> **findUnique**: `object`

#### model.sessions.operations.findUnique.args

> **args**: [`sessionsFindUniqueArgs`](sessionsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\> \| `null`

#### model.sessions.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.sessions.operations.findUniqueOrThrow.args

> **args**: [`sessionsFindUniqueOrThrowArgs`](sessionsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>

#### model.sessions.operations.groupBy

> **groupBy**: `object`

#### model.sessions.operations.groupBy.args

> **args**: [`sessionsGroupByArgs`](sessionsGroupByArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`SessionsGroupByOutputType`](SessionsGroupByOutputType.md)\>[]

#### model.sessions.operations.update

> **update**: `object`

#### model.sessions.operations.update.args

> **args**: [`sessionsUpdateArgs`](sessionsUpdateArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>

#### model.sessions.operations.updateMany

> **updateMany**: `object`

#### model.sessions.operations.updateMany.args

> **args**: [`sessionsUpdateManyArgs`](sessionsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.sessions.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.sessions.operations.updateManyAndReturn.args

> **args**: [`sessionsUpdateManyAndReturnArgs`](sessionsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>[]

#### model.sessions.operations.upsert

> **upsert**: `object`

#### model.sessions.operations.upsert.args

> **args**: [`sessionsUpsertArgs`](sessionsUpsertArgs.md)\<`ExtArgs`\>

#### model.sessions.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$sessionsPayload`]($sessionsPayload.md)\>

#### model.sessions.payload

> **payload**: [`$sessionsPayload`]($sessionsPayload.md)\<`ExtArgs`\>

#### model.settings

> **settings**: `object`

#### model.settings.fields

> **fields**: [`settingsFieldRefs`](../interfaces/settingsFieldRefs.md)

#### model.settings.operations

> **operations**: `object`

#### model.settings.operations.aggregate

> **aggregate**: `object`

#### model.settings.operations.aggregate.args

> **args**: [`SettingsAggregateArgs`](SettingsAggregateArgs.md)\<`ExtArgs`\>

#### model.settings.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateSettings`](AggregateSettings.md)\>

#### model.settings.operations.count

> **count**: `object`

#### model.settings.operations.count.args

> **args**: [`settingsCountArgs`](settingsCountArgs.md)\<`ExtArgs`\>

#### model.settings.operations.count.result

> **result**: `$Utils.Optional`\<[`SettingsCountAggregateOutputType`](SettingsCountAggregateOutputType.md)\> \| `number`

#### model.settings.operations.create

> **create**: `object`

#### model.settings.operations.create.args

> **args**: [`settingsCreateArgs`](settingsCreateArgs.md)\<`ExtArgs`\>

#### model.settings.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>

#### model.settings.operations.createMany

> **createMany**: `object`

#### model.settings.operations.createMany.args

> **args**: [`settingsCreateManyArgs`](settingsCreateManyArgs.md)\<`ExtArgs`\>

#### model.settings.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.settings.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.settings.operations.createManyAndReturn.args

> **args**: [`settingsCreateManyAndReturnArgs`](settingsCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.settings.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>[]

#### model.settings.operations.delete

> **delete**: `object`

#### model.settings.operations.delete.args

> **args**: [`settingsDeleteArgs`](settingsDeleteArgs.md)\<`ExtArgs`\>

#### model.settings.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>

#### model.settings.operations.deleteMany

> **deleteMany**: `object`

#### model.settings.operations.deleteMany.args

> **args**: [`settingsDeleteManyArgs`](settingsDeleteManyArgs.md)\<`ExtArgs`\>

#### model.settings.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.settings.operations.findFirst

> **findFirst**: `object`

#### model.settings.operations.findFirst.args

> **args**: [`settingsFindFirstArgs`](settingsFindFirstArgs.md)\<`ExtArgs`\>

#### model.settings.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\> \| `null`

#### model.settings.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.settings.operations.findFirstOrThrow.args

> **args**: [`settingsFindFirstOrThrowArgs`](settingsFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.settings.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>

#### model.settings.operations.findMany

> **findMany**: `object`

#### model.settings.operations.findMany.args

> **args**: [`settingsFindManyArgs`](settingsFindManyArgs.md)\<`ExtArgs`\>

#### model.settings.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>[]

#### model.settings.operations.findUnique

> **findUnique**: `object`

#### model.settings.operations.findUnique.args

> **args**: [`settingsFindUniqueArgs`](settingsFindUniqueArgs.md)\<`ExtArgs`\>

#### model.settings.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\> \| `null`

#### model.settings.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.settings.operations.findUniqueOrThrow.args

> **args**: [`settingsFindUniqueOrThrowArgs`](settingsFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.settings.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>

#### model.settings.operations.groupBy

> **groupBy**: `object`

#### model.settings.operations.groupBy.args

> **args**: [`settingsGroupByArgs`](settingsGroupByArgs.md)\<`ExtArgs`\>

#### model.settings.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`SettingsGroupByOutputType`](SettingsGroupByOutputType.md)\>[]

#### model.settings.operations.update

> **update**: `object`

#### model.settings.operations.update.args

> **args**: [`settingsUpdateArgs`](settingsUpdateArgs.md)\<`ExtArgs`\>

#### model.settings.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>

#### model.settings.operations.updateMany

> **updateMany**: `object`

#### model.settings.operations.updateMany.args

> **args**: [`settingsUpdateManyArgs`](settingsUpdateManyArgs.md)\<`ExtArgs`\>

#### model.settings.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.settings.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.settings.operations.updateManyAndReturn.args

> **args**: [`settingsUpdateManyAndReturnArgs`](settingsUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.settings.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>[]

#### model.settings.operations.upsert

> **upsert**: `object`

#### model.settings.operations.upsert.args

> **args**: [`settingsUpsertArgs`](settingsUpsertArgs.md)\<`ExtArgs`\>

#### model.settings.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$settingsPayload`]($settingsPayload.md)\>

#### model.settings.payload

> **payload**: [`$settingsPayload`]($settingsPayload.md)\<`ExtArgs`\>

#### model.users

> **users**: `object`

#### model.users.fields

> **fields**: [`usersFieldRefs`](../interfaces/usersFieldRefs.md)

#### model.users.operations

> **operations**: `object`

#### model.users.operations.aggregate

> **aggregate**: `object`

#### model.users.operations.aggregate.args

> **args**: [`UsersAggregateArgs`](UsersAggregateArgs.md)\<`ExtArgs`\>

#### model.users.operations.aggregate.result

> **result**: `$Utils.Optional`\<[`AggregateUsers`](AggregateUsers.md)\>

#### model.users.operations.count

> **count**: `object`

#### model.users.operations.count.args

> **args**: [`usersCountArgs`](usersCountArgs.md)\<`ExtArgs`\>

#### model.users.operations.count.result

> **result**: `$Utils.Optional`\<[`UsersCountAggregateOutputType`](UsersCountAggregateOutputType.md)\> \| `number`

#### model.users.operations.create

> **create**: `object`

#### model.users.operations.create.args

> **args**: [`usersCreateArgs`](usersCreateArgs.md)\<`ExtArgs`\>

#### model.users.operations.create.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>

#### model.users.operations.createMany

> **createMany**: `object`

#### model.users.operations.createMany.args

> **args**: [`usersCreateManyArgs`](usersCreateManyArgs.md)\<`ExtArgs`\>

#### model.users.operations.createMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.users.operations.createManyAndReturn

> **createManyAndReturn**: `object`

#### model.users.operations.createManyAndReturn.args

> **args**: [`usersCreateManyAndReturnArgs`](usersCreateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.users.operations.createManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>[]

#### model.users.operations.delete

> **delete**: `object`

#### model.users.operations.delete.args

> **args**: [`usersDeleteArgs`](usersDeleteArgs.md)\<`ExtArgs`\>

#### model.users.operations.delete.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>

#### model.users.operations.deleteMany

> **deleteMany**: `object`

#### model.users.operations.deleteMany.args

> **args**: [`usersDeleteManyArgs`](usersDeleteManyArgs.md)\<`ExtArgs`\>

#### model.users.operations.deleteMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.users.operations.findFirst

> **findFirst**: `object`

#### model.users.operations.findFirst.args

> **args**: [`usersFindFirstArgs`](usersFindFirstArgs.md)\<`ExtArgs`\>

#### model.users.operations.findFirst.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\> \| `null`

#### model.users.operations.findFirstOrThrow

> **findFirstOrThrow**: `object`

#### model.users.operations.findFirstOrThrow.args

> **args**: [`usersFindFirstOrThrowArgs`](usersFindFirstOrThrowArgs.md)\<`ExtArgs`\>

#### model.users.operations.findFirstOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>

#### model.users.operations.findMany

> **findMany**: `object`

#### model.users.operations.findMany.args

> **args**: [`usersFindManyArgs`](usersFindManyArgs.md)\<`ExtArgs`\>

#### model.users.operations.findMany.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>[]

#### model.users.operations.findUnique

> **findUnique**: `object`

#### model.users.operations.findUnique.args

> **args**: [`usersFindUniqueArgs`](usersFindUniqueArgs.md)\<`ExtArgs`\>

#### model.users.operations.findUnique.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\> \| `null`

#### model.users.operations.findUniqueOrThrow

> **findUniqueOrThrow**: `object`

#### model.users.operations.findUniqueOrThrow.args

> **args**: [`usersFindUniqueOrThrowArgs`](usersFindUniqueOrThrowArgs.md)\<`ExtArgs`\>

#### model.users.operations.findUniqueOrThrow.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>

#### model.users.operations.groupBy

> **groupBy**: `object`

#### model.users.operations.groupBy.args

> **args**: [`usersGroupByArgs`](usersGroupByArgs.md)\<`ExtArgs`\>

#### model.users.operations.groupBy.result

> **result**: `$Utils.Optional`\<[`UsersGroupByOutputType`](UsersGroupByOutputType.md)\>[]

#### model.users.operations.update

> **update**: `object`

#### model.users.operations.update.args

> **args**: [`usersUpdateArgs`](usersUpdateArgs.md)\<`ExtArgs`\>

#### model.users.operations.update.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>

#### model.users.operations.updateMany

> **updateMany**: `object`

#### model.users.operations.updateMany.args

> **args**: [`usersUpdateManyArgs`](usersUpdateManyArgs.md)\<`ExtArgs`\>

#### model.users.operations.updateMany.result

> **result**: [`BatchPayload`](BatchPayload.md)

#### model.users.operations.updateManyAndReturn

> **updateManyAndReturn**: `object`

#### model.users.operations.updateManyAndReturn.args

> **args**: [`usersUpdateManyAndReturnArgs`](usersUpdateManyAndReturnArgs.md)\<`ExtArgs`\>

#### model.users.operations.updateManyAndReturn.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>[]

#### model.users.operations.upsert

> **upsert**: `object`

#### model.users.operations.upsert.args

> **args**: [`usersUpsertArgs`](usersUpsertArgs.md)\<`ExtArgs`\>

#### model.users.operations.upsert.result

> **result**: `$Utils.PayloadToResult`\<[`$usersPayload`]($usersPayload.md)\>

#### model.users.payload

> **payload**: [`$usersPayload`]($usersPayload.md)\<`ExtArgs`\>

## Type Declaration

### other

> **other**: `object`

#### other.operations

> **operations**: `object`

#### other.operations.$executeRaw

> **$executeRaw**: `object`

#### other.operations.$executeRaw.args

> **args**: \[`TemplateStringsArray` \| [`Sql`](../classes/Sql.md), `any`[]\]

#### other.operations.$executeRaw.result

> **result**: `any`

#### other.operations.$executeRawUnsafe

> **$executeRawUnsafe**: `object`

#### other.operations.$executeRawUnsafe.args

> **args**: \[`string`, `any`[]\]

#### other.operations.$executeRawUnsafe.result

> **result**: `any`

#### other.operations.$queryRaw

> **$queryRaw**: `object`

#### other.operations.$queryRaw.args

> **args**: \[`TemplateStringsArray` \| [`Sql`](../classes/Sql.md), `any`[]\]

#### other.operations.$queryRaw.result

> **result**: `any`

#### other.operations.$queryRawUnsafe

> **$queryRawUnsafe**: `object`

#### other.operations.$queryRawUnsafe.args

> **args**: \[`string`, `any`[]\]

#### other.operations.$queryRawUnsafe.result

> **result**: `any`

#### other.payload

> **payload**: `any`

## Type Parameters

### ExtArgs

`ExtArgs` *extends* `$Extensions.InternalArgs` = `$Extensions.DefaultArgs`

### GlobalOmitOptions

`GlobalOmitOptions` = \{ \}
