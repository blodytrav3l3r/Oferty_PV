import { logger } from '../../../utils/logger';
import { readStudnieSeedProducts } from '../../studnieSeedUtils';

export function loadProductsMap(): Map<
    string,
    { componentType: string; category: string; dn: number | string; height: number }
> {
    const allProducts = new Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >();
    try {
        const items = readStudnieSeedProducts();
        for (const p of items) {
            allProducts.set(String(p.id), {
                componentType: String(p.componentType || ''),
                category: String(p.category || ''),
                dn: (p.dn as number | string) || 0,
                height: (p.height as number) || 0
            });
        }
    } catch (e) {
        logger.warn('DocxKartaBudowy', 'Nie udało się załadować produktów', e);
    }
    return allProducts;
}

export { buildRealTransitionsTable } from './kartaBudowyTransitionTable';
export { buildElementCountTable } from './kartaBudowyElementCount';
