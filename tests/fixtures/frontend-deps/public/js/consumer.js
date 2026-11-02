function usesLate() {
    return late;
}

const late = 1;

function forward() {
    return helperFn();
}

function helperFn() {
    return 1;
}

function useAll() {
    return (
        classicFn() +
        windowGlobal +
        moduleBridge +
        iifeBridge() +
        inlineBridge +
        inlineGlobal +
        blockingBridge +
        bBridge() +
        usesLate() +
        forward() +
        late
    );
}

function implicit() {
    sloppyGlobal = 5;
    return sloppyGlobal;
}

function missing() {
    return notDefinedAnywhere();
}

topLevelCall();
moduleBridge;
