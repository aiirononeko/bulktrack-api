import type { Exercise } from "./entity";
import type { ExerciseIdVO } from "../shared/vo/identifier";

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
  findById(id: ExerciseIdVO): Promise<Exercise | null>;

  /**
   * 新しいエクササイズを作成（永続化）します。
   * @param exercise 作成するエクササイズエンティティ
   */
  create(exercise: Exercise): Promise<void>;

  /**
   * 認証されたユーザーが最近使用したエクササイズを取得します。
   * @param userId ユーザーID
   * @param locale ユーザーのロケール
   * @param limit 取得する最大件数
   * @param offset 結果のオフセット
   * @returns 条件に一致するエクササイズの配列
   */
  findRecentByUserId(userId: string, locale: string, limit: number, offset: number): Promise<Exercise[]>;

  /**
   * Records or updates the usage of an exercise by a user.
   * If a record for the given userId and exerciseId exists, it updates lastUsedAt and increments useCount.
   * Otherwise, it creates a new record.
   * @param userId The ID of the user.
   * @param exerciseId The ID of the exercise used.
   * @param usedAt The timestamp when the exercise was used (typically session end time).
   * @param incrementUseCount Whether to increment the useCount (defaults to true).
   * @returns Promise<void>
   */
  upsertExerciseUsage(userId: string, exerciseId: string, usedAt: Date, incrementUseCount?: boolean): Promise<void>;

  // 必要に応じて、更新 (update) や削除 (delete) メソッドも定義できますが、
  // 今回のGETエンドポイント実装には直接関係しないため、一旦含めません。
} 
