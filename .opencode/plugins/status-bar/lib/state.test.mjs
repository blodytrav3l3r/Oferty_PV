import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, contextUsage, liveTokPerSec } from './state.js';

const ASSISTANT = (id, over = {}) => ({
  id,
  role: 'assistant',
  modelID: 'claude-sonnet-4-5',
  providerID: 'anthropic',
  cost: 0.084,
  time: { created: 1_000_000, completed: 1_012_830 },
  tokens: {
    input: 6317,
    output: 2104,
    reasoning: 300,
    cache: { read: 100, write: 50 },
    total: 8421,
  },
  ...over,
});

test('applyAssistantMessage: metryki ostatniego requestu', () => {
  const store = createStore();
  store.beginRequest('m1', 1_000_000);
  // pierwszy delta po 820 ms -> TTFT
  store.markFirstDelta(1_000_820);
  store.applyAssistantMessage(ASSISTANT('m1'));

  const s = store.state;
  assert.equal(s.last.input, 6317);
  assert.equal(s.last.output, 2104);
  assert.equal(s.last.total, 8421);
  assert.equal(s.last.ttftMs, 820);
  assert.equal(s.last.requestMs, 12830);
  assert.equal(s.last.generationMs, 12010); // completed - firstDelta
  assert.ok(Math.abs(s.last.tokPerSec - (2104 / 12.01)) < 0.5);
});

test('applyAssistantMessage: brak usage -> N/A zamiast zmylonych zer', () => {
  const store = createStore();
  store.beginRequest('m1', 1_000_000);
  store.applyAssistantMessage(
    ASSISTANT('m1', { tokens: undefined, cost: undefined }),
  );
  const s = store.state;
  assert.equal(s.last.output, null);
  assert.equal(s.last.cost, null);
  assert.equal(s.session.hasTokenData, false);
  assert.equal(s.session.hasCostData, false);
});

test('sumy sesji: dedupe przy wielokrotnych updateach tej samej wiadomosci', () => {
  const store = createStore();
  store.applyAssistantMessage(ASSISTANT('m1'));
  store.applyAssistantMessage(ASSISTANT('m1')); // ponowny update - nie liczy podwojnie
  store.applyAssistantMessage(ASSISTANT('m2'));
  const sess = store.state.session;
  assert.equal(sess.requests, 2);
  assert.equal(sess.inputTokens, 12634);
  assert.equal(sess.outputTokens, 4208);
  assert.ok(Math.abs(sess.cost - 0.168) < 1e-9);
  assert.equal(sess.hasTokenData, true);
  assert.equal(sess.hasCostData, true);
});

test('historia tok/s: avg i peak', () => {
  const store = createStore();
  const msg = (id, out, gen) =>
    ASSISTANT(id, {
      tokens: { input: 10, output: out, cache: {} },
      time: { created: 0, completed: gen },
    });
  store.applyAssistantMessage(msg('a', 1000, 10_000)); // 100 tok/s
  store.applyAssistantMessage(msg('b', 2000, 10_000)); // 200 tok/s
  const h = store.state.history;
  assert.ok(Math.abs(h.tpsPeak - 200) < 0.5);
  assert.ok(Math.abs(h.tpsSum / h.tpsCount - 150) < 0.5);
});

test('setStatus: busy/retry/error/idle oraz live window', () => {
  const store = createStore();
  store.setStatus('busy');
  assert.equal(store.state.statusType, 'busy');
  assert.equal(store.state.live.active, true);
  store.setStatus('retry', { attempt: 3, message: '429' });
  assert.deepEqual(store.state.retry, { attempt: 3, message: '429' });
  assert.equal(store.state.live.active, false);
  store.setStatus('idle');
  assert.equal(store.state.retry, null);
  assert.deepEqual(store.state.statusType, 'idle');
});

test('contextUsage: ratio tylko gdy znamy limit kontekstu', () => {
  const store = createStore();
  store.setModel({ contextLimit: 200_000 });
  store.applyAssistantMessage(ASSISTANT('m1'));
  const { used, ratio } = contextUsage(store.state);
  assert.equal(used, 8421);
  assert.ok(Math.abs(ratio - 0.042105) < 1e-4);
});

test('liveTokPerSec: tylko z realnego interim usage, nigdy z szacunku', () => {
  const store = createStore();
  store.beginRequest('m1', 0);
  store.markFirstDelta(1000);
  store.state.nowMs = 6000; // 5 s od pierwszego delta
  assert.equal(liveTokPerSec(store.state), null, 'bez interim -> null');
  store.setInterimOutput(200);
  assert.ok(Math.abs(liveTokPerSec(store.state) - 40) < 0.1);
});

test('resetForSessionSwitch: czysci request/sesje, trzyma model', () => {
  const store = createStore();
  store.setModel({ id: 'gpt-x', name: 'GPT X' });
  store.applyAssistantMessage(ASSISTANT('m1'));
  store.resetForSessionSwitch(5_000_000);
  const s = store.state;
  assert.equal(s.model.id, 'gpt-x');
  assert.equal(s.session.requests, 0);
  assert.equal(s.last.messageID, null);
  assert.equal(s.session.startedAtMs, 5_000_000);
});
