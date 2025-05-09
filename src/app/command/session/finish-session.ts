import type { IWorkoutSessionRepository } from "../../../domain/workout/repository";
import type { WorkoutSessionIdVO, UserIdVO } from "../../../domain/shared/vo/identifier";
import type { WorkoutSessionService } from "../../../domain/workout/service";
import type { FinishSessionResponseDto } from "../../dto/session.dto";
import type { IAggregationService, AggregationResult } from "../../../domain/aggregation/service";

export class FinishSessionCommand {
  constructor(
    public readonly sessionId: WorkoutSessionIdVO,
    public readonly userId: UserIdVO, // 認証から取得したユーザーID
  ) {}
}

export interface FinishSessionExecutionResult {
  responseDto: FinishSessionResponseDto;
  backgroundTask: Promise<AggregationResult>;
}

export class FinishSessionHandler {
  constructor(
    private readonly workoutSessionRepository: IWorkoutSessionRepository,
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly aggregationService: IAggregationService,
  ) {}

  async execute(command: FinishSessionCommand): Promise<FinishSessionExecutionResult> {
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

    // 集計サービスのPromiseを生成
    const aggregationTask = this.aggregationService.aggregateWorkoutDataForUser(userId)
      .catch(error => {
        console.error(`Error during background aggregation for user ${userId.value} (initial trigger):`, error);
        // waitUntil のために、失敗した場合でも AggregationResult 形式で解決する Promise を返す
        return { success: false, message: `Failed to start aggregation: ${error instanceof Error ? error.message : 'Unknown error'}` };
      });

    return {
      responseDto: {
        sessionId: finishedSession.id.value,
        finishedAt: finishedSession.finishedAt.toISOString(),
      },
      backgroundTask: aggregationTask,
    };
  }
}
