/**
 * APIレスポンスとして返されるエクササイズのデータ転送オブジェクト(DTO)。
 * OpenAPIの Exercise スキーマに対応します。
 */
export type ExerciseDto = {
  id: string;                    // UUID v7
  canonical_name: string;
  locale: string;                // 実際に返される翻訳のロケール
  name: string;                  // localeに基づいた名称
  aliases?: string;               // localeに基づいたエイリアスのCSV文字列 (OpenAPIの ExerciseCreate.aliases と同じ形式)
  is_official: boolean;
  last_used_at?: string | null;  // ISO 8601 date-time string
  // default_muscle_id や author_user_id など、OpenAPIスキーマのExerciseに含まれていても
  // /v1/exercises GETのレスポンスには不要なものは含めない (ExerciseCreateとは異なる)
};

/**
 * ドメインエンティティ Exercise から ExerciseDto への変換を行います。
 * @param exercise ドメインエンティティ
 * @param locale 優先するロケール
 * @returns ExerciseDto
 */
import type { Exercise, ExerciseTranslation } from '../../domain/exercise/entity';

export function toExerciseDto(exercise: Exercise, locale: string): ExerciseDto {
  const name = exercise.getName(locale);
  const aliasesArray = exercise.getAliases(locale);

  // 実際に翻訳が見つかったロケール、またはフォールバックとしてcanonicalNameが使われた場合のロケールを特定
  // ここでは簡略化のため、要求されたlocaleをそのまま使うが、より厳密には翻訳の有無を確認する
  const effectiveLocale = exercise.translations.find((t: ExerciseTranslation) => t.locale === locale) ? locale : 'canonical';

  return {
    id: exercise.id,
    canonical_name: exercise.canonicalName,
    locale: effectiveLocale, // または、実際に名前が取得できたロケール
    name: name,
    aliases: aliasesArray.length > 0 ? aliasesArray.join(',') : undefined,
    is_official: exercise.isOfficial,
    last_used_at: exercise.lastUsedAt?.toISOString(),
  };
}

export function toExerciseDtoList(exercises: Exercise[], locale: string): ExerciseDto[] {
  return exercises.map(ex => toExerciseDto(ex, locale));
} 