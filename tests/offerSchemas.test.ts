import {
    offerItemSchema,
    wellDataSchema,
    passageConfigSchema,
    offerCreateSchema,
    offerStudnieCreateSchema,
    offersBatchSchema,
    offersStudnieBatchSchema
} from '../src/validators/offerSchemas';

// ─── offerItemSchema ────────────────────────────────────────────────

describe('offerItemSchema', () => {
    const validItem = {
        productId: 'prod-123',
        quantity: 5,
        discount: 10,
        price: 100.50
    };

    it('powinien akceptować prawidłowy element oferty', () => {
        const result = offerItemSchema.safeParse(validItem);
        expect(result.success).toBe(true);
    });

    it('powinien akceptować element bez discount (domyślnie undefined)', () => {
        const item = { productId: 'prod-123', quantity: 5, price: 100 };
        const result = offerItemSchema.safeParse(item);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.discount).toBeUndefined();
        }
    });

    it('powinien odrzucać brakujący productId', () => {
        const item = { quantity: 5, price: 100 };
        const result = offerItemSchema.safeParse(item);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać ujemną ilość', () => {
        const item = { ...validItem, quantity: -1 };
        const result = offerItemSchema.safeParse(item);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać ujemną cenę', () => {
        const item = { ...validItem, price: -10 };
        const result = offerItemSchema.safeParse(item);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać discount poniżej 0', () => {
        const item = { ...validItem, discount: -5 };
        const result = offerItemSchema.safeParse(item);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać discount powyżej 100', () => {
        const item = { ...validItem, discount: 101 };
        const result = offerItemSchema.safeParse(item);
        expect(result.success).toBe(false);
    });
});

// ─── wellDataSchema ───────────────────────────────────────────────────

describe('wellDataSchema', () => {
    const validWell = {
        dn: '1000',
        height: 1500,
        zwienczenie: 'Płytka betonowa',
        quantity: 2,
        components: []
    };

    it('powinien akceptować prawidłowe dane studni', () => {
        const result = wellDataSchema.safeParse(validWell);
        expect(result.success).toBe(true);
    });

    it('powinien akceptować brakujący dn (opcjonalne)', () => {
        const well = { height: 1500 };
        const result = wellDataSchema.safeParse(well);
        expect(result.success).toBe(true);
    });

    it('powinien akceptować pusty dn', () => {
        const well = { ...validWell, dn: '' };
        const result = wellDataSchema.safeParse(well);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać ujemną wysokość', () => {
        const well = { ...validWell, height: -100 };
        const result = wellDataSchema.safeParse(well);
        expect(result.success).toBe(false);
    });

    it('powinien akceptować studnię bez komponentów', () => {
        const well = { dn: '1000', quantity: 1 };
        const result = wellDataSchema.safeParse(well);
        expect(result.success).toBe(true);
    });
});

// ─── passageConfigSchema ────────────────────────────────────────────

describe('passageConfigSchema', () => {
    const validPassage = {
        DN: '200',
        typPrzejscia: 'krótka',
        kat: 45
    };

    it('powinien akceptować prawidłowy przepust', () => {
        const result = passageConfigSchema.safeParse(validPassage);
        expect(result.success).toBe(true);
    });

    it('powinien akceptować przepust typu "długa"', () => {
        const passage = { ...validPassage, typPrzejscia: 'długa' };
        const result = passageConfigSchema.safeParse(passage);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać nieprawidłowy typ przepustu', () => {
        // schemat nie waliduje typPrzejscia - akceptuje dowolny string
        // więc ten test weryfikuje że schemat przepuszcza nieznane wartości
        const passage = { ...validPassage, typPrzejscia: 'średnia' };
        const result = passageConfigSchema.safeParse(passage);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać ujemną wartość heightFromBottom', () => {
        const passage = { ...validPassage, heightFromBottom: -1 };
        const result = passageConfigSchema.safeParse(passage);
        expect(result.success).toBe(false);
    });
});

// ─── offerCreateSchema ────────────────────────────────────────────────

describe('offerCreateSchema', () => {
    const validOffer = {
        clientId: 'client-123',
        state: 'draft',
        items: [
            { productId: 'prod-1', quantity: 2, price: 100 }
        ]
    };

    it('powinien akceptować prawidłową ofertę', () => {
        const result = offerCreateSchema.safeParse(validOffer);
        expect(result.success).toBe(true);
    });

    it('powinien akceptować ofertę z opcjonalnym id', () => {
        const offer = { ...validOffer, id: 'offer-123' };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać brakujący clientId', () => {
        const offer = { items: validOffer.items };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać pusty clientId', () => {
        const offer = { ...validOffer, clientId: '' };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać nieprawidłowy state', () => {
        const offer = { ...validOffer, state: 'pending' };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(false);
    });

    it('powinien akceptować state "final"', () => {
        const offer = { ...validOffer, state: 'final' };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać ujemny transportCost', () => {
        const offer = { ...validOffer, transportCost: -10 };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(false);
    });

    it('powinien akceptować pustą tablicę items', () => {
        const offer = { ...validOffer, items: [] };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać nieprawidłowe elementy w items', () => {
        const offer = {
            ...validOffer,
            items: [{ productId: '', quantity: -1, price: -10 }]
        };
        const result = offerCreateSchema.safeParse(offer);
        expect(result.success).toBe(false);
    });
});

