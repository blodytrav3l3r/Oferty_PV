// @ts-check
/* ===== UI: RENDEROWANIE PARAMETRÓW DLA POSZCZEGÓLNYCH STUDNI ===== */
/* Wyodrebnione z wellUI.js - fazy refaktoryzacji */

const WELL_PARAM_DEFS = [
    {
        key: 'nadbudowa',
        label: 'Nadbudowa',
        options: [
            ['betonowa', 'Beton'],
            ['zelbetowa', 'Żelbet']
        ]
    },
    {
        key: 'dennicaMaterial',
        label: 'Dennica',
        options: [
            ['betonowa', 'Beton'],
            ['zelbetowa', 'Żelbet']
        ]
    },
    {
        key: 'wkladkaDennica',
        label: 'Wkładka PEHD (Dennica)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'wkladkaNadbudowa',
        label: 'Wkładka PEHD (Nadb.)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'wkladkaZwienczenie',
        label: 'Wkładka PEHD (Zwieńcz.)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'klasaBetonu',
        label: 'Klasa betonu',
        options: [
            ['C40/50', 'C40/50'],
            ['C40/50(HSR)', 'C40/50 HSR'],
            ['C45/55', 'C45/55'],
            ['C45/55(HSR)', 'C45/55 HSR'],
            ['C70/85', 'C70/85'],
            ['C70/80(HSR)', 'C70/80 HSR']
        ]
    },
    {
        key: 'agresjaChemiczna',
        label: 'Agresja chem.',
        options: [
            ['XA1', 'XA1'],
            ['XA2', 'XA2'],
            ['XA3', 'XA3']
        ]
    },
    {
        key: 'agresjaMrozowa',
        label: 'Agresja mroz.',
        options: [
            ['XF1', 'XF1'],
            ['XF2', 'XF2'],
            ['XF3', 'XF3']
        ]
    },
    {
        key: 'klasaNosnosci_korpus',
        label: 'Klasa nośności Den.+Nadb.',
        options: [
            ['D400', 'D400'],
            ['E600', 'E600'],
            ['F900', 'F900']
        ]
    },
    {
        key: 'klasaNosnosci_zwienczenie',
        label: 'Klasa nośności Zwieńcz.',
        options: [
            ['D400', 'D400'],
            ['E600', 'E600'],
            ['F900', 'F900']
        ]
    },
    {
        key: 'malowanieW',
        label: 'Malowanie wew.',
        options: [
            ['brak', 'Brak'],
            ['kineta', 'Kineta'],
            ['kineta_dennica', 'Kineta+denn.'],
            ['cale', 'Całość']
        ]
    },
    {
        key: 'malowanieZ',
        label: 'Malowanie zew.',
        options: [
            ['brak', 'Brak'],
            ['zewnatrz', 'Zewnątrz']
        ]
    },
    {
        key: 'kineta',
        label: 'Kineta',
        options: [
            ['brak', 'Brak'],
            ['beton', 'Beton'],
            ['beton_gfk', 'Beton z GFK'],
            ['klinkier', 'Klinkier'],
            ['preco', 'Preco'],
            ['precotop', 'PrecoTop'],
            ['unolith', 'UnoLith'],
            ['predl', 'Predl'],
            ['kamionka', 'Kamionka']
        ]
    },
    {
        key: 'precoFullHeight',
        label: 'Wkładka cała wys.',
        options: [
            ['tak', 'Tak'],
            ['nie', 'Nie']
        ]
    },
    {
        key: 'spocznik',
        label: 'Spocznik',
        options: [
            ['brak', 'Brak'],
            ['beton', 'Beton'],
            ['beton_gfk', 'Beton z GFK'],
            ['klinkier', 'Klinkier'],
            ['preco', 'Preco'],
            ['precotop', 'Preco Top'],
            ['unolith', 'UnoLith'],
            ['predl', 'Predl'],
            ['kamionka', 'Kamionka']
        ]
    },
    {
        key: 'redukcjaKinety',
        label: 'Red. kinety',
        options: [
            ['tak', 'Tak'],
            ['nie', 'Nie']
        ]
    },
    {
        key: 'stopnie',
        label: 'Stopnie',
        options: [
            ['brak', 'Brak'],
            ['drabinka', 'Drabinka'],
            ['nierdzewna', 'Nierdzewna']
        ]
    },
    {
        key: 'spocznikH',
        label: 'Spocznik wys.',
        options: [
            ['1/2', '1/2'],
            ['2/3', '2/3'],
            ['3/4', '3/4'],
            ['1/1', '1/1'],
            ['brak', 'Brak']
        ]
    },
    {
        key: 'usytuowanie',
        label: 'Usytuowanie',
        options: [
            ['linia_dolna', 'Linia dolna'],
            ['linia_gorna', 'Linia górna'],
            ['w_osi', 'W osi'],
            ['patrz_uwagi', 'Patrz uwagi']
        ]
    },
    {
        key: 'uszczelka',
        label: 'Uszczelka',
        options: [
            ['brak', 'Brak'],
            ['GSG', 'GSG'],
            ['SDV', 'SDV'],
            ['SDV PO', 'SDV PO'],
            ['NBR', 'NBR']
        ]
    },
    {
        key: 'magazyn',
        label: 'Magazyn',
        options: [
            ['Kluczbork', 'Kluczbork'],
            ['Włocławek', 'Włocławek']
        ]
    },
    {
        key: 'wkladkaOsadnikPreco',
        label: 'Wkładka PRECO osadnik',
        options: [
            ['brak', 'Brak'],
            ['tak', 'Tak']
        ]
    }
];

