import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import type { ExerciseDto } from "../../../../application/dto/exercise";
import type {
  SearchExercisesHandler,
  SearchExercisesQuery,
} from "../../../../application/query/exercise/search-exercise"; // Adjusted path

// OpenAPIのデフォルトに従い、ロケールのデフォルト値を設定
const DEFAULT_LOCALE = "ja";
const SUPPORTED_LOCALES = ["ja", "en"]; // サポートするロケールリスト

// Accept-Languageヘッダーから優先ロケールを簡易的に取得するヘルパー関数
const getPreferredLocaleFromHeader = (
  headerValue: string | undefined | null,
): string | null => {
  if (!headerValue) return null;
  const languages = headerValue
    .split(",")
    .map((lang) => lang.split(";")[0].trim().toLowerCase());
  for (const lang of languages) {
    const mainLang = lang.split("-")[0]; // 'en-US' -> 'en'
    if (SUPPORTED_LOCALES.includes(mainLang)) {
      return mainLang;
    }
  }
  return null;
};

/**
 * エクササイズ検索API (/v1/exercises GET) のHonoハンドラファクトリ。
 * SearchExercisesHandlerのインスタンスを受け取り、Honoのハンドラ関数を返します。
 * @param searchHandler アプリケーション層の検索ハンドラ
 * @returns Honoリクエストハンドラ関数
 */
export const createSearchExercisesHandler = (
  searchHandler: SearchExercisesHandler,
) => {
  return async (c: Context): Promise<Response> => {
    try {
      const queryParam = c.req.query("q");
      const localeQueryParam = c.req.query("locale");
      const acceptLanguageHeader = c.req.header("accept-language");

      const q = queryParam || null; // クエリがなければnull

      let resolvedLocale: string;
      const preferredLocaleFromHeader =
        getPreferredLocaleFromHeader(acceptLanguageHeader);

      if (preferredLocaleFromHeader) {
        resolvedLocale = preferredLocaleFromHeader;
      } else if (
        localeQueryParam &&
        SUPPORTED_LOCALES.includes(localeQueryParam.toLowerCase())
      ) {
        resolvedLocale = localeQueryParam.toLowerCase();
      } else {
        resolvedLocale = DEFAULT_LOCALE;
      }

      if (typeof resolvedLocale !== "string") {
        // このチェックはほぼ不要になるが念のため
        throw new HTTPException(400, { message: "Invalid locale parameter" });
      }

      const applicationQuery: SearchExercisesQuery = {
        q,
        locale: resolvedLocale,
      };

      const exercisesDto: ExerciseDto[] =
        await searchHandler.execute(applicationQuery);

      return c.json(exercisesDto, 200);
    } catch (error) {
      // アプリケーション層やドメイン層で発生した予期せぬエラー
      // TODO: より詳細なエラーハンドリング (例: エラーの種類に応じたステータスコード)
      console.error("Error in searchExercises handler:", error);
      if (error instanceof HTTPException) {
        throw error; // HonoのHTTPExceptionはそのままスロー
      }
      // その他のエラーは500として返す
      throw new HTTPException(500, { message: "Internal Server Error" });
    }
  };
};
