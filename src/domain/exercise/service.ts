import { Exercise, type ExerciseTranslation } from './entity';
import { ExerciseIdVO } from '../shared/vo/identifier';
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
  async createCustomExercise(
    canonicalName: string,
    locale: string,
    name: string,
    aliases: string[] | undefined,
    authorUserId: string,
    defaultMuscleId?: number,
    isCompound = false,
  ): Promise<Exercise> {
    const exerciseId = ExerciseIdVO.generate();

    const translations: ExerciseTranslation[] = [];
    if (locale && name) {
      translations.push({
        locale: locale,
        name: name,
        aliases: aliases,
      });
    }

    const newExercise = new Exercise(
      exerciseId,
      canonicalName,
      defaultMuscleId ?? null,
      isCompound,
      false,
      authorUserId,
      null,
      new Date(),
      translations,
    );

    await this.exerciseRepository.create(newExercise);
    return newExercise;
  }

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

  /**
   * 指定されたIDのエクササイズを削除します。
   * 関連する翻訳やFTSデータもリポジトリ層で削除されます。
   * @param exerciseId 削除するエクササイズのID (VO)
   * @returns Promise<void>
   */
  async deleteExercise(exerciseId: ExerciseIdVO): Promise<void> {
    // 存在確認はリポジトリやDBの制約に任せるか、ここで行うか選択
    // ここではリポジトリに処理を委譲
    await this.exerciseRepository.deleteFullExerciseById(exerciseId);
    // 呼び出し元に削除成功を伝えるだけで、エンティティを返す必要はないことが多い
  }

  /**
   * エクササイズに翻訳情報を追加または更新します。
   * 成功した場合、更新されたエクササイズエンティティを返します。
   * @param exerciseId 対象のエクササイズID (VO)
   * @param translation 保存する翻訳情報
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async addOrUpdateTranslation(
    exerciseId: ExerciseIdVO,
    translation: ExerciseTranslation,
  ): Promise<Exercise | null> {
    // 1. リポジトリ経由で翻訳を保存
    await this.exerciseRepository.saveExerciseTranslation(exerciseId, translation);

    // 2. 更新されたエクササイズエンティティ全体をリポジトリから再取得して返す
    //    これにより、呼び出し元は最新の状態（他の翻訳も含む）を把握できる
    const updatedExercise = await this.exerciseRepository.findById(exerciseId);
    return updatedExercise;
  }

  /**
   * エクササイズから指定されたロケールの翻訳情報を削除します。
   * 成功した場合、更新されたエクササイズエンティティを返します。
   * @param exerciseId 対象のエクササイズID (VO)
   * @param locale 削除する翻訳のロケール
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async deleteTranslation(
    exerciseId: ExerciseIdVO,
    locale: string,
  ): Promise<Exercise | null> {
    // 1. リポジトリ経由で翻訳を削除
    await this.exerciseRepository.deleteExerciseTranslation(exerciseId, locale);

    // 2. 更新された（かもしれない）エクササイズエンティティを再取得して返す
    const updatedExercise = await this.exerciseRepository.findById(exerciseId);
    return updatedExercise;
  }

  /**
   * エクササイズの canonicalName を更新します。
   * @param exerciseId 更新するエクササイズのID (VO)
   * @param newCanonicalName 新しい canonicalName
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async updateExerciseCanonicalName(
    exerciseId: ExerciseIdVO,
    newCanonicalName: string,
  ): Promise<Exercise | null> {
    const exercise = await this.exerciseRepository.findById(exerciseId);
    if (!exercise) {
      return null; // もしくはエラーをスロー
    }

    // Exercise エンティティはイミュータブルであるべきだが、ここでは簡略化のため直接プロパティを変更するのではなく、
    // 新しいインスタンスを作成する形で更新を表現する (実際にはExerciseクラスに更新用メソッドがあると良い)
    const updatedExercise = new Exercise(
      exercise.id,
      newCanonicalName, // ここを更新
      exercise.defaultMuscleId,
      exercise.isCompound,
      exercise.isOfficial,
      exercise.authorUserId,
      exercise.lastUsedAt,
      exercise.createdAt, // createdAt は通常不変だが、Exerciseのコンストラクタに合わせる
      exercise.translations, // 翻訳はそのまま
    );

    // リポジトリの saveFullExercise を使って永続化 (FTS更新も行われる)
    await this.exerciseRepository.saveFullExercise(updatedExercise);
    return updatedExercise; // 保存したエンティティを返す
  }

  /**
   * エクササイズの詳細情報 (defaultMuscleId, isCompound) を更新します。
   * isOfficial や authorUserId はここでは更新対象外とします。
   * @param exerciseId 更新するエクササイズのID (VO)
   * @param details 更新する詳細情報。指定されたプロパティのみ更新されます。
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async updateExerciseDetails(
    exerciseId: ExerciseIdVO,
    details: { defaultMuscleId?: number | null; isCompound?: boolean },
  ): Promise<Exercise | null> {
    const exercise = await this.exerciseRepository.findById(exerciseId);
    if (!exercise) {
      return null;
    }

    const updatedExercise = new Exercise(
      exercise.id,
      exercise.canonicalName,
      details.defaultMuscleId !== undefined ? details.defaultMuscleId : exercise.defaultMuscleId,
      details.isCompound !== undefined ? details.isCompound : exercise.isCompound,
      exercise.isOfficial,
      exercise.authorUserId,
      exercise.lastUsedAt,
      exercise.createdAt,
      exercise.translations,
    );

    await this.exerciseRepository.saveFullExercise(updatedExercise);
    return updatedExercise;
  }
}