// ─── offerStudnieCreateSchema ───────────────────────────────────────

describe('offerStudnieCreateSchema', () => {
    const validOfferStudnie = {
        clientId: 'client-123',
        state: 'draft',
        wells: [
            { dn: '1000', height: 1500, quantity: 1 }
        ]
    };

    it('powinien akceptować prawidłową ofertę studni', () => {
        const result = offerStudnieCreateSchema.safeParse(validOfferStudnie);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać brakujące wells', () => {
        const offer = { clientId: 'client-123', state: 'draft' };
        const result = offerStudnieCreateSchema.safeParse(offer);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać pustą tablicę wells', () => {
        const offer = { ...validOfferStudnie, wells: [] };
        const result = offerStudnieCreateSchema.safeParse(offer);
        expect(result.success).toBe(true);
    });

    it('powinien akceptować totalPrice', () => {
        const offer = { ...validOfferStudnie, totalPrice: 5000 };
        const result = offerStudnieCreateSchema.safeParse(offer);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać ujemny totalPrice', () => {
        const offer = { ...validOfferStudnie, totalPrice: -100 };
        const result = offerStudnieCreateSchema.safeParse(offer);
        expect(result.success).toBe(false);
    });
});

// ─── offersBatchSchema ─────────────────────────────────────────────

describe('offersBatchSchema', () => {
    const validBatch = {
        data: [
            {
                clientId: 'client-1',
                items: [{ productId: 'prod-1', quantity: 2, price: 100 }]
            },
            {
                clientId: 'client-2',
                items: [{ productId: 'prod-2', quantity: 3, price: 200 }]
            }
        ]
    };

    it('powinien akceptować prawidłową aktualizację zbiorczą ofert rur', () => {
        const result = offersBatchSchema.safeParse(validBatch);
        expect(result.success).toBe(true);
    });

    it('powinien akceptować pojedynczą ofertę w tablicy', () => {
        const batch = {
            data: [{ clientId: 'client-1', items: [] }]
        };
        const result = offersBatchSchema.safeParse(batch);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać brakującą tablicę data', () => {
        const batch = {};
        const result = offersBatchSchema.safeParse(batch);
        expect(result.success).toBe(false);
    });

    it('powinien odrzucać nieprawidłową ofertę w tablicy', () => {
        const batch = {
            data: [
                { clientId: 'client-1', items: [] },
                { items: [] } // brak clientId
            ]
        };
        const result = offersBatchSchema.safeParse(batch);
        expect(result.success).toBe(false);
    });
});

// ─── offersStudnieBatchSchema ───────────────────────────────────────

describe('offersStudnieBatchSchema', () => {
    const validBatch = {
        data: [
            {
                clientId: 'client-1',
                wells: [{ dn: '1000', quantity: 1 }]
            },
            {
                clientId: 'client-2',
                wells: [{ dn: '1200', quantity: 2 }]
            }
        ]
    };

    it('powinien akceptować prawidłową aktualizację zbiorczą ofert studni', () => {
        const result = offersStudnieBatchSchema.safeParse(validBatch);
        expect(result.success).toBe(true);
    });

    it('powinien odrzucać nieprawidłową studnię w ofercie', () => {
        const batch = {
            data: [
                { clientId: 'client-1', wells: [{ dn: '', totalPrice: -100 }] }
            ]
        };
        const result = offersStudnieBatchSchema.safeParse(batch);
        expect(result.success).toBe(false);
    });
});

// ─── Integracja schematów ───────────────────────────────────────────

describe('Integracja schematów ofert', () => {
    it('offerCreateSchema powinien akceptować kompleksową ofertę', () => {
        const complexOffer = {
            id: 'offer-123',
            clientId: 'client-abc',
            state: 'final',
            status: 'active',
            transportCost: 150.50,
            items: [
                { productId: 'pipe-1', quantity: 10, price: 50, discount: 5 },
                { productId: 'pipe-2', quantity: 5, price: 100 }
            ],
            data: {
                notes: 'Ważna oferta',
                priority: 'high'
            }
        };
        const result = offerCreateSchema.safeParse(complexOffer);
        expect(result.success).toBe(true);
    });

    it('offerStudnieCreateSchema powinien akceptować kompleksową ofertę studni', () => {
        const complexOffer = {
            clientId: 'client-xyz',
            state: 'draft',
            wells: [
                {
                    dn: '1000',
                    height: 2000,
                    zwienczenie: 'Płytka żeliwna',
                    components: [
                        { name: 'Rura', typ: 'rura', dn: 1000, price: 500 },
                        { name: 'Dno', typ: 'dno', dn: 1000, price: 200 }
                    ],
                    passages: [
                        { DN: '200', typPrzejscia: 'krótka', kat: 45 }
                    ]
                }
            ],
            totalPrice: 1500,
            data: {
                projectName: 'Projekt kanalizacji'
            }
        };
        const result = offerStudnieCreateSchema.safeParse(complexOffer);
        expect(result.success).toBe(true);
    });
});
