/**
 * D-010 (P2-4): re-check własności w builderach kontekstu wydruku łącznego.
 *
 * Pokrywa TOCTOU check→fetch w POST /api/export-combined/{pdf,docx}:
 * (1) authorized export działa,
 * (2) unauthorized → OfferAccessDeniedError (route mapuje na 404, anti-oracle),
 * (3) zmiana stanu między check a fetch (revoke/reassign/delete,
 *     symulowana deterministycznie sekwencją mocków) → brak cudzych danych.
 */
jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const prismaMock = {
    offers_rel: { findUnique: jest.fn() },
    offers_studnie_rel: { findUnique: jest.fn() },
    offer_items_rel: { findMany: jest.fn().mockResolvedValue([]) },
    clients_rel: { findUnique: jest.fn().mockResolvedValue(null) },
    users: { findUnique: jest.fn().mockResolvedValue(null) },
    productsRury: { findMany: jest.fn().mockResolvedValue([]) }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: prismaMock
}));

import {
    buildRuryOfferContextFromOfferId,
    buildStudnieOfferContextFromOfferId,
    OfferAccessDeniedError
} from '../src/services/pdf/context';
import { loadRuryOfferData } from '../src/services/docx/rury';
import { loadStudnieOfferData } from '../src/services/docx/studnie';

const OWNER: any = { id: 'u1', username: 'u1', role: 'user', subUsers: [] };
const STRANGER: any = { id: 'u2', username: 'u2', role: 'user', subUsers: [] };
const ADMIN: any = { id: 'admin', username: 'admin', role: 'admin', subUsers: [] };

const RURY_ID = 'rury-1';
const STUDNIE_ID = 'studnie-1';

function ruryRow(userId: string) {
    return {
        id: RURY_ID,
        userId,
        offer_number: 'OF/1',
        data: JSON.stringify({}),
        clientId: null,
        createdAt: '2026-01-01T00:00:00.000Z'
    };
}

function studnieRow(userId: string) {
    return {
        id: STUDNIE_ID,
        userId,
        offer_number: 'OS/1',
        data: JSON.stringify({}),
        clientId: null,
        createdAt: '2026-01-01T00:00:00.000Z'
    };
}

