import type { IWorkoutSetRepository } from "../../domain/workout/workout-set-repository";
import type { IExerciseUsageRepository } from "../../domain/exercise/repository/exercise-usage-repository";
import { UserIdVO, WorkoutSetIdVO } from "../../domain/shared/vo/identifier";
import type { ExerciseIdVO } from "../../domain/shared/vo/identifier";
import { type WorkoutSetUpdateProps, WorkoutSet } from "../../domain/workout/entities/workout-set.entity";
import { ApplicationError, NotFoundError, AuthorizationError } from "../../app/errors";

// It's good practice to define DTOs for use case inputs and outputs
export interface UpdateWorkoutSetCommand {
  userId: UserIdVO; // For ownership check, if applicable
  setId: string;
  data: { // This structure should align with OpenAPI's SetUpdate schema, mapped to domain props
    reps?: number | null;
    weight?: number | null;
    notes?: string | null;
    performedAt?: string; // Date as string from API, to be converted
    rpe?: number | null;
    restSec?: number | null;
  };
}

export interface WorkoutSetDto { // Define based on what API should return, likely from WorkoutSet.toPrimitives()
  id: string;
  exerciseId: string;
  setNumber: number;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt: string;
  createdAt: string;
  rpe?: number | null;
  restSec?: number | null;
  volume?: number;
}

export interface DeleteWorkoutSetCommand {
  userId: string; // To verify ownership
  setId: string;
}

export interface AddWorkoutSetCommand { // 新しいコマンドインターフェース
  userId: UserIdVO;
  exerciseId: ExerciseIdVO;
  reps?: number | null;
  weight?: number | null;
  notes?: string | null;
  performedAt?: Date | null;
  customSetId?: WorkoutSetIdVO; 
  rpe?: number | null;
  restSec?: number | null;
  setNo?: number | null;
}

export class WorkoutService {
  constructor(
    private readonly workoutSetRepository: IWorkoutSetRepository,
    private readonly exerciseUsageRepository: IExerciseUsageRepository
  ) {}

