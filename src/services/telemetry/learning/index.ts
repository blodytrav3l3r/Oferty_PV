/**
 * Learning Engine - Publiczne API.
 * Każdy moduł ma jedną odpowiedzialność.
 */

export { FeatureExtractor } from './FeatureExtractor';
export { PatternDetector } from './PatternDetector';
export { KnowledgeBase } from './KnowledgeBase';
export { PreferenceEngine } from './PreferenceEngine';
export { RankingEngine } from './RankingEngine';
export { RecommendationEngine } from './RecommendationEngine';
export { FeedbackProcessor } from './FeedbackProcessor';
export { ConfidenceCalculator } from './ConfidenceCalculator';
export { LearningEngine, learningEngine } from './LearningEngine';

export type { ExtractedFeature, FeatureVector } from './FeatureExtractor';

export type { PatternType, KnowledgePattern, RecommendationRecord } from './KnowledgeBase';

export type { RankedRecommendation } from './RankingEngine';

export type { TopRecommendation } from './RecommendationEngine';

export type { FeedbackEvent } from './FeedbackProcessor';

export type { LearningRunSummary } from './LearningEngine';
