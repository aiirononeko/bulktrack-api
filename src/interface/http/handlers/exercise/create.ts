import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { JWTPayload } from "hono/utils/jwt/types"; // JWTPayloadをインポート
import { validator } from "hono/validator";
import { toExerciseDto } from "../../../../application/dto/exercise"; // DTO変換関数
import { ExerciseIdVO } from "../../../../domain/shared/vo/identifier";
import type { AppEnv } from "../../router"; // 相対パスを修正

interface ExerciseMuscleInputDto {
  muscle_id: number;
  relative_share: number;
  source_id?: string;
  source_details?: string;
}

interface ExerciseCreateRequest {
  canonical_name: string;
  locale: string; // 最初の翻訳ロケール
  name: string; // 最初の翻訳名
  aliases?: string[]; // 最初の翻訳エイリアス (OpenAPIではstring CSVかもしれないので注意)
  default_muscle_id?: number;
  is_compound?: boolean;
  exercise_muscles?: ExerciseMuscleInputDto[];
  // author_user_id は認証情報から取得するのでリクエストボディには含めない想定
}

const app = new Hono<AppEnv>();

app.post(
  "/", // ルーター側で /v1/exercises にマウントされる想定
  validator("json", (value, c) => {
    const body = value as ExerciseCreateRequest;
    // ここで詳細なバリデーションルールを適用 (例: zod)
    if (!body.canonical_name || typeof body.canonical_name !== "string") {
      throw new HTTPException(400, {
        message: "canonical_name is required and must be a string",
      });
    }
    if (!body.locale || typeof body.locale !== "string") {
      throw new HTTPException(400, {
        message: "locale is required and must be a string",
      });
    }
    if (!body.name || typeof body.name !== "string") {
      throw new HTTPException(400, {
        message: "name is required and must be a string",
      });
    }
    if (body.aliases && !Array.isArray(body.aliases)) {
      throw new HTTPException(400, {
        message: "aliases must be an array of strings",
      });
    }
    if (
      body.default_muscle_id !== undefined &&
      typeof body.default_muscle_id !== "number"
    ) {
      throw new HTTPException(400, {
        message: "default_muscle_id must be a number",
      });
    }
    if (
      body.is_compound !== undefined &&
      typeof body.is_compound !== "boolean"
    ) {
      throw new HTTPException(400, {
        message: "is_compound must be a boolean",
      });
    }
    if (body.exercise_muscles) {
      if (!Array.isArray(body.exercise_muscles)) {
        throw new HTTPException(400, {
          message: "exercise_muscles must be an array",
        });
      }
      for (const em of body.exercise_muscles) {
        if (typeof em.muscle_id !== "number") {
          throw new HTTPException(400, {
            message: "exercise_muscles[].muscle_id must be a number",
          });
        }
        if (
          typeof em.relative_share !== "number" ||
          em.relative_share < 0 ||
          em.relative_share > 1000
        ) {
          throw new HTTPException(400, {
            message:
              "exercise_muscles[].relative_share must be a number between 0 and 1000",
          });
        }
        if (em.source_id !== undefined && typeof em.source_id !== "string") {
          throw new HTTPException(400, {
            message: "exercise_muscles[].source_id must be a string",
          });
        }
        if (
          em.source_details !== undefined &&
          typeof em.source_details !== "string"
        ) {
          throw new HTTPException(400, {
            message: "exercise_muscles[].source_details must be a string",
          });
        }
      }
    }
    return body; // バリデーション成功時はそのまま返す
  }),
  async (c) => {
    const exerciseService = c.get("exerciseService");
    const jwtPayload = c.get("jwtPayload") as JWTPayload | undefined;

    let userIdString: string | undefined;
    if (jwtPayload) {
      if (typeof jwtPayload.userId === "string") {
        userIdString = jwtPayload.userId;
      } else if (typeof jwtPayload.sub === "string") {
        userIdString = jwtPayload.sub;
      } else if (jwtPayload.sub !== undefined) {
        userIdString = String(jwtPayload.sub);
      }
    }

    if (!userIdString) {
      throw new HTTPException(401, {
        message: "Unauthorized - User ID not found or invalid in JWT",
      });
    }
    if (!exerciseService) {
      throw new HTTPException(500, {
        message: "Exercise service not available",
      });
    }

    const reqBody = c.req.valid("json");

    try {
      const exerciseMusclesDomain = reqBody.exercise_muscles?.map((dto) => ({
        // exerciseId はサービス側で Exercise エンティティ作成時に設定されるため、ここでは不要
        muscleId: dto.muscle_id,
        relativeShare: dto.relative_share,
        sourceId: dto.source_id,
        sourceDetails: dto.source_details,
      }));

      const newExercise = await exerciseService.createCustomExercise(
        reqBody.canonical_name,
        reqBody.locale,
        reqBody.name,
        reqBody.aliases,
        userIdString,
        reqBody.default_muscle_id,
        reqBody.is_compound ?? false,
        exerciseMusclesDomain, // 変換後のデータを渡す
      );

      // レスポンスロケールは作成時のロケールを使用
      const dto = toExerciseDto(newExercise, reqBody.locale);
      return c.json(dto, 201); // 201 Created
    } catch (error) {
      console.error("[ExerciseCreateHandler] Error:", error);
      if (error instanceof HTTPException) throw error;
      // ドメインサービスやリポジトリで発生した予期せぬエラー
      throw new HTTPException(500, { message: "Internal Server Error" });
    }
  },
);

export default app;
