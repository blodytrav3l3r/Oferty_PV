import { EventEmitter } from 'node:events';
import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import {
    createInFlightLimiter,
    releaseTransferSlot,
    releaseTransferSlotOnError
} from '../../src/middleware/inFlightLimiter';

function mockResponse(): Response & EventEmitter {
    const response = new EventEmitter() as Response & EventEmitter;
    response.status = jest.fn().mockReturnValue(response) as unknown as Response['status'];
    response.json = jest.fn().mockReturnValue(response) as unknown as Response['json'];
    return response;
}

describe('in-flight operation limiter', () => {
    it('rejects excess work and releases capacity after response close', () => {
        const limiter = createInFlightLimiter(1, 'busy');
        const nextFirst = jest.fn() as unknown as NextFunction;
        const firstRequest = { complete: true } as Request;
        const firstResponse = mockResponse();
        limiter(firstRequest, firstResponse, nextFirst);

        const nextSecond = jest.fn() as unknown as NextFunction;
        const secondResponse = mockResponse();
        limiter({} as Request, secondResponse, nextSecond);

        expect(nextFirst).toHaveBeenCalledTimes(1);
        expect(nextSecond).not.toHaveBeenCalled();
        expect(secondResponse.status).toHaveBeenCalledWith(429);
        expect(secondResponse.json).toHaveBeenCalledWith({ error: 'busy', code: 'TRANSFER_BUSY' });

        firstResponse.emit('close');
        const duringWork = mockResponse();
        limiter({} as Request, duringWork, jest.fn() as unknown as NextFunction);
        expect(duringWork.status).toHaveBeenCalledWith(429);

        releaseTransferSlot(firstRequest);
        firstResponse.emit('finish');
        const nextThird = jest.fn() as unknown as NextFunction;
        limiter({} as Request, mockResponse(), nextThird);
        expect(nextThird).toHaveBeenCalledTimes(1);
    });

    it('releases capacity when the raw body parser rejects the request', () => {
        const limiter = createInFlightLimiter(1, 'busy');
        const request = { complete: true } as Request;
        const response = mockResponse();
        limiter(request, response, jest.fn() as unknown as NextFunction);
        const bodyError = new Error('payload too large');
        const nextError = jest.fn() as unknown as NextFunction;

        releaseTransferSlotOnError(bodyError, request, response, nextError);

        expect(nextError).toHaveBeenCalledWith(bodyError);
        const next = jest.fn() as unknown as NextFunction;
        limiter({} as Request, mockResponse(), next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
