import re

with open('public/js/app_studnie.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''    // Get przejscia for this well
    const przejsciaHtml = (well.przejscia && well.przejscia.length > 0)
        ? well.przejscia.map((prz, i) => {
            const przProd = studnieProducts.find(pr => pr.id === prz.productId);
            const przName = przProd ? przProd.name : 'Przejście';
            return `<div style="display:flex; justify-content:space-between; padding:0.3rem 0.4rem; border-bottom:1px solid var(--border-glass);">
                <span>${i + 1}. ${przName}</span>
                <span style="color:var(--text-muted);">${prz.rzedna || ''} ${prz.angle ? prz.angle + '°' : ''}</span>
            </div>`;
        }).join('')
        : '<div style="padding:0.5rem; text-align:center; color:var(--text-muted);">Brak przejść</div>';'''


replacement = '''    // Compute which element gets which transition to filter for this `elementIndex`
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const configMap = [];
    let currY = 0;
    let dennicaProcessedCount = 0;
    for (let j = well.config.length - 1; j >= 0; j--) {
        const cItem = well.config[j];
        const p = studnieProducts.find(pr => pr.id === cItem.productId);
        if (!p) continue;
        let h = 0;
        if (p.componentType === 'dennica') {
            for (let q = 0; q < cItem.quantity; q++) {
                dennicaProcessedCount++;
                h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
            }
        } else {
            h = (p.height || 0) * cItem.quantity;
        }
        configMap.push({ index: j, name: p.name, start: currY, end: currY + h });
        currY += h;
    }

    const assignedPrzejscia = (well.przejscia || []).filter(item => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        let assignedIndex = -1;
        for (let cm of configMap) {
            if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
                assignedIndex = cm.index;
                break;
            }
        }
        if (assignedIndex === -1 && configMap.length > 0) {
            assignedIndex = (mmFromBottom < 0) ? configMap[0].index : configMap[configMap.length - 1].index;
        }
        return assignedIndex === elementIndex;
    });

    const przejsciaHtml = assignedPrzejscia.length > 0
        ? assignedPrzejscia.map((item, i) => {
            const przProd = studnieProducts.find(pr => pr.id === item.productId);
            const przName = przProd ? przProd.category : 'Nieznane';
            const dn = przProd ? przProd.dn : '—';
            
            if (!item.flowType) {
                 item.flowType = (i === 0 && (item.angle === 0 || item.angle === '0')) ? 'wylot' : 'wlot';
            }
            const flowLabel = item.flowType === 'wylot' ? 'Wylot' : 'Wlot';
            const flowBg = item.flowType === 'wylot' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';
            const flowColor = item.flowType === 'wylot' ? '#fca5a5' : '#93c5fd';
            const flowBorder = item.flowType === 'wylot' ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)';
            const flowIcon = item.flowType === 'wylot' ? '📤' : '📥';
            const angleColor = (item.angle === 0 || item.angle === '0') ? '#6366f1' : '#818cf8';

            return `<div style="background:linear-gradient(90deg, #1e293b 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:4px solid ${flowBorder}; border-radius:8px; padding:0.4rem; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                <div style="background:${flowBg}; color:${flowColor}; border:1px solid ${flowBorder}; border-radius:6px; padding:0.25rem 0.4rem; display:flex; flex-direction:column; align-items:center; min-width:50px;">
                    <span style="font-size:1.0rem; margin-bottom:0.1rem;">${flowIcon}</span>
                    <span style="font-size:0.55rem; font-weight:800; text-transform:uppercase;">${flowLabel}</span>
                </div>
                <div style="flex:1; display:flex; justify-content:space-between; align-items:center; gap:0.8rem;">
                    <div style="display:flex; flex-direction:column; gap:0.15rem;">
                       <div style="display:flex; align-items:center; gap:0.5rem;">
                         <span style="font-size:0.85rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 1px rgba(0,0,0,0.5);">${przName}</span>
                         <span style="font-size:0.85rem; color:#a78bfa; font-weight:800;">${typeof dn === 'string' && dn.includes('/') ? dn : 'DN ' + dn}</span>
                       </div>
                       ${item.notes ? `<div style="font-size:0.6rem; color:#94a3b8; font-style:italic;">📝 ${item.notes}</div>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:1.2rem; margin-right: 0.5rem;">
                        <div style="text-align:center; min-width:65px;">
                            <div style="font-size:0.55rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Rzędna</div>
                            <div style="font-size:0.95rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 1px rgba(0,0,0,0.5);">${item.rzednaWlaczenia || '—'}</div>
                        </div>
                        <div style="text-align:center; min-width:60px;">
                            <div style="font-size:0.55rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Kąt</div>
                            <div style="font-size:0.95rem; font-weight:800; color:${angleColor}; text-shadow:0 1px 1px rgba(0,0,0,0.5);">${item.angle}°</div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('')
        : '<div style="padding:1.4rem; text-align:center; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; font-size:0.75rem;">Brak przejść szczelnych<br>w tym elemencie.</div>';'''

code = code.replace(target, replacement)

# We also should probably strip `max-height: 200px` from the `Przejścia` card so it can comfortably show elements and remove `background:#0d1520` padding and stuff.
target_card = '''        <div class="card card-compact">
            <div class="card-title-sm">🔗 Przejścia</div>
            <div style="background:#0d1520; border:1px solid var(--border-glass); border-radius:var(--radius-sm); max-height:200px; overflow-y:auto; font-size:0.72rem; color:var(--text-secondary);">
                ${przejsciaHtml}
            </div>
        </div>'''

replacement_card = '''        <div class="card card-compact">
            <div class="card-title-sm" style="display:flex; justify-content:space-between;">
                <span>🔗 Przejścia </span>
                <span style="color:var(--text-muted); font-size:0.7rem;">(${assignedPrzejscia.length})</span>
            </div>
            <div style="border-radius:var(--radius-sm); font-size:0.72rem; color:var(--text-secondary); height:-webkit-fill-available;">
                ${przejsciaHtml}
            </div>
        </div>'''

code = code.replace(target_card, replacement_card)

with open('public/js/app_studnie.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Przejscia cloned in Zlecenia!")
