import type { ExerciseService } from '../../../domain/exercise/service';
import { toExerciseDtoList, type ExerciseDto } from '../../dto/exercise';

/**
 * エクササイズ検索クエリのパラメータを表す型。
 */
export type SearchExercisesQuery = {
  q: string | null; // 検索文字列 (OpenAPIのクエリパラメータ q に対応)
  locale: string;   // ロケール (OpenAPIのクエリパラメータ locale に対応)
};

/**
 * エクササイズ検索ユースケースを処理するハンドラ。
 */
export class SearchExercisesHandler {
  constructor(private readonly exerciseService: ExerciseService) {}

  /**
   * エクササイズ検索クエリを実行し、結果をDTOのリストとして返します。
   * @param query エクササイズ検索クエリ
   * @returns エクササイズDTOの配列
   */
  async execute(query: SearchExercisesQuery): Promise<ExerciseDto[]> {
    const { q, locale } = query;

    const exercises = await this.exerciseService.searchExercises(q, locale);

    return toExerciseDtoList(exercises, locale);
  }
}
