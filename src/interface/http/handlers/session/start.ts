import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as v from 'valibot';
import type { StartSessionResponseDto } from '../../../../app/dto/session.dto';
import { StartSessionCommand, type StartSessionHandler } from '../../../../app/command/session/start-session';
import type { StartSessionResult } from '../../../../app/command/session/start-session';
import { WorkoutSessionService } from '../../../../domain/workout/service';
import type { IWorkoutSessionRepository } from '../../../../domain/workout/repository';
import { UserIdVO, MenuIdVO } from '../../../../domain/shared/vo/identifier';
import type { WorkoutSession } from '../../../../domain/workout/entity';

// AppEnvから StartSessionHandler の型をインポートまたは定義する必要がある
// ここでは仮に any としておくが、router.tsのAppEnvと合わせるべき
interface AppEnvVariablesWithSessionHandler {
  startSessionHandler: StartSessionHandler;
  // 他の c.var に設定されるプロパティもここに追加
}

// リクエストボディのValibotスキーマ
const StartSessionRequestSchema = v.objectAsync({
  menuId: v.optional(
    v.nullable(
      v.pipe(
        v.string("Menu ID must be a string if provided."), 
        v.uuid("Menu ID must be a valid UUID.")
      )
    )
  ),
});

// 仮のリポジトリ実装 (後でインフラ層のものに置き換える)
const tempWorkoutSessionRepository: IWorkoutSessionRepository = {
  findById: async (id) => null, // TODO: Implement
  findByUserId: async (userId) => [], // TODO: Implement
  save: async (session: WorkoutSession) => { console.log('Session saved (temp):', session.toPrimitives()); }, // TODO: Implement
};

// WorkoutSessionServiceは状態を持たないことが多いのでnewで良い場合もあるが、リポジトリは具体的な実装が必要
const workoutSessionService = new WorkoutSessionService(tempWorkoutSessionRepository);

export async function startSessionHttpHandler( // 関数名を変更して区別
  c: Context<{ Variables: AppEnvVariablesWithSessionHandler }>
): Promise<Response> {
  try {
    const jwtPayload = c.get('jwtPayload');
    if (!jwtPayload || typeof jwtPayload.sub !== 'string') { 
      throw new HTTPException(401, { message: 'Unauthorized: Missing or invalid user ID in token' });
    }
    const userIdString = jwtPayload.sub;

    const body = await c.req.json();
    const validatedBody = await v.parseAsync(StartSessionRequestSchema, body);

    const handler = c.var.startSessionHandler; // c.var からハンドラインスタンスを取得
    if (!handler) {
        throw new HTTPException(500, { message: 'Session handler not configured.' });
    }

    const userId = new UserIdVO(userIdString);
    const menuId = (validatedBody.menuId !== undefined && validatedBody.menuId !== null) 
                   ? new MenuIdVO(validatedBody.menuId) 
                   : null;

    const command = new StartSessionCommand(userId, menuId);
    const result: StartSessionResult = await handler.execute(command);

    const responseDto: StartSessionResponseDto = {
      sessionId: result.sessionId.value,
      startedAt: result.startedAt.toISOString(),
    };

    return c.json(responseDto, 201);

  } catch (error: unknown) {
    if (error instanceof v.ValiError) {
      throw new HTTPException(400, {
        message: 'Validation failed',
        cause: error.issues.map(issue => ({
          path: issue.path?.map((p: { key: string | number | symbol }) => p.key).join('.'),
          message: issue.message
        })),
      });
    }
    if (error instanceof HTTPException) {
        throw error; 
    }
    console.error('Error in startSessionHttpHandler:', error);
    throw new HTTPException(500, { message: 'Internal server error' });
  }
}
