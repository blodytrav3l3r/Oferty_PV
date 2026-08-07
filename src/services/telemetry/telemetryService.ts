/**
 * Telemetry AI - serwis zapisu i odczytu danych telemetry.
 *
 * Centralny punkt dla:
 * - zapisu konfiguracji studni z pełnym kontekstem,
 * - zapisu zdarzeń użytkownika (akceptacje, odrzucenia, zmiany),
 * - wersjonowania konfiguracji (pełna historia),
 * - zapisu przejść szczelnych (geometric features),
 * - rejestracji wersji solvera/reguł/AI.
 *
 * Moduł jest pasywny - solver JS pozostaje jedynym źródłem prawdy doboru.
 */

import crypto from 'crypto';
import { logger } from '../../utils/logger';
import prisma from '../../prismaClient';
import {
    type TelemetryConfigPayload,
    type TelemetryEventInput,
    type TelemetryRecordResponse,
    type VersionRegistrationInput
} from './telemetryTypes';

/* ===== SERWIS GŁÓWNY ===== */

class TelemetryService {
    /**
     * Zapisuje kompletną konfigurację z kontekstem wejściowym.
     * Tworzy równocześnie wersję historii oraz snapshot przejść szczelnych.
     */
    async recordConfig(
        payload: TelemetryConfigPayload,
        userId?: string
    ): Promise<TelemetryRecordResponse> {
        const now = new Date().toISOString();
        const telemetryId = crypto.randomUUID();
        const configHistoryId = crypto.randomUUID();

        try {
            // Deduplikacja AUTO_JS (Etap 2): pomiń zapis identycznej konfiguracji
            // z tego samego źródła dla tej samej studni. Duplikaty zawyżają
            // hitCount/confidence wzorców i mnożą próbki treningowe ML.
            // Porównanie po deterministycznym featureSnapshot — MANUAL/AI_SUGGEST
            // zawsze zapisujemy (sygnały decyzji użytkownika).
            if (payload.solverSource === 'AUTO_JS' && payload.wellId) {
                const existing = await this._findLatestAutoJs(payload.wellId);
                if (existing && existing.featureSnapshot && payload.featureSnapshot) {
                    // Klucz porównawczy: kanoniczny featureSnapshot + posortowana
                    // lista allComponentIds. Dwie konfiguracje o identycznym
                    // snapshot ale innym zestawie komponentów to realnie inne
                    // konfiguracje — nie mogą się dedupować (utrata danych ML).
                    const payloadKey = this._dedupKey(
                        this._stableJson(payload.featureSnapshot),
                        payload.allComponentIds
                    );
                    const storedKey = this._dedupKey(
                        this._stableJsonFromString(existing.featureSnapshot),
                        existing.allComponentIds
                    );
                    if (payloadKey !== '' && payloadKey === storedKey) {
                        await prisma.ai_telemetry_logs.update({
                            where: { id: existing.id },
                            data: {
                                lastUsedAt: now,
                                usageCount: { increment: 1 },
                                // Ta sama konfiguracja w innej ofercie/kliencie —
                                // odśwież kontekst oferty, nie nadpisuj nullami.
                                ...(payload.offerId ? { offerId: payload.offerId } : {}),
                                ...(payload.clientId ? { clientId: payload.clientId } : {}),
                                ...(payload.projectId ? { projectId: payload.projectId } : {}),
                                ...(payload.warehouse ? { warehouse: payload.warehouse } : {})
                            }
                        });
                        logger.info(
                            'Telemetry',
                            `Dedup AUTO_JS: pominięto duplikat ${existing.id} (well=${payload.wellId})`
                        );
                        return {
                            success: true,
                            telemetryId: existing.id,
                            configHistoryId: undefined,
                            transitionsCreated: 0
                        };
                    }
                }
            }

            await prisma.$transaction(async (tx) => {
                // 1. Zapis głównego rekordu telemetry
                await tx.ai_telemetry_logs.create({
                    data: {
                        id: telemetryId,
                        userId: userId || null,
                        createdAt: now,
                        offerId: payload.offerId || null,
                        wellId: payload.wellId || null,
                        clientId: payload.clientId || null,
                        projectId: payload.projectId || null,
                        warehouse: payload.warehouse || null,
                        dn: payload.dn || null,
                        rzDna: payload.rzDna ?? null,
                        rzWlazu: payload.rzWlazu ?? null,
                        wellHeight: payload.wellHeight ?? null,
                        wellType: payload.wellType || null,
                        terminationType: payload.terminationType || null,
                        reductionType: payload.reductionType || null,
                        zwiencenieType: payload.zwiencenieType || null,
                        dennicaType: payload.dennicaType || null,
                        dennicaHeight: payload.dennicaHeight ?? null,
                        kineta: payload.kineta || null,
                        ringCount: payload.ringCount ?? null,
                        ringHeights: JSON.stringify(payload.ringHeights || []),
                        appliedReductions: JSON.stringify(payload.appliedReductions || []),
                        appliedKonus: JSON.stringify(payload.appliedKonus || []),
                        appliedHatches: JSON.stringify(payload.appliedHatches || []),
                        appliedSeals: JSON.stringify(payload.appliedSeals || []),
                        allComponentIds: JSON.stringify(payload.allComponentIds || []),
                        solverSource: payload.solverSource,
                        solverVersion: payload.solverVersion || null,
                        rulesVersion: payload.rulesVersion || null,
                        aiVersion: null,
                        computationMs: payload.computationMs ?? null,
                        iterationCount: payload.iterationCount ?? null,
                        checkedVariants: payload.checkedVariants ?? null,
                        rankingScore: payload.rankingScore ?? null,
                        selectionReason: payload.selectionReason || null,
                        wasAutoGenerated: payload.wasAutoGenerated ?? false,
                        wasAccepted: payload.wasAccepted ?? false,
                        wasRejected: payload.wasRejected ?? false,
                        wasModified: payload.wasModified ?? false,
                        modificationCount: payload.modificationCount ?? 0,
                        confidenceScore: payload.confidenceScore ?? null,
                        learningWeight: payload.learningWeight ?? null,
                        trainingEligible: this._isTrainingEligible(payload),
                        feedbackProcessed: false,
                        configVersion: payload.configVersion ?? 1,
                        parentConfigId: payload.parentConfigId || null,
                        reviewStatus: payload.reviewStatus || 'active',
                        featureSnapshot: this._stableJson(payload.featureSnapshot || {}),
                        labelSnapshot: JSON.stringify(payload.labelSnapshot || {}),
                        predictionSnapshot: JSON.stringify(payload.predictionSnapshot || null),
                        rewardValue: null,
                        successRate: null,
                        usageCount: 1,
                        lastUsedAt: now,
                        manualOverrideFlag: !!payload.overrideReason,
                        original_auto_config:
                            payload.originalConfig && payload.originalConfig.length > 0
                                ? JSON.stringify(payload.originalConfig)
                                : null,
                        final_user_config:
                            payload.finalConfig && payload.finalConfig.length > 0
                                ? JSON.stringify(payload.finalConfig)
                                : null
                    }
                });

                // 2. Zapis wersji historii konfiguracji (jeśli wellId znany)
                if (payload.wellId) {
                    await tx.ai_config_history.create({
                        data: {
                            id: configHistoryId,
                            wellId: payload.wellId,
                            configVersion: payload.configVersion ?? 1,
                            parentId: payload.parentConfigId || null,
                            configJson: JSON.stringify({
                                originalConfig: payload.originalConfig || [],
                                finalConfig: payload.finalConfig || [],
                                components: payload.allComponentIds || []
                            }),
                            source: payload.solverSource,
                            triggeredBy: userId || null,
                            diffFromParent: JSON.stringify(
                                this._computeDiff(payload.originalConfig, payload.finalConfig)
                            ),
                            isCurrent: true,
                            rankingScore: payload.rankingScore ?? null,
                            selectionReason: payload.selectionReason || null,
                            createdAt: now
                        }
                    });
                }

                // 3. Snapshot przejść szczelnych
                if (payload.transitions && payload.transitions.length > 0) {
                    const transitionData = payload.transitions.map((t, i) => ({
                        id: crypto.randomUUID(),
                        wellId: payload.wellId || null,
                        configId: telemetryId,
                        transitionNo: t.transitionNo ?? i + 1,
                        dn: t.dn || null,
                        transitionType: t.transitionType || null,
                        producer: t.producer || null,
                        heightFromBottomMm: t.heightFromBottomMm ?? null,
                        angleDeg: t.angleDeg ?? null,
                        position: t.position || null,
                        collided: t.collided ?? false,
                        affectedDennicaHeight: t.affectedDennicaHeight ?? null,
                        affectedRingSelection: t.affectedRingSelection ?? false,
                        affectedReductionChoice: t.affectedReductionChoice ?? false,
                        affectedFinalConfig: t.affectedFinalConfig ?? false,
                        minimalDennicaForTransitionsMm: null,
                        solverModifiedForTransitions: false,
                        createdAt: now
                    }));
                    await tx.ai_transition_snapshots.createMany({ data: transitionData });
                }

                // 4. Zamknięcie transakcji
            });

            const configHistoryCreated = !!payload.wellId;
            const transitionsCreated = payload.transitions?.length ?? 0;

            logger.info(
                'Telemetry',
                `Zapisano konfigurację ${telemetryId} ` +
                    `(well=${payload.wellId || 'brak'}, transitions=${transitionsCreated}, history=${configHistoryCreated})`
            );

            return {
                success: true,
                telemetryId,
                configHistoryId: configHistoryCreated ? configHistoryId : undefined,
                transitionsCreated
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Telemetry', `Błąd zapisu konfiguracji: ${message}`);
            throw e;
        }
    }

    /**
     * Zapisuje pojedyncze zdarzenie telemetry (np. user_change, accept).
     */
    async recordEvent(
        event: TelemetryEventInput,
        userId?: string
    ): Promise<{ success: boolean; eventId: string }> {
        const eventId = crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            await prisma.ai_telemetry_events.create({
                data: {
                    id: eventId,
                    telemetryId: event.telemetryId || null,
                    eventType: event.eventType,
                    userId: userId || null,
                    wellId: event.wellId || null,
                    componentId: event.componentId || null,
                    previousValue: event.previousValue || null,
                    newValue: event.newValue || null,
                    changeReason: event.changeReason || null,
                    msSinceConfig: event.msSinceConfig ?? null,
                    orderInSession: event.orderInSession ?? null,
                    sequenceNo: event.sequenceNo ?? 0,
                    createdAt: now
                }
            });
            return { success: true, eventId };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Telemetry', `Błąd zapisu eventu: ${message}`);
            throw e;
        }
    }

