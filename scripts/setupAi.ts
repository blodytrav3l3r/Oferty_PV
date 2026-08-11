import 'dotenv/config';
import prisma from '../src/prismaClient';
import { modelRegistry } from '../src/services/ml/ModelRegistry';
import { featureExtractor } from '../src/services/ml/FeatureExtractor';
import { learningEngine } from '../src/services/telemetry/learning';
import { KnowledgeBase } from '../src/services/telemetry/learning/KnowledgeBase';

async function main() {
    console.log('===========================================================');
    console.log('  S.O.K. — Setup & Diagnostyka Modułu AI / ML');
    console.log('===========================================================\n');

    try {
        // 1. Sprawdzenie struktur w bazie danych
        console.log('[1/4] Sprawdzanie tabel bazy danych AI/ML...');
        const [telemetryCount, featureCount, modelCount] = await Promise.all([
            prisma.ai_telemetry_logs.count(),
            featureExtractor.getFeatureCount(),
            modelRegistry.getModelCount()
        ]);
        console.log(`  ✓ ai_telemetry_logs : ${telemetryCount} rekordów`);
        console.log(`  ✓ aiFeature          : ${featureCount} rekordów`);
        console.log(`  ✓ aiModel            : ${modelCount} modeli`);

        // 2. Inicjalizacja / samoleczenie aktywnego modelu ML
        console.log('\n[2/4] Weryfikacja i przygotowanie aktywnego modelu ML...');
        const activeModel = await modelRegistry.ensureStarterModelExists();
        console.log(
            `  ✓ Aktywny model ML   : ${activeModel.version} (AUC: ${activeModel.metrics?.rocAuc != null ? activeModel.metrics.rocAuc.toFixed(4) : 'n/a'})`
        );

        // 3. Cykl uczenia i baza wiedzy
        console.log('\n[3/4] Analiza bazy wiedzy i cyklu uczenia AI...');
        const kb = new KnowledgeBase();
        if (telemetryCount > 0) {
            console.log('  -> Uruchamianie LearningEngine.runFullCycle()...');
            const summary = await learningEngine.runFullCycle();
            console.log(`  ✓ Wykryte wzorce    : ${summary.patternsDetected}`);
            console.log(`  ✓ Zapisane do KB     : ${summary.persistedToKb}`);
        } else {
            console.log(
                '  ⓘ Brak zapytań telemetrycznych — system zbierze je automatycznie w trakcie pracy.'
            );
        }

        const patternCount = await kb.countPatterns();

        // 4. Podsumowanie
        console.log('\n[4/4] Podsumowanie stanu modułu AI/ML:');
        console.log('===========================================================');
        console.log(`  Status ML            : ONLINE`);
        console.log(`  Wersja modelu ML     : ${activeModel.version}`);
        console.log(`  Wzorców w Bazie Wsk. : ${patternCount}`);
        console.log('===========================================================');
        console.log('\n[OK] Moduł AI/ML jest w pełni skonfigurowany i gotowy.\n');
    } catch (err) {
        console.error('\n[BŁĄD] Setup modułu AI/ML nie powiódł się:');
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
