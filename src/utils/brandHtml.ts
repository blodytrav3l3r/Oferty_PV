import { APP_NAME, APP_SUBTITLE } from '../constants/appMeta';

/**
 * Podmienia tokeny nazwy aplikacji w serwowanym HTML.
 *
 * Statyczne strony (public/*.html) zawierają tokeny {{APP_NAME}} i
 * {{APP_SUBTITLE}} zamiast twardo zakodowanej nazwy — dzięki temu aplikacja
 * jest niezależna od nazwy (S.O.K., WITROS itd.), a nazwę ustawia się przez
 * zmienne środowiskowe APP_NAME/APP_SUBTITLE.
 */
export function applyBrandTokens(html: string): string {
    return html.replaceAll('{{APP_NAME}}', APP_NAME).replaceAll('{{APP_SUBTITLE}}', APP_SUBTITLE);
}

/**
 * Wstrzykuje globalną zmienną window.APP_NAME (JSON-escaped) przed </head> —
 * frontend (np. orderEditMode.js) używa jej zamiast twardej nazwy.
 */
export function injectAppNameScript(html: string): string {
    const script = `<script>window.APP_NAME=${JSON.stringify(APP_NAME)};</script>`;
    if (html.includes('</head>')) {
        return html.replace('</head>', script + '</head>');
    }
    return script + html;
}
