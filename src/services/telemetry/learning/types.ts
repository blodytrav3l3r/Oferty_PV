export interface ExtractedFeature {
    name: string;
    value: string | number | boolean;
    weight: number;
    category: 'geometric' | 'user' | 'solver' | 'transition' | 'acceptance';
}

export interface FeatureVector {
    wellId: string;
    telemetryId: string;
    dn: string;
    features: ExtractedFeature[];
    extractedAt: string;
}
