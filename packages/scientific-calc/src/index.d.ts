/**
 * @bulktrack/scientific-calc
 * 筋肥大トレーニングの科学的計算モジュール
 */
export { EffectiveRepsCalculator } from '@/calculators/effective-reps';
export { VolumeCalculator } from '@/calculators/volume';
export { LoadDistributionCalculator } from '@/calculators/load-distribution';
export { OneRepMaxCalculator } from '@/calculators/one-rep-max';
export type { EffectiveRepsParams, } from '@/calculators/effective-reps';
export type { VolumeCalculationParams, EffectiveVolumeParams, } from '@/calculators/volume';
export type { LoadDistributionEntry, IntensityZone, ZoneDistribution, } from '@/calculators/load-distribution';
export type { OneRMFormula, OneRMParams, } from '@/calculators/one-rep-max';
export type { MovementType, TrainingMetrics, MuscleContribution, TrainingIntensity, RestPeriod, } from '@/types';
export declare const createCalculators: () => {
    effectiveReps: any;
    volume: any;
    loadDistribution: any;
    oneRepMax: any;
};
