/**
 * Antygrawity — Automatyczny System Doboru Elementów Studni
 *
 * Automatycznie dobiera elementy studni dla średnic DN1000, DN1200, DN1500, DN2000, DN2500
 * z obsługą płyt redukcyjnych, konusów, płyt DIN, pierścieni odciążających i przejść szczelnych.
 *
 * @module antygrawity
 */

import { WellComponent } from '../../types';
import { logger } from '../../utils/logger';
import {
    selectDennica,
    selectKragByDn,
    selectZakonczenie,
    selectPlytaRedukcyjna,
    selectKragiNadbudowy,
    selectKragOt
} from './selection';
import { placePrzejscia, insertOtRing } from './passages';

// ─── Stałe ──────────────────────────────────────────────────────────

/** Prawidłowe rozmiary DN obsługiwane przez system */
const VALID_DN_SIZES = [1000, 1200, 1500, 2000, 2500];

/** Mapowanie rozmiarów DN na ich docelowe DN redukcji */
const REDUCTION_OPTIONS: Record<number, number> = {
    1200: 1000,
    1500: 1000,
    2000: 1000,
    2500: 1000
};

// ─── Typy ──────────────────────────────────────────────────────────

export interface ManholeConfig {
    targetDn: number;
    targetHeight: number;
    magazyn?: string;
    zakonczenieType?: string;
    przejscia?: import('../../types').PassageConfig[];
    hasPlytaOdciazajaca?: boolean;
    hasPierscienOdciazajacy?: boolean;
}

export interface SelectionResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    components: WellComponent[];
    totalHeight: number;
    metadata?: Record<string, unknown>;
}

// ─── Główny koordynator (Orchestrator) ──────────────────────────────

/**
 * Automatycznie dobiera i składa elementy studni na podstawie konfiguracji.
 * Potok (Pipeline): dennica → podpora → kręgi nadbudowy → redukcja → zakończenie → przejścia
 */
