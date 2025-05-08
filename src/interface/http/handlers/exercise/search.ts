import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

import type { SearchExercisesHandler, SearchExercisesQuery } from '../../../../app/query/exercise/search-exercise'; // Adjusted path
import type { ExerciseDto } from '../../../../app/dto/exercise';

// OpenAPIのデフォルトに従い、ロケールのデフォルト値を設定
const DEFAULT_LOCALE = 'ja';

/**
 * エクササイズ検索API (/v1/exercises GET) のHonoハンドラファクトリ。
 * SearchExercisesHandlerのインスタンスを受け取り、Honoのハンドラ関数を返します。
 * @param searchHandler アプリケーション層の検索ハンドラ
 * @returns Honoリクエストハンドラ関数
 */
export const createSearchExercisesHandler = (searchHandler: SearchExercisesHandler) => {
  return async (c: Context): Promise<Response> => {
    try {
      const queryParam = c.req.query('q');
      const localeParam = c.req.query('locale');

      const q = queryParam || null; // クエリがなければnull
      const locale = localeParam || DEFAULT_LOCALE;

      if (typeof locale !== 'string') {
        // localeが予期せぬ形式の場合 (例: 配列など)
        throw new HTTPException(400, { message: 'Invalid locale parameter' });
      }

      const applicationQuery: SearchExercisesQuery = { q, locale };

      const exercisesDto: ExerciseDto[] = await searchHandler.execute(applicationQuery);
      
      return c.json(exercisesDto, 200);
    } catch (error) {
      // アプリケーション層やドメイン層で発生した予期せぬエラー
      // TODO: より詳細なエラーハンドリング (例: エラーの種類に応じたステータスコード)
      console.error('Error in searchExercises handler:', error);
      if (error instanceof HTTPException) {
        throw error; // HonoのHTTPExceptionはそのままスロー
      }
      // その他のエラーは500として返す
      throw new HTTPException(500, { message: 'Internal Server Error' });
    }
  };
};
