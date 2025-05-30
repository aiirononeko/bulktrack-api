/**
 * 1RM (One Rep Max) 推定計算モジュール
 * 複数の推定式をサポート
 */

export type OneRMFormula = 'epley' | 'brzycki' | 'lander' | 'lombardi' | 'mayhew' | 'oconner' | 'wathan';

export interface OneRMParams {
  weight: number;
  reps: number;
  formula?: OneRMFormula;
}

export class OneRepMaxCalculator {
  /**
   * Epley Formula (1985)
   * 1RM = weight × (1 + reps / 30)
   * 最も一般的な推定式
   */
  calculateEpley(weight: number, reps: number): number {
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  }
  
  /**
   * Brzycki Formula (1993)
   * 1RM = weight × (36 / (37 - reps))
   * 1-10レップスで精度が高い
   */
  calculateBrzycki(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps >= 37) {
      throw new Error('Brzycki formula is not valid for reps >= 37');
    }
    return weight * (36 / (37 - reps));
  }
  
  /**
   * Lander Formula (1985)
   * 1RM = (100 × weight) / (101.3 - 2.67123 × reps)
   */
  calculateLander(weight: number, reps: number): number {
    if (reps === 1) return weight;
    const denominator = 101.3 - 2.67123 * reps;
    if (denominator <= 0) {
      throw new Error('Lander formula is not valid for this rep range');
    }
    return (100 * weight) / denominator;
  }
  
  /**
   * Lombardi Formula (1989)
   * 1RM = weight × reps^0.10
   */
  calculateLombardi(weight: number, reps: number): number {
    if (reps === 1) return weight;
    return weight * Math.pow(reps, 0.10);
  }
  
  /**
   * Mayhew et al. Formula (1992)
   * 1RM = (100 × weight) / (52.2 + 41.9 × e^(-0.055 × reps))
   */
  calculateMayhew(weight: number, reps: number): number {
    if (reps === 1) return weight;
    const denominator = 52.2 + 41.9 * Math.exp(-0.055 * reps);
    return (100 * weight) / denominator;
  }
  
  /**
   * O'Conner Formula (1989)
   * 1RM = weight × (1 + 0.025 × reps)
   */
  calculateOConner(weight: number, reps: number): number {
    if (reps === 1) return weight;
    return weight * (1 + 0.025 * reps);
  }
  
  /**
   * Wathan Formula (1994)
   * 1RM = (100 × weight) / (48.8 + 53.8 × e^(-0.075 × reps))
   */
  calculateWathan(weight: number, reps: number): number {
    if (reps === 1) return weight;
    const denominator = 48.8 + 53.8 * Math.exp(-0.075 * reps);
    return (100 * weight) / denominator;
  }
  
  /**
   * 統合推定メソッド
   * 指定された推定式またはデフォルト（Epley）で計算
   */
  calculate(params: OneRMParams): number {
    const { weight, reps, formula = 'epley' } = params;
    
    if (weight <= 0) {
      throw new Error('Weight must be positive');
    }
    if (reps < 1) {
      throw new Error('Reps must be at least 1');
    }
    
    switch (formula) {
      case 'epley':
        return this.calculateEpley(weight, reps);
      case 'brzycki':
        return this.calculateBrzycki(weight, reps);
      case 'lander':
        return this.calculateLander(weight, reps);
      case 'lombardi':
        return this.calculateLombardi(weight, reps);
      case 'mayhew':
        return this.calculateMayhew(weight, reps);
      case 'oconner':
        return this.calculateOConner(weight, reps);
      case 'wathan':
        return this.calculateWathan(weight, reps);
      default:
        throw new Error(`Unknown formula: ${formula}`);
    }
  }
  
  /**
   * 複数の推定式で計算し、平均値を返す
   * より精度の高い推定を行う場合に使用
   */
  calculateAverage(
    weight: number,
    reps: number,
    formulas: OneRMFormula[] = ['epley', 'brzycki', 'lander']
  ): number {
    const results = formulas.map(formula => 
      this.calculate({ weight, reps, formula })
    );
    
    return results.reduce((sum, val) => sum + val, 0) / results.length;
  }
}