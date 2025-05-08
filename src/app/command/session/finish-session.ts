import type { IWorkoutSessionRepository } from "../../../domain/workout/repository";
import type { WorkoutSessionIdVO, UserIdVO } from "../../../domain/shared/vo/identifier";
import type { WorkoutSessionService } from "../../../domain/workout/service";
import type { FinishSessionResponseDto } from "../../dto/session.dto";

export class FinishSessionCommand {
  constructor(
    public readonly sessionId: WorkoutSessionIdVO,
    public readonly userId: UserIdVO, // 認証から取得したユーザーID
  ) {}
}

export class FinishSessionHandler {
  constructor(
    private readonly workoutSessionRepository: IWorkoutSessionRepository,
    private readonly workoutSessionService: WorkoutSessionService,
  ) {}

  async execute(command: FinishSessionCommand): Promise<FinishSessionResponseDto> {
    const { sessionId, userId } = command;

    const finishedSession = await this.workoutSessionService.finishSession({
      sessionId,
      userId,
    });

    await this.workoutSessionRepository.save(finishedSession);

    if (!finishedSession.finishedAt) {
      // WorkoutSession.finish() と WorkoutSessionService.finishSession() のロジックにより
      // finishedAt は設定されているはずだが、万が一のための防御的チェック
      throw new Error("Internal server error: Session finishedAt was not set after finishing.");
    }

    return {
      sessionId: finishedSession.id.value,
      finishedAt: finishedSession.finishedAt.toISOString(),
    };
  }
}
