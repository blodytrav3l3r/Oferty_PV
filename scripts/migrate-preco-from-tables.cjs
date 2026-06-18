#!/usr/bin/env node
// Jednorazowa migracja: odczytuje PRECO z 3 starych tabel → zapisuje do settings
// Uruchamiany PRZED prisma db push (zanim stare tabele zostaną usunięte)

const { PrismaClient } = require('../generated/prisma');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Sprawdź czy stare tabele istnieją
        const tables = await prisma.$queryRawUnsafe(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='PrecoKonfig'"
        );
        if (!Array.isArray(tables) || tables.length === 0) {
            console.log('[MIGRATE] Brak starych tabel PRECO — pomijam');
            return;
        }

        // Sprawdź czy już zmigrowane
        const existing = await prisma.settings.findUnique({
            where: { key: 'preco_pricing' }
        });
        if (existing) {
            console.log('[MIGRATE] PRECO już w settings — pomijam');
            return;
        }

        // Odczytaj dane ze starych tabel
        const konfig = await prisma.$queryRawUnsafe('SELECT * FROM PrecoKonfig');
        const kinety = await prisma.$queryRawUnsafe('SELECT * FROM PrecoKinety');
        const zakresy = await prisma.$queryRawUnsafe('SELECT * FROM PrecoZakresy');

        if (!Array.isArray(konfig) || konfig.length === 0) {
            console.log('[MIGRATE] Stare tabele puste — pomijam');
            return;
        }

        // Zbuduj PrecoEntry
        const entry = {};
        for (const k of konfig) {
            const dn = String(k.dnStudni);
            entry[dn] = {
                skrzynkaWlazowa: Number(k.skrzynkaWlazowa ?? 0),
                cenaPelnaWysMB: Number(k.cenaPelnaWysMB ?? 0),
                cenaDnoOsadnika: Number(k.cenaDnoOsadnika ?? 0),
                kinety: [],
                spadekKineta: [],
                spadekMufa: [],
                uniesienie: [],
                redukcja: []
            };
        }

        // Dodaj kinety
        if (Array.isArray(kinety)) {
            for (const k of kinety) {
                const dn = String(k.dnStudni);
                if (entry[dn]) {
                    entry[dn].kinety.push({
                        dn: Number(k.dnRury),
                        prosta: Number(k.prosta),
                        dodWlot: Number(k.dodWlot)
                    });
                }
            }
        }

        // Dodaj zakresy — grupuj po dnStudni i typ
        if (Array.isArray(zakresy)) {
            const seenKeys = new Set();
            for (const z of zakresy) {
                const typ = String(z.typ);
                const key = `${typ}|${z.minVal}|${z.maxVal}|${z.grupaDn}`;
                if (seenKeys.has(key)) continue;
                seenKeys.add(key);
                const rangeObj = { min: Number(z.minVal), max: Number(z.maxVal), grupy: { [z.grupaDn]: Number(z.cena) } };

                for (const dn of Object.keys(entry)) {
                    if (entry[dn][typ]) {
                        // Sprawdź czy już istnieje
                        const exists = entry[dn][typ].some(r => r.min === rangeObj.min && r.max === rangeObj.max);
                        if (!exists) {
                            entry[dn][typ].push(rangeObj);
                        }
                    }
                }
            }
        }

        // Zapisz do settings
        const json = JSON.stringify([entry]);
        await prisma.settings.upsert({
            where: { key: 'preco_pricing' },
            update: { value: json },
            create: { key: 'preco_pricing', value: json }
        });

        // Rowniez jako default
        await prisma.settings.upsert({
            where: { key: 'preco_pricing_default' },
            update: { value: json },
            create: { key: 'preco_pricing_default', value: json }
        });

        console.log('[MIGRATE] PRECO zmigrowany z tabel do settings');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => {
    console.error('[MIGRATE] Błąd:', e.message);
    process.exit(0); // Nie blokuj entrypoint
});
