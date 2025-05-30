/**
 * @bulktrack/scientific-calc
 * 筋肥大トレーニングの科学的計算モジュール
 */
// Import calculators for internal use
import { EffectiveRepsCalculator } from '@/calculators/effective-reps';
import { VolumeCalculator } from '@/calculators/volume';
import { LoadDistributionCalculator } from '@/calculators/load-distribution';
import { OneRepMaxCalculator } from '@/calculators/one-rep-max';
// Re-export Calculators
export { EffectiveRepsCalculator } from '@/calculators/effective-reps';
export { VolumeCalculator } from '@/calculators/volume';
export { LoadDistributionCalculator } from '@/calculators/load-distribution';
export { OneRepMaxCalculator } from '@/calculators/one-rep-max';
// Factory functions for convenience
export const createCalculators = () => ({
    effectiveReps: new EffectiveRepsCalculator(),
    volume: new VolumeCalculator(),
    loadDistribution: new LoadDistributionCalculator(),
    oneRepMax: new OneRepMaxCalculator(),
});
