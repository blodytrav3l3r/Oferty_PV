(function () {
    function loadPartial(id, path) {
        return fetch(path + '?v=' + Date.now())
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (html) {
                var el = document.getElementById(id);
                if (el) el.innerHTML = html;
            })
            .catch(function (e) {
                console.error('partialLoader: failed to load ' + path, e);
            });
    }

    var els = document.querySelectorAll('[data-partial]');
    var promises = [];
    for (var i = 0; i < els.length; i++) {
        var id = els[i].id;
        var path = els[i].getAttribute('data-partial');
        if (id && path) promises.push(loadPartial(id, path));
    }
    Promise.all(promises).catch(function () {});
})();
