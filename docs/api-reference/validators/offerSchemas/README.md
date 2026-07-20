[**WITROS Oferty PV — Backend API Reference v1.8.0**](../../README.md)

***

[WITROS Oferty PV — Backend API Reference](../../README.md) / validators/offerSchemas

# validators/offerSchemas

Schematy walidacji Zod dla ofert

Definiuje struktury danych dla ofert rur i studni używane
przy tworzeniu, aktualizacji i walidacji danych wejściowych API.

## Example

```ts
// Walidacja pojedynczej oferty
const result = offerCreateSchema.safeParse({
  clientId: 'client-123',
  items: [{ productId: 'prod-1', quantity: 5, price: 100 }]
});

if (result.success) {
  console.log('Dane poprawne:', result.data);
} else {
  console.error('Błędy walidacji:', result.error.issues);
}
```

## Type Aliases

- [ClientInput](type-aliases/ClientInput.md)
- [ClientsBatchInput](type-aliases/ClientsBatchInput.md)
- [MarketplaceModerateInput](type-aliases/MarketplaceModerateInput.md)
- [MarketplaceSearchInput](type-aliases/MarketplaceSearchInput.md)
- [OfferCreateInput](type-aliases/OfferCreateInput.md)
- [OfferItemInput](type-aliases/OfferItemInput.md)
- [OffersBatchInput](type-aliases/OffersBatchInput.md)
- [OffersStudnieBatchInput](type-aliases/OffersStudnieBatchInput.md)
- [OfferStudnieCreateInput](type-aliases/OfferStudnieCreateInput.md)
- [OfferStudnieUpdateInput](type-aliases/OfferStudnieUpdateInput.md)
- [OfferUpdateInput](type-aliases/OfferUpdateInput.md)
- [PaginationQuery](type-aliases/PaginationQuery.md)
- [PassageConfigInput](type-aliases/PassageConfigInput.md)
- [PricelistDataInput](type-aliases/PricelistDataInput.md)
- [ProductionOrderCreateInput](type-aliases/ProductionOrderCreateInput.md)
- [ProductionOrderItemInput](type-aliases/ProductionOrderItemInput.md)
- [ProductionOrdersBatchInput](type-aliases/ProductionOrdersBatchInput.md)
- [RuryOfferExportInput](type-aliases/RuryOfferExportInput.md)
- [RuryOfferExportItemInput](type-aliases/RuryOfferExportItemInput.md)
- [RuryOrderItemInput](type-aliases/RuryOrderItemInput.md)
- [RuryOrdersBatchInput](type-aliases/RuryOrdersBatchInput.md)
- [RuryOrderUpdateInput](type-aliases/RuryOrderUpdateInput.md)
- [StudnieOfferExportInput](type-aliases/StudnieOfferExportInput.md)
- [StudnieOfferExportItemInput](type-aliases/StudnieOfferExportItemInput.md)
- [StudnieOrderItemInput](type-aliases/StudnieOrderItemInput.md)
- [StudnieOrdersBatchInput](type-aliases/StudnieOrdersBatchInput.md)
- [StudnieOrderUpdateInput](type-aliases/StudnieOrderUpdateInput.md)
- [TelemetryOverrideInput](type-aliases/TelemetryOverrideInput.md)
- [UserUpdateInput](type-aliases/UserUpdateInput.md)
- [WellComponentInput](type-aliases/WellComponentInput.md)
- [WellDataInput](type-aliases/WellDataInput.md)
- [YearLetterInput](type-aliases/YearLetterInput.md)

## Variables

- [clientsBatchSchema](variables/clientsBatchSchema.md)
- [clientSchema](variables/clientSchema.md)
- [marketplaceModerateSchema](variables/marketplaceModerateSchema.md)
- [marketplaceSearchSchema](variables/marketplaceSearchSchema.md)
- [offerCreateSchema](variables/offerCreateSchema.md)
- [offerItemSchema](variables/offerItemSchema.md)
- [offersBatchSchema](variables/offersBatchSchema.md)
- [offersStudnieBatchSchema](variables/offersStudnieBatchSchema.md)
- [offerStudnieCreateSchema](variables/offerStudnieCreateSchema.md)
- [offerStudnieUpdateSchema](variables/offerStudnieUpdateSchema.md)
- [offerUpdateSchema](variables/offerUpdateSchema.md)
- [paginationQuerySchema](variables/paginationQuerySchema.md)
- [passageConfigSchema](variables/passageConfigSchema.md)
- [precoPricingPatchSchema](variables/precoPricingPatchSchema.md)
- [precoPricingUpdateSchema](variables/precoPricingUpdateSchema.md)
- [pricelistDataSchema](variables/pricelistDataSchema.md)
- [productionOrderCreateSchema](variables/productionOrderCreateSchema.md)
- [productionOrderItemSchema](variables/productionOrderItemSchema.md)
- [productionOrdersBatchSchema](variables/productionOrdersBatchSchema.md)
- [productPatchSchema](variables/productPatchSchema.md)
- [productStudniePatchSchema](variables/productStudniePatchSchema.md)
- [ruryOfferExportItemSchema](variables/ruryOfferExportItemSchema.md)
- [ruryOfferExportSchema](variables/ruryOfferExportSchema.md)
- [ruryOrderItemSchema](variables/ruryOrderItemSchema.md)
- [ruryOrdersBatchSchema](variables/ruryOrdersBatchSchema.md)
- [ruryOrderUpdateSchema](variables/ruryOrderUpdateSchema.md)
- [studnieOfferExportItemSchema](variables/studnieOfferExportItemSchema.md)
- [studnieOfferExportSchema](variables/studnieOfferExportSchema.md)
- [studnieOrderItemSchema](variables/studnieOrderItemSchema.md)
- [studnieOrdersBatchSchema](variables/studnieOrdersBatchSchema.md)
- [studnieOrderUpdateSchema](variables/studnieOrderUpdateSchema.md)
- [telemetryOverrideSchema](variables/telemetryOverrideSchema.md)
- [userUpdateSchema](variables/userUpdateSchema.md)
- [wellComponentSchema](variables/wellComponentSchema.md)
- [wellDataSchema](variables/wellDataSchema.md)
- [yearLetterSchema](variables/yearLetterSchema.md)
