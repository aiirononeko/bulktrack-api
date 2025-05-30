import type { MovementType } from '@/types';

export interface EffectiveRepsParams {
  reps: number;
  rpe: number;
  exerciseType: MovementType;
  restTime: number;
  previousSetRPE?: number;
}

export class EffectiveRepsCalculator {
  // Helms et al. (2018) のRIR-RPE関係
  private readonly RIR_MULTIPLIERS: Record<number, number> = {
    0: 1.0,   // RPE 10
    1: 1.0,   // RPE 9
    2: 1.0,   // RPE 8
    3: 1.0,   // RPE 7
    4: 0.65,  // RPE 6
    5: 0.65,  // RPE 5
    6: 0.3,   // RPE 4以下
  };
  
  calculate(params: EffectiveRepsParams): number {
    const rir = 10 - params.rpe;
    const rirMultiplier = this.RIR_MULTIPLIERS[Math.min(rir, 6)];
    
    // Schoenfeld et al. (2015) - 複合種目の中枢疲労考慮
    const movementMultiplier = 
      params.exerciseType === 'compound' ? 0.85 : 1.0;
    
    // Grgic et al. (2018) - 休息時間の影響
    const restMultiplier = this.calculateRestMultiplier(
      params.restTime,
      params.exerciseType
    );
    
    // 累積疲労の考慮
    const fatigueMultiplier = this.calculateFatigue(
      params.rpe,
      params.previousSetRPE
    );
    
    return params.reps * 
           rirMultiplier * 
           movementMultiplier * 
           restMultiplier * 
           fatigueMultiplier;
  }
  
  private calculateRestMultiplier(
    restSeconds: number,
    type: MovementType
  ): number {
    // Schoenfeld et al. (2016) のレスト時間研究
    const optimalRest = type === 'compound' ? 180 : 90;
    
    if (restSeconds >= optimalRest) return 1.0;
    
    // 線形減少
    return 0.7 + (0.3 * (restSeconds / optimalRest));
  }
  
  private calculateFatigue(
    currentRPE: number,
    previousRPE?: number
  ): number {
    if (!previousRPE) return 1.0;
    
    // 前セットからの疲労度累積
    const fatigueFactor = (previousRPE + currentRPE) / 20;
    
    // 0.8～1.0の範囲で調整
    return Math.max(0.8, 1.0 - (fatigueFactor * 0.2));
  }
}