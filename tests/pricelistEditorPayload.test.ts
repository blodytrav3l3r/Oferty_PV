/** Wybór payloadu edytora: wersja (DRAFT/ACTIVE) ma pierwszeństwo, seed tylko przy braku. */
import { pickEditorData } from '../src/services/pricelist/editorPayload';

describe('pickEditorData', () => {
    it('brak wersji (fallback) = seed', () => {
        expect(
            pickEditorData({ data: null, fallback: true, versionId: null }, () => ['seed'])
        ).toEqual(['seed']);
    });

    it('wersja ma pierwszeństwo nad seedem', () => {
        expect(
            pickEditorData({ data: [{ id: 'r1' }], fallback: false, versionId: 'v1' }, () => [
                'seed'
            ])
        ).toEqual([{ id: 'r1' }]);
    });

    it('seed nie jest wołany, gdy istnieje wersja', () => {
        const fromSeed = jest.fn();
        pickEditorData({ data: [], fallback: false, versionId: 'v1' }, fromSeed);

        expect(fromSeed).not.toHaveBeenCalled();
    });
});
