// @ts-check
// Wymuszenie jedynego punktu wejścia: app.html#/<module>
if (window.top === window.self) {
    const module =
        location.pathname
            .split('/')
            .pop()
            .replace(/\.html?$/, '') || 'rury';
    window.location.replace('/app.html#/' + module);
}
