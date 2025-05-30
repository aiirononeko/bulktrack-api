import { type Result, type UserIdVO, ok } from "@bulktrack/shared-kernel";
import type { Exercise } from "../../domain/exercise/exercise-full.entity";
import type { ExerciseMuscle } from "../../domain/exercise/value-objects/exercise-muscle.vo";
import type { ExerciseQueryPort } from "../../domain/exercise/ports/exercise-query.port";
import type { ExerciseDto } from "../dto/exercise.dto";

export interface ListRecentExercisesCommand {
  userId: UserIdVO;
  locale: string;
  limit: number;
  offset: number;
}

export class ListRecentExercisesUseCase {
  constructor(private readonly exerciseRepository: ExerciseQueryPort) {}

  async execute(
    command: ListRecentExercisesCommand,
  ): Promise<Result<ExerciseDto[], Error>> {
    const { userId, locale, limit, offset } = command;

    // ユーザーが最近使用したエクササイズを取得
    const result = await this.exerciseRepository.findRecentByUserId({
      userId: userId.value,
      locale,
      limit,
      offset,
    });

    if (result.isErr()) {
      return result;
    }

    // DTOに変換
    const exercises = result.unwrap();
    const dtos = exercises.map((exercise: Exercise) => ({
      id: exercise.id.value,
      canonical_name: exercise.canonicalName.value,
      name: exercise.getName(locale),
      aliases: exercise.getAliases(locale),
      default_muscle_id: exercise.defaultMuscleId,
      is_compound: exercise.isCompound,
      exercise_muscles: exercise.exerciseMuscles.map(
        (muscle: ExerciseMuscle) => ({
          muscle_id: muscle.muscleId,
          relative_share: muscle.relativeShare,
          source_id: muscle.sourceId,
          source_details: muscle.sourceDetails,
        }),
      ),
    }));

    return ok(dtos);
  }
}
