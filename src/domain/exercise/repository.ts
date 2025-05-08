import type { Exercise, ExerciseId } from './entity';

export interface IExerciseRepository {
  /**
   * 指定されたクエリとロケールに基づいてエクササイズを検索します。
   * クエリがnullまたは空の場合、最近使用されたエクササイズやデフォルトのリストを返すことが期待されます。
   * @param query 検索クエリ文字列 (部分一致、前方一致など実装に依存)
   * @param locale ユーザーのロケール (例: 'ja', 'en')
   * @returns 条件に一致するエクササイズの配列
   */
  search(query: string | null, locale: string): Promise<Exercise[]>;

  /**
   * 指定されたIDのエクササイズを取得します。
   * @param id 取得するエクササイズのID
   * @returns エクササイズエンティティ、見つからない場合はnull
   */
  findById(id: ExerciseId): Promise<Exercise | null>;

  /**
   * 新しいエクササイズを作成（永続化）します。
   * @param exercise 作成するエクササイズエンティティ
   */
  create(exercise: Exercise): Promise<void>;

  // 必要に応じて、更新 (update) や削除 (delete) メソッドも定義できますが、
  // 今回のGETエンドポイント実装には直接関係しないため、一旦含めません。
} 
