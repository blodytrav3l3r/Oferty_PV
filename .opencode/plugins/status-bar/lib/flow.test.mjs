// Integracja: eventy OpenCode 2 -> store -> renderCompact (bez TUI).
// Symuluje pełny cykl requestu na sztucznym katalogu modeli/providerów.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './state.js';
import { registerEvents, seedSession } from './events.js';
import { renderCompact } from './layout.js';

const MODELS = [
  {
    modelID: 'claude-sonnet-4-5',
    providerID: 'anthropic',
    name: 'Claude Sonnet 4.5',
    limit: { context: 200000, output: 64000 },
  },
];
const PROVIDERS = [{ id: 'anthropic', name: 'Anthropic' }];

function makeApi() {
  const handlers = {};
  const messages = [];
  return {
    api: {
      data: {
        on(type, handler) {
          handlers[type] = handler;
          return () => {};
        },
        location: {
          model: { list: () => MODELS },
          provider: { list: () => PROVIDERS },
        },
        session: {
          get: () => null,
          message: { list: () => messages, sync: async () => {} },
        },
      },
      ui: { router: { current: () => ({ type: 'home' }) } },
      client: {},
    },
    handlers,
    messages,
  };
}

const textsOf = (cells) => cells.map((c) => c.text).join('|');

test('pełny cykl: busy -> step -> delty -> completed -> idle', () => {
  const { api, handlers, messages } = makeApi();
  const store = createStore();
  const bus = registerEvents(api, store);
  bus.syncRouteSession('s1', () => {});

  // 1) generowanie
  handlers['session.status']({ data: { sessionID: 's1', status: { type: 'busy' } } });
  let cells = renderCompact(store.state, {}, 120);
  assert.ok(textsOf(cells).includes('◉ GENERATING'));
  assert.ok(cells.some((c) => c.text.length === 1), 'spinner gdy brak interim');

  // 2) start kroku: model/provider z katalogu + zegar serwera
  handlers['session.step.started']({
    created: 1000,
    data: {
      sessionID: 's1',
      assistantMessageID: 'a1',
      model: { id: 'claude-sonnet-4-5', providerID: 'anthropic' },
      started: 1000,
    },
  });
  assert.equal(store.state.live.startedFromServer, true);
  assert.equal(store.state.model.name, 'Claude Sonnet 4.5');
  assert.equal(store.state.provider.name, 'Anthropic');

  // 3) pierwszy delta -> TTFT liczony z czasów serwera
  handlers['session.text.delta']({
    created: 1820,
    data: { sessionID: 's1', assistantMessageID: 'a1', ordinal: 0, delta: 'x' },
  });
  assert.equal(store.state.last.ttftMs, 820);

  // 4) prompt użytkownika = wejście do skrzynki sesji
  handlers['session.inbox.enqueued']({
    created: 900,
    data: { sessionID: 's1', inboxID: 'i1', item: {} },
  });
  assert.equal(store.state.session.messages, 1);

  // 5) ukończenie: metryki z wiadomości asystenta w cache
  messages.push({
    id: 'a1',
    type: 'assistant',
    model: { id: 'claude-sonnet-4-5', providerID: 'anthropic' },
    cost: 0.084,
    time: { created: 1000, completed: 13000 },
    tokens: { input: 6317, output: 2104, reasoning: 300, cache: { read: 100, write: 50 } },
    content: [],
  });
  handlers['session.execution.succeeded']({ created: 13000, data: { sessionID: 's1' } });
  handlers['session.status']({ data: { sessionID: 's1', status: { type: 'idle' } } });

  cells = renderCompact(store.state, {}, 150);
  const joined = textsOf(cells);
  assert.ok(joined.includes('● IDLE'), joined);
  assert.ok(joined.includes('Last'), `Last po zakonczeniu: ${joined}`);
  // total = input + output + reasoning + cache.read + cache.write = 8871
  assert.ok(joined.includes('8.9k/200k'), `kontekst: ${joined}`);
  assert.ok(joined.includes('(4.4%)'), `procent: ${joined}`);
  assert.ok(joined.includes('$0.084'), `koszt: ${joined}`);
  assert.ok(joined.includes('tok/s'), `tok/s: ${joined}`);

  // sumy sesji
  assert.equal(store.state.session.requests, 1);
  assert.equal(store.state.session.hasCostData, true);
});

test('retry -> RATE LIMITED z numerem próby; failed -> ERROR', () => {
  const { api, handlers } = makeApi();
  const store = createStore();
  registerEvents(api, store);
  handlers['session.status']({
    created: 1,
    data: { sessionID: undefined, status: { type: 'retry', attempt: 2, message: '429' } },
  });
  assert.ok(textsOf(renderCompact(store.state, {}, 120)).includes('⚠ RATE LIMITED #2'));

  handlers['session.execution.failed']({
    created: 2,
    data: { sessionID: undefined, error: { name: 'APIError' } },
  });
  assert.ok(textsOf(renderCompact(store.state, {}, 120)).includes('✕ ERROR'));
});

test('wąski terminal: sekcje minimalne, koszt ukryty mimo danych', () => {
  const { api, handlers, messages } = makeApi();
  const store = createStore();
  registerEvents(api, store);
  messages.push({
    id: 'a1',
    type: 'assistant',
    cost: 0.084,
    time: { created: 0, completed: 5000 },
    tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
    content: [],
  });
  handlers['session.execution.succeeded']({ created: 5000, data: { sessionID: undefined } });

  const wide = renderCompact(store.state, {}, 180);
  assert.ok(wide.some((c) => c.text.includes('$')), 'koszt przy 180 kol');
  const narrow = renderCompact(store.state, {}, 60);
  assert.ok(!narrow.some((c) => c.text.includes('$')), 'koszt ukryty przy 60 kol');
});

test('seed sesji: model z katalogu + sumy z historii wiadomości', () => {
  const { api, messages } = makeApi();
  const store = createStore();
  messages.push(
    { id: 'u1', type: 'user', time: { created: 500 }, text: 'hej' },
    {
      id: 'a1',
      type: 'assistant',
      model: { id: 'claude-sonnet-4-5', providerID: 'anthropic' },
      cost: 0.5,
      time: { created: 1000, completed: 4000 },
      tokens: { input: 1000, output: 500, reasoning: 0, cache: { read: 0, write: 0 } },
      content: [],
    },
  );
  seedSession(api, store, 's1');

  assert.equal(store.state.model.name, 'Claude Sonnet 4.5');
  assert.equal(store.state.contextLimit, 200000);
  assert.equal(store.state.session.requests, 1);
  assert.equal(store.state.session.messages, 1);
  assert.equal(store.state.session.inputTokens, 1000);
  assert.equal(store.state.session.outputTokens, 500);
});
