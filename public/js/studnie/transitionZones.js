// @ts-check
/**
 * transitionZones.js — Wspólna geometria stref przejść (SSoT, P1.1)
 *
 * Rozdział odpowiedzialności (twarde reguły):
 *   OT    = containment korpusu rury (segment zawiera dół..dół+DN).
 *   Joint = walidacja względem strefy z zapasami (osobna reguła).
 *   krag_ot NIE jest wyjątkiem od reguły jointów.
 *
 * Wszystkie wymiary w mm od dna studni (spójne z segmentami solvera,
 * diagramOtRings i buildCandidateLayouts — bottom-up od dennicy).
 * Zależności globalne: brak (czyste funkcje; resolve produktu robi caller).
 */

// Rezerwy domyślne — spójne z solverAutoSelect (parseHoleClearance) i validator.py:85.
var TRANSITION_SAFETY_MARGIN_MM = 15;
var TRANSITION_RESERVE_STD_MM = 300;
var TRANSITION_RESERVE_MIN_MM = 150;
// Legacy fallback DN, gdy brak produktu (dotychczasowe `|| 160` w 12 miejscach).
var TRANSITION_LEGACY_DN_MM = 160;

/**
 * SSoT średnicy rury przejścia. Format cennika: '160' lub '110/160' (drugi człon).
 * @param {Object|null} pprod produkt przejścia (może być null)
 * @returns {number} DN w mm
 */
function getTransitionDn(pprod) {
    if (!pprod || pprod.dn == null || pprod.dn === '') return TRANSITION_LEGACY_DN_MM;
    if (typeof pprod.dn === 'string' && pprod.dn.indexOf('/') !== -1) {
        return parseFloat(pprod.dn.split('/')[1]) || TRANSITION_LEGACY_DN_MM;
    }
    return parseFloat(pprod.dn) || TRANSITION_LEGACY_DN_MM;
}

/**
 * Korpus rury w mm od dna: dół = (rzędnaWłączenia - rzędnaDna) * 1000.
 * @param {*} rzednaWlaczenia rzędna włączenia (m, liczba lub string)
 * @param {*} rzDna rzędna dna (m)
 * @param {number} dnMm średnica (mm)
 * @returns {{bottomMm:number,topMm:number,centerMm:number,dnMm:number}|null} null gdy brak rzędnej
 */
function getTransitionBody(rzednaWlaczenia, rzDna, dnMm) {
    var pel = parseFloat(rzednaWlaczenia);
    if (isNaN(pel)) return null;
    var base = rzDna != null ? parseFloat(rzDna) : 0;
    if (isNaN(base)) base = 0;
    var dn = dnMm > 0 ? dnMm : TRANSITION_LEGACY_DN_MM;
    var bottomMm = Math.round((pel - base) * 1000);
    return { bottomMm: bottomMm, topMm: bottomMm + dn, centerMm: bottomMm + dn / 2, dnMm: dn };
}

/**
 * Parsowanie zapasu z produktu (puste/NaN → fallback).
 */
function parseTransitionReserve(val, fallbackMm) {
    if (val === undefined || val === null || val === '') return fallbackMm;
    var p = parseFloat(val);
    return isNaN(p) ? fallbackMm : p;
}

/**
 * Strefy przejścia: standardowa i minimalna (z marginesem bezpieczeństwa).
 * @param {{bottomMm:number,topMm:number}} body korpus z getTransitionBody
 * @param {{dolStd:number,goraStd:number,dolMin:number,goraMin:number}} reserves zapasy (mm)
 * @param {number} [marginMm] margines (domyślnie 15)
 */
function getTransitionZone(body, reserves, marginMm) {
    var m = marginMm == null ? TRANSITION_SAFETY_MARGIN_MM : marginMm;
    return {
        std: {
            bottomMm: body.bottomMm - reserves.dolStd - m,
            topMm: body.topMm + reserves.goraStd + m
        },
        min: {
            bottomMm: body.bottomMm - reserves.dolMin - m,
            topMm: body.topMm + reserves.goraMin + m
        }
    };
}

/**
 * Czy segment w całości zawiera korpus rury (reguła OT).
 * Granice domknięte: korpus równo na granicach segmentu → true.
 */
function segmentContainsBody(seg, body) {
    if (!seg || !body) return false;
    return seg.start <= body.bottomMm && seg.end >= body.topMm;
}

/**
 * Czy joint (pozycja mm) leży w strefie (reguła jointów).
 */
function jointInZone(jointMm, zone) {
    if (!zone) return false;
    return jointMm >= zone.bottomMm && jointMm <= zone.topMm;
}

/* ===== Rejestracja globali ===== */
if (typeof window !== 'undefined') {
    window.getTransitionDn = getTransitionDn;
    window.getTransitionBody = getTransitionBody;
    window.parseTransitionReserve = parseTransitionReserve;
    window.getTransitionZone = getTransitionZone;
    window.segmentContainsBody = segmentContainsBody;
    window.jointInZone = jointInZone;
    window.TRANSITION_SAFETY_MARGIN_MM = TRANSITION_SAFETY_MARGIN_MM;
    window.TRANSITION_RESERVE_STD_MM = TRANSITION_RESERVE_STD_MM;
    window.TRANSITION_RESERVE_MIN_MM = TRANSITION_RESERVE_MIN_MM;
    window.TRANSITION_LEGACY_DN_MM = TRANSITION_LEGACY_DN_MM;
}
