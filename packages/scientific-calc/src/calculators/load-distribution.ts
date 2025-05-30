/**
 * 負荷分布計算モジュール
 * トレーニング強度ゾーンの分析
 */

export interface LoadDistributionEntry {
  intensityPercentage: number; // 1RMに対する割合
  volume: number;
  sets: number;
}

export type IntensityZone = 'light' | 'moderate' | 'heavy' | 'maximal';

export interface ZoneDistribution {
  zone: IntensityZone;
  percentageRange: { min: number; max: number };
  totalVolume: number;
  totalSets: number;
  volumePercentage: number;
}

export class LoadDistributionCalculator {
  // Helms et al. (2018) パワーリフティングの強度ゾーン
  private readonly INTENSITY_ZONES: Record<IntensityZone, { min: number; max: number }> = {
    light: { min: 0, max: 60 },      // 低強度：筋持久力向上
    moderate: { min: 60, max: 80 },  // 中強度：筋肥大ゾーン
    heavy: { min: 80, max: 90 },     // 高強度：筋力向上
    maximal: { min: 90, max: 100 },  // 最大強度：最大筋力
  };
  
  /**
   * 負荷分布の計算
   * Schoenfeld et al. (2021) - 強度ゾーン別のボリューム分析
   */
  calculateDistribution(entries: LoadDistributionEntry[]): ZoneDistribution[] {
    const totalVolume = entries.reduce((sum, entry) => sum + entry.volume, 0);
    
    const distributions: ZoneDistribution[] = [];
    
    for (const [zone, range] of Object.entries(this.INTENSITY_ZONES) as [IntensityZone, { min: number; max: number }][]) {
      const zoneEntries = entries.filter(
        entry => entry.intensityPercentage >= range.min && 
                 entry.intensityPercentage < range.max
      );
      
      const zoneVolume = zoneEntries.reduce((sum, entry) => sum + entry.volume, 0);
      const zoneSets = zoneEntries.reduce((sum, entry) => sum + entry.sets, 0);
      
      distributions.push({
        zone,
        percentageRange: range,
        totalVolume: zoneVolume,
        totalSets: zoneSets,
        volumePercentage: totalVolume > 0 ? (zoneVolume / totalVolume) * 100 : 0,
      });
    }
    
    return distributions;
  }
  
  /**
   * 最適な負荷分布の提案
   * Schoenfeld & Grgic (2018) - 筋肥大のための推奨分布
   */
  getOptimalDistributionForHypertrophy(): Record<IntensityZone, number> {
    return {
      light: 10,      // 10% - ウォームアップ、回復
      moderate: 70,   // 70% - メインの筋肥大ワーク
      heavy: 15,      // 15% - 筋力向上も兼ねる
      maximal: 5,     // 5%  - 神経系の適応
    };
  }
  
  /**
   * 現在の分布と最適分布の比較
   */
  compareWithOptimal(
    current: ZoneDistribution[]
  ): Array<{
    zone: IntensityZone;
    currentPercentage: number;
    optimalPercentage: number;
    difference: number;
  }> {
    const optimal = this.getOptimalDistributionForHypertrophy();
    
    return current.map(dist => ({
      zone: dist.zone,
      currentPercentage: dist.volumePercentage,
      optimalPercentage: optimal[dist.zone],
      difference: dist.volumePercentage - optimal[dist.zone],
    }));
  }
}