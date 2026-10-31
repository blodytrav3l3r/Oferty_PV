import { InvalidPriceError, requireFinitePrice } from '../validators/finiteNumbers';

export const RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

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
