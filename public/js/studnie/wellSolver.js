// @ts-check
/**
 * wellSolver.js — BACKWARD-COMPATIBLE WRAPPER
 *
 * Funkcje wyodrębnione do osobnych plików:
 *   solverCore.js       → buildConfigSegments(), applyDrilledRings()
 *   solverAutoSelect.js → autoSelectComponents(), runJsAutoSelection()
 *   solverValidation.js → recalculateWellErrors()
 *
 * Ten plik pozostaje dla zachowania wstecznej kompatybilności.
 * Nowy kod ładuje solverCore.js, solverAutoSelect.js, solverValidation.js
 * przed tym plikiem (kolejność script tagów w studnie.html).
 *
 * Zależności globalne: studnieProducts, logger, getCurrentWell, showToast,
 *   FLOW_TYPES i inne (ładowane przez pozostałe script tagi)
 */
