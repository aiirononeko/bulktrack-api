import type { Exercise, ExerciseTranslation } from "./entity";
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

  // --- FTS対応で追加/変更が必要になる可能性のあるメソッド群 ---
  /**
   * エクササイズエンティティ全体を保存（作成または更新）します。
   * 実装側でFTSの更新も行います。
   * @param exercise 保存するエクササイズエンティティ
   */
  saveFullExercise(exercise: Exercise): Promise<void>;

  /**
   * 指定されたIDのエクササイズを完全に削除します。
   * 関連する翻訳やFTSデータも削除されることを期待します。
   * @param exerciseId 削除するエクササイズのID (VO)
   */
  deleteFullExerciseById(exerciseId: ExerciseIdVO): Promise<void>;

  /**
   * エクササイズに翻訳情報を追加または更新します。
   * 実装側でFTSの更新も行います。
   * @param exerciseId 対象のエクササイズID (VO)
   * @param translation 保存する翻訳情報
   */
  saveExerciseTranslation(exerciseId: ExerciseIdVO, translation: ExerciseTranslation): Promise<void>;

  /**
   * エクササイズから指定されたロケールの翻訳情報を削除します。
   * 実装側でFTSの更新も行います。
   * @param exerciseId 対象のエクササイズID (VO)
   * @param locale 削除する翻訳のロケール
   */
  deleteExerciseTranslation(exerciseId: ExerciseIdVO, locale: string): Promise<void>;
  // --- ここまで追加 --- 

  // 必要に応じて、更新 (update) や削除 (delete) メソッドも定義できますが、
  // 今回のGETエンドポイント実装には直接関係しないため、一旦含めません。
} 
