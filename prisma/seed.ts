import { PrismaClient } from '../generated/prisma';
import * as path from 'path';
import * as fs from 'fs';
import { DN_SIZES, ZAKRESY_TYPES } from '../src/constants/precoSizes';
import { FEATURE_NAMES, ML_CONSTANTS } from '../src/config/mlConstants';
import type { Prisma } from '../generated/prisma';

type ProductsRuryCreateManyInput = Prisma.ProductsRuryCreateManyInput;
type ProductsStudnieCreateManyInput = Prisma.ProductsStudnieCreateManyInput;

const prisma = new PrismaClient();

function readJson<Data = unknown>(fileName: string): Data {
    return JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'data', fileName), 'utf-8')
    ) as Data;
}

function toBool(val: unknown): boolean {
    if (val === 1 || val === true) return true;
    return false;
}

async function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force');

    console.log('Seed: sprawdzam czy dane juz istnieja...');

    const [hasRury, hasStudnie, hasPreco] = await Promise.all([
        prisma.productsRury.count(),
        prisma.productsStudnie.count(),
        prisma.precoKonfig.count()
    ]);

    if (hasRury > 0 || hasStudnie > 0 || hasPreco > 0) {
        if (!force) {
            console.error(
                'Blad: baza zawiera juz dane (ProductsRury, ProductsStudnie lub PrecoKonfig).'
            );
            console.error('Uzyj --force aby pominac ten check i nadpisac dane.');
            process.exit(1);
        }
        console.log('— Wymuszono nadpisanie danych (--force).');
    }

    console.log('Seed: wczytywanie danych z JSON...');
    const ruryData = readJson<Array<Record<string, unknown>>>('seed_rury.json');
    const studnieData = readJson<Array<Record<string, unknown>>>('seed_studnie.json');
    const precoData =
        readJson<Array<Record<string, Record<string, unknown>>>>('seed_preco.json')[0] ?? {};

    console.log(`  Rury: ${ruryData.length}`);
    console.log(`  Studnie: ${studnieData.length}`);

    console.log('Seed: zapis do bazy...');

    let konfigCount = 0;
    let kinetyCount = 0;
    let zakresyCount = 0;
    let existingAiModel = 0;

    await prisma.$transaction(async (tx) => {
        if (force) {
            console.log('  -> czyszczenie starych danych seed...');
            await tx.precoZakresyDefault.deleteMany();
            await tx.precoZakresy.deleteMany();
            await tx.precoKinetyDefault.deleteMany();
            await tx.precoKinety.deleteMany();
            await tx.precoKonfigDefault.deleteMany();
            await tx.precoKonfig.deleteMany();
            await tx.productsStudnieDefault.deleteMany();
            await tx.productsStudnie.deleteMany();
            await tx.productsRuryDefault.deleteMany();
            await tx.productsRury.deleteMany();
        }

        // ── ProductsRury + ProductsRuryDefault ──
        console.log('  -> ProductsRury / ProductsRuryDefault...');
        const ruryRows: ProductsRuryCreateManyInput[] = ruryData.map(
            (p: Record<string, unknown>) => ({
                id: p.id as string,
                name: p.name as string,
                category: p.category as string,
                price: p.price as number,
                transport: (p.transport as number | null) ?? null,
                weight: (p.weight as number | null) ?? null,
                area: (p.area as number | null) ?? null
            })
        );

        if (ruryRows.length > 0) {
            await tx.productsRury.createMany({ data: ruryRows });
            await tx.productsRuryDefault.createMany({ data: ruryRows });
        }

        // ── ProductsStudnie + ProductsStudnieDefault ──
        console.log('  -> ProductsStudnie / ProductsStudnieDefault...');
        const studnieRows: ProductsStudnieCreateManyInput[] = studnieData.map(
            (p: Record<string, unknown>) => ({
                id: p.id as string,
                name: p.name as string,
                category: p.category as string,
                componentType: p.componentType as string,
                dn: p.dn != null ? String(p.dn) : null,
                height: (p.height as number | null) ?? null,
                weight: (p.weight as number | null) ?? null,
                price: (p.price as number | null) ?? 0,
                area: (p.area as number | null) ?? null,
                areaExt: (p.areaExt as number | null) ?? null,
                transport: (p.transport as number | null) ?? null,
                magazynWL: toBool(p.magazynWL),
                magazynKLB: toBool(p.magazynKLB),
                formaStandardowa: toBool(p.formaStandardowa),
                formaStandardowaKLB: toBool(p.formaStandardowaKLB),
                active: p.active !== undefined ? toBool(p.active) : true,
                zapasDol: (p.zapasDol as number | null) ?? null,
                zapasGora: (p.zapasGora as number | null) ?? null,
                zapasDolMin: (p.zapasDolMin as number | null) ?? null,
                zapasGoraMin: (p.zapasGoraMin as number | null) ?? null,
                spocznikH: p.spocznikH != null ? String(p.spocznikH) : null,
                hMin1: (p.hMin1 as number | null) ?? null,
                hMax1: (p.hMax1 as number | null) ?? null,
                cena1: (p.cena1 as number | null) ?? null,
                hMin2: (p.hMin2 as number | null) ?? null,
                hMax2: (p.hMax2 as number | null) ?? null,
                cena2: (p.cena2 as number | null) ?? null,
                hMin3: (p.hMin3 as number | null) ?? null,
                hMax3: (p.hMax3 as number | null) ?? null,
                cena3: (p.cena3 as number | null) ?? null,
                doplataPEHD: (p.doplataPEHD as number | null) ?? null,
                doplataZelbet: (p.doplataZelbet as number | null) ?? null,
                doplataDrabNierdzewna: (p.doplataDrabNierdzewna as number | null) ?? null,
                malowanieWewnetrzne: (p.malowanieWewnetrzne as number | null) ?? null,
                malowanieZewnetrzne: (p.malowanieZewnetrzne as number | null) ?? null
            })
        );

        if (studnieRows.length > 0) {
            await tx.productsStudnie.createMany({ data: studnieRows });
            await tx.productsStudnieDefault.createMany({ data: studnieRows });
        }

        // ── PRECO ──
        // Logika zgodna z flattenAndSave w src/routes/precoPricingV2.ts — seed odtwarza
        // identyczne wiersze (ID, order, wartość value), jak zapis przez API PRECO.
        console.log('  -> PrecoKonfig / PrecoKonfigDefault...');
        let kinetyIdx = 0;
        let zakresIdx = 0;
        const konfigRows: Array<{ id: string; key: string; value: string }> = [];
        const kinetyRows: Array<{
            id: string;
            order: number;
            dn: number;
            wellDn: number;
            height: number;
            cena: number;
        }> = [];
        const zakresyRows: Array<{
            id: string;
            order: number;
            label: string;
            min: number;
            max: number;
            grupy: string;
            wellDn: number;
        }> = [];

        for (const dnStr of DN_SIZES) {
            const dnCfg = precoData[dnStr];
            if (!dnCfg) continue;
            const obj = dnCfg as Record<string, unknown>;
            const { kinety, ...scalarFields } = obj;
            konfigRows.push({
                id: `preco_konfig_${dnStr}`,
                key: dnStr,
                value: JSON.stringify(scalarFields)
            });
            if (Array.isArray(kinety)) {
                for (const k of kinety) {
                    const kin = k as Record<string, unknown>;
                    kinetyRows.push({
                        id: `preco_kinety_${dnStr}_${kinetyIdx}`,
                        order: (kin.order as number) ?? kinetyIdx,
                        dn: (kin.dn ?? 0) as number,
                        wellDn: Number(dnStr),
                        height: (kin.prosta ?? kin.height) as number,
                        cena: (kin.dodWlot ?? kin.cena) as number
                    });
                    kinetyIdx++;
                }
            }
            for (const label of ZAKRESY_TYPES) {
                const arr = dnCfg[label];
                if (!Array.isArray(arr)) continue;
                for (const item of arr) {
                    const it = item as Record<string, unknown>;
                    const grupy = (it.grupy as Record<string, unknown>) ?? {};
                    zakresyRows.push({
                        id: `preco_zakres_${label}_${zakresIdx}`,
                        order: (it.order as number) ?? zakresIdx,
                        label,
                        min: it.min as number,
                        max: it.max as number,
                        grupy: JSON.stringify(grupy),
                        wellDn: Number(dnStr)
                    });
                    zakresIdx++;
                }
            }
        }

        konfigCount = konfigRows.length;
        if (konfigRows.length > 0) {
            await tx.precoKonfig.createMany({ data: konfigRows });
            await tx.precoKonfigDefault.createMany({ data: konfigRows });
        }

        kinetyCount = kinetyRows.length;
        if (kinetyRows.length > 0) {
            await tx.precoKinety.createMany({ data: kinetyRows });
            await tx.precoKinetyDefault.createMany({ data: kinetyRows });
        }

        zakresyCount = zakresyRows.length;
        if (zakresyRows.length > 0) {
            await tx.precoZakresy.createMany({ data: zakresyRows });
            await tx.precoZakresyDefault.createMany({ data: zakresyRows });
        }

        // ── AiModel (startowy model ML) ──
        console.log('  -> AiModel (startowy model ML)...');
        existingAiModel = await tx.aiModel.count();
        if (existingAiModel === 0) {
            const zeros = FEATURE_NAMES.map(() => 0);
            const ones = FEATURE_NAMES.map(() => 1);
            await tx.aiModel.create({
                data: {
                    id: 'seed_' + Date.now(),
                    version: 'v0.1.0-starter',
                    weights: JSON.stringify(zeros),
                    bias: 0,
                    metrics: JSON.stringify({
                        accuracy: 0.5,
                        precision: 0.5,
                        recall: 0.5,
                        f1: 0.5,
                        rocAuc: 0.5,
                        trainSize: 0,
                        valSize: 0
                    }),
                    features: JSON.stringify(FEATURE_NAMES),
                    featureMins: JSON.stringify(zeros),
                    featureMaxs: JSON.stringify(ones),
                    trainingRows: 0,
                    active: true,
                    featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                    notes: 'Model startowy — domyślne wagi (neutralne). Wytrenuj właściwy model przez API /ai/train.',
                    createdAt: new Date().toISOString()
                }
            });
        }
    });

    console.log(`Seed: zakonczono. Wgrano:`);
    console.log(`  ProductsRury / ProductsRuryDefault: ${ruryData.length}`);
    console.log(`  ProductsStudnie / ProductsStudnieDefault: ${studnieData.length}`);
    console.log(`  PrecoKonfig / PrecoKonfigDefault: ${konfigCount}`);
    console.log(`  PrecoKinety / PrecoKinetyDefault: ${kinetyCount}`);
    console.log(`  PrecoZakresy / PrecoZakresyDefault: ${zakresyCount}`);
    console.log(`  AiModel: ${existingAiModel === 0 ? '1 (startowy)' : existingAiModel}`);
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
