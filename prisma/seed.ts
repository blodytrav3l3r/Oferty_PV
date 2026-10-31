import { PrismaClient } from '../generated/prisma';
import { FEATURE_NAMES, ML_CONSTANTS } from '../src/config/mlConstants';

const prisma = new PrismaClient();

/**
 * Seed po etapie 2 nie zapisuje cennika: tabele LIVE i `*_Default` nie istnieją,
 * a ceny żyją wyłącznie w wersjach (`PricelistVersion`). Wersję bazową tworzy
 * `ensureBaselineVersions()` przy starcie serwera z plików `data/seed_*.json`.
 *
 * Zostaje tylko startowy model ML, żeby predykcje miały czym odpowiedzieć
 * przed pierwszym treningiem.
 */
async function main() {
    console.log('Seed: startowy model ML...');

    const existingAiModel = await prisma.$transaction(async (tx) => {
        const count = await tx.aiModel.count();
        if (count > 0) return count;

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
        return 1;
    });

    console.log(
        `Seed: zakonczono. AiModel: ${existingAiModel === 1 ? '1 (startowy)' : existingAiModel}.`
    );
    console.log('Cennik: wersja bazowa powstanie przy starcie serwera (data/seed_*.json).');
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
