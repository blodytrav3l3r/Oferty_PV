// @ts-check

if (window.top === window.self) {
    const module =
        location.pathname
            .split('/')
            .pop()
            .replace(/\.html?$/, '') || 'studnie';
    // Przekaż query (?order= / ?edit= / ?tab=) do hasha SPA — router (parseHash)
    // wstawia je do src iframe. Bez tego deep linki gubiły parametry.
    window.location.replace('/app.html#/' + module + location.search);
}
