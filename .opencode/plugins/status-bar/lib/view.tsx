/** @jsxImportSource @opentui/solid */
// Widok Status Bara (SolidJS/OpenTUI). Cała logika siedzi w layout.js/state.js —
// tutaj wyłącznie mapowanie komórek i wierszy szczegółów na elementy OpenTUI.

import { createSignal, onCleanup, onMount, For, Show } from 'solid-js';
import { renderCompact, renderDetailRows } from './layout.js';

/**
 * Tokeny motywu OpenCode 2 (ResolvedTheme) -> płaskie nazwy, których używa
 * lib/layout.js. V2 nie ma `primary`/`success`/`borderSubtle` — odpowiedniki:
 * text.base, text.action.primary.base, text.feedback.<kind>.base, border.base.
 */
export function themeTokens(theme) {
  const t = theme ?? {};
  const feedback = t.text?.feedback ?? {};
  return {
    text: t.text?.base,
    textMuted: t.text?.muted,
    primary: t.text?.action?.primary?.base,
    info: feedback.info?.base,
    success: feedback.success?.base,
    warning: feedback.warning?.base,
    error: feedback.error?.base,
    borderSubtle: t.border?.base,
  };
}

export function StatusBarView(props) {
  const tick = useTick(props.store);

  // Szerokość/temat odczytane raz — resize renderera nie jest eventowany do pluginów;
  // shortcut: pełna reaktywność na resize dopiero, gdy OpenCode da event.
  const tokens = themeTokens(props.theme);
  const width = Number(props.width) || 100;

  return (
    <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1} height={1}>
      <Show when={(tick(), renderCompact(props.store.state, tokens, width))} keyed>
        {(cells) => (
          <For each={cells}>
            {(cell) => (
              <Show when={cell.separator} fallback={<text fg={cell.fg}>{`${cell.text} `}</text>}>
                <text fg={tokens.borderSubtle}>│ </text>
              </Show>
            )}
          </For>
        )}
      </Show>
    </box>
  );
}

function useTick(store) {
  const [v, setV] = createSignal(0);
  onMount(() => {
    const unsubscribe = store.subscribe(() => setV((x) => x + 1));
    onCleanup(unsubscribe);
  });
  return v;
}

/** Render funkcja dla ui.dialog.show() — szczegóły sesji. */
export function DetailsDialog(props) {
  const t = themeTokens(props.theme);
  const rows = renderDetailRows(props.store.state);
  return (
    <box flexDirection="column" padding={1}>
      <text fg={t.primary}>STATUS BAR — SZCZEGÓŁY (Esc zamyka)</text>
      <box height={1} />
      <For each={rows}>
        {(row) => (
          <box flexDirection="row" height={1}>
            <text fg={t.textMuted}>{row[0].padEnd(18, ' ')}</text>
            <text fg={t.text}>{row[1]}</text>
          </box>
        )}
      </For>
    </box>
  );
}
