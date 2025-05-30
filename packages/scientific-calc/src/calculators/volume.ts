/**
 * ボリューム計算モジュール
 * 筋肥大トレーニングにおけるボリューム指標の計算
 */

export interface VolumeCalculationParams {
  weight: number;
  reps: number;
  sets?: number;
}

export interface EffectiveVolumeParams extends VolumeCalculationParams {
  effectiveReps: number;
  relativeShare: number; // 0-1000 (千分率)
  tensionFactor?: number; // デフォルト1.0
}

export class VolumeCalculator {
  /**
   * 基本ボリューム計算
   * Volume = Weight × Reps × Sets
   */
  calculateBasicVolume(params: VolumeCalculationParams): number {
    const sets = params.sets ?? 1;
    return params.weight * params.reps * sets;
  }
  
  /**
   * 効果的ボリューム計算
   * Schoenfeld et al. (2017) - ボリュームと筋肥大の関係
   * 筋肉の寄与率と緊張係数を考慮
   */
  calculateEffectiveVolume(params: EffectiveVolumeParams): number {
    const basicVolume = this.calculateBasicVolume(params);
    const relativeShareDecimal = params.relativeShare / 1000;
    const tensionFactor = params.tensionFactor ?? 1.0;
    
    // 効果的レップスを使用したボリューム
    const effectiveVolume = params.weight * params.effectiveReps;
    
    // 筋肉寄与率と緊張係数を適用
    return effectiveVolume * relativeShareDecimal * tensionFactor;
  }
  
  /**
   * 週間ボリュームの集計
   */
  aggregateWeeklyVolume(dailyVolumes: number[]): {
    total: number;
    average: number;
    max: number;
    min: number;
  } {
    if (dailyVolumes.length === 0) {
      return { total: 0, average: 0, max: 0, min: 0 };
    }
    
    const total = dailyVolumes.reduce((sum, vol) => sum + vol, 0);
    const average = total / dailyVolumes.length;
    const max = Math.max(...dailyVolumes);
    const min = Math.min(...dailyVolumes);
    
    return { total, average, max, min };
  }
  
  /**
   * 相対的ボリューム強度 (RVI: Relative Volume Intensity)
   * 体重あたりのボリュームを計算
   */
  calculateRelativeVolumeIntensity(
    volume: number,
    bodyWeight: number
  ): number {
    if (bodyWeight <= 0) {
      throw new Error('Body weight must be positive');
    }
    return volume / bodyWeight;
  }
}