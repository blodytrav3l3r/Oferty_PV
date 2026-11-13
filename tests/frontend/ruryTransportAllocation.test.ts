import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadTransport() {
    const sandbox = {
        window: {},
        document: { getElementById: () => null },
        MAX_TRANSPORT_WEIGHT: 24000,
        getRuryProductById: () => null,
        calculateTransports: () => ({ totalTransports: 0 }),
        calculateTransportTrips: () => ({ saved: 0 }),
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(path.join(process.cwd(), 'public/js/rury/transport.js'), 'utf-8'),
        sandbox,
        { filename: 'transport.js' }
    );
    return sandbox.window as Record<string, (...args: any[]) => any>;
}

describe('frontend vm: dokładna alokacja transportu rur', () => {
    it('dzieli 1,00 zł na trzy sztuki jako 0,33 + 0,33 + 0,34', () => {
        const transport = loadTransport();
        const allocation = transport['calculateTransportAllocation'](
            [{ uid: 'pipe-1', productId: 'P', weight: 1, quantity: 3 }],
            1
        );
        expect(allocation.items[0].totalCents).toBe(100);
        expect(allocation.items[0].segments).toEqual([
            { quantity: 2, transportCentsPerUnit: 33 },
            { quantity: 1, transportCentsPerUnit: 34 }
        ]);
    });

    it('rozdziela różne wagi proporcjonalnie i remisy stabilnie po UID', () => {
        const transport = loadTransport();
        const weighted = transport['calculateTransportAllocation'](
            [
                { uid: 'light', productId: 'L', weight: 1, quantity: 1 },
                { uid: 'heavy', productId: 'H', weight: 2, quantity: 1 }
            ],
            1
        );
        expect(weighted.items.map((entry: any) => entry.totalCents)).toEqual([33, 67]);

        const tied = transport['calculateTransportAllocation'](
            [
                { uid: 'z', productId: 'P', weight: 1, quantity: 1 },
                { uid: 'a', productId: 'P', weight: 1, quantity: 1 }
            ],
            0.01
        );
        expect(tied.items.map((entry: any) => [entry.itemUid, entry.totalCents])).toEqual([
            ['z', 0],
            ['a', 1]
        ]);
    });

    it('pomija wagę zerową, zachowuje grosze dla ilości ułamkowej i nie mutuje historii', () => {
        const transport = loadTransport();
        const history = [
            { uid: 'zero', productId: 'Z', weight: 0, quantity: 1 },
            { uid: 'fractional', productId: 'F', weight: 1, quantity: 1.5 }
        ];
        const projection = transport['projectTransportAllocation'](history, null, 0.05);
        expect(projection.items).toEqual([{ itemUid: 'fractional', totalCents: 5 }]);
        expect(history[0]).not.toHaveProperty('transportAllocation');
        expect(history[1]).not.toHaveProperty('transportAllocation');
    });

    it('przy samych zerowych wagach dzieli koszt proporcjonalnie do ilości', () => {
        const transport = loadTransport();
        const allocation = transport['calculateTransportAllocation'](
            [
                { uid: 'one', productId: 'P', weight: 0, quantity: 1 },
                { uid: 'two', productId: 'P', weight: 0, quantity: 2 }
            ],
            0.03
        );
        expect(allocation.items.map((entry: any) => entry.totalCents)).toEqual([1, 2]);
        expect(
            allocation.items.reduce((sum: number, entry: any) => sum + entry.totalCents, 0)
        ).toBe(3);
    });

    it('osobny transport nie jest rozdzielany na pozycje', () => {
        const transport = loadTransport();
        const distribution = transport['withOfferTransportFlags']({ transportSeparate: true }, () =>
            transport['calculateTransportDistributionStandalone'](
                [{ uid: 'pipe', productId: 'P', weight: 1, quantity: 3 }],
                1
            )
        );
        expect(distribution).toEqual({});
    });

    it('wybór części ilości zachowuje przypisane stawki jednostkowe', () => {
        const transport = loadTransport();
        const selected = transport['selectTransportAllocation'](
            [{ uid: 'pipe', quantity: 2 }],
            {
                version: 1,
                items: [
                    {
                        itemUid: 'pipe',
                        totalCents: 100,
                        segments: [
                            { quantity: 2, transportCentsPerUnit: 33 },
                            { quantity: 1, transportCentsPerUnit: 34 }
                        ]
                    }
                ]
            },
            [{ uid: 'pipe', quantity: 3 }]
        );
        expect(selected.items[0]).toEqual({
            itemUid: 'pipe',
            totalCents: 66,
            segments: [{ quantity: 2, transportCentsPerUnit: 33 }]
        });
    });

    it('ilość ułamkowa w podalokacji jest kwotą liniową bez segmentów', () => {
        const transport = loadTransport();
        const selected = transport['selectTransportAllocation'](
            [{ uid: 'fractional', quantity: 0.5 }],
            {
                version: 1,
                items: [
                    {
                        itemUid: 'fractional',
                        totalCents: 100,
                        segments: [{ quantity: 2, transportCentsPerUnit: 50 }]
                    }
                ]
            },
            [{ uid: 'fractional', quantity: 1 }]
        );
        expect(selected.items[0]).toEqual({ itemUid: 'fractional', totalCents: 50 });
    });

    it('zachowuje podział przy utworzeniu i edycji kolejnego zamówienia częściowego', () => {
        const transport = loadTransport();
        const allocation = {
            version: 1,
            items: [
                {
                    itemUid: 'pipe',
                    totalCents: 100,
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        };
        const sourceItems = [{ uid: 'pipe', quantity: 3 }];
        const originalSnapshot = {
            transportSourceItems: sourceItems,
            transportAllocation: allocation
        };
        const allocateOrder = (alreadyOrdered: number) => {
            const orderAllocation = transport['selectTransportAllocation'](
                [{ uid: 'pipe', orderedQuantity: 1 }],
                allocation,
                sourceItems,
                { pipe: alreadyOrdered }
            );
            return orderAllocation.items[0].totalCents;
        };
        const firstOrderCents = allocateOrder(0);
        const secondOrderOnCreateCents = allocateOrder(1);
        const editSourceAllocation = transport['projectTransportAllocation'](
            originalSnapshot.transportSourceItems,
            originalSnapshot.transportAllocation,
            1
        );
        const secondOrderAfterEditCents = transport['selectTransportAllocation'](
            [{ uid: 'pipe', orderedQuantity: 1 }],
            editSourceAllocation,
            originalSnapshot.transportSourceItems,
            { pipe: 1 }
        ).items[0].totalCents;
        const thirdOrderCents = allocateOrder(2);

        expect(originalSnapshot.transportAllocation.items[0].totalCents).toBe(100);
        expect(secondOrderAfterEditCents).toBe(secondOrderOnCreateCents);
        expect([firstOrderCents, secondOrderOnCreateCents, thirdOrderCents]).toEqual([33, 33, 34]);
        expect(firstOrderCents + secondOrderAfterEditCents + thirdOrderCents).toBe(100);
    });

    it('renderer zamówienia używa zapisanej podalokacji, nie pełnego kosztu oferty', () => {
        const transport = loadTransport();
        const currentOrder = {
            transportSeparate: false,
            transportAllocation: {
                version: 1,
                items: [
                    {
                        itemUid: 'pipe',
                        totalCents: 33,
                        segments: [{ quantity: 1, transportCentsPerUnit: 33 }]
                    }
                ]
            }
        };
        const windowState = transport as unknown as Record<string, unknown>;
        windowState.orderEditMode = true;
        windowState.getCurrentRuryOrder = () => currentOrder;
        const allocation = transport['getCurrentRuryTransportAllocation'](
            [{ uid: 'pipe', quantity: 3, orderedQuantity: 1 }],
            1
        );
        expect(allocation.items[0].totalCents).toBe(33);
    });

    it('nie ufa uszkodzonym metadanym alokacji i odtwarza legacy projection', () => {
        const transport = loadTransport();
        const items = [{ uid: 'pipe', productId: 'P', weight: 1, quantity: 3 }];
        const corruptions = [
            { version: 1, items: [null] },
            {
                version: 1,
                items: [{ itemUid: 'pipe', totalCents: 100, segments: [null] }]
            },
            {
                version: 1,
                items: [
                    {
                        itemUid: 'pipe',
                        totalCents: 100,
                        segments: [
                            { quantity: 2, transportCentsPerUnit: 33 },
                            { quantity: 1, transportCentsPerUnit: 33 }
                        ]
                    }
                ]
            }
        ];

        corruptions.forEach((saved) => {
            const projection = transport['projectTransportAllocation'](items, saved, 1);
            expect(projection.items[0].totalCents).toBe(100);
            expect(projection.items[0].segments).toEqual([
                { quantity: 2, transportCentsPerUnit: 33 },
                { quantity: 1, transportCentsPerUnit: 34 }
            ]);
        });
    });

    it('odrzuca zapisane alokacje dla źródłowych UID zduplikowanych w pozycjach', () => {
        const transport = loadTransport();
        const duplicateItems = [
            { uid: 'pipe', quantity: 1 },
            { uid: 'pipe', quantity: 1 }
        ];
        const allocation = {
            version: 1,
            items: [
                {
                    itemUid: 'pipe',
                    totalCents: 100,
                    segments: [{ quantity: 1, transportCentsPerUnit: 100 }]
                }
            ]
        };

        expect(transport['isTransportAllocationValid'](duplicateItems, allocation, 1)).toBe(false);
    });

    it('edycja pierwszego zamówienia nie zmienia zamrożonej alokacji drugiego', () => {
        const transport = loadTransport();
        const sourceItems = [{ uid: 'pipe', quantity: 3, weight: 1 }];
        const sourceAllocation = {
            version: 1,
            items: [
                {
                    itemUid: 'pipe',
                    totalCents: 100,
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        };
        const makeOrder = (
            id: string,
            createdAt: string,
            orderedQuantity: number,
            allocation: any
        ) => ({
            id,
            offerId: 'offer',
            createdAt,
            transportSeparate: false,
            transportAllocation: allocation,
            transportCost:
                allocation.items.reduce((sum: number, entry: any) => sum + entry.totalCents, 0) /
                100,
            items: [{ uid: 'pipe', quantity: 3, orderedQuantity }]
        });
        const firstAllocation = transport['allocateRuryOrderTransport'](
            [{ uid: 'pipe', orderedQuantity: 1 }],
            sourceItems,
            sourceAllocation,
            [],
            null
        );
        const first = makeOrder('order-1', '2026-01-01', 1, firstAllocation.allocation);
        const secondAllocation = transport['allocateRuryOrderTransport'](
            [{ uid: 'pipe', orderedQuantity: 2 }],
            sourceItems,
            sourceAllocation,
            [first],
            null
        );
        const second = makeOrder('order-2', '2026-01-02', 2, secondAllocation.allocation);
        const savedSecondAllocation = JSON.parse(JSON.stringify(second.transportAllocation));
        const editedFirstAllocation = transport['allocateRuryOrderTransport'](
            [{ uid: 'pipe', orderedQuantity: 1 }],
            sourceItems,
            sourceAllocation,
            [first, second],
            first
        );

        expect(firstAllocation.allocation.items[0].totalCents).toBe(33);
        expect(secondAllocation.allocation.items[0].totalCents).toBe(67);
        expect(secondAllocation.allocation.items[0].segments).toEqual([
            { quantity: 1, transportCentsPerUnit: 33 },
            { quantity: 1, transportCentsPerUnit: 34 }
        ]);
        expect(editedFirstAllocation.valid).toBe(true);
        expect(editedFirstAllocation.allocation.items[0].totalCents).toBe(33);
        expect(second.transportAllocation).toEqual(savedSecondAllocation);
        expect(editedFirstAllocation.transportCost + second.transportCost).toBe(1);
    });

    it('pozwala zwiększyć zamówienie z wolnej puli i blokuje wzrost po jej wyczerpaniu', () => {
        const transport = loadTransport();
        const sourceItems = [{ uid: 'pipe', quantity: 3, weight: 1 }];
        const sourceAllocation = {
            version: 1,
            items: [
                {
                    itemUid: 'pipe',
                    totalCents: 100,
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        };
        const current = {
            id: 'current',
            items: [{ uid: 'pipe', orderedQuantity: 1 }],
            transportAllocation: {
                version: 1,
                items: [
                    {
                        itemUid: 'pipe',
                        totalCents: 33,
                        segments: [{ quantity: 1, transportCentsPerUnit: 33 }]
                    }
                ]
            }
        };
        const frozen = {
            id: 'frozen',
            createdAt: '2026-01-01',
            items: [{ uid: 'pipe', orderedQuantity: 1 }],
            transportAllocation: {
                version: 1,
                items: [
                    {
                        itemUid: 'pipe',
                        totalCents: 33,
                        segments: [{ quantity: 1, transportCentsPerUnit: 33 }]
                    }
                ]
            }
        };
        const grown = transport['allocateRuryOrderTransport'](
            [{ uid: 'pipe', orderedQuantity: 2 }],
            sourceItems,
            sourceAllocation,
            [current, frozen],
            current
        );
        expect(grown.valid).toBe(true);
        expect(grown.allocation.items[0]).toEqual({
            itemUid: 'pipe',
            totalCents: 67,
            segments: [
                { quantity: 1, transportCentsPerUnit: 33 },
                { quantity: 1, transportCentsPerUnit: 34 }
            ]
        });

        const exhaustedOther = {
            ...frozen,
            items: [{ uid: 'pipe', orderedQuantity: 2 }],
            transportAllocation: {
                version: 1,
                items: [
                    {
                        itemUid: 'pipe',
                        totalCents: 67,
                        segments: [
                            { quantity: 1, transportCentsPerUnit: 33 },
                            { quantity: 1, transportCentsPerUnit: 34 }
                        ]
                    }
                ]
            }
        };
        const exhausted = transport['allocateRuryOrderTransport'](
            [{ uid: 'pipe', orderedQuantity: 2 }],
            sourceItems,
            sourceAllocation,
            [current, exhaustedOther],
            current
        );
        expect(exhausted.valid).toBe(false);
        expect(exhausted.reason).toBe('transport-pool-conflict');
    });

    it('przy edycji legacy bez poprawnej alokacji przydziela całą ilość z wolnej puli', () => {
        const transport = loadTransport();
        const integerSourceItems = [{ uid: 'pipe', quantity: 3, weight: 1 }];
        const integerSourceAllocation = {
            version: 1,
            items: [
                {
                    itemUid: 'pipe',
                    totalCents: 100,
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        };
        const legacyIntegerOrder = {
            id: 'legacy-integer',
            items: [{ uid: 'pipe', quantity: 3, orderedQuantity: 1 }],
            transportCost: 0
        };
        const integerEdit = transport['allocateRuryOrderTransport'](
            [{ uid: 'pipe', orderedQuantity: 1 }],
            integerSourceItems,
            integerSourceAllocation,
            [legacyIntegerOrder],
            legacyIntegerOrder
        );

        expect(integerEdit.valid).toBe(true);
        expect(integerEdit.allocation.items[0]).toEqual({
            itemUid: 'pipe',
            totalCents: 33,
            segments: [{ quantity: 1, transportCentsPerUnit: 33 }]
        });

        const fractionalSourceItems = [{ uid: 'fraction', quantity: 1.5, weight: 1 }];
        const fractionalSourceAllocation = {
            version: 1,
            items: [{ itemUid: 'fraction', totalCents: 100 }]
        };
        const legacyFractionalOrder = {
            id: 'legacy-fractional',
            items: [{ uid: 'fraction', quantity: 1.5, orderedQuantity: 0.5 }],
            transportCost: 0
        };
        const fractionalEdit = transport['allocateRuryOrderTransport'](
            [{ uid: 'fraction', orderedQuantity: 0.5 }],
            fractionalSourceItems,
            fractionalSourceAllocation,
            [legacyFractionalOrder],
            legacyFractionalOrder
        );

        expect(fractionalEdit.valid).toBe(true);
        expect(fractionalEdit.allocation.items[0]).toEqual({
            itemUid: 'fraction',
            totalCents: 33
        });
    });

    it('zachowuje alokację mimo pozycji autoAdded bez udziału w transporcie', () => {
        const transport = loadTransport();
        const sourceItems = [{ uid: 'pipe', quantity: 2, weight: 1 }];
        const sourceAllocation = {
            version: 1,
            items: [
                {
                    itemUid: 'pipe',
                    totalCents: 66,
                    segments: [{ quantity: 2, transportCentsPerUnit: 33 }]
                }
            ]
        };
        const current = {
            id: 'current',
            items: [
                { uid: 'pipe', quantity: 2, orderedQuantity: 1 },
                { uid: 'auto', quantity: 1, orderedQuantity: 1, autoAdded: true }
            ],
            transportCost: 0.33,
            transportAllocation: {
                version: 1,
                items: [
                    {
                        itemUid: 'pipe',
                        totalCents: 33,
                        segments: [{ quantity: 1, transportCentsPerUnit: 33 }]
                    }
                ]
            }
        };

        const edited = transport['allocateRuryOrderTransport'](
            [{ uid: 'pipe', orderedQuantity: 1 }],
            sourceItems,
            sourceAllocation,
            [current],
            current
        );

        expect(edited.valid).toBe(true);
        expect(edited.allocation.items[0].totalCents).toBe(33);
    });
});