  async addWorkoutSet(command: AddWorkoutSetCommand): Promise<WorkoutSetDto> { // 新しいメソッド
    let addedSet: WorkoutSet;
    try {
      addedSet = WorkoutSet.create({
        exerciseId: command.exerciseId,
        setNumber: command.setNo ?? 1, 
        reps: command.reps,
        weight: command.weight,
        notes: command.notes,
        performedAt: command.performedAt === null ? undefined : command.performedAt,
        id: command.customSetId,
        rpe: command.rpe,
        restSec: command.restSec,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Domain error (e.g., validation in WorkoutSet.create)
        throw new ApplicationError(error.message, 400, "ADD_SET_FAILED");
      }
      throw new ApplicationError("An unexpected error occurred while creating the set.", 500, "UNEXPECTED_CREATE_SET_ERROR");
    }
    
    await this.workoutSetRepository.saveSet(addedSet, command.userId);

    const addedSetPrimitives = addedSet.toPrimitives();
    const dto: WorkoutSetDto = {
      id: addedSetPrimitives.id,
      exerciseId: addedSetPrimitives.exerciseId,
      setNumber: addedSetPrimitives.setNumber,
      reps: addedSetPrimitives.reps,
      weight: addedSetPrimitives.weight,
      notes: addedSetPrimitives.notes,
      performedAt: addedSetPrimitives.performedAt,
      createdAt: addedSetPrimitives.createdAt,
      rpe: addedSetPrimitives.rpe,
      restSec: addedSetPrimitives.restSec,
      volume: addedSetPrimitives.volume,
    };

    return dto;
  }

  async updateWorkoutSet(command: UpdateWorkoutSetCommand): Promise<WorkoutSetDto> {
    const setIdVo = new WorkoutSetIdVO(command.setId);
    const userIdVo = command.userId;

    const existingSet = await this.workoutSetRepository.findSetByIdAndUserId(setIdVo, userIdVo); // workoutSetRepository を使用
    if (!existingSet) {
      throw new NotFoundError(`WorkoutSet with id ${command.setId} not found.`);
    }

    // Optional: Ownership/Authorization check
    // if (command.userId && !existingSet.sessionId.equals(someSessionFetchedViaUserId.id)) {
    //   throw new AuthorizationError(`User not authorized to update this set.`);
    // }
    
    const updateProps: WorkoutSetUpdateProps = {};
    if (command.data.reps !== undefined) updateProps.reps = command.data.reps;
    if (command.data.weight !== undefined) updateProps.weight = command.data.weight;
    if (command.data.notes !== undefined) updateProps.notes = command.data.notes;
    if (command.data.performedAt !== undefined) {
        updateProps.performedAt = new Date(command.data.performedAt); // Convert string to Date
        if (Number.isNaN(updateProps.performedAt.getTime())) { 
            throw new Error("Invalid date format for performedAt"); 
        }
    }
    if (command.data.rpe !== undefined) updateProps.rpe = command.data.rpe;
    if (command.data.restSec !== undefined) updateProps.restSec = command.data.restSec;


    existingSet.update(updateProps);

    await this.workoutSetRepository.updateSet(existingSet, userIdVo); // workoutSetRepository を使用

    const updatedSetPrimitives = existingSet.toPrimitives();
    
    const dto: WorkoutSetDto = {
        id: updatedSetPrimitives.id,
        exerciseId: updatedSetPrimitives.exerciseId,
        setNumber: updatedSetPrimitives.setNumber,
        reps: updatedSetPrimitives.reps,
        weight: updatedSetPrimitives.weight,
        notes: updatedSetPrimitives.notes,
        performedAt: updatedSetPrimitives.performedAt,
        createdAt: updatedSetPrimitives.createdAt,
        rpe: updatedSetPrimitives.rpe,
        restSec: updatedSetPrimitives.restSec,
        volume: updatedSetPrimitives.volume,
    };

    return dto;
  }

  async deleteWorkoutSet(command: DeleteWorkoutSetCommand): Promise<void> {
    const setIdVo = new WorkoutSetIdVO(command.setId);
    const userIdVo = new UserIdVO(command.userId);

    const existingSet = await this.workoutSetRepository.findSetByIdAndUserId(setIdVo, userIdVo); // workoutSetRepository を使用
    if (!existingSet) {
      // NotFoundError をスローするか、AuthorizationError をスローして情報漏洩を防ぐか検討
      // ここでは、セットが見つからない場合は NotFoundError とし、
      // ユーザーIDが一致しない場合はリポジトリが null を返すかエラーをスローすることを期待。
      throw new NotFoundError(`WorkoutSet with id ${command.setId} not found or not accessible by user.`);
    }

    await this.workoutSetRepository.deleteSet(setIdVo, userIdVo); // workoutSetRepository を使用
  }

  // 新しいメソッド: recordExerciseUsage
  async recordExerciseUsage(userId: UserIdVO, exerciseId: ExerciseIdVO, performedAt: Date): Promise<void> {
    if (!this.exerciseUsageRepository) {
      // exerciseUsageRepository がDIされていなければエラーまたはログを出力
      // 通常はコンストラクタで必須とするため、このチェックは不要かもしれないが念のため
      console.error("ExerciseUsageRepository not injected into WorkoutService.");
      // ここでエラーをスローするか、処理をスキップするかは設計による
      // throw new Error("ExerciseUsageRepository not configured");
      return; // ここではスキップする
    }
    try {
      // performedAt の日付部分のみを使用する（時刻は無視）
      const performedDate = new Date(performedAt.getFullYear(), performedAt.getMonth(), performedAt.getDate());
      await this.exerciseUsageRepository.recordUsage(userId, exerciseId, performedDate);
    } catch (error) {
      // ログ出力は行うが、このメソッドのエラーは呼び出し元に伝播させない設計も考えられる
      // (ユーザー体験として、セットの追加が成功すれば利用履歴の記録失敗は致命的ではない場合)
      console.error(`Error recording exercise usage for user ${userId.value} and exercise ${exerciseId.value} on ${performedAt.toISOString()}:`, error);
      // throw error; // 必要に応じてエラーを再スロー
    }
  }
}
