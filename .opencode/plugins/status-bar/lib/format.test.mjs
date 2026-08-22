import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCompact,
  formatInt,
  formatPercent,
  formatSessionDuration,
  formatRequestDuration,
  computeTokPerSec,
  formatTokPerSec,
  formatCost,
  contextLevel,
  formatStatus,
  truncateMiddle,
  pickSections,
} from './format.js';

test('formatCompact: wartości bazowe', () => {
  assert.equal(formatCompact(8421), '8.4k');
  assert.equal(formatCompact(200000), '200k');
  assert.equal(formatCompact(6317), '6.3k');
  assert.equal(formatCompact(999), '999');
  assert.equal(formatCompact(1240000), '1.24M');
});

test('formatCompact: brak danych', () => {
  assert.equal(formatCompact(null), null);
  assert.equal(formatCompact(undefined), null);
  assert.equal(formatCompact(NaN), null);
});

test('formatInt: grupowanie', () => {
  assert.equal(formatInt(6317), '6,317');
  assert.equal(formatInt(0), '0');
  assert.equal(formatInt(null), null);
});

test('formatPercent: jeden przecinek poniżej 10%, zaokrąglenie powyżej', () => {
  assert.equal(formatPercent(0.0421), '4.2%');
  assert.equal(formatPercent(0.1), '10%');
  assert.equal(formatPercent(0.426), '43%');
  assert.equal(formatPercent(null), null);
});

test('formatSessionDuration: mm:ss oraz h:mm:ss', () => {
  assert.equal(formatSessionDuration(1458000), '00:24:18');
  assert.equal(formatSessionDuration(3723000), '1:02:03');
  assert.equal(formatSessionDuration(-5), null);
  assert.equal(formatSessionDuration(null), null);
});

test('formatRequestDuration: sekundy i minuty', () => {
  assert.equal(formatRequestDuration(12830), '12.83s');
  assert.equal(formatRequestDuration(8420), '8.42s');
  assert.equal(formatRequestDuration(83500), '1:23.5s');
  assert.equal(formatRequestDuration(0), '0.00s');
  assert.equal(formatRequestDuration(undefined), null);
});

test('computeTokPerSec: poprawny wynik, zero tokenów, zero czasu, brak danych', () => {
  const tps = computeTokPerSec(2104, 53500);
  assert.ok(Math.abs(tps - 39.3) < 0.1);
  assert.equal(computeTokPerSec(0, 1000), null, 'zero tokenow -> null');
  assert.equal(computeTokPerSec(100, 0), null, 'zero czasu -> null (nie Infinity)');
  assert.equal(computeTokPerSec(null, 1000), null);
  assert.equal(computeTokPerSec(100, null), null);
});

test('computeTokPerSec: bardzo szybka generacja nie daje nieskonczonosci', () => {
  assert.ok(computeTokPerSec(50, 20) > 0);
  assert.equal(Number.isFinite(computeTokPerSec(50, 20)), true);
});

test('formatTokPerSec: format i kompakt dla duzych wartosci', () => {
  assert.equal(formatTokPerSec(39.414), '39.4 tok/s');
  assert.equal(formatTokPerSec(12345), '12.3k tok/s');
  assert.equal(formatTokPerSec(0), null);
  assert.equal(formatTokPerSec(null), null);
});

test('formatCost: koszt z API albo null', () => {
  assert.equal(formatCost(0.084), '$0.084');
  assert.equal(formatCost(1.42), '$1.42');
  assert.equal(formatCost(0), '$0.00');
  assert.equal(formatCost(null), null);
});

test('contextLevel: progi 80%/90%', () => {
  assert.equal(contextLevel(0.042), 'ok');
  assert.equal(contextLevel(0.85), 'warn');
  assert.equal(contextLevel(0.95), 'danger');
  assert.equal(contextLevel(null), 'ok');
});

test('formatStatus: wszystkie stany + fallback READY bez zgadywania', () => {
  assert.deepEqual(formatStatus('idle'), { glyph: '●', label: 'IDLE' });
  assert.deepEqual(formatStatus('busy'), { glyph: '◉', label: 'GENERATING' });
  assert.deepEqual(formatStatus('retry'), { glyph: '⚠', label: 'RATE LIMITED' });
  assert.deepEqual(formatStatus('error'), { glyph: '✕', label: 'ERROR' });
  assert.deepEqual(formatStatus('disconnected'), { glyph: '○', label: 'DISCONNECTED' });
  assert.deepEqual(formatStatus(undefined), { glyph: '●', label: 'READY' });
  assert.deepEqual(formatStatus('cos_obcego'), { glyph: '●', label: 'READY' });
});

test('truncateMiddle: dlugi model ID skracany srodkiem, krotki nietkniety', () => {
  const long = 'anthropic/claude-sonnet-4-5-20260115-thinking-ultra';
  const cut = truncateMiddle(long, 30);
  assert.ok(cut.length <= 30);
  assert.ok(cut.includes('…'));
  assert.equal(truncateMiddle('gpt-4o', 30), 'gpt-4o');
});

test('pickSections: responsive — szeroki/sredni/waski terminal', () => {
  const wide = pickSections(180);
  assert.ok(wide.includes('cost') && wide.includes('ttft'));
  const mid = pickSections(120);
  assert.deepEqual(mid, ['model', 'provider', 'status', 'tps', 'context', 'session']);
  const small = pickSections(60);
  assert.deepEqual(small, ['model', 'tps', 'session']);
  assert.equal(pickSections(null)[0], 'model', 'fallback szerokosci');
});
