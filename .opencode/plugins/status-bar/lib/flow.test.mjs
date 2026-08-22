// Integracja: eventy OpenCode -> store -> renderCompact (bez TUI).
// Symuluje pełny cykl requestu na sztucznym katalogu providerów.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './state.js';
import { registerEvents } from './events.js';
import { renderCompact } from './layout.js';

function makeApi() {
  const handlers = {};
  return {
    api: {
      event: {
        on(type, handler) {
          handlers[type] = handler;
          return () => {};
        },
      },
      route: { current: { name: 'home' } },
      state: {
        provider: [
          {
            id: 'anthropic',
            name: 'Anthropic',
            models: {
              'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5', limit: { context: 200000, output: 64000 } },
            },
          },
        ],
        session: { get: () => null, messages: () => [] },
      },
      client: {},
    },
    handlers,
  };
}

const textsOf = (cells) => cells.map((c) => c.text).join('|');

test('pełny cykl: busy -> delty -> interim -> completed -> idle', () => {
  const { api, handlers } = makeApi();
  const store = createStore();
  const bus = registerEvents(api, store);
  bus.syncRouteSession('s1', () => {});

  // 1) generowanie
  handlers['session.status']({ data: { sessionID: 's1', status: { type: 'busy' } } });
  let cells = renderCompact(store.state, {}, 120);
  assert.ok(textsOf(cells).includes('◉ GENERATING'));
  assert.ok(cells.some((c) => c.text.length === 1), 'spinner gdy brak interim');

  // 2) model/provider z wiadomości + katalogu (user przed odpowiedzią)
  handlers['message.updated']({
    data: { sessionID: 's1', info: { id: 'u1', role: 'user', time: { created: 1000 } } },
  });

  // 3) asystent streamingu (start z zegara serwera) — przed pierwszą deltą
  handlers['message.updated']({
    data: {
      sessionID: 's1',
      info: {
        id: 'a1',
        role: 'assistant',
        providerID: 'anthropic',
        modelID: 'claude-sonnet-4-5',
        time: { created: 1000 },
      },
    },
  });
  assert.equal(store.state.live.startedFromServer, true);

  // 4) pierwszy delta -> TTFT
  handlers['session.next.text.delta']({
    data: { sessionID: 's1', timestamp: 1820, assistantMessageID: 'a1' },
  });
  assert.equal(store.state.last.ttftMs, 820);

  // 5) interim usage podczas streamingu -> live tok/s z realnych danych
  handlers['message.updated']({
    data: {
      sessionID: 's1',
      info: {
        id: 'a1',
        role: 'assistant',
        providerID: 'anthropic',
        modelID: 'claude-sonnet-4-5',
        time: { created: 1000 },
        tokens: { output: 400 },
      },
    },
  });
  cells = renderCompact(store.state, {}, 120);
  const tpsCell = cells.find((c) => c.text.includes('tok/s'));
  assert.ok(tpsCell, 'live tok/s widoczny');
  assert.ok(store.state.model.name === 'Claude Sonnet 4.5');
  assert.ok(textsOf(cells).includes('Anthropic'));

  // interim update NIE kasuje TTFT (regresja beginRequest)
  assert.equal(store.state.last.ttftMs, 820);

  // 6) ukończenie
  handlers['message.updated']({
    data: {
      sessionID: 's1',
      info: {
        id: 'a1',
        role: 'assistant',
        providerID: 'anthropic',
        modelID: 'claude-sonnet-4-5',
        cost: 0.084,
        time: { created: 1000, completed: 13000 },
        tokens: {
          input: 6317,
          output: 2104,
          reasoning: 300,
          cache: { read: 100, write: 50 },
          total: 8421,
        },
      },
    },
  });
  handlers['session.status']({ data: { sessionID: 's1', status: { type: 'idle' } } });

  cells = renderCompact(store.state, {}, 150);
  const joined = textsOf(cells);
  assert.ok(joined.includes('● IDLE'));
  assert.ok(joined.includes('Last'), `Last po zakonczeniu: ${joined}`);
  assert.ok(joined.includes('8.4k/200k'), `kontekst: ${joined}`);
  assert.ok(joined.includes('(4.2%)') || joined.includes('(4.21%)'), `procent: ${joined}`);
  assert.ok(joined.includes('$0.08'));

  // sumy sesji
  assert.equal(store.state.session.requests, 1);
  assert.equal(store.state.session.hasCostData, true);
});

test('retry -> RATE LIMITED z numerem próby; error -> ERROR', () => {
  const { api, handlers } = makeApi();
  const store = createStore();
  registerEvents(api, store);
  handlers['session.status']({
    data: { sessionID: undefined, status: { type: 'retry', attempt: 2, message: '429' } },
  });
  assert.ok(textsOf(renderCompact(store.state, {}, 120)).includes('⚠ RATE LIMITED #2'));

  handlers['session.error']({ data: { sessionID: undefined, error: { name: 'APIError' } } });
  assert.ok(textsOf(renderCompact(store.state, {}, 120)).includes('✕ ERROR'));
});

test('wąski terminal: sekcje minimalne, koszt ukryty mimo danych', () => {
  const { api, handlers } = makeApi();
  const store = createStore();
  registerEvents(api, store);
  handlers['message.updated']({
    data: {
      sessionID: undefined,
      info: {
        id: 'a1',
        role: 'assistant',
        cost: 0.084,
        time: { created: 0, completed: 5000 },
        tokens: { input: 10, output: 20, cache: {}, total: 30 },
      },
    },
  });
  const wide = renderCompact(store.state, {}, 180);
  assert.ok(wide.some((c) => c.text.includes('$')), 'koszt przy 180 kol');
  const narrow = renderCompact(store.state, {}, 60);
  assert.ok(!narrow.some((c) => c.text.includes('$')), 'koszt ukryty przy 60 kol');
});