    /**
     * Rejestruje wersję solvera/reguł/AI.
     * Używane przy deployu lub gdy zmienia się logika solvera.
     */
    async registerVersion(
        input: VersionRegistrationInput
    ): Promise<{ success: boolean; id: string }> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            await prisma.ai_telemetry_versions.create({
                data: {
                    id,
                    componentType: input.componentType,
                    version: input.version,
                    description: input.description || null,
                    schemaVersion: input.schemaVersion || null,
                    isActive: input.isActive ?? true,
                    appliedFrom: 'Oferty_PV @ ' + now,
                    createdAt: now
                }
            });
            logger.info(
                'Telemetry',
                `Zarejestrowano wersję ${input.componentType}:${input.version}`
            );
            return { success: true, id };
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Telemetry', `Błąd rejestracji wersji: ${message}`);
            throw e;
        }
    }

    /**
     * Oznacza konfigurację jako zaakceptowaną przez użytkownika
     * (pasuje do passive_learner.record_acceptance).
     *
     * Naprawa F2: offerSave.js wysyła `telemetryId: w.id` (ID studni, np. 'well-...'),
     * nie UUID rekordu telemetrii — updateMany po `id` nie znajdował rekordu i
     * etykiety OFFER_SAVE cicho ginęły. Gdy `telemetryId` nie jest UUID rekordu,
     * oznaczamy najnowszy rekord danej studni (wellId).
     */
    async recordAcceptance(telemetryId: string, accepted: boolean, wellId?: string): Promise<void> {
        try {
            const now = new Date().toISOString();
            const updates = {
                wasAccepted: accepted,
                wasRejected: !accepted,
                lastAcceptedAt: accepted ? now : null,
                lastRejectedAt: !accepted ? now : null,
                usageCount: { increment: 1 },
                lastUsedAt: now
            };

            // updateMany zamiast update: brak rekordu (np. gdy /config nie dotarł
            // wcześniej) nie może rzucić P2025 — telemetria jest pasywna,
            // brak rekordu nie jest błędem.
            const result = await prisma.ai_telemetry_logs.updateMany({
                where: { id: telemetryId },
                data: updates
            });

            // Fallback: telemetryId to ID studni (wellId) — oznacz najnowszy
            // rekord konfiguracji tej studni.
            let resolvedId: string | null = result.count > 0 ? telemetryId : null;
            if (result.count === 0 && wellId) {
                const latest = await prisma.ai_telemetry_logs.findFirst({
                    where: { wellId },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true }
                });
                if (latest) {
                    await prisma.ai_telemetry_logs.updateMany({
                        where: { id: latest.id },
                        data: updates
                    });
                    resolvedId = latest.id;
                }
            }

            // Feedback nadszedł PO ekstrakcji cech — zsynchronizuj etykietę w
            // aiFeature, żeby klasa negatywna (REJECTED) trafiła do treningu.
            // updateLabelByTelemetry musi dostać UUID rekordu telemetrii (nie wellId),
            // inaczej updateMany po telemetryId nie znajdzie wiersza aiFeature.
            if (resolvedId) {
                try {
                    const { featureExtractor } = await import('../ml/FeatureExtractor');
                    await featureExtractor.updateLabelByTelemetry(
                        resolvedId,
                        accepted ? 'ACCEPTED' : 'REJECTED'
                    );
                } catch (labelErr) {
                    // Sync etykiety to krok wtórny — acceptance już zapisany.
                    // Błąd nie może zamienić sukcesu w 500 (klient fire-and-forget).
                    logger.error(
                        'Telemetry',
                        `Nie udało się zsynchronizować etykiety dla ${resolvedId}: ${labelErr}`
                    );
                }
            }
        } catch (e) {
            logger.error(
                'Telemetry',
                `Nie udało się zaktualizować acceptance dla ${telemetryId}: ${e}`
            );
            throw e;
        }
    }

    /**
     * Ostatni rekord AUTO_JS dla danej studni (używany do deduplikacji).
     */
    private async _findLatestAutoJs(wellId: string): Promise<{
        id: string;
        featureSnapshot: string | null;
        allComponentIds: string | null;
    } | null> {
        try {
            return await prisma.ai_telemetry_logs.findFirst({
                where: { wellId, solverSource: 'AUTO_JS' },
                orderBy: { createdAt: 'desc' },
                select: { id: true, featureSnapshot: true, allComponentIds: true }
            });
        } catch (e) {
            logger.error('Telemetry', `Błąd _findLatestAutoJs: ${e}`);
            return null;
        }
    }

    /**
     * Deterministyczny JSON z obiektu (stabilna kolejność kluczy) do porównania
     * z zapisanym featureSnapshot.
     */
    private _stableJson(obj: Record<string, unknown>): string {
        try {
            return this._canonicalize(obj);
        } catch {
            return '';
        }
    }

    /**
     * Rekord jest kandydatem do treningu TYLKO gdy zawiera komplet danych:
     * niepustą listę komponentów i niezerową cenę z featureSnapshot
     * (totalPrice=0 sygnalizuje martwe cechy — np. brak produktów studni).
     */
    private _isTrainingEligible(payload: TelemetryConfigPayload): boolean {
        const components = payload.allComponentIds || [];
        if (components.length === 0) return false;
        const snap = payload.featureSnapshot || {};
        const totalPrice = Number(snap.totalPrice) || 0;
        return totalPrice > 0;
    }

    /**
     * Deterministyczny JSON z zapisanego stringa featureSnapshot — klucze
     * sortowane, by porównanie nie zależało od kolejności nadania na froncie.
     */
    private _stableJsonFromString(raw: string): string {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                return this._canonicalize(parsed);
            }
            return '';
        } catch {
            return '';
        }
    }

    /**
     * Rekurencyjny kanoniczny serializer JSON (deterministyczny):
     * - obiekty: klucze sortowane na KAŻDYM poziomie zagnieżdżenia,
     * - tablice obiektów: elementy sortowane wg kanonicznego JSON (kolejność
     *   elementów-obiektów nie wpływa na wynik porównania),
     * - tablice prymitywów: kolejność zachowana (ma znaczenie, np. ringHeights),
     * - prymitywy/null zachowywane bez zmian.
     * Zwraca '' przy błędzie (pusty string = brak porównania).
     */
    private _canonicalize(value: unknown): string {
        try {
            if (value === null || typeof value !== 'object') {
                return JSON.stringify(value);
            }
            if (Array.isArray(value)) {
                const items = value.map((el) => this._canonicalize(el));
                const allObjects = value.every(
                    (el) => el !== null && typeof el === 'object' && !Array.isArray(el)
                );
                if (allObjects) {
                    items.sort();
                }
                return '[' + items.join(',') + ']';
            }
            const record = value as Record<string, unknown>;
            const parts = Object.keys(record)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + this._canonicalize(record[k]));
            return '{' + parts.join(',') + '}';
        } catch {
            return '';
        }
    }

    /**
     * Klucz porównawczy deduplikacji: kanoniczny featureSnapshot + separator +
     * posortowana lista allComponentIds. Identyczny snapshot przy innym
     * zestawie komponentów daje inny klucz — konfiguracje się nie dedupują.
     */
    private _dedupKey(snapshot: string, componentIds: unknown): string {
        if (snapshot === '') {
            return '';
        }
        return snapshot + '||' + JSON.stringify(this._normalizeIds(componentIds));
    }

    /**
     * Normalizuje allComponentIds (array z payloadu lub string JSON z bazy)
     * do posortowanej listy stringów. Brak/pusty zbiór → [] (identyczny klucz).
     */
    private _normalizeIds(raw: unknown): string[] {
        let arr: unknown[] = [];
        if (Array.isArray(raw)) {
            arr = raw;
        } else if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    arr = parsed;
                }
            } catch {
                return [];
            }
        }
        return arr.filter((x): x is string => typeof x === 'string').sort();
    }

    private _computeDiff<T extends { productId?: string }>(
        original: T[] | undefined,
        final: T[] | undefined
    ): { added: string[]; removed: string[]; kept: string[] } {
        const orig = (original || []).map((c) => c.productId || '').filter(Boolean);
        const fin = (final || []).map((c) => c.productId || '').filter(Boolean);
        const origCounts = new Map<string, number>();
        const finCounts = new Map<string, number>();
        orig.forEach((id) => origCounts.set(id, (origCounts.get(id) || 0) + 1));
        fin.forEach((id) => finCounts.set(id, (finCounts.get(id) || 0) + 1));
        const added: string[] = [];
        const removed: string[] = [];
        const kept: string[] = [];
        const all = new Set([...origCounts.keys(), ...finCounts.keys()]);
        for (const id of all) {
            const o = origCounts.get(id) || 0;
            const f = finCounts.get(id) || 0;
            if (f > o) added.push(...Array(f - o).fill(id));
            else if (o > f) removed.push(...Array(o - f).fill(id));
            if (Math.min(o, f) > 0) kept.push(...Array(Math.min(o, f)).fill(id));
        }
        return { added, removed, kept };
    }
}

export const telemetryService = new TelemetryService();