function renderWellParams() {
    const container = document.getElementById('well-params-container');
    if (!container) return;
    const well = getCurrentWell();
    if (!well) {
        container.innerHTML =
            '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Dodaj studnię aby edytować parametry</div>';
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:0.55rem;">`;

    const isOsadnik = typeof isSettlingWell === 'function' && isSettlingWell(well);

    WELL_PARAM_DEFS.forEach((def) => {
        if (def.key === 'precoFullHeight') {
            if (well.kineta !== 'preco' && well.kineta !== 'precotop') {
                return;
            }
        }
        // Wkładka PRECO osadnik — wyszarzona jeśli to nie osadnik
        let isGreyedOut = false;
        if (def.key === 'wkladkaOsadnikPreco' && !isOsadnik) {
            isGreyedOut = true;
        }
        // Gdy kineta = preco/precotop → spocznikH zablokowany na 1/1
        if (def.key === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop')) {
            isGreyedOut = true;
        }
        // Gdy wkładka osadnikowa aktywna — kineta i spocznik zablokowane na 'brak'
        if (well.wkladkaOsadnikPreco === 'tak') {
            if (def.key === 'kineta' || def.key === 'spocznik') {
                return; // ukryj — wymuszamy 'brak'
            }
        }
        const currentVal = well[def.key] || '';

        html += `<div style="display:flex; align-items:center; gap:0.2rem; ${isGreyedOut ? 'opacity: 0.5;' : ''}">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">${def.label}</span>`;
        html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:0.35rem; flex:1;">`;
        def.options.forEach(([val, lbl]) => {
            const isActive = val === currentVal;
            html += `<button onclick="updateWellParam('${def.key}','${val}')" style="
                height: 34px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:${isActive ? '800' : '600'};
                border:1px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
                background:${isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'};
                color:${isActive ? '#a5b4fc' : 'var(--text-secondary)'};
                transition:all 0.15s ease;
                display:flex; align-items:center; justify-content:center;
                ${isActive ? 'box-shadow:0 0 10px rgba(99,102,241,0.2);' : ''}
            " onmouseenter="if(!${isActive}){this.style.borderColor='rgba(99,102,241,0.3)';this.style.background='rgba(255,255,255,0.08)'}"
               onmouseleave="if(!${isActive}){this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.04)'}"
            >${lbl}</button>`;
        });
        html += `</div></div>`;

        // Pola dodatkowe renderowane bezpośrednio pod odpowiadającym kafelkiem
        if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Nazwa p. wew.</span>`;
            html += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" onclick="this.select()" onchange="updateWellParam('powlokaNameW', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Koszt p. wew.</span>`;
            html += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onclick="this.select()" onchange="updateWellParam('malowanieWewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
        }

        if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Nazwa p. zew.</span>`;
            html += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" onclick="this.select()" onchange="updateWellParam('powlokaNameZ', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Koszt p. zew.</span>`;
            html += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onclick="this.select()" onchange="updateWellParam('malowanieZewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
        }

        if (def.key === 'wkladkaOsadnikPreco' && well.wkladkaOsadnikPreco === 'tak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem; ${isGreyedOut ? 'opacity: 0.5;' : ''}">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Wys. wkładki osadnik</span>`;
            html += `<div style="display:flex; align-items:center; gap:0.5rem;">`;
            html += `<input type="number" value="${well.wkladkaOsadnikH || ''}" onclick="this.select()" onchange="updateWellParam('wkladkaOsadnikH', parseFloat(this.value)||0)" placeholder="Wys. w mm" style="width:120px; height:34px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `<span style="font-size:0.8rem; color:var(--text-muted);">mm</span>`;
            html += `</div></div>`;
        }
    });

    html += `</div>`;
    html += `<div style="display:flex; gap:0.4rem; margin-top:1rem; justify-content:flex-end;">`;
    html += `<button class="btn btn-secondary btn-sm" onclick="resetWellParamsToDefaults()" style="font-size:0.8rem; padding:0.4rem 0.8rem; border-radius:8px;"><i data-lucide="refresh-cw" aria-hidden="true"></i> Przywróć domyślne (Krok 2)</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

window.renderWellParams = renderWellParams;
