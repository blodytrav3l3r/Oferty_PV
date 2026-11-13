import { InvalidPriceError, requireFinitePrice } from '../validators/finiteNumbers';
import { roundMoney } from '../utils/money';

export const RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

function roundPrecoGroups(value: unknown): Record<string, number> {
    let groups = value;
    if (typeof groups === 'string') {
        try {
            groups = JSON.parse(groups);
        } catch {
            throw new InvalidPriceError('grupy');
        }
    }
    if (groups == null) return {};
    if (typeof groups !== 'object' || Array.isArray(groups)) throw new InvalidPriceError('grupy');
    return Object.fromEntries(
        Object.entries(groups as Record<string, unknown>).map(([key, value]) => [
            key,
            roundMoney(requireFinitePrice(value, `grupy.${key}`))
        ])
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
            const config = { ...scalarFields };
            for (const field of ['skrzynkaWlazowa', 'cenaPelnaWysMB', 'cenaDnoOsadnika']) {
                if (config[field] != null) {
                    config[field] = roundMoney(requireFinitePrice(config[field], field));
                }
            }
            for (const label of RANGE_TYPES) {
                if (Array.isArray(config[label])) {
                    config[label] = config[label].map((item: Record<string, unknown>) => ({
                        ...item,
                        grupy: roundPrecoGroups(item.grupy)
                    }));
                }
            }
            konfigRows.push({
                id: `preco_konfig_${key}`,
                key,
                value: JSON.stringify(config)
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
                        height: roundMoney(
                            requireFinitePrice(
                                kin.prosta ?? kin.height,
                                `kinety[${kinetyIdx}].height`
                            )
                        ),
                        cena: roundMoney(
                            requireFinitePrice(kin.dodWlot ?? kin.cena, `kinety[${kinetyIdx}].cena`)
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
                        const grupy = roundPrecoGroups(it.grupy);
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
