import type { MuscleId } from "../muscle/muscle.vo";
import { ExerciseIdVO } from "../shared/value-objects/identifier";
import { Exercise, type ExerciseTranslation } from "./exercise-full.entity";
import type { ExerciseQueryPort } from "./ports/exercise-query.port";
import type { ExerciseCommandPort } from "./ports/exercise-command.port";
import type { ExerciseAdminPort } from "./ports/exercise-admin.port";
import type {
  ExerciseMuscle,
  ExerciseSourceId,
  RelativeShare,
  SourceDetails,
} from "./value-objects/exercise-muscle.vo";
import { ExerciseNameVO } from "./value-objects/exercise-name-vo";

// ExerciseMuscle から exerciseId を除いた入力用インターフェースを定義
export interface ExerciseMuscleInput {
  muscleId: MuscleId;
  relativeShare: RelativeShare;
  sourceId?: ExerciseSourceId;
  sourceDetails?: SourceDetails;
}

export class ExerciseService {
  constructor(
    private readonly queryPort: ExerciseQueryPort,
    private readonly commandPort: ExerciseCommandPort,
    private readonly adminPort: ExerciseAdminPort,
  ) {}

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
    limit?: number,
    offset?: number,
  ): Promise<Exercise[]> {
    return this.queryPort.search({ query, locale, limit, offset }).then(result => {
      if (result.isErr()) {
        throw result.error;
      }
      return result.unwrap();
    });
  }

  /**
   * カスタムエクササイズを作成します。
   * @param canonicalName エクササイズの標準名 (文字列)
   * @param locale 作成時のロケール
   * @param name そのロケールでの名称
   * @param aliases そのロケールでのエイリアス
   * @param authorUserId 作成者のユーザーID
   * @param defaultMuscleId デフォルトの筋肉ID (MuscleId)
   * @param isCompound コンパウンド種目かどうか
   * @param exerciseMusclesInput このエクササイズに関連する筋肉情報 (オプショナル、exerciseIdなし)
   * @returns 作成されたエクササイズエンティティ
   */
  async createCustomExercise(
    canonicalName: string,
    locale: string,
    name: string,
    aliases: string[] | undefined,
    authorUserId: string,
    defaultMuscleId?: MuscleId | null,
    isCompound = false,
    exerciseMusclesInput: ExerciseMuscleInput[] = [],
  ): Promise<Exercise> {
    const exerciseIdVo = ExerciseIdVO.generate();
    const canonicalNameVo = ExerciseNameVO.create(canonicalName);

    const translations: ExerciseTranslation[] = [];
    if (locale && name) {
      translations.push({
        locale: locale,
        name: name,
        aliases: aliases,
      });
    }

    const exerciseMusclesForEntity: ExerciseMuscle[] = exerciseMusclesInput.map(
      (input) => ({
        ...input,
        exerciseId: exerciseIdVo,
      }),
    );

    const newExercise = new Exercise(
      exerciseIdVo,
      canonicalNameVo,
      defaultMuscleId ?? null,
      isCompound,
      false,
      authorUserId,
      null,
      translations,
      exerciseMusclesForEntity,
    );

    const result = await this.commandPort.create(newExercise);
    if (result.isErr()) {
      throw result.error;
    }
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
    return this.queryPort.findRecentByUserId({ userId, locale, limit, offset }).then(result => {
      if (result.isErr()) {
        throw result.error;
      }
      return result.unwrap();
    });
  }

  /**
   * Records the usage of multiple exercises for a user at the end of a session.
   * It iterates through each exercise ID and calls the repository's upsert method.
   * @param userId The ID of the user.
   * @param exerciseIds An array of exercise IDs (string) used in the session.
   * @param sessionFinishedAt The timestamp when the session finished.
   * @returns Promise<void>
   */
  async recordExerciseUsageForSession(
    userId: string,
    exerciseIds: string[],
    sessionFinishedAt: Date,
  ): Promise<void> {
    if (exerciseIds.length === 0) {
      return;
    }
    const promises = exerciseIds.map(async (id) => {
      const result = await this.commandPort.updateUsage(
        userId,
        new ExerciseIdVO(id),
        sessionFinishedAt,
        true,
      );
      if (result.isErr()) {
        throw result.error;
      }
    });
    await Promise.all(promises);
  }

  /**
   * 指定されたIDのエクササイズを削除します。
   * @param exerciseId 削除するエクササイズのID (ExerciseId)
   * @returns Promise<void>
   */
  async deleteExercise(exerciseId: ExerciseIdVO): Promise<void> {
    const result = await this.adminPort.deleteFullExerciseById(exerciseId);
    if (result.isErr()) {
      throw result.error;
    }
  }

  /**
   * エクササイズに翻訳情報を追加または更新します。
   * @param exerciseId 対象のエクササイズID (ExerciseId)
   * @param translation 保存する翻訳情報
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async addOrUpdateTranslation(
    exerciseId: ExerciseIdVO,
    translation: ExerciseTranslation,
  ): Promise<Exercise | null> {
    const saveResult = await this.adminPort.saveExerciseTranslation(
      exerciseId,
      translation,
    );
    if (saveResult.isErr()) {
      throw saveResult.error;
    }
    const findResult = await this.queryPort.findById(exerciseId);
    if (findResult.isErr()) {
      throw findResult.error;
    }
    return findResult.unwrap();
  }

  /**
   * エクササイズから指定されたロケールの翻訳情報を削除します。
   * @param exerciseId 対象のエクササイズID (ExerciseId)
   * @param locale 削除する翻訳のロケール
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async deleteTranslation(
    exerciseId: ExerciseIdVO,
    locale: string,
  ): Promise<Exercise | null> {
    const deleteResult = await this.adminPort.deleteExerciseTranslation(exerciseId, locale);
    if (deleteResult.isErr()) {
      throw deleteResult.error;
    }
    const findResult = await this.queryPort.findById(exerciseId);
    if (findResult.isErr()) {
      throw findResult.error;
    }
    return findResult.unwrap();
  }

  /**
   * エクササイズの canonicalName を更新します。
   * @param exerciseId 更新するエクササイズのID (ExerciseId)
   * @param newCanonicalName 新しい canonicalName (string)
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async updateExerciseCanonicalName(
    exerciseId: ExerciseIdVO,
    newCanonicalName: string,
  ): Promise<Exercise | null> {
    const findResult = await this.queryPort.findById(exerciseId);
    if (findResult.isErr()) {
      throw findResult.error;
    }
    const exercise = findResult.unwrap();
    if (!exercise) {
      return null;
    }
    const newCanonicalNameVo = ExerciseNameVO.create(newCanonicalName);

    const updatedExercise = new Exercise(
      exercise.id,
      newCanonicalNameVo,
      exercise.defaultMuscleId,
      exercise.isCompound,
      exercise.isOfficial,
      exercise.authorUserId,
      exercise.lastUsedAt,
      exercise.translations,
      exercise.exerciseMuscles,
    );

    const saveResult = await this.adminPort.saveFullExercise(updatedExercise);
    if (saveResult.isErr()) {
      throw saveResult.error;
    }
    return updatedExercise;
  }

  /**
   * エクササイズの詳細情報 (defaultMuscleId, isCompound, exerciseMuscles) を更新します。
   * @param exerciseId 更新するエクササイズのID (ExerciseId)
   * @param details 更新する詳細情報。指定されたプロパティのみ更新されます。
   * @returns 更新されたエクササイズエンティティ、またはエクササイズが見つからない場合はnull
   */
  async updateExerciseDetails(
    exerciseId: ExerciseIdVO,
    details: {
      defaultMuscleId?: MuscleId | null;
      isCompound?: boolean;
      exerciseMuscles?: ExerciseMuscleInput[];
    },
  ): Promise<Exercise | null> {
    const findResult = await this.queryPort.findById(exerciseId);
    if (findResult.isErr()) {
      throw findResult.error;
    }
    const exercise = findResult.unwrap();
    if (!exercise) {
      return null;
    }

    const exerciseMusclesForUpdate: ExerciseMuscle[] | undefined =
      details.exerciseMuscles
        ? details.exerciseMuscles.map((input) => ({
            ...input,
            exerciseId: exerciseId,
          }))
        : exercise.exerciseMuscles;

    const updatedExercise = new Exercise(
      exercise.id,
      exercise.canonicalName,
      details.defaultMuscleId !== undefined
        ? details.defaultMuscleId
        : exercise.defaultMuscleId,
      details.isCompound !== undefined
        ? details.isCompound
        : exercise.isCompound,
      exercise.isOfficial,
      exercise.authorUserId,
      exercise.lastUsedAt,
      exercise.translations,
      exerciseMusclesForUpdate,
    );

    const saveResult = await this.adminPort.saveFullExercise(updatedExercise);
    if (saveResult.isErr()) {
      throw saveResult.error;
    }
    return updatedExercise;
  }
}
