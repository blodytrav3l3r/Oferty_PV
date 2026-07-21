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
    wlaz: '#1e293b',
    plyta_din: '#be185d',
    plyta_najazdowa: '#9d174d',
    plyta_zamykajaca: '#7c3aed',
    pierscien_odciazajacy: '#0891b2',
    konus: '#d97706',
    avr: '#475569',
    krag: '#4338ca',
    krag_ot: '#4338ca',
    osadnik: '#a16207',
    dennica: '#047857',
    styczna: '#059669',
    plyta_redukcyjna: '#6d28d9',
    fallback: '#334155',

    // Component strokes
    wlaz_stroke: '#334155',
    plyta_din_stroke: '#ec4899',
    plyta_najazdowa_stroke: '#f472b6',
    plyta_zamykajaca_stroke: '#a78bfa',
    pierscien_odciazajacy_stroke: '#22d3ee',
    konus_stroke: '#fbbf24',
    avr_stroke: '#94a3b8',
    krag_stroke: '#818cf8',
    krag_ot_stroke: '#c084fc',
    osadnik_stroke: '#fbbf24',
    dennica_stroke: '#34d399',
    styczna_stroke: '#34d399',
    plyta_redukcyjna_stroke: '#a78bfa',
    fallback_stroke: '#64748b',

    // Misc drawing colors
    dimLine: '#94a3b8',
    dimText: '#cbd5e1',
    dnLabel: '#64748b',
    emptyState: '#475569',
    labelWhite: '#ffffff',
    precoDash: '#ef4444',
    fillHeight: '#f59e0b',
    transitionCircle: 'rgba(15,23,42,0.7)',
    textShadow: 'rgba(0,0,0,0.8)',
    transitionActive: '#38bdf8',
    transitionStroke: '#0ea5e9',
    transitionBack: 'rgba(71,85,105,0.4)',
    transitionBackStroke: 'rgba(100,116,139,0.5)'
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
