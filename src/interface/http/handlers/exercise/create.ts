import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { AppEnv } from '../../router'; // 相対パスを修正
import { ExerciseIdVO } from '../../../../domain/shared/vo/identifier';
import { toExerciseDto } from '../../../../app/dto/exercise'; // DTO変換関数
import { HTTPException } from 'hono/http-exception';
import type { JWTPayload } from 'hono/utils/jwt/types'; // JWTPayloadをインポート

// OpenAPIの ExerciseCreate スキーマに対応する型 (仮)
// 実際にはopenapi.yamlから生成された型か、手動で正確に定義する必要があります
interface ExerciseCreateRequest {
  canonical_name: string;
  locale: string;         // 最初の翻訳ロケール
  name: string;           // 最初の翻訳名
  aliases?: string[];      // 最初の翻訳エイリアス (OpenAPIではstring CSVかもしれないので注意)
  default_muscle_id?: number;
  is_compound?: boolean;
  // author_user_id は認証情報から取得するのでリクエストボディには含めない想定
}

const app = new Hono<AppEnv>();

app.post(
  '/', // ルーター側で /v1/exercises にマウントされる想定
  validator('json', (value, c) => {
    const body = value as ExerciseCreateRequest;
    // ここで詳細なバリデーションルールを適用 (例: zod)
    if (!body.canonical_name || typeof body.canonical_name !== 'string') {
      throw new HTTPException(400, { message: 'canonical_name is required and must be a string' });
    }
    if (!body.locale || typeof body.locale !== 'string') {
      throw new HTTPException(400, { message: 'locale is required and must be a string' });
    }
    if (!body.name || typeof body.name !== 'string') {
      throw new HTTPException(400, { message: 'name is required and must be a string' });
    }
    // aliases, default_muscle_id, is_compound のバリデーションも同様に追加
    return body; // バリデーション成功時はそのまま返す
  }),
  async (c) => {
    const exerciseService = c.get('exerciseService');
    const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined;

    let userIdString: string | undefined;
    if (jwtPayload) {
      if (typeof jwtPayload.userId === 'string') {
        userIdString = jwtPayload.userId;
      } else if (typeof jwtPayload.sub === 'string') {
        userIdString = jwtPayload.sub;
      } else if (jwtPayload.sub !== undefined) { 
        userIdString = String(jwtPayload.sub);
      }
    }

    if (!userIdString) {
      throw new HTTPException(401, { message: 'Unauthorized - User ID not found or invalid in JWT' });
    }
    if (!exerciseService) {
      throw new HTTPException(500, { message: 'Exercise service not available' });
    }

    const reqBody = c.req.valid('json');

    try {
      const newExercise = await exerciseService.createCustomExercise(
        reqBody.canonical_name,
        reqBody.locale,
        reqBody.name,
        reqBody.aliases, 
        userIdString,
        reqBody.default_muscle_id,
        reqBody.is_compound ?? false,
      );

      // レスポンスロケールは作成時のロケールを使用
      const dto = toExerciseDto(newExercise, reqBody.locale);
      return c.json(dto, 201); // 201 Created
    } catch (error) {
      console.error('[ExerciseCreateHandler] Error:', error);
      if (error instanceof HTTPException) throw error;
      // ドメインサービスやリポジトリで発生した予期せぬエラー
      throw new HTTPException(500, { message: 'Internal Server Error' });
    }
  },
);

export default app;
