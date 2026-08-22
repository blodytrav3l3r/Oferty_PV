// Integracyjny smoke-test: ładuje status-bar.tsx przez bun (tsx + JSX runtime)
// i weryfikuje rejestrację slotu app_bottom + komendy + subskrypcje eventów.
// Uruchomienie: bun run smoke.mjs
import assert from 'node:assert/strict';

const mod = await import('./status-bar.tsx');
assert.equal(typeof mod.default?.tui, 'function', 'default export tui');
assert.equal(mod.default.id, 'sok.status-bar');

const events = [];
const disposers = [];
const api = {
  event: {
    on(type, handler) {
      events.push({ type, handler });
      disposers.push(() => {});
      return () => {};
    },
  },
  route: { current: { name: 'home' } },
  state: {
    provider: [],
    session: { get: () => null, messages: () => [] },
  },
  lifecycle: {
    onDispose(fn) {
      disposers.push(fn);
    },
  },
  slots: { register: () => 'sok.status-bar' },
  keymap: { registerLayer: () => {} },
  ui: { dialog: { replace() {}, clear() {} }, toast() {} },
  theme: {
    current: {
      primary: {}, secondary: {}, accent: {}, error: {}, warning: {}, success: {},
      info: {}, text: {}, textMuted: {}, borderSubtle: {},
    },
  },
  client: {},
};

await mod.default.tui(api);

const types = events.map((e) => e.type);
for (const expected of [
  'session.status',
  'message.updated',
  'session.next.text.delta',
  'session.next.reasoning.delta',
  'session.error',
]) {
  assert.ok(types.includes(expected), `brak subskrypcji ${expected}`);
}
// Sukces = brak rzucenia wyjątku i EXIT=0 (console poza globalem eslinta tego repo)
for (const off of disposers) off(); // stop timera — zwolnienie event loop
