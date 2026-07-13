import { logger } from '../utils/logger';
import { ensureProductsSeeded, readPricelist } from '../services/pricelistService';
import { PRICELIST_CONFIG_STUDNIE } from '../services/studnieProductHelpers';
import prisma from '../prismaClient';

export async function initStudnieProductsTable() {
    const config = PRICELIST_CONFIG_STUDNIE;
    await ensureProductsSeeded(config);

    try {
        const wCount = await prisma.productsStudnie.deleteMany({
            where: { componentType: 'przejscie', category: { startsWith: 'W +' } }
        });
        if (wCount.count > 0) {
            await prisma.categoriesStudnie.deleteMany({
                where: { name: { startsWith: 'W +' } }
            });
            logger.info('ProductsStudnieV2', `Usunięto ${wCount.count} produktów W+ z bazy`);
        }
    } catch (e) {
        logger.warn(
            'ProductsStudnieV2',
            'Błąd czyszczenia W+:',
            e instanceof Error ? e.message : e
        );
    }

    try {
        const cnt = await prisma.productsStudnie.count();
        if (cnt > 0) return;
        const data = await readPricelist(config.keyCurrent);
        if (!Array.isArray(data) || data.length === 0) return;

        const STALE_KEYS = [
            'Pow. wewn. m²',
            'Pow. zewn. m²',
            'Dopłata Żelbet',
            'Wys. spocznika',
            'Hmin 1 mm',
            'Hmax 1 mm',
            'Cena 1 PLN',
            'Hmin 2 mm',
            'Hmax 2 mm',
            'Cena 2 PLN',
            'Hmin 3 mm',
            'Hmax 3 mm',
            'Cena 3 PLN'
        ];
        const staleProducts = (data as Record<string, unknown>[]).filter((p) =>
            STALE_KEYS.some((k) => p[k] !== undefined && p[k] !== null)
        );
        if (staleProducts.length > 0) {
            const sample = staleProducts
                .slice(0, 5)
                .map((p) => p.id)
                .join(', ');
            const msg = `Seed studni zawiera ${staleProducts.length} produktów ze starymi polskimi kluczami (np. ${sample}...). Uruchom: node scripts/normalize-seed-studnie.mjs --apply`;
            logger.error('ProductsStudnieV2', msg);
            throw new Error(msg);
        }

        await prisma.$transaction(
            async (tx) => {
                const uniqueKeys = new Map<
                    string,
                    { name: string; componentType: string | null }
                >();
                for (const item of data) {
                    const name = String(item.category ?? '');
                    if (!name) continue;
                    const compType = item.componentType != null ? String(item.componentType) : null;
                    uniqueKeys.set(name, { name, componentType: compType });
                }
                let orderIdx = 0;
                for (const entry of uniqueKeys.values()) {
                    await tx.categoriesStudnie.upsert({
                        where: { name: entry.name },
                        update: { componentType: entry.componentType },
                        create: {
                            name: entry.name,
                            componentType: entry.componentType,
                            order: orderIdx
                        }
                    });
                    orderIdx++;
                }
            },
            { timeout: 30000 }
        );

        await prisma.productsStudnie.deleteMany();

        const CHUNK = 25;
        for (let i = 0; i < data.length; i += CHUNK) {
            const chunk = data.slice(i, i + CHUNK);
            await prisma.$transaction(
                async (tx) => {
                    for (const item of chunk) {
                        await tx.productsStudnie.create({
                            data: {
                                id: String(item.id),
                                name: String(item.name ?? ''),
                                category: String(item.category ?? ''),
                                componentType: String(item.componentType ?? ''),
                                dn: item.dn != null ? String(item.dn) : null,
                                height: item.height != null ? Number(item.height) : null,
                                weight: item.weight != null ? Number(item.weight) : null,
                                price: Number(item.price ?? 0),
                                area: item.area != null ? Number(item.area) : null,
                                areaExt: item.areaExt != null ? Number(item.areaExt) : null,
                                transport: item.transport != null ? Number(item.transport) : null,
                                magazynWL: item.magazynWL != null ? Boolean(item.magazynWL) : false,
                                magazynKLB:
                                    item.magazynKLB != null ? Boolean(item.magazynKLB) : false,
                                formaStandardowa:
                                    item.formaStandardowa != null
                                        ? Boolean(item.formaStandardowa)
                                        : false,
                                formaStandardowaKLB:
                                    item.formaStandardowaKLB != null
                                        ? Boolean(item.formaStandardowaKLB)
                                        : false,
                                active: item.active != null ? Boolean(item.active) : false,
                                zapasDol: item.zapasDol != null ? Number(item.zapasDol) : null,
                                zapasGora: item.zapasGora != null ? Number(item.zapasGora) : null,
                                zapasDolMin:
                                    item.zapasDolMin != null ? Number(item.zapasDolMin) : null,
                                zapasGoraMin:
                                    item.zapasGoraMin != null ? Number(item.zapasGoraMin) : null,
                                spocznikH: item.spocznikH != null ? String(item.spocznikH) : null,
                                hMin1: item.hMin1 != null ? Number(item.hMin1) : null,
                                hMax1: item.hMax1 != null ? Number(item.hMax1) : null,
                                cena1: item.cena1 != null ? Number(item.cena1) : null,
                                hMin2: item.hMin2 != null ? Number(item.hMin2) : null,
                                hMax2: item.hMax2 != null ? Number(item.hMax2) : null,
                                cena2: item.cena2 != null ? Number(item.cena2) : null,
                                hMin3: item.hMin3 != null ? Number(item.hMin3) : null,
                                hMax3: item.hMax3 != null ? Number(item.hMax3) : null,
                                cena3: item.cena3 != null ? Number(item.cena3) : null,
                                doplataPEHD:
                                    item.doplataPEHD != null ? Number(item.doplataPEHD) : null,
                                doplataZelbet:
                                    item.doplataZelbet != null ? Number(item.doplataZelbet) : null,
                                doplataDrabNierdzewna:
                                    item.doplataDrabNierdzewna != null
                                        ? Number(item.doplataDrabNierdzewna)
                                        : null,
                                malowanieWewnetrzne:
                                    item.malowanieWewnetrzne != null
                                        ? Number(item.malowanieWewnetrzne)
                                        : null,
                                malowanieZewnetrzne:
                                    item.malowanieZewnetrzne != null
                                        ? Number(item.malowanieZewnetrzne)
                                        : null
                            }
                        });
                    }
                },
                { timeout: 30000 }
            );
        }

        logger.info(
            'ProductsStudnieV2',
            `Zainicjalizowano productsStudnie (${data.length} produktów) z seed`
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.warn('ProductsStudnieV2', 'Seed tabeli productsStudnie pominięty:', message);
    }
}
