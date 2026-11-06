const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildLoadReport } = require('../../scripts/load-metrics.cjs');

test('keeps warmup samples out of steady-state percentiles', () => {
    const report = buildLoadReport([
        { op: 'write', phase: 'warmup', ms: 1200, status: 200, url: 'PUT /api/offers-rury' },
        { op: 'write', phase: 'steady', ms: 180, status: 200, url: 'PUT /api/offers-rury' },
        {
            op: 'write',
            phase: 'steady',
            ms: 220,
            status: 200,
            url: 'DELETE /api/offers-rury/load100_123_4'
        }
    ]);

    assert.equal(report.ops.write.p95, 220);
    assert.equal(report.warmup.ops.write.p95, 1200);
});

test('reports PUT and DELETE separately with normalized resource IDs', () => {
    const report = buildLoadReport([
        { op: 'write', phase: 'steady', ms: 180, status: 200, url: 'PUT /api/offers-rury' },
        {
            op: 'write',
            phase: 'steady',
            ms: 220,
            status: 200,
            url: 'DELETE /api/offers-rury/load100_123_4'
        },
        {
            op: 'write',
            phase: 'steady',
            ms: 240,
            status: 200,
            url: 'DELETE /api/offers-rury/load100_456_4'
        }
    ]);

    assert.equal(report.routes['PUT /api/offers-rury'].n, 1);
    assert.equal(report.routes['DELETE /api/offers-rury/:id'].n, 2);
});

test('keeps failures visible in the route breakdown', () => {
    const report = buildLoadReport([
        {
            op: 'write',
            phase: 'steady',
            ms: 543,
            status: 500,
            url: 'PUT /api/offers-rury',
            body: 'database unavailable'
        }
    ]);

    assert.deepEqual(report.routes['PUT /api/offers-rury'], {
        n: 1,
        p50: 543,
        p95: 543,
        p99: 543,
        fail: 1,
        throttled: 0,
        statuses: { 500: 1 },
        errSample: ['database unavailable']
    });
});