export async function selectManholeComponents(config: ManholeConfig): Promise<SelectionResult> {
    const {
        targetDn,
        targetHeight,
        magazyn = 'WL',
        zakonczenieType = 'konus',
        przejscia = [],
        hasPlytaOdciazajaca = false,
        hasPierscienOdciazajacy = false
    } = config;

    const result: SelectionResult = {
        success: true,
        errors: [],
        warnings: [],
        components: [],
        totalHeight: 0,
        metadata: { targetDn, targetHeight, magazyn, zakonczenieType }
    };

    if (!VALID_DN_SIZES.includes(targetDn)) {
        return createInvalidDnResult(targetDn);
    }

    const magazynField = `magazyn${magazyn}`;
    const formaStdField = `formaStandardowa${magazyn}`;

    try {
        await assembleComponents(result, {
            targetDn,
            targetHeight,
            magazyn,
            magazynField,
            formaStdField,
            zakonczenieType,
            przejscia,
            hasPlytaOdciazajaca,
            hasPierscienOdciazajacy
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.success = false;
        result.errors.push(`Błąd systemu: ${message}`);
        logger.error('Antygrawity', 'Błąd systemu', message);
    }

    return result;
}

// ─── Potok montażu (Assembly Pipeline) ──────────────────────────────

interface AssemblyContext {
    targetDn: number;
    targetHeight: number;
    magazyn: string;
    magazynField: string;
    formaStdField: string;
    zakonczenieType: string;
    przejscia: import('../../types').PassageConfig[];
    hasPlytaOdciazajaca: boolean;
    hasPierscienOdciazajacy: boolean;
}

/**
 * Wykonuje pełny potok montażu elementów
 */
async function assembleComponents(
    result: SelectionResult,
    ctx: AssemblyContext
): Promise<void> {
    // Krok 1: Dennica (bottom plate)
    const dennica = await selectDennica(ctx.targetDn, ctx.magazynField, ctx.formaStdField);
    if (!dennica) {
        result.errors.push(`Brak dostępnej dennicy dla DN${ctx.targetDn} w magazynie ${ctx.magazyn}`);
        result.success = false;
        return;
    }
    addComponent(result, dennica, 'dennica');

    // Krok 2: Obsługa podpory odciążającej (load-bearing support)
    let currentDn = ctx.targetDn;
    if (ctx.hasPlytaOdciazajaca || ctx.hasPierscienOdciazajacy) {
        const added = await addLoadBearingSupport(result, ctx);
        if (!added) return;
    }

    // Krok 3: Określenie redukcji i zakończenia
    const needsReduction = REDUCTION_OPTIONS[ctx.targetDn] !== undefined;
    const reductionDn = needsReduction ? REDUCTION_OPTIONS[ctx.targetDn] : ctx.targetDn;

    const ending = await selectZakonczenie(reductionDn, ctx.zakonczenieType, ctx.magazynField, ctx.formaStdField);
    if (!ending) {
        result.errors.push(`Brak zakończenia ${ctx.zakonczenieType} dla DN${reductionDn}`);
        result.success = false;
        return;
    }

    let remainingHeight = ctx.targetHeight - result.totalHeight - (ending.height || 0);

    // Krok 4: Płyta redukcyjna (jeśli potrzebna)
    let reductionPlate: WellComponent | null = null;
    if (needsReduction) {
        reductionPlate = await selectPlytaRedukcyjna(ctx.targetDn, reductionDn, ctx.magazynField, ctx.formaStdField);
        if (!reductionPlate) {
            result.errors.push(`Brak płyty redukcyjnej DN${ctx.targetDn}/DN${reductionDn}`);
            result.success = false;
            return;
        }
        remainingHeight -= reductionPlate.height || 0;
    }

    // Krok 5: Kręgi nadbudowy (buildup rings)
    await addBuildupRings(result, currentDn, remainingHeight, ctx.magazynField, ctx.formaStdField);

    // Krok 6: Umieszczenie płyty redukcyjnej
    if (reductionPlate) {
        addComponent(result, reductionPlate, 'plyta_redukcyjna');
        currentDn = reductionDn;
    }

    // Krok 7: Zakończenie (ending)
    addComponent(result, ending, 'zakonczenie');

    // Krok 8: Przejścia szczelne (passages)
    if (ctx.przejscia.length > 0) {
        await processPassages(result, currentDn, ctx);
    }

    // Krok 9: Końcowa walidacja wysokości
    if (Math.abs(result.totalHeight - ctx.targetHeight) > 100) {
        result.warnings.push(
            `Różnica wysokości: ${Math.abs(result.totalHeight - ctx.targetHeight)}mm (cel: ${ctx.targetHeight}mm)`
        );
    }
}

// ─── Pomocniki montażu (Assembly Helpers) ───────────────────────────

/**
 * Dodaje element do wyniku z automatycznie inkrementowaną pozycją
 */
function addComponent(result: SelectionResult, component: WellComponent, layer: string): void {
    result.components.push({
        ...component,
        position: result.components.length + 1,
        layer
    });
    result.totalHeight += component.height || 0;
}

/**
 * Dodaje pierścień podpory odciążającej. Zwraca false, jeśli dobór się nie powiedzie.
 */
async function addLoadBearingSupport(
    result: SelectionResult,
    ctx: AssemblyContext
): Promise<boolean> {
    const odciazajacyHeight = ctx.hasPlytaOdciazajaca ? 200 : 150;

    const supportingRing = await selectKragByDn(
        ctx.targetDn,
        ctx.magazynField,
        ctx.formaStdField,
        ctx.targetHeight - result.totalHeight - odciazajacyHeight
    );

    if (!supportingRing) {
        result.errors.push(
            `Brak kręgu podporowego DN${ctx.targetDn} dla płyty/pierścienia odciążającego`
        );
        result.success = false;
        return false;
    }

    addComponent(result, supportingRing, 'krag_podpora');
    return true;
}

/**
 * Dobiera i dodaje kręgi nadbudowy, aby wypełnić pozostałą wysokość
 */
async function addBuildupRings(
    result: SelectionResult,
    dn: number,
    remainingHeight: number,
    magazynField: string,
    formaStdField: string
): Promise<void> {
    const rings = await selectKragiNadbudowy(dn, remainingHeight, magazynField, formaStdField);

    if (rings.length === 0 && remainingHeight > 0) {
        result.warnings.push(
            `Nie można dobrać kręgów nadbudowy dla wysokości ${remainingHeight}mm`
        );
    }

    rings.forEach((ring) => addComponent(result, ring, 'krag_nadbudowy'));
}

/**
 * Przetwarza przejścia rur i obsługuje wymóg kręgu wierconego (OT)
 */
async function processPassages(
    result: SelectionResult,
    currentDn: number,
    ctx: AssemblyContext
): Promise<void> {
    const passageResult = await placePrzejscia(
        result.components,
        ctx.przejscia,
        ctx.magazynField,
        ctx.formaStdField
    );

    if (!passageResult.success) {
        result.errors.push(...passageResult.errors);
        result.success = false;
    }
    result.warnings.push(...passageResult.warnings);

    if (!passageResult.requiresOtRing) return;

    const otRing = await selectKragOt(currentDn, ctx.magazynField, ctx.formaStdField);
    if (otRing) {
        result.components = insertOtRing(result.components, otRing, passageResult.otPosition);
        result.success = true;
    } else {
        result.errors.push('Wymagany krąg wiercony (OT) niedostępny');
        result.success = false;
    }
}

/**
 * Tworzy wynik błędu dla nieprawidłowego rozmiaru DN
 */
function createInvalidDnResult(targetDn: number): SelectionResult {
    return {
        success: false,
        errors: [
            `Nieprawidłowa średnica DN${targetDn}. Dostępne: ${VALID_DN_SIZES.map(
                (dn) => `DN${dn}`
            ).join(', ')}`
        ],
        warnings: [],
        components: [],
        totalHeight: 0
    };
}

// ─── Re-eksporty publicznego API ────────────────────────────────────

export { getAvailableComponents } from './selection';
export { validateManhole } from './validators';
export { VALID_DN_SIZES, REDUCTION_OPTIONS };
