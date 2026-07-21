(function () {
    function loadPartialSync(id, path) {
        var el = document.getElementById(id);
        if (!el) return;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', path + '?v=' + Date.now(), false);
            xhr.overrideMimeType('text/html; charset=utf-8');
            xhr.send();
            if (xhr.status === 200) {
                el.innerHTML = xhr.responseText;
            }
        } catch (e) {
            console.error('partialLoader: failed to load ' + path, e);
        }
    }

    var els = document.querySelectorAll('[data-partial]');
    for (var i = 0; i < els.length; i++) {
        var id = els[i].id;
        var path = els[i].getAttribute('data-partial');
        if (id && path) loadPartialSync(id, path);
    }
})();
