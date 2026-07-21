(function () {
    var PARTIALS = [{ id: 'partial-header', path: 'partials/header.html' }];

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

    for (var i = 0; i < PARTIALS.length; i++) {
        loadPartialSync(PARTIALS[i].id, PARTIALS[i].path);
    }
})();
