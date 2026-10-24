/** @jsxImportSource @opentui/solid */
// S.O.K. Status Bar — plugin TUI OpenCode 2.
// Provider-agnostic: wszystkie dane z eventów i katalogu OpenCode,
// zero pollingu, zero własnej telemetrii, zero zgadywanych wartości.
//
// Kontrakt V2: https://opencode.ai/v2/docs/build/plugins/cli
//   TuiPlugin (1.x)            -> Plugin.define({ id, setup })
//   api.event.on               -> context.data.on
//   api.slots.register         -> context.ui.slot
//   api.ui.dialog.replace      -> context.ui.dialog.show
//   api.keymap.registerLayer   -> context.keymap.layer
//   api.route.current          -> context.ui.router.current()
//   api.theme.current          -> context.theme
//   api.lifecycle.onDispose    -> zwrócony cleanup z setup
//
// Slot: 1.x `app_bottom` nie istnieje w V2. Pasek idzie do
// `prompt.footer.status` (sesja) i `home.footer.status` (ekran główny) jako
// `append`, więc nie zastępuje wbudowanych wskaźników.

import { Plugin } from '@opencode/plugin/tui';
import { createStore } from './lib/state.js';
import { registerEvents, seedSession, reportErr } from './lib/events.js';
import { StatusBarView, DetailsDialog } from './lib/view.tsx';

const TICK_MS = 1000;

// One active setup per TUI process. The CLI can find this plugin twice:
// the `plugins` entry in cli.json and the auto-discovery of `.opencode/plugins/`.
// A second active setup would register a second timer, a second set of event
// subscriptions and a second status bar.
const ACTIVE = Symbol.for('sok.status-bar.setup');
const registry = globalThis as unknown as Record<symbol, Set<string> | undefined>;
const active = (registry[ACTIVE] ??= new Set<string>());

function currentSessionID(context) {
  const route = context.ui.router.current();
  return route?.type === 'session' ? route.sessionID : undefined;
}

export default Plugin.define({
  id: 'sok.status-bar',
  setup(context) {
    if (active.has('sok.status-bar')) return;
    active.add('sok.status-bar');
    try {
      return start(context);
    } catch (error) {
      active.delete('sok.status-bar');
      throw error;
    }
  },
});

function start(context) {
  const store = createStore();
  const bus = registerEvents(context, store);

  // Seed istniejącej sesji przy starcie plugina
  try {
    const sid = currentSessionID(context);
    if (sid) seedSession(context, store, sid);
  } catch (err) {
    reportErr(context, 'initial-seed', err);
  }

  // Jedyny timer: tick zegara sesji + detekcja zmiany sesji w routingu.
  // Aktualizuje wyłącznie sygnał Status Bara — nie dotyka reszty UI.
  const timer = setInterval(() => {
    store.tick();
    try {
      bus.syncRouteSession(currentSessionID(context), (id) => seedSession(context, store, id));
    } catch {
      // routing jeszcze nie gotowy — tick bez zmian
    }
  }, TICK_MS);

  const renderBar = () => (
    <StatusBarView
      store={store}
      theme={context.theme}
      width={Number(context.renderer?.width) || 100}
    />
  );
  context.ui.slot({ append: 'prompt.footer.status', render: renderBar });
  context.ui.slot({ append: 'home.footer.status', render: renderBar });

  let detailsOpen = false;
  const toggleDetails = () => {
    if (detailsOpen) {
      context.ui.dialog.clear();
      detailsOpen = false;
      return;
    }
    detailsOpen = true;
    context.ui.dialog.show(
      () => (
        <DetailsDialog
          store={store}
          theme={context.theme}
          onClose={() => {
            detailsOpen = false;
          }}
        />
      ),
      () => {
        detailsOpen = false;
      },
    );
  };

  context.keymap.layer(() => ({
    mode: 'global',
    commands: [
      {
        id: 'statusbar.details',
        title: 'Status bar: szczegóły',
        group: 'Plugin',
        palette: true,
        slash: { name: 'status' },
        bind: 'ctrl+shift+s',
        run: toggleDetails,
      },
    ],
    bindings: [],
  }));

  return () => {
    clearInterval(timer);
    bus.dispose();
    active.delete('sok.status-bar');
  };
}
