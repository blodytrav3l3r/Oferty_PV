import fs from 'fs';
import path from 'path';
import { logger } from '../../../utils/logger';

export function loadProductsMap(): Map<
    string,
    { componentType: string; category: string; dn: number | string; height: number }
> {
    const allProducts = new Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >();
    try {
        const jsonPath = path.join(process.cwd(), 'data', 'seed_studnie.json');
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const products: any[] = JSON.parse(raw);
        for (const p of products) {
            allProducts.set(p.id, {
                componentType: p.componentType || '',
                category: p.category || '',
                dn: p.dn || 0,
                height: p.height || 0
            });
        }
    } catch (e) {
        logger.warn('DocxKartaBudowy', 'Nie udało się załadować produktów', e);
    }
    return allProducts;
}

export { buildRealTransitionsTable } from './kartaBudowyTransitionTable';
export { buildElementCountTable } from './kartaBudowyElementCount';
