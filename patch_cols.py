import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    code = f.read()

target1 = '''    // Quick tiles for kat stopni
    const katOptions = ['90', '135', '180', '270'];

    // Map well params to display labels
    const kinetaOptions = [
        ['brak', 'Brak'], ['beton', 'Beton'], ['beton_gfk', 'Beton GFK'],
        ['klinkier', 'Klinkier'], ['preco', 'Preco'], ['precotop', 'PrecoTop'], ['unolith', 'UnoLith']
    ];'''

replacement1 = '''    // Quick tiles for kat stopni
    const katOptions = ['90', '135', '180', '270'];
    
    const dinOptions = [
        ['AT/2009-03-1733', 'AT/2009-03-1733'],
        ['Brak', 'Brak']
    ];
    
    const spocznikMatOptions = [
        ['brak', 'Brak'], ['beton_gfk', 'Beton z GFK'], ['klinkier', 'Klinkier'],
        ['preco', 'Preco'], ['precotop', 'Preco Top'], ['unolith', 'UnoLith'],
        ['predl', 'Predl'], ['kamionka', 'Kamionka']
    ];
    
    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? '';

    // Map well params to display labels
    const kinetaOptions = [
        ['brak', 'Brak'], ['beton', 'Beton'], ['beton_gfk', 'Beton GFK'],
        ['klinkier', 'Klinkier'], ['preco', 'Preco'], ['precotop', 'PrecoTop'], ['unolith', 'UnoLith']
    ];'''

code = code.replace(target1, replacement1)


target2 = '''    <!-- Parametry studni -->
    <div class="card card-compact" style="margin-bottom:0.6rem;">
        <div class="card-title-sm">⚙️ Parametry studni</div>
        
        <div class="form-group-sm">
            <label class="form-label-sm">Redukcja kinety</label>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                ${redKinetyOptions.map(([v, l]) =>
                    `<button type="button" class="param-tile ${v === redKinetyVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                ).join('')}
            </div>
            <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
        </div>

        <div class="form-group-sm" style="margin-top:0.4rem;">
            <label class="form-label-sm">Wysokość spocznika</label>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                ${spocznikOptions.map(([v, l]) =>
                    `<button type="button" class="param-tile ${v === spocznikHVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                ).join('')}
            </div>
            <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
        </div>

        <div class="form-row form-row-2 form-row-compact" style="margin-top:0.4rem;">
            <div class="form-group-sm">
                <label class="form-label-sm">Studnia wd. DIN</label>
                <input type="text" id="zl-din" class="form-input form-input-sm" value="${din}" readonly style="color:#818cf8; font-weight:700;">
            </div>
        </div>
        
        <div class="form-group-sm" style="margin-top:0.4rem;">
            <label class="form-label-sm">Rodzaj stopni</label>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                ${stopnieOptions.map(([v, l]) =>
                    `<button type="button" class="param-tile ${v === stopnieVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                ).join('')}
            </div>
            <input type="hidden" id="zl-rodzaj-stopni" value="${stopnieVal}">
        </div>
        <div id="zl-stopnie-inne-wrap" style="display:${stopnieVal === 'inne' ? 'block' : 'none'}; margin-top:0.4rem;">
            <div class="form-group-sm">
                <label class="form-label-sm">Inne (opis)</label>
                <input type="text" id="zl-stopnie-inne" class="form-input form-input-sm" value="${existing?.stopnieInne || ''}" placeholder="Opis...">
            </div>
        </div>

        <div class="form-row form-row-2 form-row-compact" style="margin-top:0.4rem;">
            <div class="form-group-sm">
                <label class="form-label-sm">Ustalanie kąta stopni</label>
                <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                    <input type="number" id="zl-kat-stopni" class="form-input form-input-sm" value="${katStopni}" placeholder="np. 90" min="0" max="360" oninput="onZleceniaKatChange()" style="width:70px; margin-right:5px;">
                    ${katOptions.map(v =>
                        `<button type="button" class="param-tile" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                    ).join('')}
                </div>
            </div>
            <div class="form-group-sm">
                <label class="form-label-sm">Wykonanie</label>
                <input type="text" id="zl-wykonanie" class="form-input form-input-sm" value="${wykonanie ? wykonanie + '°' : ''}" readonly style="color:#818cf8; font-weight:700;">
            </div>
        </div>

        <div class="form-group-sm" style="margin-top:0.4rem;">
            <label class="form-label-sm">Usytuowanie</label>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                ${usytOptions.map(([v, l]) =>
                    `<button type="button" class="param-tile ${v === usytuowanieVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                ).join('')}
            </div>
            <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
        </div>

        <div class="form-group-sm" style="margin-top:0.4rem;">
            <label class="form-label-sm">Kineta</label>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                ${kinetaOptions.map(([v, l]) =>
                    `<button type="button" class="param-tile ${v === kinetaVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                ).join('')}
            </div>
            <input type="hidden" id="zl-kineta" value="${kinetaVal}">
        </div>

        <div class="form-group-sm" style="margin-top:0.4rem;">
            <label class="form-label-sm">Klasa betonu</label>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                ${klasaBetonuOptions.map(([v, l]) =>
                    `<button type="button" class="param-tile ${v === klasaBetonuVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                ).join('')}
            </div>
            <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
        </div>
    </div>'''


