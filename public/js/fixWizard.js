const fs = require('fs');
let code = fs.readFileSync('g:/GitHub/Oferty_PV/public/js/app_studnie.js', 'utf8');

// The marker we know got duplicated at the very end
const marker = '// --- WIZARD LOGIC ---';
const lastIndex = code.lastIndexOf(marker);

// Remove the duplicated block if it was injected near bottom (line 2891)
if (lastIndex > 2500) {
    code = code.substring(0, lastIndex);
    // append the actual DOMContentLoaded code that was previously beneath it (we might have overridden it)
    code += 'document.addEventListener("DOMContentLoaded", () => { setTimeout(() => { setupParamTiles(); updateParamTilesUI(); }, 500); });';
    console.log('Fixed redeclaration issue!');
}

// Add the reset to clearOfferForm
const t1 = `    showSection('builder');
    renderOfferSummary();
}`;
const r1 = `    showSection('builder');
    if (typeof showWizardStep === 'function') { showWizardStep(1); }
    renderOfferSummary();
}`;
code = code.replace(t1, r1);

// Add the bypass to loadOfferStudnie
const t2 = `        hasUnsavedChanges = false;
        showToast('Oferta wczytana!', 'success');`;
const r2 = `        hasUnsavedChanges = false;
        if (typeof bypassWizardForSavedOffer === 'function') { bypassWizardForSavedOffer(); }
        showToast('Oferta wczytana!', 'success');`;
code = code.replace(t2, r2);

fs.writeFileSync('g:/GitHub/Oferty_PV/public/js/app_studnie.js', code);
console.log('Done replacement');
