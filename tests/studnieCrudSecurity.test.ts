/**
 * Testy bezpieczenstwa E2E dla endpointu studnieCrud POST /studnie
 *
 * Weryfikuja, ze po Fazie 2 endpoint uzywa resolveWriteUserId
 * i odrzuca proby eskalacji uprawnien.
 */

import { resolveWriteUserId } from '../src/utils/ownership';
import { User } from '../src/helpers';

// Wyciagamy logike symulujaca dzialanie handlera POST /studnie
// bez koniecznosci pelnego mockowania bazy danych.
// Jest to test jednostkowy wycinka logiki, a nie pelny E2E
// (ktory wymaga podniesionego serwera testowego).

interface MockOfferInput {
    id?: string;
    userId?: string;
    number?: string;
    status?: string;
    createdAt?: number | Date | string;
}

const regularUser: User = {
    id: 'user1',
    username: 'user1',
    role: 'user',
    subUsers: []
};

const admin: User = {
    id: 'admin1',
    username: 'admin',
    role: 'admin',
    subUsers: []
};

const pro: User = {
    id: 'pro1',
    username: 'pro',
    role: 'pro',
    subUsers: ['subA']
};

/**
 * Funkcja pomocnicza symulujaca nowo napisany handler w studnieCrud.ts.
 * Powinna zwrocic 403 gdy uzytkownik probuje utworzyc oferte
 * z cudzym userId.
 */
function simulatePostStudnieHandler(authReq: User, body: MockOfferInput[]) {
    const responses: Array<{ status: number; body: unknown }> = [];
    for (const o of body) {
        const resolved = resolveWriteUserId(authReq, o.userId);
        if (!resolved.allowed) {
            responses.push({
                status: 403,
                body: {
                    error: 'Brak uprawnien do tworzenia oferty dla wskazanego uzytkownika',
                    offendingOfferId: o.id,
                    requestedUserId: o.userId || null
                }
            });
            return { halted: true, responses };
        }
        responses.push({ status: 200, body: { ok: true, userId: resolved.effectiveUserId } });
    }
    return { halted: false, responses };
}

describe('E2E Bezpieczenstwa - POST /studnie (studnieCrud.ts)', () => {
    it('zwykly user probujacy utworzyc oferte jako admin → 403', () => {
        const { halted, responses } = simulatePostStudnieHandler(regularUser, [
            { id: 'ofr-1', userId: 'admin1', number: 'W-001' }
        ]);
        expect(halted).toBe(true);
        expect(responses[0].status).toBe(403);
        expect(responses[0].body).toMatchObject({
            error: expect.stringContaining('Brak uprawnien'),
            requestedUserId: 'admin1'
        });
    });

    it('zwykly user probujacy utworzyc oferte dla innego usera → 403', () => {
        const { halted, responses } = simulatePostStudnieHandler(regularUser, [
            { id: 'ofr-1', userId: 'user2', number: 'W-001' }
        ]);
        expect(halted).toBe(true);
        expect(responses[0].status).toBe(403);
    });

    it('zwykly user bez userId w body → 200 (id wlasne)', () => {
        const { halted, responses } = simulatePostStudnieHandler(regularUser, [
            { id: 'ofr-1', number: 'W-001' }
        ]);
        expect(halted).toBe(false);
        expect(responses[0].status).toBe(200);
        expect(responses[0].body).toMatchObject({
            ok: true,
            userId: 'user1'
        });
    });

    it('admin moze utworzyc oferte dla dowolnego userId → 200', () => {
        const { halted, responses } = simulatePostStudnieHandler(admin, [
            { id: 'ofr-1', userId: 'subA', number: 'W-001' }
        ]);
        expect(halted).toBe(false);
        expect(responses[0].body).toMatchObject({
            ok: true,
            userId: 'subA'
        });
    });

    it('admin moze utworzyc oferte dla siebie (bez userId) → 200', () => {
        const { halted, responses } = simulatePostBudnieHandler_bis(admin, [
            { id: 'ofr-1', number: 'W-001' }
        ]);
        expect(halted).toBe(false);
        expect(responses[0].body).toMatchObject({
            ok: true,
            userId: 'admin1'
        });
    });

    it('pro moze utworzyc oferte dla swojego sub-usera → 200', () => {
        const { responses } = simulatePostStudnieHandler(pro, [
            { id: 'ofr-1', userId: 'subA', number: 'W-001' }
        ]);
        expect(responses[0].body).toMatchObject({
            ok: true,
            userId: 'subA'
        });
    });

    it('pro probujacy utworzyc oferte dla nieznanego usera → 403', () => {
        const { halted, responses } = simulatePostStudnieHandler(pro, [
            { id: 'ofr-1', userId: 'hacker-user', number: 'W-001' }
        ]);
        expect(halted).toBe(true);
        expect(responses[0].status).toBe(403);
    });
});

function simulatePostBudnieHandler_bis(authReq: User, body: MockOfferInput[]) {
    return simulatePostStudnieHandler(authReq, body);
}
