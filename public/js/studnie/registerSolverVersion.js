// @ts-check

document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.telemetryRegisterSolverVersion === 'function') {
        window.telemetryRegisterSolverVersion();
    }
});
