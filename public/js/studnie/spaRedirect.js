// @ts-check

if (window.top === window.self) {
    const module =
        location.pathname
            .split('/')
            .pop()
            .replace(/\.html?$/, '') || 'studnie';
    window.location.replace('/app.html#/' + module);
}
