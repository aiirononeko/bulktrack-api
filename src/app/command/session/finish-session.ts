import type { IWorkoutSessionRepository } from "../../../domain/workout/repository";
import type { WorkoutSessionIdVO, UserIdVO } from "../../../domain/shared/vo/identifier";
import type { WorkoutSessionService } from "../../../domain/workout/service";
import type { FinishSessionResponseDto } from "../../dto/session.dto";
import type { IAggregationService, AggregationResult } from "../../../domain/aggregation/service";
import type { ExerciseService } from "../../../domain/exercise/service";
import type { WorkoutSet } from "../../../domain/workout/entities/workout-set.entity";

// Define a common result type for background tasks for clarity
interface BackgroundTaskResult {
  success: boolean;
  message?: string; 
  taskName?: string; 
  originalResult?: AggregationResult; // Store original AggregationResult if applicable
}

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
    private readonly exerciseService: ExerciseService, 
  ) {}

  async execute(command: FinishSessionCommand): Promise<FinishSessionExecutionResult> {
    const { sessionId, userId } = command;

    const finishedSession = await this.workoutSessionService.finishSession({
      sessionId,
      userId,
    });
    await this.workoutSessionRepository.save(finishedSession);

    if (!finishedSession.finishedAt) {
      throw new Error("Internal server error: Session finishedAt was not set after finishing.");
    }
    const sessionFinishedAt = finishedSession.finishedAt;

    const backgroundTasks: Promise<BackgroundTaskResult>[] = [];

    // 1. Aggregation Task
    const aggregationTask = this.aggregationService.aggregateWorkoutDataForUser(userId)
      .then((aggResult: AggregationResult): BackgroundTaskResult => {
        return {
          success: aggResult.success,
          message: aggResult.message || (aggResult.success ? "Aggregation completed." : "Aggregation finished with no specific message."),
          taskName: 'Aggregation',
          originalResult: aggResult, 
        };
      }) 
      .catch((error): BackgroundTaskResult => {
        console.error(`Error during background aggregation for user ${userId.value}:`, error);
        return { 
          success: false, 
          message: `Aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          taskName: 'Aggregation' 
          // No originalResult in case of direct catch
        };
      });
    backgroundTasks.push(aggregationTask);

    // 2. Exercise Usage Recording Task
    const recordUsageTask = (async (): Promise<BackgroundTaskResult> => {
      try {
        const setsInSession: WorkoutSet[] = await this.workoutSessionRepository.getSetsBySessionId(sessionId); 
        
        if (!setsInSession || setsInSession.length === 0) {
          return { success: true, message: "No exercise usage to record (no sets).", taskName: 'ExerciseUsage' };
        }

        const uniqueExerciseIds: string[] = [...new Set(setsInSession.map((set: WorkoutSet) => set.exerciseId.value))];
        
        if (uniqueExerciseIds.length > 0) {
          await this.exerciseService.recordExerciseUsageForSession(userId.value, uniqueExerciseIds, sessionFinishedAt);
          return { success: true, message: "Exercise usage recorded.", taskName: 'ExerciseUsage' };
        }
        return { success: true, message: "No unique exercises to record usage for.", taskName: 'ExerciseUsage' };
      } catch (error) {
        console.error(`Error during background exercise usage recording for user ${userId.value}, session ${sessionId.value}:`, error);
        return { success: false, message: `Exercise usage recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`, taskName: 'ExerciseUsage' };
      }
    })();
    backgroundTasks.push(recordUsageTask);

    const allBackgroundProcessing = Promise.allSettled(backgroundTasks);

    return {
      responseDto: {
        sessionId: finishedSession.id.value,
        finishedAt: sessionFinishedAt.toISOString(),
      },
      backgroundTask: allBackgroundProcessing.then(results => {
        let finalReportedResult: AggregationResult = {
          success: false, 
          message: "Aggregation task outcome not determined or other critical tasks failed.",
        }; 

        for (const result of results) {
          if (result.status === 'fulfilled') {
            const value = result.value as BackgroundTaskResult; // value is BackgroundTaskResult
            console.log(`Background task '${value.taskName || 'Unknown'}' completed: ${value.message || ''}`);
            if (value.taskName === 'Aggregation' && value.originalResult) {
                finalReportedResult = value.originalResult;
            } else if (value.taskName === 'Aggregation') { // Aggregation task but no originalResult (e.g., caught error)
                finalReportedResult.success = value.success;
                finalReportedResult.message = value.message;
            }
          } else {
            console.error(`Background task failed: ${result.reason}`);
            // If a non-aggregation task fails, we don't necessarily overwrite the aggregation result,
            // unless the aggregation itself hasn't successfully completed.
            if (finalReportedResult.message === "Aggregation task outcome not determined or other critical tasks failed."){
                finalReportedResult.success = false;
                finalReportedResult.message = `A background task (not necessarily aggregation) failed. Reason: ${result.reason}`;
            }
          }
        }
        return finalReportedResult;
      }),
    };
  }
}
