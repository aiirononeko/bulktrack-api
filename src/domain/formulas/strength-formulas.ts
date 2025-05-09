/**
 * Epley法を使用して1RM（1回最大挙上重量）を推定します。
 * @param weight 使用した重量
 * @param reps 実行したレップ数
 * @returns 推定1RM
 */
export function calculateEpley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    return 0; // またはエラーをスローするか、NaNを返すなど、適切なエラーハンドリングを行う
  }
  if (reps === 1) {
    return weight; // 1レップの場合はそのままの重量が1RM
  }
  return weight * (1 + reps / 30);
}
