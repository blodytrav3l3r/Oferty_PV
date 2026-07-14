export interface TrainingExample {
    features: number[];
    label: number;
    weight: number;
}

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

    train(dataset: TrainingExample[], learningRate: number, epochs: number): void {
        const n = dataset.length;
        if (n === 0) return;

        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;
            for (const example of dataset) {
                const prediction = this.predict(example.features);
                const error = example.label - prediction;
                const w = example.weight;
                for (let i = 0; i < this.weights.length; i++) {
                    this.weights[i] += learningRate * error * example.features[i] * w;
                }
                this.bias += learningRate * error * w;
                totalLoss +=
                    w *
                    (example.label * Math.log(Math.max(prediction, 1e-10)) +
                        (1 - example.label) * Math.log(Math.max(1 - prediction, 1e-10)));
            }
            if (epoch % 1000 === 0) {
                const avgLoss = -totalLoss / n;
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
