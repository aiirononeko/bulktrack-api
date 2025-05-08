import type { UserIdVO, MenuIdVO, WorkoutSessionIdVO } from "../../../domain/shared/vo/identifier";
import type { IWorkoutSessionRepository } from "../../../domain/workout/repository";
import type { WorkoutSessionService } from "../../../domain/workout/service";
import type { WorkoutSession } from "../../../domain/workout/entities/workout-session.entity";

export class StartSessionCommand {
  constructor(
    public readonly userId: UserIdVO,
    public readonly menuId?: MenuIdVO | null,
  ) {}
}

export interface StartSessionResult {
  sessionId: WorkoutSessionIdVO;
  startedAt: Date;
  // 必要であれば他の情報も追加 (例: 作成されたエンティティ全体)
  // createdSession: WorkoutSession; 
}

export class StartSessionHandler {
  private readonly workoutSessionService: WorkoutSessionService;
  private readonly workoutSessionRepository: IWorkoutSessionRepository;

  constructor(
    workoutSessionService: WorkoutSessionService,
    workoutSessionRepository: IWorkoutSessionRepository,
  ) {
    this.workoutSessionService = workoutSessionService;
    this.workoutSessionRepository = workoutSessionRepository;
  }

  async execute(command: StartSessionCommand): Promise<StartSessionResult> {
    const { userId, menuId } = command;

    // WorkoutSessionServiceを使用してセッションエンティティを作成
    // WorkoutSessionServiceはID生成とstartedAtの設定を行う
    const newSession: WorkoutSession = this.workoutSessionService.startSession({
      userId,
      menuId,
      // customSessionIdGenerator や customDateProvider は
      // 必要に応じてDIコンテナやファクトリ経由で注入するか、
      // ここではデフォルトの動作に任せる
    });

    // 作成されたセッションをリポジトリに保存
    await this.workoutSessionRepository.save(newSession);

    // 結果を返す
    return {
      sessionId: newSession.id,
      startedAt: newSession.startedAt,
      // createdSession: newSession // 必要であればエンティティ全体を返す
    };
  }
}
