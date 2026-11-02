function loadExtra() {
    const script = document.createElement('script');
    script.src = 'vendor/extra.js';
    document.head.appendChild(script);
}

window.loadExtra = loadExtra;