describe('D-010 combined export TOCTOU — buildery PDF (context.ts)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.offer_items_rel.findMany.mockResolvedValue([]);
        prismaMock.clients_rel.findUnique.mockResolvedValue(null);
        prismaMock.users.findUnique.mockResolvedValue(null);
        prismaMock.productsRury.findMany.mockResolvedValue([]);
    });

    it('(1) owner: oba buildery zwracają kontekst (authorized export działa)', async () => {
        prismaMock.offers_rel.findUnique.mockResolvedValue(ruryRow('u1'));
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(studnieRow('u1'));

        const rury = await buildRuryOfferContextFromOfferId(RURY_ID, OWNER);
        const studnie = await buildStudnieOfferContextFromOfferId(STUDNIE_ID, OWNER);

        expect(rury.offerNumber).toBe('OF/1');
        expect(studnie.offerNumber).toBe('OS/1');
    });

    it('(1) admin: cudzy wiersz czytelny (canReadDoc bez zmian)', async () => {
        prismaMock.offers_rel.findUnique.mockResolvedValue(ruryRow('u1'));
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(studnieRow('u1'));

        await expect(buildRuryOfferContextFromOfferId(RURY_ID, ADMIN)).resolves.toBeDefined();
        await expect(buildStudnieOfferContextFromOfferId(STUDNIE_ID, ADMIN)).resolves.toBeDefined();
    });

    it('(2) obcy: rury builder rzuca OfferAccessDeniedError (status 404)', async () => {
        prismaMock.offers_rel.findUnique.mockResolvedValue(ruryRow('u1'));

        const err = await buildRuryOfferContextFromOfferId(RURY_ID, STRANGER).catch((e) => e);
        expect(err).toBeInstanceOf(OfferAccessDeniedError);
        expect((err as OfferAccessDeniedError).status).toBe(404);
    });

    it('(2) obcy: studnie builder rzuca OfferAccessDeniedError (status 404)', async () => {
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(studnieRow('u1'));

        const err = await buildStudnieOfferContextFromOfferId(STUDNIE_ID, STRANGER).catch((e) => e);
        expect(err).toBeInstanceOf(OfferAccessDeniedError);
        expect((err as OfferAccessDeniedError).status).toBe(404);
    });

    it('(3) revoke/reassign między check a fetch: fetch widzi świeży wiersz → brak danych', async () => {
        // check w route widział wiersz właściciela (u1) — fetch widzi już wiersz
        // przypisany komu innemu (revoke/reassign współdzielenia lub zmiana opiekuna).
        prismaMock.offers_rel.findUnique
            .mockResolvedValueOnce(ruryRow('u1'))
            .mockResolvedValueOnce(ruryRow('u9'));

        // symulacja checka z route (findUnique + canReadDoc) — przechodzi
        const { canReadDoc } = await import('../src/utils/ownership');
        const checked = await prismaMock.offers_rel.findUnique({ where: { id: RURY_ID } });
        expect(canReadDoc(OWNER, checked.userId)).toBe(true);

        // fetch w builderze (ten sam request, ms później) — odmawia
        await expect(buildRuryOfferContextFromOfferId(RURY_ID, OWNER)).rejects.toBeInstanceOf(
            OfferAccessDeniedError
        );
    });

    it('(3) delete między check a fetch: fetch nie zwraca cudzych danych', async () => {
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValueOnce(studnieRow('u1'));
        const checked = await prismaMock.offers_studnie_rel.findUnique({
            where: { id: STUDNIE_ID }
        });
        expect(checked).not.toBeNull();

        prismaMock.offers_studnie_rel.findUnique.mockResolvedValueOnce(null);
        await expect(buildStudnieOfferContextFromOfferId(STUDNIE_ID, OWNER)).rejects.toThrow();
    });

    it('kompatybilność: bez authUser (pojedyncze eksporty) zachowanie bez zmian', async () => {
        prismaMock.offers_rel.findUnique.mockResolvedValue(ruryRow('u1'));
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(studnieRow('u1'));

        await expect(buildRuryOfferContextFromOfferId(RURY_ID)).resolves.toBeDefined();
        await expect(buildStudnieOfferContextFromOfferId(STUDNIE_ID)).resolves.toBeDefined();
    });
});

describe('D-010 combined export TOCTOU — loadery DOCX', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.offer_items_rel.findMany.mockResolvedValue([]);
        prismaMock.clients_rel.findUnique.mockResolvedValue(null);
        prismaMock.users.findUnique.mockResolvedValue(null);
        prismaMock.productsRury.findMany.mockResolvedValue([]);
    });

    it('(1) owner: loadery DOCX zwracają dane', async () => {
        prismaMock.offers_rel.findUnique.mockResolvedValue(ruryRow('u1'));
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(studnieRow('u1'));

        await expect(loadRuryOfferData(RURY_ID, OWNER)).resolves.toBeDefined();
        await expect(loadStudnieOfferData(STUDNIE_ID, OWNER)).resolves.toBeDefined();
    });

    it('(2) obcy: loadery DOCX rzucają OfferAccessDeniedError', async () => {
        prismaMock.offers_rel.findUnique.mockResolvedValue(ruryRow('u1'));
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(studnieRow('u1'));

        await expect(loadRuryOfferData(RURY_ID, STRANGER)).rejects.toBeInstanceOf(
            OfferAccessDeniedError
        );
        await expect(loadStudnieOfferData(STUDNIE_ID, STRANGER)).rejects.toBeInstanceOf(
            OfferAccessDeniedError
        );
    });
});
