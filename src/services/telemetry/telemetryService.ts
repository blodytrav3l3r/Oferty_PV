import crypto from 'crypto';
import { logger } from '../../utils/logger';
import prisma from '../../prismaClient';
import {
    type TelemetryConfigPayload,
    type TelemetryEventInput,
    type TelemetryRecordResponse,
    type VersionRegistrationInput
} from './telemetryTypes';
import { recordConfig as writeConfig } from './telemetryConfigWriter';
import { safeDeserialize, safeJson } from './telemetryUtils';

class TelemetryService {
    async recordConfig(
        payload: TelemetryConfigPayload,
        userId?: string
    ): Promise<TelemetryRecordResponse> {
        return writeConfig(payload, userId);
    }

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

    async recordEventsBulk(
        events: TelemetryEventInput[],
        userId?: string
    ): Promise<{ success: boolean; created: number }> {
        if (events.length === 0) return { success: true, created: 0 };

        const now = new Date().toISOString();
        const data = events.map((ev) => ({
            id: crypto.randomUUID(),
            telemetryId: ev.telemetryId || null,
            eventType: ev.eventType,
            userId: userId || null,
            wellId: ev.wellId || null,
            componentId: ev.componentId || null,
            previousValue: ev.previousValue || null,
            newValue: ev.newValue || null,
            changeReason: ev.changeReason || null,
            msSinceConfig: ev.msSinceConfig ?? null,
            orderInSession: ev.orderInSession ?? null,
            sequenceNo: ev.sequenceNo ?? 0,
            createdAt: now
        }));

        try {
            await prisma.ai_telemetry_events.createMany({ data });
            return { success: true, created: data.length };
        } catch (e) {
            logger.error('Telemetry', `Błąd batch insertu eventów: ${e}`);
            return { success: false, created: 0 };
        }
    }

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

    async listRecent(limit: number = 100): Promise<Array<Record<string, unknown>>> {
        try {
            const logs = await prisma.ai_telemetry_logs.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit
            });
            return logs.map((l) => safeDeserialize(l));
        } catch (e) {
            logger.error('Telemetry', `Błąd listy: ${e}`);
            return [];
        }
    }

    async getConfigHistory(wellId: string): Promise<Array<Record<string, unknown>>> {
        try {
            const history = await prisma.ai_config_history.findMany({
                where: { wellId },
                orderBy: { configVersion: 'desc' }
            });
            return history.map((h) => ({
                ...h,
                diffFromParent: safeJson(h.diffFromParent)
            }));
        } catch (e) {
            logger.error('Telemetry', `Błąd pobierania historii: ${e}`);
            return [];
        }
    }

    async getTransitions(configId: string): Promise<Array<Record<string, unknown>>> {
        try {
            const trans = await prisma.ai_transition_snapshots.findMany({
                where: { configId },
                orderBy: { transitionNo: 'asc' }
            });
            return trans;
        } catch (e) {
            logger.error('Telemetry', `Błąd pobierania przejść: ${e}`);
            return [];
        }
    }

    async getEvents(wellId: string): Promise<Array<Record<string, unknown>>> {
        try {
            const events = await prisma.ai_telemetry_events.findMany({
                where: { wellId },
                orderBy: { createdAt: 'asc' }
            });
            return events;
        } catch (e) {
            logger.error('Telemetry', `Błąd pobierania eventów: ${e}`);
            return [];
        }
    }

    async getActiveVersions(): Promise<Array<Record<string, unknown>>> {
        try {
            return await prisma.ai_telemetry_versions.findMany({
                where: { isActive: true },
                orderBy: { createdAt: 'desc' }
            });
        } catch (e) {
            logger.error('Telemetry', `Błąd listy wersji: ${e}`);
            return [];
        }
    }

    async recordAcceptance(telemetryId: string, accepted: boolean): Promise<void> {
        try {
            await prisma.ai_telemetry_logs.update({
                where: { id: telemetryId },
                data: {
                    wasAccepted: accepted,
                    wasRejected: !accepted,
                    lastAcceptedAt: accepted ? new Date().toISOString() : null,
                    lastRejectedAt: !accepted ? new Date().toISOString() : null,
                    usageCount: { increment: 1 },
                    lastUsedAt: new Date().toISOString()
                }
            });
        } catch (e) {
            logger.warn(
                'Telemetry',
                `Nie udało się zaktualizować acceptance dla ${telemetryId}: ${e}`
            );
        }
    }
}

export const telemetryService = new TelemetryService();
