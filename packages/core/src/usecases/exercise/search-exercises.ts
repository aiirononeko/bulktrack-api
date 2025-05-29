import { Result } from "@bulktrack/shared-kernel";
import type { Exercise } from "../../../src/domain/exercise/entity";
import type { ExerciseMuscle } from "../../../src/domain/exercise/vo";
import type { ExerciseDto } from "../dto/exercise.dto";

export interface ExerciseRepository {
  search(params: {
    query: string | null;
    locale: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<Exercise[], Error>>;
}

export interface SearchExercisesCommand {
  query: string | null;
  locale: string;
  limit: number;
  offset: number;
}

export class SearchExercisesUseCase {
  constructor(private readonly exerciseRepository: ExerciseRepository) {}

  async execute(
    command: SearchExercisesCommand,
  ): Promise<Result<ExerciseDto[], Error>> {
    const { query, locale, limit, offset } = command;

    // リポジトリから検索
    const result = await this.exerciseRepository.search({
      query,
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

    return Result.ok(dtos);
  }
}
