(function () {
    if (window.top === window.self) {
        var module =
            location.pathname
                .split('/')
                .pop()
                .replace(/\.html?$/, '') || 'app';
        window.location.replace('/app.html#/' + module);
    }
})();
