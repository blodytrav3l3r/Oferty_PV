/**
 * Inteligentny Konfigurator Studni
 * Implementacja warstwy uczenia maszynowego (ML) analizującej preferencje użytkownika na bazie zapisywanych ofert.
 * Wykorzystuje pamięć lokalną do budowy wag i prawdopodobieństw (Frequency Based Model).
 */

class LearningWellConfigurator {
    constructor() {
        this.storageKey = 'witros_ml_modelData_v1';
        this.model = this.loadModel();
    }

    /**
     * Inicjalizuje lub przywraca pusty Tensor Prawdopodobieństw.
     * context => parametr determinujący (np. kategoria DN, przedział wielkości przejść).
     */
    loadModel() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Błąd odczytu modelu ML:', e);
        }

        // Struktura bazy uczącej (wagi na podstawie liczności zdarzeń w podzbiorze kontekstowym)
        return {
            dnContexts: {},
            trainedHashes: [], // [NEW] Hashe do deduplikacji
            totalTrained: 0
        };
    }

    /**
     * Prosty algorytm haszujący (djb2) do generowania unikalnego ID konfiguracji
     */
    hashCode(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 33) ^ str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    saveModel() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.model));
        } catch (e) {
            console.warn('Nie można zapisać pamięci ML:', e);
        }
    }

    /**
     * Wprowadza do pamięci historyczną ofertę zatwierdzoną przez inżyniera.
     * @param {Object} well - Konfiguracja studni zapisywana/skopiowana przez UI
     */
    train(well) {
        if (!well || !well.dn || !well.config) return;

        // [USPRAWNIENIE 1] Deduplikacja: Zapobiegamy wielokrotnemu treningowi na identycznej studni
        const configStr = well.dn.toString() + (well.rzednaWlazu || '') + (well.rzednaDna || '') + JSON.stringify(well.config);
        const configHash = this.hashCode(configStr);

        if (!this.model.trainedHashes) this.model.trainedHashes = [];
        if (this.model.trainedHashes.includes(configHash)) {
            return; // Ta dokładna konfiguracja już trenowała model
        }

        // Utrzymujemy historię haszy do max 1000 elementów aby zapobiec wyciekowi pamięci
        this.model.trainedHashes.push(configHash);
        if (this.model.trainedHashes.length > 1000) {
            this.model.trainedHashes.shift();
        }

        const dnStr = well.dn.toString();

        // Utwórz kontekst jeśli nie ma
        if (!this.model.dnContexts[dnStr]) {
            this.model.dnContexts[dnStr] = {
                topPreference: {},
                ringHeightFreq: {}
            };
        }

        const context = this.model.dnContexts[dnStr];

        // 1. Zidentyfikuj wybrane kręgi bazowe (poniżej ewentualnej redukcji/zwieńczenia)
        let mainRingHeights = [];
        let topClosureType = null;

        // Zwieńczeniem bazowym lub konusem zawsze będzie element na górze danej studni (z wyłączeniem włazu).
        const topTypesLookup = ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'];

        for (const item of well.config) {
            // Ponieważ config list jest renderowany z produkami w 'well.config' przypisanymi tylko ID
            // musimy odzyskać ich typ
            const prodInfo = window.studnieProducts ? window.studnieProducts.find(p => p.id === item.productId) : null;
            if (prodInfo) {
                if (topTypesLookup.includes(prodInfo.componentType) && !topClosureType) {
                    topClosureType = prodInfo.componentType;
                }

                // Track kręgi 
                if (prodInfo.componentType === 'krag' || prodInfo.componentType === 'krag_ot') {
                    if (prodInfo.dn === well.dn) { // ignoruj kręgi redukcyjne 1000m z samej góry jeśli to duża studnia
                        mainRingHeights.push(prodInfo.height);
                    }
                }
            }
        }

        // 2. Trening Własności (Aktualizacja wag częstości)
        if (topClosureType) {
            context.topPreference[topClosureType] = (context.topPreference[topClosureType] || 0) + 1;
        }

        // [USPRAWNIENIE 2] Liczymy wystąpienie *danego wymiaru kręgu* raz dla studni, niezależnie od ilości.
        // Gwarantuje to, że głębokie studnie z np. 5 kręgami 1000mm nie zdominują algorytmu.
        if (mainRingHeights.length > 0) {
            const uniqueHeights = [...new Set(mainRingHeights)];
            for (const h of uniqueHeights) {
                const hKey = h.toString();
                context.ringHeightFreq[hKey] = (context.ringHeightFreq[hKey] || 0) + 1;
            }
        }

        this.model.totalTrained++;

        // [USPRAWNIENIE 3] Weight Decay (Starzenie się starych danych).
        // Co 20 treningów redukujemy wszystkie wagi o 10%, robiąc miejsce na nowe preferencje.
        if (this.model.totalTrained % 20 === 0) {
            for (const dKey in this.model.dnContexts) {
                const ctx = this.model.dnContexts[dKey];
                for (const tKey in ctx.topPreference) {
                    ctx.topPreference[tKey] *= 0.9;
                }
                for (const rKey in ctx.ringHeightFreq) {
                    ctx.ringHeightFreq[rKey] *= 0.9;
                }
            }
        }

        this.saveModel();

        console.log(`[ML Engine] Zaktualizowano model dla DN${dnStr}. Baza: V${this.model.totalTrained}`);
    }

    /**
     * Odpytywane przed Solverem w celu uzyskania predykcji scoringowych.
     */
    getRecommendation(dn) {
        let recommendation = {
            preferredTop: null,
            ringHeightsByWeight: [1000, 750, 500, 250] // Domyślny fallback zachłanny
        };

        const dnStr = dn.toString();
        const context = this.model.dnContexts[dnStr];

        if (!context) return recommendation;

        // --- Extrakcja Preferowanego Głównego Zamknięcia ---
        if (Object.keys(context.topPreference).length > 0) {
            // Znajdź typ z największą statystyką wystąpień
            let maxVotes = -1;
            for (const [typ, votes] of Object.entries(context.topPreference)) {
                if (votes > maxVotes) {
                    maxVotes = votes;
                    recommendation.preferredTop = typ;
                }
            }
        }

        // --- Extrakcja Sortowania Kręgów (Na podstawie wyuczonej częstości) ---
        if (Object.keys(context.ringHeightFreq).length > 0) {
            // Sort keys by highest vote count
            const sortedHeights = Object.entries(context.ringHeightFreq)
                .sort((a, b) => b[1] - a[1]) // sortowanie malejące wg liczby głosów
                .map(entry => parseInt(entry[0]));

            // Scal z pozostałościami po to aby algorytm dalej miał domyślne fallbacki dla nietrenowanych parametrów
            const defHeights = [1000, 750, 500, 250];
            const merged = [];

            // najpierw ulubieńce
            for (const h of sortedHeights) {
                if (!merged.includes(h)) merged.push(h);
            }
            // następnie reszta
            for (const h of defHeights) {
                if (!merged.includes(h)) merged.push(h);
            }

            recommendation.ringHeightsByWeight = merged;
        }

        return recommendation;
    }

    resetStorageData() {
        this.model = { dnContexts: {}, totalTrained: 0 };
        this.saveModel();
        console.log('[ML Engine] Zresetowano model uczeniowy studni.');
    }
}

// Inicjalizacja instancji globalnej
window.wellML = new LearningWellConfigurator();
