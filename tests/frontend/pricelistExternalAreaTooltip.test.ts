import fs from 'node:fs';
import path from 'node:path';

describe('Cennik studni — informacja o powierzchni zewnętrznej dennicy', () => {
    test('dymek kolumny P.zew wyjaśnia, że nie obejmuje spodu dennicy', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/pricelistManager.js'),
            'utf8'
        );

        expect(source).toContain(
            'Powierzchnia zewnętrzna; dla dennicy nie uwzględnia dna od spodu.'
        );
    });
});
