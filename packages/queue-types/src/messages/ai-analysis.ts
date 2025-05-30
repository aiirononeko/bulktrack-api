/**
 * AI分析用Queueメッセージ
 */

import type { DomainEvent } from '@bulktrack/shared-kernel';

export interface AIAnalysisMessage extends DomainEvent {
  type: 'ANALYZE_TRAINING_PATTERN' | 'ANALYZE_VOLUME_TRENDS' | 'GENERATE_RECOMMENDATIONS';
  userId: string;
  context: AIAnalysisContext;
}

export interface AIAnalysisContext {
  timeRange: {
    start: Date;
    end: Date;
  };
  muscleGroups?: string[];
  metrics?: {
    totalVolume: number;
    avgIntensity: number;
    trainingFrequency: number;
  };
  previousAnalysis?: {
    id: string;
    timestamp: Date;
  };
}

export interface PatternDetectionMessage extends DomainEvent {
  type: 'PATTERN_DETECTION';
  userId: string;
  patterns: TrainingPattern[];
}

export interface TrainingPattern {
  type: 'progressive_overload' | 'plateau' | 'deload' | 'injury_risk';
  confidence: number; // 0-1
  description: string;
  affectedMuscles: string[];
  detectedAt: Date;
  recommendations: string[];
}

export interface VolumeOptimizationMessage extends DomainEvent {
  type: 'VOLUME_OPTIMIZATION';
  userId: string;
  currentDistribution: Record<string, number>;
  optimalDistribution: Record<string, number>;
  adjustmentPlan: AdjustmentPlan[];
}

export interface AdjustmentPlan {
  muscleGroup: string;
  currentVolume: number;
  targetVolume: number;
  weeklyIncrement: number;
  reasoning: string;
}