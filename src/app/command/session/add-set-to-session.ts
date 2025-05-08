import type { IWorkoutSessionRepository } from "../../../domain/workout/repository";
import type {
  WorkoutSessionIdVO,
  UserIdVO,
  ExerciseIdVO,
  WorkoutSetIdVO,
} from "../../../domain/shared/vo/identifier"; // 型としてインポートするよう修正
import type { WorkoutSet } from "../../../domain/workout/entities/workout-set.entity"; // 修正後のパス
import type { AddSetResponseDto, WorkoutSetDto } from "../../dto/set.dto";
import { ApplicationError } from "../../errors"; // ApplicationError をインポート

export class AddSetToSessionCommand {
  constructor(
    public readonly sessionId: WorkoutSessionIdVO,
    public readonly userId: UserIdVO, // 認証済みユーザー
    public readonly exerciseId: ExerciseIdVO,
    public readonly reps?: number | null,
    public readonly weight?: number | null,
    // public readonly distance?: number | null, // 削除
    // public readonly duration?: number | null, // 削除
    public readonly notes?: string | null,
    public readonly performedAt?: Date | null, // 指定されなければハンドラで設定
    public readonly customSetId?: WorkoutSetIdVO, // テスト用など、特定のIDでセットを作成したい場合
  ) {}
}

export class AddSetToSessionHandler {
  constructor(
    private readonly workoutSessionRepository: IWorkoutSessionRepository,
    // private readonly workoutSessionService: WorkoutSessionService, // 必要に応じて追加
  ) {}

  async execute(command: AddSetToSessionCommand): Promise<AddSetResponseDto> {
    const session = await this.workoutSessionRepository.findById(command.sessionId);

    if (!session) {
      throw new ApplicationError("Workout session not found.", 404, "SESSION_NOT_FOUND");
    }
    if (!session.userId.equals(command.userId)) {
      throw new ApplicationError("Forbidden to access this session.", 403, "SESSION_FORBIDDEN");
    }
    // session.addSet内で終了済みチェックは行われるが、ここでも事前チェックも可能
    if (session.finishedAt) {
      throw new ApplicationError("Cannot add sets to a finished session.", 400, "SESSION_FINISHED");
    }

    let addedSet: WorkoutSet;
    try {
      addedSet = session.addSet({
        exerciseId: command.exerciseId,
        reps: command.reps,
        weight: command.weight,
        // distance: command.distance, // 削除
        notes: command.notes,
        performedAt: command.performedAt === null ? undefined : command.performedAt, // null の場合は undefined に変換
        id: command.customSetId, // 指定があればそれを使用
        // setNumber は session.addSet内で自動採番
      });
    } catch (error) {
      if (error instanceof Error) { // error の型を Error に指定
        throw new ApplicationError(error.message, 400, "ADD_SET_FAILED");
      }
      // 予期しない型のエラーの場合
      throw new ApplicationError("An unexpected error occurred while adding the set.", 500, "UNEXPECTED_ADD_SET_ERROR");
    }
    
    await this.workoutSessionRepository.save(session); // 更新されたセッション（セット配列含む）を保存

    const addedSetDto: WorkoutSetDto = {
      id: addedSet.id.value,
      exerciseId: addedSet.exerciseId.value,
      setNumber: addedSet.setNumber,
      reps: addedSet.reps,
      weight: addedSet.weight,
      // distance: addedSet.distance, // 削除
      notes: addedSet.notes,
      performedAt: addedSet.performedAt.toISOString(),
    };

    return { addedSet: addedSetDto };
  }
}
 