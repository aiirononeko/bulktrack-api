import { WorkoutSession } from "./entity";
import type { UserIdVO, MenuIdVO } from "../shared/vo/identifier";
import { WorkoutSessionIdVO } from "../shared/vo/identifier";
import { v7 as uuidv7 } from "uuid";

function generateNewWorkoutSessionId(): WorkoutSessionIdVO {
  return new WorkoutSessionIdVO(uuidv7());
}

export class WorkoutSessionService {
  // リポジトリはコンストラクタで注入することも、メソッドの引数で渡すこともできます。
  // ユースケースに応じて設計を選択します。
  // constructor(private readonly workoutSessionRepository: IWorkoutSessionRepository) {}

  public startSession(params: {
    userId: UserIdVO;
    menuId?: MenuIdVO | null;
    customSessionIdGenerator?: () => WorkoutSessionIdVO; // テスト容易性のため
    customDateProvider?: () => Date; // テスト容易性のため
  }): WorkoutSession {
    const now = params.customDateProvider ? params.customDateProvider() : new Date();
    const sessionId = params.customSessionIdGenerator
      ? params.customSessionIdGenerator()
      : generateNewWorkoutSessionId(); // 新しいID生成関数を使用

    const session = WorkoutSession.create({
      id: sessionId,
      userId: params.userId,
      menuId: params.menuId,
      startedAt: now,
    });

    // ドメインサービスはエンティティを返すのが一般的です。
    // 永続化はアプリケーション層（コマンドハンドラ）がリポジトリを介して行います。
    return session;
  }

  // 他のドメインロジック（例: finishSession, addExerciseToSessionなど）もここに追加可能
}
