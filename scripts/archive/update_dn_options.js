const fs = require('fs');

let content = fs.readFileSync('public/js/studnie/orderManager.js', 'utf-8');

// 1. Add updatePrzejscieDnOptions function before buildPrzejscieRowHTML
const updateDnOptionsFunc = `
/** Aktualizuje opcje DN w zależności od wybranego rodzaju przejścia */
function updatePrzejscieDnOptions(prefix, category) {
    const dns = new Set();
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach(p => {
            if (p.componentType === 'przejscie' && p.active !== 0 && (!category || category === 'Inne' || p.category === category)) {
                if (typeof p.dn === 'string' && p.dn.includes('/')) {
                    dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                } else if (p.dn) {
                    dns.add(parseFloat(p.dn) || 0);
                }
            }
        });
    }
    const dnOptions = Array.from(dns).filter(d => !isNaN(d) && d > 0).sort((a,b)=>a-b);
    
    ['dnod', 'dndo'].forEach(type => {
        const select = document.getElementById(\`\${prefix}-\${type}-select\`);
        const input = document.getElementById(\`\${prefix}-\${type}\`);
        if (!select || !input) return;
        
        const currVal = input.value;
        const isCurrInne = currVal && !dnOptions.includes(parseFloat(currVal));
        
        let html = \`<option value="" \${!currVal ? 'selected' : ''}>—</option>\`;
        html += dnOptions.map(d => \`<option value="\${d}" \${parseFloat(currVal) === d ? 'selected' : ''}>\${d}</option>\`).join('');
        html += \`<option value="Inne" \${isCurrInne ? 'selected' : ''}>Inne</option>\`;
        
        select.innerHTML = html;
        if (isCurrInne) {
            select.value = 'Inne';
            input.style.display = 'block';
        } else if (currVal && dnOptions.includes(parseFloat(currVal))) {
            select.value = parseFloat(currVal);
            input.style.display = 'none';
        } else {
            select.value = '';
            input.value = '';
            input.style.display = 'none';
        }
    });
}

function buildPrzejscieRowHTML(row, idx, source) {`;

content = content.replace(/function buildPrzejscieRowHTML\(row, idx, source\) \{/, updateDnOptionsFunc);

// 2. Update buildPrzejscieRowHTML to only get DNs for the selected category, and add onchange hook
const buildPrzejscieRegex = /const cats = new Set\(\);[\s\S]*?const dnOptions = Array\.from\(dns\)\.filter\(d => !isNaN\(d\) && d > 0\)\.sort\(\(a,b\)=>a-b\);/;

const newBuildLogic = `const cats = new Set();
    const dns = new Set();
    if (typeof studnieProducts !== 'undefined') {
        studnieProducts.forEach(p => {
            if (p.componentType === 'przejscie' && p.active !== 0) {
                if (p.category) cats.add(p.category);
                if (!row.rodzaj || row.rodzaj === 'Inne' || p.category === row.rodzaj) {
                    if (typeof p.dn === 'string' && p.dn.includes('/')) {
                        dns.add(parseFloat(p.dn.split('/')[1]) || parseFloat(p.dn.split('/')[0]) || 0);
                    } else if (p.dn) {
                        dns.add(parseFloat(p.dn) || 0);
                    }
                }
            }
        });
    }
    
    const catOptions = Array.from(cats).sort();
    const dnOptions = Array.from(dns).filter(d => !isNaN(d) && d > 0).sort((a,b)=>a-b);`;

content = content.replace(buildPrzejscieRegex, newBuildLogic);

// 3. Add updatePrzejscieDnOptions call to rodzaj select onchange
const oldRodzajOnchange = `onchange="\${warnScript} document.getElementById('\${prefix}-rodzaj').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-rodzaj').value = this.value;"`;
const newRodzajOnchange = `onchange="\${warnScript} document.getElementById('\${prefix}-rodzaj').style.display = this.value === 'Inne' ? 'block' : 'none'; if(this.value !== 'Inne') document.getElementById('\${prefix}-rodzaj').value = this.value; updatePrzejscieDnOptions('\${prefix}', this.value);"`;

content = content.replace(oldRodzajOnchange, newRodzajOnchange);

fs.writeFileSync('public/js/studnie/orderManager.js', content);
