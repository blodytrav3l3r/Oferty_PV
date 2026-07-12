// @ts-check
/**
 * wellSolverAuto.js — Główny punkt wejścia auto-doboru
 */

/* ===== GŁÓWNY PUNKT WEJŚCIA AUTO-DOBORU ===== */
let isAutoSelectRunning = false;
window.__autoSelectCallCount = 0;
const __MAX_AUTO_SELECT_CALLS = 10;
window.autoSelectComponents = async function autoSelectComponents(autoTriggered = false) {
    window.__autoSelectCallCount++;
    if (window.__autoSelectCallCount > __MAX_AUTO_SELECT_CALLS) {
        logger.error('wellSolver', '========================================');
        logger.error('wellSolver', 'DETEKCJA NIESKOŃCZONEJ PĘTLI autoSelectComponents!');
        logger.error('wellSolver', 'Licznik wywołań:', window.__autoSelectCallCount);
        logger.error('wellSolver', 'Stack trace:', new Error().stack);
        logger.error('wellSolver', '========================================');
        window.__autoSelectCallCount = 0;
        return;
    }
    if (isAutoSelectRunning) {
        logger.warn('wellSolver', '[AutoSelect] Pomijam — już trwa auto-dobór');
        return;
    }
    isAutoSelectRunning = true;
    try {
        const well = getCurrentWell();
        if (!well) {
            if (!autoTriggered) showToast('Najpierw dodaj studnię', 'error');
            return;
        }

        if (well.autoLocked) {
            if (!autoTriggered) showToast('Auto-dobór jest zablokowany w Trybie Ręcznym.', 'error');
            return;
        }

        const dn = well.dn;
        const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
        const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

        if (well.rzednaWlazu == null || well.rzednaWlazu <= rzDna) {
            if (!autoTriggered)
                showToast(
                    'Ustaw rzędną włazu, aby auto-dobrać elementy (Rzędna Dna przyjęta jako 0)',
                    'error'
                );
            return;
        }

        const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
        if (requiredMm < 500) {
            if (!autoTriggered) showToast('Wymagana wysokość za mała (min. 500mm)', 'error');
            return;
        }

        if (!studnieProducts || studnieProducts.length === 0) {
            if (!autoTriggered) showToast('Dane produktów jeszcze się ładują...', 'info');
            return;
        }

        // --- Pokaż loading w UI ---
        well.configStatus = 'LOADING';
        if (typeof refreshAll === 'function') refreshAll();

        const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));

        // === KROK 1: JS Solver ===
        const jsMsStart =
            window.performance && window.performance.now ? window.performance.now() : Date.now();
        const jsResult = runJsAutoSelection(well, requiredMm, availProducts);
        if (jsResult.error) {
            showToast(jsResult.error, 'error');
            well.configStatus = 'ERROR';
            well.configErrors = [jsResult.error];
            refreshAll();
            return;
        }
        logger.info(
            'wellSolver',
            '[AutoSelect] JS solver OK. config.length=',
            jsResult.config?.length,
            'totalHeight=',
            jsResult.totalHeight,
            'diff=',
            jsResult.diff,
            'topLabel=',
            jsResult.topLabel,
            'fallback=',
            jsResult.fallback
        );
        if (jsResult.config)
            logger.info(
                'wellSolver',
                '[AutoSelect] config[0]=',
                JSON.stringify(jsResult.config[0])
            );

        well.config = jsResult.config;
        const errors = [...(jsResult.errors || [])];
        if (jsResult.fallback)
            errors.push(
                jsResult.fallbackReason
                    ? `Zastosowana rozszerzona tolerancja - ${jsResult.fallbackReason}`
                    : 'Zastosowana rozszerzona tolerancja'
            );
        if (errors.length > 0 && jsResult.isMinimal) {
            well.configStatus = 'WARNING';
        } else if (errors.length > 0) {
            well.configStatus = 'WARNING';
        } else {
            well.configStatus = 'OK';
        }
        well.configErrors = errors;
        well.configSource = 'AUTO_JS';

        // Wzbogacenie AI score — tylko do telemetrii, nie zmienia wyboru
        if (typeof window.mlEnrichLayout === 'function') {
            window
                .mlEnrichLayout(well.config, well)
                .then(function (enriched) {
                    if (enriched && enriched._aiScore !== undefined) {
                        well._aiScore = enriched._aiScore;
                        well._mlOnline = enriched._mlOnline;
                        well._modelVersion = enriched._modelVersion;
                    }
                })
                .catch(function () {
                    // pasywnie — ignoruj
                });
        }

        try {
            sortWellConfigByOrder();
            if (typeof recalcGaskets === 'function') recalcGaskets(well);
            if (typeof syncKineta === 'function') syncKineta(well);
            logger.info(
                'wellSolver',
                '[AutoSelect] Przed render. config.length=',
                well.config?.length
            );
            renderWellConfig();
            renderWellDiagram();
            updateSummary();
            refreshAll();
            logger.info('wellSolver', '[AutoSelect] Render OK.');
        } catch (renderErr) {
            logger.error('wellSolver', '[AutoSelect] Błąd renderowania:', renderErr);
            logger.error('wellSolver', '[AutoSelect] Stack:', renderErr.stack);
        }

        // ─── Pasywny hook telemetry AI ───
        try {
            if (typeof window.telemetryRecordConfig === 'function') {
                const jsMsEnd =
                    window.performance && window.performance.now
                        ? window.performance.now()
                        : Date.now();
                window.telemetryRecordConfig({
                    well: well,
                    configItems: well.config || [],
                    solverSource: 'AUTO_JS',
                    computationMs: Math.round(jsMsEnd - jsMsStart),
                    iterationCount: 1,
                    checkedVariants: (availProducts || []).length,
                    rankingScore:
                        typeof jsResult.diff === 'number'
                            ? Math.max(0, 10 - jsResult.diff / 50)
                            : undefined,
                    selectionReason: jsResult.fallback
                        ? `fallback: ${jsResult.fallbackReason || 'extended tolerance'}`
                        : 'js_solver_standard'
                });
            }
        } catch (e) {
            // Pasywny hook — nie wpływa na wynik solvera
        }

        const diffStr = jsResult.diff >= 0 ? `+${jsResult.diff}mm` : `${jsResult.diff}mm`;
        const redLabel = jsResult.reductionUsed ? ` + Redukcja DN${jsResult.targetDn || 1000}` : '';
        const fallbackLabel = jsResult.fallback
            ? ' <i data-lucide="alert-triangle"></i> (rozszerzona tolerancja)'
            : '';
        let statusIcon = '<i data-lucide="check-circle-2"></i>';
        if (well.configStatus === 'WARNING') statusIcon = '<i data-lucide="alert-triangle"></i>';
        if (well.configStatus === 'ERROR') statusIcon = '<i data-lucide="alert-circle"></i>';
        if (!autoTriggered) {
            showToast(
                `${statusIcon} Auto-dobór: ${fmtInt(jsResult.totalHeight)} mm (${diffStr}) | ${jsResult.topLabel}${redLabel}${fallbackLabel}`,
                well.configStatus === 'OK' ? 'success' : 'warning'
            );
        }
    } finally {
        isAutoSelectRunning = false;
        if (window.__autoSelectCallCount > 0) window.__autoSelectCallCount--;
    }
};
