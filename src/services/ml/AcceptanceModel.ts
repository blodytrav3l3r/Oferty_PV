export interface TrainingExample {
    features: number[];
    label: number;
    weight: number;
}

/**
 * Awaria numeryczna treningu (NaN/Inf w wagach) — trening NIE może przejść
 * dalej z zepsutym modelem. TrainingPipeline mapuje to na FAILED_NUMERICAL.
 */
export class TrainingNumericalError extends Error {}

/**
 * Rozbieżność loss (loss > bestLoss * (1 + threshold) przez N kolejnych epok).
 * TrainingPipeline mapuje to na FAILED_VALIDATION (model niezdatny).
 */
export class TrainingDivergenceError extends Error {}

/**
 * Przekroczony deadline treningu (cooperative cancellation — sprawdzany
 * co epokę). TrainingPipeline mapuje to na FAILED_TIMEOUT.
 */
export class TrainingTimeoutError extends Error {}

export class AcceptanceModel {
    private weights: number[];
    private bias: number;
    private featureCount: number;

    constructor(featureCount: number, weights?: number[], bias?: number) {
        this.featureCount = featureCount;
        this.weights = weights || new Array(featureCount).fill(0);
        this.bias = bias ?? 0;
    }

    sigmoid(z: number): number {
        if (z > 20) return 1;
        if (z < -20) return 0;
        return 1 / (1 + Math.exp(-z));
    }

    predict(features: number[]): number {
        let z = this.bias;
        for (let i = 0; i < this.weights.length; i++) {
            z += features[i] * this.weights[i];
        }
        return this.sigmoid(z);
    }

    predictBatch(featuresList: number[][]): number[] {
        return featuresList.map((f) => this.predict(f));
    }

    train(
        dataset: TrainingExample[],
        learningRate: number,
        epochs: number,
        l2Lambda = 0.01,
        options?: {
            deadline?: number; // timestamp ms — timeout cooperative
            divergenceThreshold?: number; // np. 0.05 = 5% nad best loss
            divergenceEpochs?: number; // ile epok z rzędu ponad próg → błąd
            onEpoch?: (epoch: number, avgLoss: number) => void;
        }
    ): void {
        const n = dataset.length;
        if (n === 0) return;
        const {
            deadline,
            divergenceThreshold = 0.05,
            divergenceEpochs = 10,
            onEpoch
        } = options || {};
        let bestLoss = Infinity;
        let badEpochs = 0;

        for (let epoch = 0; epoch < epochs; epoch++) {
            if (deadline && Date.now() > deadline) {
                throw new TrainingTimeoutError(`deadline exceeded at epoch ${epoch}/${epochs}`);
            }
            let totalLoss = 0;
            let l2 = 0;
            for (const example of dataset) {
                const prediction = this.predict(example.features);
                const error = example.label - prediction;
                const w = example.weight;
                for (let i = 0; i < this.weights.length; i++) {
                    this.weights[i] +=
                        learningRate *
                        (error * example.features[i] * w - l2Lambda * this.weights[i]);
                }
                this.bias += learningRate * error * w;
                totalLoss +=
                    w *
                    (example.label * Math.log(Math.max(prediction, 1e-10)) +
                        (1 - example.label) * Math.log(Math.max(1 - prediction, 1e-10)));
            }
            for (let i = 0; i < this.weights.length; i++) {
                l2 += this.weights[i] * this.weights[i];
            }

            // Guardrail numeryczny: NaN/Inf w jakiejkolwiek wadze lub bias po
            // aktualizacji = zepsuty model. Zatrzymaj natychmiast (nie czekaj
            // na następną epokę — model i tak jest bezużyteczny).
            if (!Number.isFinite(this.bias) || this.weights.some((w) => !Number.isFinite(w))) {
                throw new TrainingNumericalError(
                    `non-finite weights/bias at epoch ${epoch}/${epochs}`
                );
            }

            const avgLoss = -totalLoss / n + (l2Lambda / 2) * (l2 / n);
            if (!Number.isFinite(avgLoss)) {
                throw new TrainingNumericalError(`non-finite loss at epoch ${epoch}/${epochs}`);
            }
            if (avgLoss < bestLoss) {
                bestLoss = avgLoss;
                badEpochs = 0;
            } else if (avgLoss > bestLoss * (1 + divergenceThreshold)) {
                // Divergencja: loss rośnie znacząco ponad najlepszy dotąd —
                // N kolejnych takich epok = niestabilny trening (nie pojedyncza oscylacja).
                badEpochs++;
                if (badEpochs >= divergenceEpochs) {
                    throw new TrainingDivergenceError(
                        `loss diverged ${badEpochs} epochs (best=${bestLoss}, last=${avgLoss})`
                    );
                }
            } else {
                badEpochs = 0;
            }
            if (onEpoch) onEpoch(epoch, avgLoss);

            if (epoch % 1000 === 0) {
                if (avgLoss < 0.001) break;
            }
        }
    }

    getWeights(): number[] {
        return [...this.weights];
    }

    getBias(): number {
        return this.bias;
    }

    getFeatureCount(): number {
        return this.featureCount;
    }
}
