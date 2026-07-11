function fitSvgText(svgId) {
    var svg = document.getElementById(svgId);
    if (!svg) return;
    var text = svg.querySelector('text');
    if (!text) return;
    var bbox = text.getBBox();
    if (bbox.width === 0 || bbox.height === 0) return;
    var padX = bbox.height * 0.1;
    var padY = bbox.height * 0.1;
    svg.setAttribute(
        'viewBox',
        bbox.x -
            padX +
            ' ' +
            (bbox.y - padY) +
            ' ' +
            (bbox.width + 2 * padX) +
            ' ' +
            (bbox.height + 2 * padY)
    );
}
function runFit() {
    fitSvgText('snr-svg');
    fitSvgText('order-svg');
}
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(runFit);
} else {
    setTimeout(runFit, 200);
}
setTimeout(runFit, 400);