replacement2 = '''    <!-- Parametry studni w dwóch kolumnach -->
    <div class="card card-compact" style="margin-bottom:0.6rem;">
        <div class="card-title-sm">⚙️ Parametry studni</div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; align-items:start;">
            <!-- Kolumna 1 -->
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                <div class="form-group-sm">
                    <label class="form-label-sm">Redukcja kinety</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${redKinetyOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === redKinetyVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Studnia wd. DIN</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        <input type="text" id="zl-din" class="form-input form-input-sm" value="${dinVal}" style="width:140px; margin-right:5px; color:#818cf8; font-weight:700;">
                        ${dinOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="document.getElementById('zl-din').value='${v}'">${l}</button>`
                        ).join('')}
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Rodzaj stopni</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${stopnieOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === stopnieVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-stopni" value="${stopnieVal}">
                </div>

                <div id="zl-stopnie-inne-wrap" style="display:${stopnieVal === 'inne' ? 'block' : 'none'};">
                    <div class="form-group-sm">
                        <label class="form-label-sm">Inne (opis)</label>
                        <input type="text" id="zl-stopnie-inne" class="form-input form-input-sm" value="${existing?.stopnieInne || ''}" placeholder="Opis...">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Ustalanie kąta stopni / Wykonanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem; align-items:center;" class="zl-param-group">
                        <input type="number" id="zl-kat-stopni" class="form-input form-input-sm" value="${katStopni}" placeholder="np. 90" min="0" max="360" onfocus="this.value=''" oninput="onZleceniaKatChange()" style="width:70px;">
                        <span style="font-size:1.2rem; color:var(--text-muted); margin: 0 4px;">→</span>
                        <input type="text" id="zl-wykonanie" class="form-input form-input-sm" value="${wykonanie ? wykonanie + '°' : ''}" readonly style="width:70px; color:#818cf8; font-weight:700; margin-right:5px; pointer-events:none;">
                        ${katOptions.map(v =>
                            `<button type="button" class="param-tile" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                        ).join('')}
                    </div>
                </div>
            </div>

            <!-- Kolumna 2 -->
            <div style="display:flex; flex-direction:column; gap:0.8rem;">
                <div class="form-group-sm">
                    <label class="form-label-sm">Wysokość spocznika</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${spocznikOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === spocznikHVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Usytuowanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${usytOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === usytuowanieVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Kineta</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${kinetaOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === kinetaVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-kineta" value="${kinetaVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Spocznik</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${spocznikMatOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === spocznikMatVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-spocznik', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik" value="${spocznikMatVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Klasa betonu</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${klasaBetonuOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === klasaBetonuVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
                </div>
            </div>
        </div>
    </div>'''

code = code.replace(target2, replacement2)

target3 = '''        // Params
        redukcjaKinety: document.getElementById('zl-red-kinety')?.value || '',
        spocznikH: document.getElementById('zl-spocznik-h')?.value || '',
        din: getStudniaDIN(well.dn),
        rodzajStopni: document.getElementById('zl-rodzaj-stopni')?.value || '',
        stopnieInne: document.getElementById('zl-stopnie-inne')?.value || '',
        katStopni: document.getElementById('zl-kat-stopni')?.value || '',
        wykonanie: document.getElementById('zl-wykonanie')?.value || '',
        usytuowanie: document.getElementById('zl-usytuowanie')?.value || '',
        kineta: document.getElementById('zl-kineta')?.value || '',
        spocznik: document.getElementById('zl-spocznik-h')?.value || '',
        klasaBetonu: document.getElementById('zl-klasa-betonu')?.value || '','''

replacement3 = '''        // Params
        redukcjaKinety: document.getElementById('zl-red-kinety')?.value || '',
        spocznikH: document.getElementById('zl-spocznik-h')?.value || '',
        din: document.getElementById('zl-din')?.value || getStudniaDIN(well.dn),
        rodzajStopni: document.getElementById('zl-rodzaj-stopni')?.value || '',
        stopnieInne: document.getElementById('zl-stopnie-inne')?.value || '',
        katStopni: document.getElementById('zl-kat-stopni')?.value || '',
        wykonanie: document.getElementById('zl-wykonanie')?.value || '',
        usytuowanie: document.getElementById('zl-usytuowanie')?.value || '',
        kineta: document.getElementById('zl-kineta')?.value || '',
        spocznik: document.getElementById('zl-spocznik')?.value || '',
        klasaBetonu: document.getElementById('zl-klasa-betonu')?.value || '','''

code = code.replace(target3, replacement3)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Tiles layout successfully patched into 2 columns!")
