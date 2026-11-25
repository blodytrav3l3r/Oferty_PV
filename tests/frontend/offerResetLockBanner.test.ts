/** @jest-environment jsdom */
// @ts-nocheck
/**
 * Regresja: nowa oferta nie może zachować banera blokady poprzedniej oferty.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readJs(file: string): string {
    return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('nowa oferta studni czyści stan banera blokady', () => {
    it('ukrywa blokadę poprzedniej studni po wyczyszczeniu formularza', () => {
        document.body.innerHTML = '<div class="well-center-column"></div>';
        const sandbox: Record<string, any> = {
            console,
            document,
            window: {},
            wells: [{ id: 'w1', name: 's1' }],
            currentWellIndex: 0,
            editingOfferIdStudnie: 'offer-1',
            orderEditMode: null,
            currentUser: null,
            wellCounter: 2,
            wellDiscounts: {},
            visiblePrzejsciaTypes: new Set(['DN1000']),
            customPrzejsciaTypes: [],
            wizardConfirmedParams: new Set(),
            isWellOrdered: () => true,
            getOrdersForOffer: () => [
                { id: 'order-1', orderNumber: 'ZS/1', wells: [{ id: 'w1' }] }
            ],
            getOfferOrderProgress: () => ({ ordered: 1, total: 1, percent: 100 }),
            clearOfferFormFields: () => {},
            generateOfferNumberStudnie: () => 'OS/NEW',
            clearOrderNumberField: () => {},
            applyStudnieOfferPricelist: async () => {},
            refreshAll: () => {},
            showSection: () => {},
            renderOfferSummary: () => {},
            goToWizardStep: () => {}
        };
        sandbox.getCurrentWell = () => sandbox.wells[sandbox.currentWellIndex] || null;
        vm.createContext(sandbox);
        vm.runInContext(
            readJs('public/js/shared/escapeHtml.js').replace(/^export /gm, ''),
            sandbox
        );
        vm.runInContext(readJs('public/js/studnie/uiLockBanners.js'), sandbox);
        vm.runInContext(readJs('public/js/studnie/offerManager.js'), sandbox);

        sandbox.renderOfferLockBanner();
        const banner = document.getElementById('offer-lock-banner') as HTMLElement;
        expect(banner.textContent).toContain('STUDNIA ZABLOKOWANA');

        sandbox.clearOfferForm();

        expect(sandbox.wells).toEqual([]);
        expect(document.getElementById('offer-lock-banner')).toBeNull();
    });
});
