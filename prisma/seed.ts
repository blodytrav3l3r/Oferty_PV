import { PrismaClient } from '../generated/prisma';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

const CATEGORIES_RURY = [
    'Rury Betonowe',
    'Żelbetowe KL. A (II)',
    'Żelbetowe KL. S (I)',
    'Duże Żelbetowe II',
    'Rury Jajowe Betonowe',
    'Rury Jajowe Żelbetowe',
    'Akcesoria PEHD',
    'Uszczelki',
    'Zabezpieczenie transportu'
];

function readJson(fileName: string): any {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', fileName), 'utf-8'));
}

/** Czyta wszystkie pliki seed studni z katalogu data/seed/studnie/ */
function readStudnieSeed(): any[] {
    const dir = path.join(__dirname, '..', 'data', 'seed', 'studnie');
    const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort();
    const all: any[] = [];
    for (const f of files) {
        const items = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
        if (Array.isArray(items)) all.push(...items);
    }
    return all;
}

function toBool(val: any): boolean {
    if (val === 1 || val === true) return true;
    return false;
}

async function main() {
    console.log('Seeding database...');

    const ruryData = readJson('seed_rury.json');
    const studnieData = readStudnieSeed();

    // ── Wyczyść stare dane ──
    await prisma.productsRury.deleteMany();
    await prisma.productsStudnie.deleteMany();

    await prisma.$transaction(async (tx) => {
        // ── CategoriesRury ──
        for (let i = 0; i < CATEGORIES_RURY.length; i++) {
            await tx.categoriesRury.upsert({
                where: { name: CATEGORIES_RURY[i] },
                update: { order: i },
                create: { name: CATEGORIES_RURY[i], order: i }
            });
        }

        // ── ProductsRury ──
        await tx.productsRury.createMany({
            data: ruryData.map((p: any) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                price: p.price,
                transport: p.transport ?? null,
                weight: p.weight ?? null,
                area: p.area ?? null
            }))
        });

        // ── CategoriesStudnie ──
        const catStudnieMap = new Map<string, { componentType: string | null; order: number }>();
        const compTypesByCat = new Map<string, Set<string>>();

        for (const p of studnieData) {
            if (!catStudnieMap.has(p.category)) {
                catStudnieMap.set(p.category, { componentType: null, order: catStudnieMap.size });
                compTypesByCat.set(p.category, new Set());
            }
            if (p.componentType) {
                compTypesByCat.get(p.category)!.add(p.componentType);
            }
        }

        for (const [cat, types] of compTypesByCat) {
            if (types.size === 1) {
                catStudnieMap.get(cat)!.componentType = types.values().next().value ?? null;
            }
        }

        for (const [name, meta] of catStudnieMap) {
            await tx.categoriesStudnie.upsert({
                where: { name },
                update: { componentType: meta.componentType, order: meta.order },
                create: { name, componentType: meta.componentType, order: meta.order }
            });
        }

        // ── ProductsStudnie ──
        const studnieProducts = studnieData.map((p: any) => {
            const area = p.area;
            const areaExt = p.areaExt;
            const doplataZelbet = p.doplataZelbet;
            const spocznikH = p.spocznikH;
            const hMin1 = p.hMin1;
            const hMax1 = p.hMax1;
            const cena1 = p.cena1;
            const hMin2 = p.hMin2;
            const hMax2 = p.hMax2;
            const cena2 = p.cena2;
            const hMin3 = p.hMin3;
            const hMax3 = p.hMax3;
            const cena3 = p.cena3;

            return {
                id: p.id,
                name: p.name,
                category: p.category,
                componentType: p.componentType,
                dn: p.dn != null ? String(p.dn) : null,
                height: p.height ?? null,
                weight: p.weight ?? null,
                price: p.price ?? 0,
                area: area ?? null,
                areaExt: areaExt ?? null,
                transport: p.transport ?? null,
                magazynWL: toBool(p.magazynWL),
                magazynKLB: toBool(p.magazynKLB),
                formaStandardowa: toBool(p.formaStandardowa),
                formaStandardowaKLB: toBool(p.formaStandardowaKLB),
                active: p.active !== undefined ? toBool(p.active) : true,
                zapasDol: p.zapasDol ?? null,
                zapasGora: p.zapasGora ?? null,
                zapasDolMin: p.zapasDolMin ?? null,
                zapasGoraMin: p.zapasGoraMin ?? null,
                spocznikH: spocznikH != null ? String(spocznikH) : null,
                hMin1: hMin1 ?? null,
                hMax1: hMax1 ?? null,
                cena1: cena1 ?? null,
                hMin2: hMin2 ?? null,
                hMax2: hMax2 ?? null,
                cena2: cena2 ?? null,
                hMin3: hMin3 ?? null,
                hMax3: hMax3 ?? null,
                cena3: cena3 ?? null,
                doplataPEHD: p.doplataPEHD ?? null,
                doplataZelbet: doplataZelbet ?? null,
                doplataDrabNierdzewna: p.doplataDrabNierdzewna ?? null,
                malowanieWewnetrzne: p.malowanieWewnetrzne ?? null,
                malowanieZewnetrzne: p.malowanieZewnetrzne ?? null
            };
        });

        await tx.productsStudnie.createMany({
            data: studnieProducts
        });
    });

    console.log('Seeding complete');
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
