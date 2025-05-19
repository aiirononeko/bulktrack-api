import type { ExerciseIdVO } from "../shared/vo/identifier";
import type { MuscleId } from "../muscle/vo";
import type { ExerciseMuscle, ExerciseNameVO } from "./vo";

export type ExerciseId = ExerciseIdVO;

// 翻訳情報を表す型
export type ExerciseTranslation = {
  locale: string;
  name: string;
  aliases?: string[]; // CSV or JSON list from openapi.yaml, represented as string[] here
};

export class Exercise {
  constructor(
    public readonly id: ExerciseId,
    public readonly canonicalName: ExerciseNameVO,
    public readonly defaultMuscleId: MuscleId | null,
    public readonly isCompound: boolean,          // Corresponds to exercises.isCompound
    public readonly isOfficial: boolean,          // Corresponds to exercises.isOfficial
    public readonly authorUserId: string | null,    // Corresponds to exercises.authorUserId
    public readonly lastUsedAt: Date | null,      // Corresponds to exercises.lastUsedAt and openapi Exercise.last_used_at
    public readonly translations: ExerciseTranslation[] = [], // Populated from exerciseTranslations table
    public readonly exerciseMuscles: ExerciseMuscle[] = [],
  ) {}

  /**
   * 指定されたロケールでのエクササイズ名を取得します。
   * 翻訳が見つからない場合は、canonicalNameを返します。
   */
  public getName(locale: string): string {
    const translation = this.translations.find(t => t.locale === locale);
    return translation?.name || this.canonicalName.value;
  }

  /**
   * 指定されたロケールでのエイリアス（別名）のリストを取得します。
   * 翻訳またはエイリアスが見つからない場合は、空の配列を返します。
   */
  public getAliases(locale: string): string[] {
    const translation = this.translations.find(t => t.locale === locale);
    // openapi.yamlではaliasesはstringだが、entityでは扱いやすいようにstring[]とする
    // DBのaliasesがCSVならパース処理がリポジトリ実装で必要になる
    return translation?.aliases || [];
  }

  // OpenAPIスキーマのExercise.last_used_at は string, format: date-time
  // DBのexercises.last_used_at も text
  // entityではDate型として扱うが、シリアライズ/デシリアライズはアプリケーション層やインフラ層の責務
}
