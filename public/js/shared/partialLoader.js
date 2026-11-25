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
                throw e;
            });
    }

    const els = document.querySelectorAll('[data-partial]');
    const partials = [];
    for (let i = 0; i < els.length; i++) {
        const id = els[i].id;
        const path = els[i].getAttribute('data-partial');
        if (id && path) partials.push({ id: id, path: path, promise: loadPartial(id, path) });
    }
    Promise.allSettled(
        partials.map(function (partial) {
            return partial.promise;
        })
    ).then(function (results) {
        const failures = [];
        results.forEach(function (result, index) {
            if (result.status !== 'rejected') return;
            const partial = partials[index];
            failures.push({
                id: partial.id,
                path: partial.path,
                error:
                    result.reason instanceof Error ? result.reason.message : String(result.reason)
            });
        });
        if (failures.length > 0) {
            console.warn('partialLoader: ' + failures.length + ' partiali nie załadowano');
        }
        document.dispatchEvent(
            new CustomEvent('partials:loaded', {
                detail: { failed: failures.length, failures: failures }
            })
        );
    });
})();
