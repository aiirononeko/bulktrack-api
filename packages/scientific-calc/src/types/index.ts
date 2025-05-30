/**
 * 科学的計算モジュールの共通型定義
 */

export type MovementType = 'compound' | 'isolation';

export interface TrainingMetrics {
  volume: number;
  effectiveVolume: number;
  effectiveReps: number;
  estimatedOneRM: number;
  intensityPercentage: number;
}

export interface MuscleContribution {
  muscleId: string;
  relativeShare: number; // 0-1000 (千分率)
  tensionFactor: number;
}

export interface TrainingIntensity {
  rpe: number;
  rir: number;
  percentageOf1RM: number;
}

export interface RestPeriod {
  seconds: number;
  isOptimal: boolean;
  recoveryPercentage: number;
}