/**
 * Weryfikacja: czy zmiana "Spocznik wys." (spocznikH) wpływa na dobór elementów studni SS1
 * w REALNEJ przeglądarce (pełny solver + AI dual-ranking + eksploracja).
 * Run: node tests/playwright/spocznikVerification.cjs  (wymaga backendu na :3000)
 */
const BASE = 'http://localhost:3000';
const OFFER_ID = 'offer_studnie_1786990199779';

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    const { readdirSync } = require('fs');
    const { join } = require('path');
    const cr = process.env.LOCALAPPDATA + '\\npm-cache\\_npx';
    try {
        for (const h of readdirSync(cr, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)) {
            try {
                return require(join(cr, h, 'node_modules', 'playwright'));
            } catch (_) {}
        }
    } catch (_) {}
    throw new Error('playwright not found');
}
const { chromium } = resolvePlaywright();
const CHROME_PATH =
    process.env.CHROME_PATH ||
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1234\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox']
    });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    const failures = [];

    try {
        // Login
        const r = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        if (!r.ok()) throw new Error(`login failed ${r.status()}`);
        const token = (await r.json()).token;
        await page.addInitScript((t) => localStorage.setItem('authToken', t), token);

        // Pobierz studnię SS1 z API (taki sam obiekt jak w przeglądarce)
        const of = await page.request.get(`${BASE}/api/offers-studnie/${OFFER_ID}`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!of.ok()) throw new Error(`offer fetch failed ${of.status()}`);
        const offerJson = await of.json();
        let offer = offerJson.data || offerJson;
        if (!(offer.wells || []).length && offer.data && Array.isArray(offer.data.wells))
            offer = offer.data;
        const wellsArr = offer.wells || [];
        const ss1Idx = wellsArr.findIndex((w) => w.numer === 'ss1' || w.name === 'ss1');
        if (ss1Idx < 0) {
            console.log(
                'API keys:',
                Object.keys(offerJson).join(','),
                '| offer keys:',
                Object.keys(offer).join(',')
            );
            throw new Error('SS1 not found in offer');
        }
        const ss1 = wellsArr[ss1Idx];
        console.log('SS1 id=', ss1.id, 'dn=', ss1.dn, 'spocznikH=', ss1.spocznikH);

        // Otwórz moduł studnie
        await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2500);
        const iframeEl = await page.waitForSelector('#spa-iframe-studnie', { timeout: 15000 });
        await sleep(1500);
        let frame = await iframeEl.contentFrame();
        if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
        if (!frame) throw new Error('no studnie iframe');

        // Czekaj aż produkty załadują się w module
        for (let i = 0; i < 25; i++) {
            const ok = await frame.evaluate(() => {
                try {
                    return (
                        Array.isArray(window.studnieProducts) && window.studnieProducts.length > 50
                    );
                } catch (_) {
                    return false;
                }
            });
            if (ok) break;
            await sleep(1200);
        }
        const prodCount = await frame.evaluate(() => window.studnieProducts.length);
        console.log('Products loaded:', prodCount);

        // Wstrzyknij studnię SS1 do stanu modułu
        await frame.evaluate((wellObj) => {
            window.wells = [structuredClone(wellObj)];
            window.currentWellIndex = 0;
            window.editingOfferIdStudnie = 'offer_studnie_1786990199779';
        }, ss1);

        const fns = await frame.evaluate(() => ({
            hasUpdateWellParam: typeof window.updateWellParam === 'function',
            hasAutoSelect: typeof window.autoSelectComponents === 'function',
            hasRank: typeof window.rankCandidates === 'function'
        }));
        console.log('Available:', JSON.stringify(fns));
        if (!fns.hasUpdateWellParam) throw new Error('updateWellParam not available');

        const spoczniki = ['1/2', '2/3', '3/4', '1/1', 'brak'];
        const results = [];

        for (const sh of spoczniki) {
            const snap = await frame.evaluate(async (value) => {
                try {
                    await window.updateWellParam('spocznikH', value);
                } catch (e) {
                    return { error: 'updateWellParam: ' + e.message };
                }
                await new Promise((r) => setTimeout(r, 800));
                const w = window.wells[0];
                return {
                    spocznikH: w.spocznikH,
                    config: w.config.map((c) => c.productId + (c.autoAdded ? '*' : '')),
                    configSource: w.configSource,
                    aiRank: w._aiRankInfo || null,
                    configStatus: w.configStatus,
                    configErrors: w.configErrors || []
                };
            }, sh);
            results.push(snap);
            console.log(`\n[${sh}]`);
            console.log('  config:', (snap.config || []).join(', '));
            console.log('  source:', snap.configSource, '| status:', snap.configStatus);
            console.log('  aiRank:', JSON.stringify(snap.aiRank));
            if (snap.error) console.log('  ERROR:', snap.error);
        }

        // Niedeterminizm: ta sama wartość 1/2 kilka razy (Opcja B → ma być deterministycznie)
        console.log('\n=== Opcja B: powtórz 1/2 x4 (oczekiwane identyczne) ===');
        const reps = [];
        for (let i = 0; i < 4; i++) {
            const snap = await frame.evaluate(async () => {
                await window.updateWellParam('spocznikH', '1/2');
                await new Promise((r) => setTimeout(r, 800));
                const w = window.wells[0];
                return {
                    config: w.config.map((c) => c.productId + (c.autoAdded ? '*' : '')),
                    source: w.configSource,
                    aiRank: w._aiRankInfo || null,
                    inputHash: w._lastSolveInputHash || null
                };
            });
            reps.push(snap);
            console.log(
                `  run${i}: ${snap.config.join(', ')} | ${snap.source} | expl=${snap.aiRank && snap.aiRank.explorationTriggered} | hash=${snap.inputHash}`
            );
        }

        // Zmiana wejścia solvera (rzędna przejścia) → hash musi się zmienić
        console.log('\n=== Zmiana wejścia solvera (rzędna przejścia) ===');
        const afterChange = await frame.evaluate(async () => {
            const w = window.wells[0];
            if (w.przejscia && w.przejscia[0]) {
                w.przejscia[0].rzednaWlaczenia = '1.500';
                await window.updateWellParam('spocznikH', '1/2');
                await new Promise((r) => setTimeout(r, 800));
            }
            return {
                config: w.config.map((c) => c.productId + (c.autoAdded ? '*' : '')),
                inputHash: w._lastSolveInputHash || null,
                aiRank: w._aiRankInfo || null
            };
        });
        console.log(`  config: ${afterChange.config.join(', ')}`);
        console.log(
            `  hash: ${afterChange.inputHash} | expl=${afterChange.aiRank && afterChange.aiRank.explorationTriggered}`
        );

        // Porównanie sylwetek (bez kinety)
        const silhouette = (cfg) => (cfg || []).filter((p) => !p.startsWith('KINETA-')).join(',');
        const kinetaOf = (cfg) =>
            (cfg || []).filter((p) => p.startsWith('KINETA-')).join(',') || '(brak)';

        console.log('\n=== Podsumowanie ===');
        const ref = silhouette(results.find((r) => r.spocznikH === '1/2').config);
        for (const r of results) {
            const same = silhouette(r.config) === ref;
            console.log(
                `${r.spocznikH}: sylwetka ${same ? 'IDENTYCZNA' : 'ROZNA'} | kineta=${kinetaOf(r.config)}`
            );
            if (!same)
                failures.push(
                    `spocznikH=${r.spocznikH}: silhouette differs from 1/2 (element selection depends on spocznikH!)`
                );
        }
        const repRef = silhouette(reps[0].config);
        const varied = reps.filter((rp) => silhouette(rp.config) !== repRef);
        const exploded = reps.filter((rp) => rp.aiRank && rp.aiRank.explorationTriggered);
        console.log(
            `Re-run 1/2: ${reps.length} runs, ${varied.length} różne od 1., eksploracja odpaliła: ${exploded.length}`
        );
        if (varied.length > 0)
            failures.push(`Opcja B: re-run 1/2 zmienił elementy (${varied.length}/${reps.length})`);
        if (exploded.length > 0)
            failures.push(
                `Opcja B: eksploracja odpaliła przy identycznych wejściach (${exploded.length}/${reps.length})`
            );
        const hashes = reps.map((rp) => rp.inputHash).filter(Boolean);
        if (hashes.length && new Set(hashes).size > 1)
            failures.push(`Opcja B: _lastSolveInputHash niestabilny przy identycznych wejściach`);
        if (!afterChange.inputHash)
            failures.push('Opcja B: _lastSolveInputHash nie ustawiony po zmianie wejścia');
        console.log(`Zmiana rzędnej: hash=${afterChange.inputHash}`);

        if (failures.length) {
            console.error('\nFAILED:');
            failures.forEach((f) => console.error('  ' + f));
            process.exitCode = 1;
        } else {
            console.log('\nOK: spocznikH NIE wpływa na dobór elementów — różni się tylko kineta.');
        }
    } catch (e) {
        console.error('\nFATAL:', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
