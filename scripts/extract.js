const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/js/studnie/autoSelect.js');
let content = fs.readFileSync(filePath, 'utf8');

function extractFunction(content, funcName) {
    const match = content.match(new RegExp(`function\\s+${funcName}\\s*\\([^{]*\\)\\s*\\{`));
    if (!match) return { found: false, text: '' };

    const startIdx = match.index;
    let braceCount = 0;
    let i = startIdx + match[0].length - 1; // index of the first '{'

    while (i < content.length) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                const endIdx = i + 1;
                const funcText = content.substring(startIdx, endIdx);
                return { found: true, text: funcText, start: startIdx, end: endIdx };
            }
        }
        i++;
    }
    return { found: false, text: '' };
}

const functionsToExtract = {
    'wellPopups': [
        'openZakonczeniePopup',
        'updateZakonczenieButton',
        'updateRedukcjaButton',
        'updatePsiaBudaButton',
        'openRedukcjaZakonczeniePopup',
        'showStycznaPopup',
        'handleStycznaProductChoice'
    ],
    'wellTransitions': [
        'renderInlinePrzejsciaApp',
        'renderWellPrzejscia',
        'movePrzejscie',
        'removePrzejscieFromWell',
        'editPrzejscie',
        'savePrzejscieEdit',
        'cancelPrzejscieEdit',
        'syncEditState',
        'editUpdateAngles',
        'editChangePrzejscieType',
        'openPrzejsciaVisibilityPopup',
        'closePrzejsciaVisibilityPopup',
        'togglePrzejsciaTypeVisibility',
        'setPrzejsciaVisibilityAll',
        'refreshPrzejsciaVisibilityTiles'
    ],
    'wellConfigRules': [
        'enforceSingularTopClosures',
        'sortWellConfigByOrder',
        'filterByWellParams',
        'filterSealsByWellType',
        'getAvailableProducts'
    ],
    'wellActions': [
        'updateElevations',
        'syncElevationInputs',
        'updateHeightIndicator',
        'updateWellNumer',
        'checkWellNumerDuplicate',
        'updateDoplata',
        'dragWellComponent',
        'dragEndWellComponent',
        'allowDropWellComponent',
        'dragLeaveWellComponent',
        'dropWellComponent',
        'addWellComponent',
        'removeWellComponent',
        'updateWellQuantity',
        'clearWellConfig',
        'renderTiles',
        'renderWellConfig',
        'moveWellComponent'
    ]
};

for (const [moduleName, funcs] of Object.entries(functionsToExtract)) {
    let moduleCode = `/* ===== Extracted to ${moduleName}.js ===== */\n\n`;
    for (const funcName of funcs) {
        const result = extractFunction(content, funcName);
        if (result.found) {
            moduleCode += result.text + "\n\n";
            // Do not modify content directly inside the loop to avoid messing up offsets for remaining functions if we aren't careful? Wait, extracting and deleting changes string length.
            // Best to replace with padding or re-evaluate. Let's do string replacement.
            content = content.slice(0, result.start) + "".padEnd(result.end - result.start, ' ') + content.slice(result.end);
            console.log(`Extracted ${funcName} -> ${moduleName}.js`);
        } else {
            console.log(`Could NOT find ${funcName}`);
        }
    }
    const outPath = path.join(__dirname, `public/js/studnie/${moduleName}.js`);
    fs.writeFileSync(outPath, moduleCode, 'utf8');
}

// Write the remaining solver back to wellSolver.js
// Filter out the blank lines caused by padding
content = content.replace(/^[ \t]+$/gm, '');
fs.writeFileSync(path.join(__dirname, 'public/js/studnie/wellSolver.js'), content, 'utf8');
// fs.unlinkSync(filePath); // I'll do this later to ensure nothing is lost

console.log('Extraction complete.');
