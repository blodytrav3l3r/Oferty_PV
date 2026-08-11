// @ts-check
/**
 * diagramTheme.js — Stałe kolorów i motywów dla diagramu studni (SVG).
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 *
 * Zawiera:
 *   SVG_COLORS      — centralna mapa kolorów SVG
 *   COMPONENT_THEME — mapa kolorów i etykiet dla typów komponentów studni
 *
 * Zależności: brak (czyste stałe)
 * Ładowany jako pierwszy z grupy diagram-*.
 */

/** Centralna mapa kolorów SVG */
const SVG_COLORS = {
    // Component fills
    wlaz: 'var(--slate-800)',
    plyta_din: 'var(--cmp-plyta-din)',
    plyta_najazdowa: 'var(--cmp-plyta-najazdowa)',
    plyta_zamykajaca: 'var(--cmp-plyta-zamykajaca)',
    pierscien_odciazajacy: 'var(--cmp-pierscien)',
    konus: 'var(--cmp-konus)',
    avr: 'var(--cmp-avr)',
    krag: 'var(--cmp-krag)',
    krag_ot: 'var(--cmp-krag)',
    osadnik: 'var(--cmp-osadnik)',
    dennica: 'var(--cmp-dennica)',
    styczna: 'var(--cmp-styczna)',
    plyta_redukcyjna: 'var(--cmp-plyta-redukcyjna)',
    fallback: 'var(--slate-700)',

    // Component strokes
    wlaz_stroke: 'var(--slate-700)',
    plyta_din_stroke: 'var(--pink)',
    plyta_najazdowa_stroke: 'var(--pink-hover)',
    plyta_zamykajaca_stroke: 'var(--accent2-hover)',
    pierscien_odciazajacy_stroke: 'var(--cyan)',
    konus_stroke: 'var(--warn-hover)',
    avr_stroke: 'var(--slate-400)',
    krag_stroke: 'var(--accent-hover)',
    krag_ot_stroke: 'var(--purple-alt)',
    osadnik_stroke: 'var(--warn-hover)',
    dennica_stroke: 'var(--success-hover)',
    styczna_stroke: 'var(--success-hover)',
    plyta_redukcyjna_stroke: 'var(--accent2-hover)',
    fallback_stroke: 'var(--slate-500)',

    // Misc drawing colors
    dimLine: 'var(--slate-400)',
    dimText: 'var(--slate-300)',
    dnLabel: 'var(--slate-500)',
    emptyState: 'var(--cmp-avr)',
    labelWhite: 'var(--white)',
    precoDash: 'var(--danger)',
    fillHeight: 'var(--warn)',
    transitionCircle: 'rgba(var(--slate-950-rgb), 0.7)',
    textShadow: 'rgba(var(--black-rgb), 0.8)',
    transitionActive: 'var(--blue-alt)',
    transitionStroke: 'var(--sky-500)',
    transitionBack: 'rgba(var(--slate-600-rgb), 0.4)',
    transitionBackStroke: 'rgba(var(--slate-500-rgb), 0.5)'
};

/** Mapa kolorów i etykiet dla typów komponentów studni */
const COMPONENT_THEME = {
    wlaz: { fill: SVG_COLORS.wlaz, stroke: SVG_COLORS.wlaz_stroke, label: 'Właz' },
    plyta_din: {
        fill: SVG_COLORS.plyta_din,
        stroke: SVG_COLORS.plyta_din_stroke,
        label: 'Płyta DIN'
    },
    plyta_najazdowa: {
        fill: SVG_COLORS.plyta_najazdowa,
        stroke: SVG_COLORS.plyta_najazdowa_stroke,
        label: 'Pł. Odci.'
    },
    plyta_zamykajaca: {
        fill: SVG_COLORS.plyta_zamykajaca,
        stroke: SVG_COLORS.plyta_zamykajaca_stroke,
        label: 'Pł. Odci.'
    },
    pierscien_odciazajacy: {
        fill: SVG_COLORS.pierscien_odciazajacy,
        stroke: SVG_COLORS.pierscien_odciazajacy_stroke,
        label: 'PO'
    },
    konus: { fill: SVG_COLORS.konus, stroke: SVG_COLORS.konus_stroke, label: 'Konus' },
    avr: { fill: SVG_COLORS.avr, stroke: SVG_COLORS.avr_stroke, label: 'AVR' },
    krag: { fill: SVG_COLORS.krag, stroke: SVG_COLORS.krag_stroke, label: 'Krąg' },
    krag_ot: {
        fill: SVG_COLORS.krag_ot,
        stroke: SVG_COLORS.krag_ot_stroke,
        label: 'Krąg wiercony'
    },
    osadnik: { fill: SVG_COLORS.osadnik, stroke: SVG_COLORS.osadnik_stroke, label: 'Osadnik' },
    dennica: { fill: SVG_COLORS.dennica, stroke: SVG_COLORS.dennica_stroke, label: 'Dennica' },
    styczna: { fill: SVG_COLORS.styczna, stroke: SVG_COLORS.styczna_stroke, label: 'Styczna' },
    plyta_redukcyjna: {
        fill: SVG_COLORS.plyta_redukcyjna,
        stroke: SVG_COLORS.plyta_redukcyjna_stroke,
        label: 'Płyta red.'
    }
};

window.COMPONENT_THEME = COMPONENT_THEME;
