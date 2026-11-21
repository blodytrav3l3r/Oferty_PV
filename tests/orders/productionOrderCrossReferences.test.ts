import { buildProductionOrderCrossReferences } from '../../src/utils/productionOrderCrossReferences';

const denica = {
    id: 'pz-denica',
    wellId: 'well-1',
    elementIndex: 5,
    componentType: 'dennica',
    productionOrderNumber: 'D/00001/26'
};

const ring = {
    id: 'pz-ring',
    wellId: 'well-1',
    elementIndex: 3,
    componentType: 'krag',
    productionOrderNumber: 'K/00002/26'
};

const drilledRing = {
    id: 'pz-drilled',
    wellId: 'well-1',
    elementIndex: 2,
    componentType: 'krag_ot',
    productionOrderNumber: 'K/00003/26'
};

describe('buildProductionOrderCrossReferences', () => {
    it('wypisuje numery zapisanych kręgów na wydruku dennicy', () => {
        expect(buildProductionOrderCrossReferences(denica, [denica, ring, drilledRing])).toBe(
            'Kręgi: K/00003/26, K/00002/26'
        );
    });

    it('wypisuje numer dennicy i pozostałych kręgów na wydruku kręgu', () => {
        expect(buildProductionOrderCrossReferences(ring, [denica, ring, drilledRing])).toBe(
            'Studnia: D/00001/26, Krąg: K/00003/26'
        );
    });

    it('pomija zlecenia z innych studni i zwraca pusty tekst bez zapisanych sąsiadów', () => {
        const otherWell = { ...drilledRing, wellId: 'well-2' };

        expect(buildProductionOrderCrossReferences(denica, [denica, otherWell])).toBe('');
    });

    it('rozpoznaje historyczną dennicę po nazwie, gdy PZ nie ma componentType', () => {
        const legacyDenica = {
            ...denica,
            componentType: null,
            productName: 'Dennica DN1000 H=950/800'
        };
        const legacyRing = { ...ring, componentType: null, productName: 'Krąg DN1000/750' };

        expect(buildProductionOrderCrossReferences(legacyDenica, [legacyDenica, legacyRing])).toBe(
            'Kręgi: K/00002/26'
        );
        expect(buildProductionOrderCrossReferences(legacyRing, [legacyDenica, legacyRing])).toBe(
            'Studnia: D/00001/26'
        );
    });
});
