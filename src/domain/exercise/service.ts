import type { Exercise } from './entity';
import type { IExerciseRepository } from './repository';

export class ExerciseService {
  constructor(private readonly exerciseRepository: IExerciseRepository) {}

  /**
   * 指定されたクエリとロケールに基づいてエクササイズを検索します。
   * @param query 検索クエリ文字列。nullまたは空文字列の場合、リポジトリの実装によっては
   *              最近使われたエクササイズや推奨エクササイズなどを返すこともあります。
   * @param locale ユーザーのロケール (例: 'ja', 'en')
   * @returns 条件に一致するエクササイズの配列
   */
  async searchExercises(
    query: string | null,
    locale: string,
  ): Promise<Exercise[]> {
    // 現状ではリポジトリのsearchメソッドを直接呼び出すだけですが、
    // 必要に応じて、ここで追加のフィルタリング、ソート、
    // または他のビジネスロジックを適用することができます。
    return this.exerciseRepository.search(query, locale);
  }

  /**
   * カスタムエクササイズを作成します。
   * @param canonicalName エクササイズの標準名
   * @param locale 作成時のロケール
   * @param name そのロケールでの名称
   * @param aliases そのロケールでのエイリアス
   * @param authorUserId 作成者のユーザーID
   * @param defaultMuscleId デフォルトの筋肉ID (オプショナル)
   * @param isCompound コンパウンド種目かどうか
   * @returns 作成されたエクササイズエンティティ
   */
  // async createCustomExercise(
  //   canonicalName: string,
  //   locale: string,
  //   name: string,
  //   aliases: string[] | undefined,
  //   authorUserId: string, // User ID from auth context
  //   defaultMuscleId?: number,
  //   isCompound: boolean = false,
  // ): Promise<Exercise> {
  //   // Implement Exercise creation logic here for POST /v1/exercises
  //   // This involves creating an Exercise entity and saving it via the repository.
  //   // For now, this is commented out as we are focusing on the GET endpoint.
  //   throw new Error('Not implemented');
  // }

  /**
   * 認証されたユーザーの最近使用したエクササイズリストを取得します。
   * @param userId ユーザーID
   * @param locale ユーザーのロケール
   * @param limit 取得件数の上限
   * @param offset 取得開始オフセット
   * @returns Exerciseエンティティの配列
   */
  async getRecentExercisesForUser(
    userId: string,
    locale: string,
    limit: number,
    offset: number,
  ): Promise<Exercise[]> {
    // TODO: Add any domain-specific logic here if needed, e.g., validation, enrichment.
    // For now, it directly calls the repository method.
    return this.exerciseRepository.findRecentByUserId(userId, locale, limit, offset);
  }

  /**
   * Records the usage of multiple exercises for a user at the end of a session.
   * It iterates through each exercise ID and calls the repository's upsert method.
   * @param userId The ID of the user.
   * @param exerciseIds An array of exercise IDs used in the session.
   * @param sessionFinishedAt The timestamp when the session finished.
   * @returns Promise<void>
   */
  async recordExerciseUsageForSession(userId: string, exerciseIds: string[], sessionFinishedAt: Date): Promise<void> {
    if (exerciseIds.length === 0) {
      return; // No exercises to record
    }

    // Consider wrapping these in a transaction if the repository itself doesn't handle it
    // and if atomicity for all exercise usage updates for a session is critical.
    // However, individual upserts are often fine.
    const promises = exerciseIds.map(exerciseId => 
      this.exerciseRepository.upsertExerciseUsage(userId, exerciseId, sessionFinishedAt, true)
    );
    
    // We can run them in parallel
    await Promise.all(promises);
    // Or sequentially if preferred for any reason (e.g., reducing load, specific DB constraints)
    // for (const exerciseId of exerciseIds) {
    //   await this.exerciseRepository.upsertExerciseUsage(userId, exerciseId, sessionFinishedAt, true);
    // }
  }
}
