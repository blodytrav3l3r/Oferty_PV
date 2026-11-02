let lexicalGlobal = 1;

function classicFn() {
    return lexicalGlobal;
}

window.windowGlobal = classicFn;

(function () {
    window.iifeBridge = function () {
        return lexicalGlobal;
    };
})();
