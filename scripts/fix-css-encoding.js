#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const fixes = {
    'kafelk\uFFFDw': 'kafelk\u00F3w',
    'g\uFFFDrnego': 'g\u00F3rnego',
    'produkt\uFFFDw': 'produkt\u00F3w',
    'autora \uFFFD renderowane': 'autora \u2013 renderowane',
    'filtr\uFFFDw': 'filtr\u00F3w',
    'shimmmera \uFFFDadowania': 'shimmera \u0142adowania',
    'nag\uFFFD\uFFFDwka': 'nag\u0142\u00F3wka',
    'Nag\uFFFD\uFFFDwek': 'Nag\u0142\u00F3wek',
    'wyodr\uFFFDbnione': 'wyodr\u0119bnione',
    'styl\uFFFDw': 'styl\u00F3w',
    'typ\uFFFDw': 'typ\u00F3w',
    'Zak\uFFFDadki': 'Zak\u0142adki',
    'wykorzystuj\uFFFDce': 'wykorzystuj\u0105ce',
    'Og\uFFFDlne': 'Og\u00F3lne',
    'wysoko\uFFFDci': 'wysoko\u015Bci',
    'przycisk\uFFFDw': 'przycisk\u00F3w',
    'STAN \uFFFDADOWANIA': 'STAN \u0141ADOWANIA',
    'checkbox\uFFFDw': 'checkbox\u00F3w',
    'zam\uFFFDwienia': 'zam\u00F3wienia',
    'sprzeda\uFFFDy': 'sprzeda\u017Cy'
};

function fixFile(filepath) {
    const buf = fs.readFileSync(filepath);
    let text = buf.toString('utf-8');
    let count = 0;
    for (const [corrupted, fixed] of Object.entries(fixes)) {
        const escaped = corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        const matches = text.match(regex);
        if (matches) {
            count += matches.length;
            text = text.replace(regex, fixed);
        }
    }
    if (count > 0) {
        const remaining = (text.match(/\uFFFD/g) || []).length;
        if (remaining > 0) {
            console.log('WARN: ' + path.basename(filepath) + ' — ' + remaining + ' U+FFFD remain');
        }
        fs.writeFileSync(filepath, text, 'utf-8');
        console.log('FIXED ' + count + ' U+FFFD in ' + path.basename(filepath));
    } else {
        console.log('SKIP ' + path.basename(filepath) + ' — no matches');
    }
}

const cssDir = path.resolve(__dirname, '..', 'public', 'css');
fixFile(path.join(cssDir, 'style.css'));
fixFile(path.join(cssDir, 'studnie.css'));
fixFile(path.join(cssDir, 'zlecenia.css'));
