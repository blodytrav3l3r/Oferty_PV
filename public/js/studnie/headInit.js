// @ts-check
(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') || params.get('order')) {
        document.documentElement.classList.add('wizard-loading-state');
    }
})();
