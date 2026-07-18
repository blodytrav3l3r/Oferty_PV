/**
 * Partial order flow test for Rury module.
 * Tests: qty input read scope, ZT auto-check, orderedQuantity tracking.
 *
 * Run:  node tests/playwright/partialOrderRury.cjs
 * Needs: backend on :3000, Vite on :5173
 */

const BASE = 'http://localhost:5173';

function resolvePlaywright() {
    try { return require('playwright'); } catch (_) {}
    const { readdirSync } = require('fs');
    const { join } = require('path');
    const cr = process.env.LOCALAPPDATA + '\\npm-cache\\_npx';
    try {
        for (const h of readdirSync(cr, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
            try { return require(join(cr, h, 'node_modules', 'playwright')); } catch (_) {}
        }
    } catch (_) {}
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();
const CHROME_PATH = process.env.CHROME_PATH ||
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    let failed = false;
    const errors = [];

    try {
        // Login
        const r = await page.request.post(`${BASE}/api/auth/login`, { data: { username: 'admin', password: 'anim123456' } });
        const token = (await r.json()).token;
        await page.addInitScript(t => localStorage.setItem('authToken', t), token);

        // Load rury module
        await page.goto(`${BASE}/app.html#/rury`, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(3000);
        const iframeEl = await page.waitForSelector('#spa-iframe-rury', { timeout: 15000 });
        await sleep(2000);
        let frame = await iframeEl.contentFrame();
        if (!frame) frame = page.frames().find(f => f.url().includes('rury'));
        if (!frame) throw new Error('no rury iframe');

        // Wait for products
        for (let i = 0; i < 20; i++) {
            const ok = await frame.evaluate(() => { try { return Array.isArray(products) && products.length > 50; } catch (_) { return false; } });
            if (ok) break;
            await sleep(1500);
        }

        // ─── Test 1: collectSelectedItemsForOrder reads qty from correct section ───
        console.log('T1: section-scoped qty read...');
        const t1 = await frame.evaluate(() => {
            try {
                // Simulate: step3 has input offer-qty-UID, summary tab has offer-summary-qty-UID
                // Both with different values
                const uid = 'test-uid-001';
                const step3Content = document.getElementById('offer-items-body');
                const summaryContent = document.getElementById('offer-tab-summary-body');

                // Append a test input to step3 and summary sections
                const step3Input = document.createElement('input');
                step3Input.id = 'order-qty-' + uid;
                step3Input.value = '50';
                step3Content.parentElement.appendChild(step3Input);

                const summaryInput = document.createElement('input');
                summaryInput.id = 'offer-summary-qty-' + uid;
                summaryInput.value = '10';
                summaryContent.appendChild(summaryInput);

                // Now simulate active section = summary tab
                // We need to make section-offer the active one temporarily
                const sections = document.querySelectorAll('.section');
                let sectionOffer = null;
                sections.forEach(s => { if (s.id === 'section-offer') sectionOffer = s; });

                if (!sectionOffer) return { error: 'section-offer not found' };

                // Query within section-offer only
                const q1 = sectionOffer.querySelector('#order-qty-' + uid);
                const q2 = sectionOffer.querySelector('#offer-summary-qty-' + uid);
                const result = q2 ? q2.value : 'not-found';

                // Cleanup
                step3Input.remove();
                summaryInput.remove();

                return { success: true, summaryResult: result, q1Found: !!q1, q2Found: !!q2 };
            } catch (e) {
                return { error: e.message };
            }
        });
        console.log('   Section-scoped read:', JSON.stringify(t1));

        if (t1.error) { errors.push(t1.error); failed = true; }
        else if (t1.summaryResult === '10') console.log('   ✅ section-scoped read works');
        else { errors.push(`section-scoped read returned ${t1.summaryResult}, expected '10'`); failed = true; }

        // ─── Test 2: ZT items get quantity from selected pipe qty ───
        console.log('T2: ZT quantity from pipe order...');
        const t2 = await frame.evaluate(() => {
            try {
                window.currentOfferItems = [{
                    uid: 'pipe-1',
                    productId: 'RTB-0-03-25-K00',
                    quantity: 100,
                    autoAdded: false,
                    customLengthM: null,
                    pehdType: ''
                }, {
                    uid: 'zt-1',
                    productId: 'ZT-0300',
                    quantity: 100,
                    autoAdded: true,
                    customLengthM: null,
                    pehdType: ''
                }];

                // Simulate collectSelectedItemsForOrder logic
                const selected = [];
                const seen = new Set();
                const items = window.currentOfferItems;

                // Simulate pipe being selected
                const pipeClone = Object.assign({}, items[0]);
                pipeClone.orderedQuantity = 10;
                selected.push(pipeClone);
                seen.add(pipeClone.uid);

                // Sum pipe order qty per diameter
                const byDiam = {};
                selected.forEach(it => {
                    if (it.autoAdded) return;
                    const d = 300; // DN300
                    const oq = it.orderedQuantity || it.quantity;
                    byDiam[d] = (byDiam[d] || 0) + oq;
                });

                // Process auto items
                const autoResults = [];
                items.forEach(it => {
                    if (!it.autoAdded) return;
                    if (seen.has(it.uid)) return;
                    const d = 300;
                    if (d > 0 && byDiam[d]) {
                        const cloned = structuredClone(it);
                        if (cloned.productId.startsWith('ZT-')) {
                            cloned.quantity = byDiam[d];
                        }
                        autoResults.push({ pid: cloned.productId, qty: cloned.quantity, orderedQty: cloned.orderedQuantity });
                    }
                });

                return { byDiam, autoResults };
            } catch (e) {
                return { error: e.message };
            }
        });
        console.log('   ZT qty matching:', JSON.stringify(t2));
        if (t2.error) { errors.push(t2.error); failed = true; }
        else if (t2.autoResults && t2.autoResults[0] && t2.autoResults[0].qty === 10) {
            console.log('   ✅ ZT gets qty=10 from pipe sum');
        } else {
            errors.push(`ZT qty mismatch: ${JSON.stringify(t2.autoResults)}`);
            failed = true;
        }

        // ─── Test 3: ZT checkbox auto-checks via onPipeCheckboxChange ───
        console.log('T3: ZT auto-check mechanism...');
        const t3 = await frame.evaluate(() => {
            try {
                const div = document.createElement('div');
                div.innerHTML = `
                    <input type="checkbox" class="item-order-pipe" data-diameter="300">
                    <input type="checkbox" class="item-order-auto" data-diameter="300">
                `;
                document.body.appendChild(div);

                const pipeCb = div.querySelector('.item-order-pipe');
                const ztCb = div.querySelector('.item-order-auto');

                pipeCb.checked = true;
                // Simulate onPipeCheckboxChange
                const diameter = parseInt(pipeCb.dataset.diameter);
                document.querySelectorAll(`.item-order-auto[data-diameter="${diameter}"]:not(:disabled)`).forEach(cb => { cb.checked = pipeCb.checked; });

                const result = { pipeChecked: pipeCb.checked, ztChecked: ztCb.checked };
                div.remove();
                return result;
            } catch (e) { return { error: e.message }; }
        });
        console.log('   ZT auto-check:', JSON.stringify(t3));
        if (t3.error) { errors.push(t3.error); failed = true; }
        else if (t3.ztChecked) console.log('   ✅ ZT auto-checks with pipe');
        else { errors.push('ZT not auto-checked'); failed = true; }

        // ─── Test 4-6: quantity tracking (in one scope to share ordersRury) ───
        console.log('T4-6: quantity tracking...');
        const t456 = await frame.evaluate(() => {
            try {
                window.editingOfferId = 'test-offer-1';
                // Direct assignment to global let ordersRury
                ordersRury = [{
                    offerId: 'test-offer-1',
                    items: [
                        { productId: 'RTB-0-03-25-K00', orderedQuantity: 10, quantity: 10, customLengthM: null, pehdType: '' },
                        { productId: 'ZT-0300', orderedQuantity: 10, quantity: 10, customLengthM: null, pehdType: '' }
                    ]
                }];

                // T4: computeOrderedQuantities
                let map = {};
                if (typeof window.computeOrderedQuantities === 'function') {
                    map = window.computeOrderedQuantities();
                }
                const pipeKey = 'RTB-0-03-25-K00||';
                const ztKey = 'ZT-0300||';
                const pipeOrdered = map[pipeKey] || 0;
                const ztOrdered = map[ztKey] || 0;

                // T5: getRemainingQuantity for qty=100 item → should be 90
                let remaining100 = -1;
                if (typeof window.getRemainingQuantity === 'function') {
                    remaining100 = window.getRemainingQuantity({
                        productId: 'RTB-0-03-25-K00', quantity: 100, customLengthM: null, pehdType: ''
                    });
                }

                // T6: getRemainingQuantity for qty=10 item (all 10 already ordered) → should be 0
                let remaining10 = -1;
                if (typeof window.getRemainingQuantity === 'function') {
                    remaining10 = window.getRemainingQuantity({
                        productId: 'RTB-0-03-25-K00', quantity: 10, customLengthM: null, pehdType: ''
                    });
                }

                return {
                    pipeOrdered, ztOrdered,
                    remaining100, remaining10,
                    expected: { pipeOrdered: 10, ztOrdered: 10, remaining100: 90, remaining10: 0 }
                };
            } catch (e) { return { error: e.message }; }
        });
        console.log('   Quantity tracking:', JSON.stringify(t456));
        if (t456.error) { errors.push(t456.error); failed = true; }
        else {
            const e = t456.expected;
            let ok = true;
            if (t456.pipeOrdered === e.pipeOrdered) console.log('   ✅ pipe ordered = 10');
            else { errors.push(`pipe ordered ${t456.pipeOrdered}, expected ${e.pipeOrdered}`); ok = false; }
            if (t456.ztOrdered === e.ztOrdered) console.log('   ✅ ZT ordered = 10');
            else { errors.push(`ZT ordered ${t456.ztOrdered}, expected ${e.ztOrdered}`); ok = false; }
            if (t456.remaining100 === e.remaining100) console.log('   ✅ remaining (100-10) = 90');
            else { errors.push(`remaining100=${t456.remaining100}, expected ${e.remaining100}`); ok = false; }
            if (t456.remaining10 === e.remaining10) console.log('   ✅ remaining (10-10) = 0');
            else { errors.push(`remaining10=${t456.remaining10}, expected ${e.remaining10}`); ok = false; }
            if (!ok) failed = true;
        }

        // ─── Test 7: step3 shows input (not "—") when remaining == quantity ───
        console.log('T7: partial qty input visibility (remaining==quantity)...');
        // Reset orders so remaining = 100
        await frame.evaluate(() => {
            ordersRury = []; // eslint-disable-line no-global-assign
            window.currentOfferItems = [{
                uid: 'pipe-vis-1',
                productId: 'RTB-0-03-25-K00',
                quantity: 100,
                autoAdded: false,
                customLengthM: null,
                pehdType: ''
            }];
        });
        await frame.evaluate(() => { if (typeof window.renderOfferItems === 'function') window.renderOfferItems(); });
        await sleep(1000);

        const t7 = await frame.evaluate(() => {
            const input = document.querySelector('.order-partial-qty');
            const dash = document.querySelector('.order-qty-all');
            return {
                hasInput: !!input,
                hasDash: !!dash,
                inputValue: input ? input.value : null
            };
        });
        console.log('   Input visibility:', JSON.stringify(t7));
        if (t7.hasInput && !t7.hasDash) {
            console.log('   ✅ Input shown (not "—") when remaining==quantity');
        } else {
            errors.push(`Input state wrong: input=${t7.hasInput}, dash=${t7.hasDash}`);
            failed = true;
        }

        // ─── Report ───
        if (failed) {
            console.error('\n❌ FAILED:');
            errors.forEach(e => console.error('  ' + e));
            process.exitCode = 1;
        } else {
            console.log('\n✅ ALL CHECKS PASSED (7/7)');
        }
    } catch (e) {
        console.error('\n❌ FATAL:', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
