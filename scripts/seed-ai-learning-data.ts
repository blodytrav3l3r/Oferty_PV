/**
 * Skrypt seedujacy syntetyczne dane testowe dla Learning Engine.
 * Uruchom: npx ts-node scripts/seed-ai-learning-data.ts
 *
 * Opcjonalnie z uruchomieniem Learning Cycle:
 *   npx ts-node scripts/seed-ai-learning-data.ts --run-cycle
 */

import prisma from '../src/prismaClient';

const DNs = ['800', '1000', '1200', '1500', '2000'];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function makeRecord(dn: string, idx: number) {
    const warehouse = pick(['KLB', 'WL']);
    const wellType = pick(['standard', 'standard', 'psia_buda', 'styczna']);
    const wellHeight = [2000, 2500, 3000, 3500, 4000][idx % 5];
    const ringCount = Math.floor(wellHeight / 1000) + 1;
    const sealCount = pick([1, 2, 3]);
    const wasModified = idx % 3 === 0;
    const useReduction = idx % 4 === 0;

    const baseConfig = [
        { componentType: 'krag', productId: 'KDB-' + dn + '-1000', quantity: ringCount - 1 },
        { componentType: 'dennica', productId: 'DDD-' + dn + '-500', quantity: 1 }
    ];
    if (sealCount > 0) {
        baseConfig.push({
            componentType: 'uszczelka',
            productId: 'USZ-' + dn,
            quantity: sealCount
        });
    }
    if (useReduction) {
        const smallerDn = String(Math.max(parseInt(dn) - 200, 600));
        baseConfig.push({
            componentType: 'krag redukcyjny',
            productId: 'KRC-' + dn + '-' + smallerDn,
            quantity: 1
        });
    }

    let finalConfig = baseConfig;
    if (wasModified) {
        finalConfig = [
            ...baseConfig,
            { componentType: 'krag', productId: 'KDB-' + dn + '-1000', quantity: 1 }
        ];
    }

    return {
        id: 'seed-' + dn + '-' + idx + '-' + Date.now(),
        dn,
        warehouse,
        wellType,
        wellHeight,
        ringCount,
        modificationCount: wasModified ? 1 : 0,
        wasAccepted: !(idx % 5 === 4),
        wasRejected: idx % 5 === 4,
        wasModified,
        original_auto_config: JSON.stringify(baseConfig),
        final_user_config: wasModified ? JSON.stringify(finalConfig) : null,
        override_reason: wasModified ? 'Reka użytkownika' : null,
        allComponentIds: JSON.stringify(baseConfig.map((c) => ({ productId: c.productId }))),
        appliedReductions: useReduction
            ? JSON.stringify([
                  { productId: 'KRC-' + dn + '-' + String(Math.max(parseInt(dn) - 200, 600)) }
              ])
            : null,
        appliedKonus: JSON.stringify(sealCount > 1 ? [{ productId: 'KNS-' + dn + '-500' }] : []),
        appliedSeals: JSON.stringify(sealCount > 0 ? [{ productId: 'USZ-' + dn }] : []),
        solverSource: 'AUTO_JS',
        trainingEligible: true,
        createdAt: new Date(Date.now() - (10 - idx) * 86400000).toISOString()
    };
}

async function seedAiLearningData(runCycle = false, force = false) {
    console.log('Seeding AI learning data...');

    const existing = await prisma.ai_telemetry_logs.count();
    if (existing > 50 && !force) {
        console.log(
            'Baza ma juz ' + existing + ' rekordow — pomijam seed, uzyj --force aby wymusic'
        );
        return;
    }
    if (force && existing > 0) {
        console.log('Force mode — usuwam ' + existing + ' istniejacych rekordow');
        await prisma.ai_telemetry_logs.deleteMany({});
        await prisma.settings.deleteMany({ where: { key: 'learning_last_run' } });
    }

    const records: Array<Record<string, unknown>> = [];
    for (let dnIdx = 0; dnIdx < DNs.length; dnIdx++) {
        for (let i = 0; i < 10; i++) {
            records.push(makeRecord(DNs[dnIdx], i));
        }
    }

    for (let i = 0; i < records.length; i += 25) {
        const batch = records.slice(i, i + 25);
        await prisma.$transaction(
            batch.map((r) => prisma.ai_telemetry_logs.create({ data: r as any }))
        );
        console.log('  Wgrano ' + Math.min(i + 25, records.length) + ' / ' + records.length);
    }

    console.log('Seed zakonczony — utworzono ' + records.length + ' rekordow');

    if (runCycle) {
        console.log('Uruchamianie Learning Cycle...');
        const { learningEngine } =
            await import('../src/services/telemetry/learning/LearningEngine');
        const result = await learningEngine.runFullCycle();
        console.log(
            'Learning Cycle: processed=' +
                result.processed +
                ' patterns=' +
                result.patternsDetected +
                ' persisted=' +
                result.persistedToKb
        );
    }
}

const shouldRunCycle = process.argv.includes('--run-cycle');
const force = process.argv.includes('--force');
seedAiLearningData(shouldRunCycle, force)
    .catch((e) => {
        console.error('Blad seed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
