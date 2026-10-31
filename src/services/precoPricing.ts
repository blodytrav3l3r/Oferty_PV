import prisma from '../prismaClient';
import { InvalidPriceError, requireFinitePrice } from '../validators/finiteNumbers';

export const RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

export async function formatPrecoResponse(konfigTable: any, kinetyTable: any, zakresyTable: any) {
    const [konfigRows, kinetyRows, zakresyRows] = await Promise.all([
        konfigTable.findMany(),
        kinetyTable.findMany({ orderBy: [{ dn: 'asc' }, { height: 'asc' }] }),
        zakresyTable.findMany({ orderBy: { order: 'asc' } })
    ]);

    if (konfigRows.length === 0 && zakresyRows.length === 0) {
        return { data: [{}] };
    }

    const entry: Record<string, unknown> = {};

    for (const row of konfigRows) {
        const wellDn = Number(row.key);
        const parsed = JSON.parse(row.value);
        const kinety = kinetyRows
            .filter((k: any) => k.wellDn === wellDn)
            .map((k: any) => ({ dn: k.dn, prosta: k.height, dodWlot: k.cena, order: k.order }));
        const ranges: Record<string, unknown> = {};
        for (const label of RANGE_TYPES) {
            ranges[label] = zakresyRows
                .filter((z: any) => z.label === label && z.wellDn === wellDn)
                .map((z: any) => ({
                    order: z.order,
                    min: z.min,
                    max: z.max,
                    grupy: JSON.parse(z.grupy)
                }));
        }
        entry[row.key] = { ...parsed, kinety, ...ranges };
    }

    return { data: [entry] };
}

export function getPrecoLive() {
    return formatPrecoResponse(prisma.precoKonfig, prisma.precoKinety, prisma.precoZakresy);
}

export function getPrecoDefault() {
    return formatPrecoResponse(
        prisma.precoKonfigDefault,
        prisma.precoKinetyDefault,
        prisma.precoZakresyDefault
    );
}

/** Spłaszcza zagnieżdżony PRECO do wierszy wersji (bez zapisu). */
export function flattenPrecoRows(input: Record<string, unknown>) {
    const konfigRows: { id: string; key: string; value: string }[] = [];
    const kinetyRows: {
        id: string;
        order: number;
        dn: number;
        wellDn: number;
        height: number;
        cena: number;
    }[] = [];
    const zakresyRows: {
        id: string;
        order: number;
        label: string;
        min: number;
        max: number;
        grupy: string;
        wellDn: number;
    }[] = [];
    let kinetyIdx = 0;
    let zakresIdx = 0;

    for (const [key, value] of Object.entries(input)) {
        const dn = Number(key);
        if (
            !Number.isNaN(dn) &&
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
        ) {
            const obj = value as Record<string, unknown>;
            const { kinety, ...scalarFields } = obj;
            konfigRows.push({
                id: `preco_konfig_${key}`,
                key,
                value: JSON.stringify(scalarFields)
            });
            if (Array.isArray(kinety)) {
                for (const k of kinety) {
                    const kin = k as Record<string, unknown>;
                    // D-FIX-2: wymiary/ceny kinety wymagane i skończone —
                    // brak/cicha koercja na 0 zabroniona (throw przed tx).
                    kinetyRows.push({
                        id: `preco_kinety_${key}_${kinetyIdx}`,
                        order: (kin.order as number) ?? kinetyIdx,
                        dn: requireFinitePrice(kin.dn, `kinety[${kinetyIdx}].dn`),
                        wellDn: dn,
                        height: requireFinitePrice(
                            kin.prosta ?? kin.height,
                            `kinety[${kinetyIdx}].height`
                        ),
                        cena: requireFinitePrice(
                            kin.dodWlot ?? kin.cena,
                            `kinety[${kinetyIdx}].cena`
                        )
                    });
                    kinetyIdx++;
                }
            }
            for (const label of RANGE_TYPES) {
                const arr = obj[label];
                if (Array.isArray(arr)) {
                    for (const item of arr) {
                        const it = item as Record<string, unknown>;
                        const grupy = (it.grupy as Record<string, unknown>) ?? {};
                        const minV = requireFinitePrice(it.min, `zakresy[${zakresIdx}].min`);
                        const maxV = requireFinitePrice(it.max, `zakresy[${zakresIdx}].max`);
                        // Zakres z max <= 0 albo max < min nie dopasuje sie nigdy
                        // (_findPrecoRange zwraca wtedy 0 zl) — blokujemy przed tx.
                        if (maxV <= 0 || maxV < minV) {
                            throw new InvalidPriceError(
                                `zakresy[${zakresIdx}].max (wymagane max >= min i max > 0)`
                            );
                        }
                        zakresyRows.push({
                            id: `preco_zakres_${label}_${zakresIdx}`,
                            order: (it.order as number) ?? zakresIdx,
                            label,
                            min: minV,
                            max: maxV,
                            grupy: JSON.stringify(grupy),
                            wellDn: dn
                        });
                        zakresIdx++;
                    }
                }
            }
        }
    }

    return { konfig: konfigRows, kinety: kinetyRows, zakresy: zakresyRows };
}

export async function flattenAndSave(input: Record<string, unknown>, isDefault: boolean) {
    const konfigTable: any = isDefault ? prisma.precoKonfigDefault : prisma.precoKonfig;
    const kinetyTable: any = isDefault ? prisma.precoKinetyDefault : prisma.precoKinety;
    const zakresyTable: any = isDefault ? prisma.precoZakresyDefault : prisma.precoZakresy;
    const { konfig, kinety, zakresy } = flattenPrecoRows(input);

    const ops: any[] = [
        konfigTable.deleteMany(),
        kinetyTable.deleteMany(),
        zakresyTable.deleteMany()
    ];
    if (konfig.length > 0) ops.push(konfigTable.createMany({ data: konfig }));
    if (kinety.length > 0) ops.push(kinetyTable.createMany({ data: kinety }));
    if (zakresy.length > 0) ops.push(zakresyTable.createMany({ data: zakresy }));

    await prisma.$transaction(ops);
}
