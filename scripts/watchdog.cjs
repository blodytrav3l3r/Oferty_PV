// C1: decyzje watchdoga start.bat w testowalnej postaci (bat jest ASCII-only
// i nieuruchomialny na CI-ubuntu — logika mieszka tutaj, bat tylko woła CLI).
//
// window <statefile> <windowSec>
//   RESET (stdout) gdy brak pliku stanu albo ostatni crash starszy niż okno —
//   licznik restartów wraca do 0 (zdrowy okres kasuje historię).
//   KEEP gdy crash wewnątrz okna — licznik rośnie (crash loop dalej staje na max).
//   Zawsze zapisuje "teraz" do statefile. Exit 0 w obu (decyzja w stdout,
//   żeby nie mylić z błędem wykonania; błąd wykonania = exit 2).
// rotate <logfile> <maxBytes>
//   Gdy log większy niż maxBytes: log.1 kasowany, log → log.1 (1 backup).
//   Exit 0 zawsze (rotacja best-effort, nigdy nie blokuje watchdoga).
const { readFileSync, writeFileSync, existsSync, statSync, renameSync, rmSync } = require('node:fs');

/** Czysta decyzja okna — testowana jednostkowo (sekundy epoch). */
function decideWindow(lastCrashEpoch, nowEpoch, windowSec) {
    if (!Number.isFinite(lastCrashEpoch)) return 'RESET';
    if (!Number.isFinite(nowEpoch) || !Number.isFinite(windowSec) || windowSec <= 0)
        return 'KEEP';
    return nowEpoch - lastCrashEpoch > windowSec ? 'RESET' : 'KEEP';
}

/** Czysta decyzja rotacji — testowana jednostkowo (bajty). */
function shouldRotate(sizeBytes, maxBytes) {
    if (!Number.isFinite(sizeBytes) || !Number.isFinite(maxBytes) || maxBytes <= 0)
        return false;
    return sizeBytes > maxBytes;
}

function cmdWindow(stateFile, windowSecRaw) {
    const windowSec = parseInt(windowSecRaw, 10);
    const now = Math.floor(Date.now() / 1000);
    let last = NaN;
    try {
        if (existsSync(stateFile)) last = parseInt(readFileSync(stateFile, 'utf8').trim(), 10);
    } catch {
        /* brak/nieczytelny stan = RESET */
    }
    const decision = decideWindow(last, now, windowSec);
    try {
        writeFileSync(stateFile, String(now), 'utf8');
    } catch {
        /* stan best-effort */
    }
    console.log(decision);
}

function cmdRotate(logFile, maxRaw) {
    const max = parseInt(maxRaw, 10);
    try {
        if (!existsSync(logFile)) return;
        if (!shouldRotate(statSync(logFile).size, max)) return;
        try {
            rmSync(logFile + '.1', { force: true });
        } catch {
            /* brak backupu */
        }
        renameSync(logFile, logFile + '.1');
    } catch {
        /* rotacja best-effort */
    }
}

module.exports = { decideWindow, shouldRotate };

if (require.main === module) {
    const [, , cmd, ...args] = process.argv;
    if (cmd === 'window') cmdWindow(args[0], args[1]);
    else if (cmd === 'rotate') cmdRotate(args[0], args[1]);
    else if (cmd !== undefined) {
        console.error(
            'Użycie: watchdog.cjs window <statefile> <windowSec> | rotate <logfile> <maxBytes>'
        );
        process.exit(2);
    }
}
