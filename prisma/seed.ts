import { PrismaClient } from '../generated/prisma';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

function readJson(fileName: string): any {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', fileName), 'utf-8'));
}

function toBool(val: any): boolean {
    if (val === 1 || val === true) return true;
    return false;
}

const DN_SIZES = ['1000', '1200', '1500', '2000', '2500'];

const ZAKRESY_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'];

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
    const ruryData = readJson('seed_rury.json');
    const studnieData = readJson('seed_studnie.json');
    const precoData = readJson('seed_preco.json')[0];

    console.log(`  Rury: ${ruryData.length}`);
    console.log(`  Studnie: ${studnieData.length}`);

    console.log('Seed: zapis do bazy...');

    let kinetyCount = 0;
    let zakresyCount = 0;

    await prisma.$transaction(async (tx) => {
        // ── ProductsRury + ProductsRuryDefault ──
        console.log('  -> ProductsRury / ProductsRuryDefault...');
        const ruryRows = ruryData.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            transport: p.transport ?? null,
            weight: p.weight ?? null,
            area: p.area ?? null
        }));

        if (ruryRows.length > 0) {
            await tx.productsRury.createMany({ data: ruryRows });
            await tx.productsRuryDefault.createMany({ data: ruryRows });
        }

        // ── ProductsStudnie + ProductsStudnieDefault ──
        console.log('  -> ProductsStudnie / ProductsStudnieDefault...');
        const studnieRows = studnieData.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            componentType: p.componentType,
            dn: p.dn != null ? String(p.dn) : null,
            height: p.height ?? null,
            weight: p.weight ?? null,
            price: p.price ?? 0,
            area: p.area ?? null,
            areaExt: p.areaExt ?? null,
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
            spocznikH: p.spocznikH != null ? String(p.spocznikH) : null,
            hMin1: p.hMin1 ?? null,
            hMax1: p.hMax1 ?? null,
            cena1: p.cena1 ?? null,
            hMin2: p.hMin2 ?? null,
            hMax2: p.hMax2 ?? null,
            cena2: p.cena2 ?? null,
            hMin3: p.hMin3 ?? null,
            hMax3: p.hMax3 ?? null,
            cena3: p.cena3 ?? null,
            doplataPEHD: p.doplataPEHD ?? null,
            doplataZelbet: p.doplataZelbet ?? null,
            doplataDrabNierdzewna: p.doplataDrabNierdzewna ?? null,
            malowanieWewnetrzne: p.malowanieWewnetrzne ?? null,
            malowanieZewnetrzne: p.malowanieZewnetrzne ?? null
        }));

        if (studnieRows.length > 0) {
            await tx.productsStudnie.createMany({ data: studnieRows });
            await tx.productsStudnieDefault.createMany({ data: studnieRows });
        }

        // ── PRECO ──
        console.log('  -> PrecoKonfig / PrecoKonfigDefault...');
        const konfigRows: Array<{ id: string; key: string; value: string }> = [];
        for (const dnStr of DN_SIZES) {
            const dnCfg = precoData[dnStr];
            if (!dnCfg) continue;
            const scalars: Record<string, number> = {
                skrzynkaWlazowa: dnCfg.skrzynkaWlazowa,
                cenaPelnaWysMB: dnCfg.cenaPelnaWysMB,
                cenaDnoOsadnika: dnCfg.cenaDnoOsadnika
            };
            for (const [key, val] of Object.entries(scalars)) {
                const id = `konfig_${dnStr}_${key}`;
                konfigRows.push({ id, key: `${dnStr}:${key}`, value: String(val) });
            }
        }
        if (konfigRows.length > 0) {
            await tx.precoKonfig.createMany({ data: konfigRows });
            await tx.precoKonfigDefault.createMany({ data: konfigRows });
        }

        console.log('  -> PrecoKinety / PrecoKinetyDefault...');
        let kinetaOrder = 0;
        const kinetyRows: Array<{
            id: string;
            order: number;
            dn: number;
            height: number;
            cena: number;
        }> = [];
        for (const dnStr of DN_SIZES) {
            const dnCfg = precoData[dnStr];
            if (!dnCfg || !dnCfg.kinety) continue;
            for (const k of dnCfg.kinety) {
                kinetaOrder++;
                kinetyRows.push({
                    id: `kineta_${kinetaOrder}`,
                    order: kinetaOrder,
                    dn: k.dn,
                    height: k.prosta,
                    cena: k.dodWlot
                });
            }
        }
        kinetyCount = kinetyRows.length;
        if (kinetyRows.length > 0) {
            await tx.precoKinety.createMany({ data: kinetyRows });
            await tx.precoKinetyDefault.createMany({ data: kinetyRows });
        }

        console.log('  -> PrecoZakresy / PrecoZakresyDefault...');
        let zakresOrder = 0;
        const zakresyRows: Array<{
            id: string;
            order: number;
            label: string;
            min: number;
            max: number;
        }> = [];
        for (const dnStr of DN_SIZES) {
            const dnCfg = precoData[dnStr];
            if (!dnCfg) continue;
            for (const typ of ZAKRESY_TYPES) {
                const entries = dnCfg[typ];
                if (!entries) continue;
                for (const entry of entries) {
                    for (const grupaDn of Object.keys(entry.grupy)) {
                        zakresOrder++;
                        zakresyRows.push({
                            id: `zakres_${zakresOrder}`,
                            order: zakresOrder,
                            label: `${typ}:${grupaDn}`,
                            min: entry.min,
                            max: entry.max
                        });
                    }
                }
            }
        }
        zakresyCount = zakresyRows.length;
        if (zakresyRows.length > 0) {
            await tx.precoZakresy.createMany({ data: zakresyRows });
            await tx.precoZakresyDefault.createMany({ data: zakresyRows });
        }
    });

    console.log(`Seed: zakonczono. Wgrano:`);
    console.log(`  ProductsRury / ProductsRuryDefault: ${ruryData.length}`);
    console.log(`  ProductsStudnie / ProductsStudnieDefault: ${studnieData.length}`);
    console.log(`  PrecoKonfig / PrecoKonfigDefault: ${DN_SIZES.length * 3}`);
    console.log(`  PrecoKinety / PrecoKinetyDefault: ${kinetyCount}`);
    console.log(`  PrecoZakresy / PrecoZakresyDefault: ${zakresyCount}`);
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
