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
}
