(function () {
    function loadPartial(id, path) {
        return fetch(path + '?v=' + Date.now())
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (html) {
                const el = document.getElementById(id);
                if (el) el.innerHTML = html;
            })
            .catch(function (e) {
                console.error('partialLoader: failed to load ' + path, e);
            });
    }

    const els = document.querySelectorAll('[data-partial]');
    const promises = [];
    for (let i = 0; i < els.length; i++) {
        const id = els[i].id;
        const path = els[i].getAttribute('data-partial');
        if (id && path) promises.push(loadPartial(id, path));
    }
    Promise.allSettled(promises).then(function (results) {
        const failed = results.filter(function (r) {
            return r.status === 'rejected';
        }).length;
        if (failed > 0) {
            console.warn('partialLoader: ' + failed + ' partiali nie załadowano');
        }
        document.dispatchEvent(new CustomEvent('partials:loaded'));
    });
})();
