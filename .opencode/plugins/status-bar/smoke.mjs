// Integracyjny smoke-test: ładuje tui.tsx przez bun (tsx + JSX runtime + prawdziwe
// @opencode/plugin/tui) i weryfikuje kontrakt plugina V2: setup, sloty, komenda
// keymapy, subskrypcje eventów i cleanup.
// Uruchomienie: bun run smoke.mjs
import assert from 'node:assert/strict';

const mod = await import('./tui.tsx');
const plugin = mod.default;

assert.equal(plugin.id, 'sok.status-bar');
assert.equal(typeof plugin.setup, 'function', 'setup() z Plugin.define');

const events = [];
const slots = [];
const layers = [];
const dialogs = [];

const context = {
  options: {},
  app: { version: '0.0.0', channel: 'test' },
  renderer: { width: 120 },
  client: {},
  theme: {
    text: {
      base: 'base',
      muted: 'muted',
      action: { primary: { base: 'primary' } },
      feedback: {
        error: { base: 'error' },
        warning: { base: 'warning' },
        success: { base: 'success' },
        info: { base: 'info' },
      },
    },
    border: { base: 'border' },
  },
  data: {
    on(type, handler) {
      events.push({ type, handler });
      return () => {};
    },
    location: {
      model: { list: () => [] },
      provider: { list: () => [] },
    },
    session: {
      get: () => undefined,
      message: { list: () => [], sync: async () => {} },
    },
  },
  ui: {
    router: { current: () => ({ type: 'home' }) },
    slot(claim) {
      slots.push(claim);
      return () => {};
    },
    dialog: {
      show(render, onClose) {
        dialogs.push({ render, onClose });
      },
      clear() {
        dialogs.length = 0;
      },
    },
    toast: {
      show() {},
    },
  },
  keymap: {
    layer(factory) {
      layers.push(factory());
    },
  },
};

const dispose = plugin.setup(context);
assert.equal(typeof dispose, 'function', 'setup zwraca cleanup');

const types = events.map((e) => e.type);
for (const expected of [
  'session.status',
  'session.step.started',
  'session.text.delta',
  'session.reasoning.delta',
  'session.execution.succeeded',
  'session.execution.failed',
  'session.inbox.enqueued',
]) {
  assert.ok(types.includes(expected), `brak subskrypcji ${expected}`);
}

const targets = slots.map((s) => s.append);
assert.deepEqual(targets, ['prompt.footer.status', 'home.footer.status'], 'cele slotów');
for (const slot of slots) assert.equal(typeof slot.render, 'function', 'render slotu');

assert.equal(layers.length, 1, 'jedna warstwa keymapy');
const layer = layers[0];
assert.equal(layer.mode, 'global');
assert.deepEqual(layer.bindings, []);
const command = layer.commands?.[0];
assert.equal(command?.id, 'statusbar.details');
assert.equal(command?.bind, 'ctrl+shift+s');
assert.equal(command?.palette, true);
assert.equal(command?.slash?.name, 'status');

// Komenda otwiera i zamyka dialog szczegółów.
command.run();
assert.equal(dialogs.length, 1, 'dialog szczegółów otwarty');
command.run();
assert.equal(dialogs.length, 0, 'dialog szczegółów zamknięty');

// Eventy nie mogą rzucać na niepełnych danych.
for (const { type, handler } of events) handler({ type, created: Date.now(), data: {} });

// Podwójne ładowanie (cli.json + auto-discovery) nie może dać dwóch pasków.
const second = plugin.setup(context);
assert.equal(second, undefined, 'drugi setup jest ignorowany');
assert.equal(slots.length, 2, 'brak duplikatu slotów');
assert.equal(layers.length, 1, 'brak duplikatu keymapy');

await dispose();
// Po cleanupie plugin może się aktywować ponownie (hot reload).
const again = plugin.setup(context);
assert.equal(typeof again, 'function', 'setup działa po dispose');
await again();
// Sukces = brak wyjątku i EXIT=0 (console poza globalem eslinta tego repo)
