// @ts-check
/* ===== UI: PRZEŁĄCZNIKI ZAKŁADEK (PANEL BOCZNY I BUDOWNICZY) ===== */
/* Wyodrebnione z wellUI.js - fazy refaktoryzacji */

/* ===== PANEL RABATÓW ===== */
/** Przełącznik zakładek paska bocznego (Lista vs Rabaty) */
function switchSidebarTab(tabName) {
    const listContent = document.getElementById('sidebar-list-content');
    const discContent = document.getElementById('sidebar-discounts-content');
    const tabList = document.getElementById('stab-list');
    const tabDisc = document.getElementById('stab-discounts');

    if (!listContent || !discContent || !tabList || !tabDisc) return;

    if (tabName === 'list') {
        listContent.style.display = 'flex';
        discContent.style.display = 'none';
        tabList.classList.add('active');
        tabDisc.classList.remove('active');
    } else {
        listContent.style.display = 'none';
        discContent.style.display = 'flex';
        tabList.classList.remove('active');
        tabDisc.classList.add('active');
    }
}

function switchBuilderTab(tab) {
    const btabConcrete = document.getElementById('btab-concrete');
    const btabTransitions = document.getElementById('btab-transitions');
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    const bcontentTransitions = document.getElementById('bcontent-transitions');

    if (btabConcrete) btabConcrete.classList.toggle('active', tab === 'concrete');
    if (btabTransitions) btabTransitions.classList.toggle('active', tab === 'transitions');
    if (bcontentConcrete) bcontentConcrete.style.display = tab === 'concrete' ? 'block' : 'none';
    if (bcontentTransitions)
        bcontentTransitions.style.display = tab === 'transitions' ? 'block' : 'none';

    if (tab === 'transitions') {
        if (typeof renderInlinePrzejsciaApp === 'function') renderInlinePrzejsciaApp();
        if (typeof renderWellPrzejscia === 'function') renderWellPrzejscia();
        const przejsciaContainer = document.getElementById('inline-przejscia-app-container');
        const przejsciaIcon = document.getElementById('przejscia-app-icon');
        if (przejsciaContainer && przejsciaContainer.style.display === 'none') {
            przejsciaContainer.style.display = 'block';
            if (przejsciaIcon)
                przejsciaIcon.innerHTML =
                    '<span class="text-xs"><i data-lucide="chevron-up"></i></span>';
            if (window.lucide) window.lucide.createIcons({ root: przejsciaIcon });
        }
    }
}

window.switchSidebarTab = switchSidebarTab;
window.switchBuilderTab = switchBuilderTab;
