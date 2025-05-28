import type { ExerciseService } from "../../../domain/exercise/service";
import type { UserIdVO } from "../../../domain/shared/vo/identifier";
import { type ExerciseDto, toExerciseDtoList } from "../../dto/exercise";

/**
 * Parameters for the List Recent Exercises query.
 */
export type ListRecentExercisesQuery = {
  userId: UserIdVO; // Authenticated User ID
  locale: string;
  limit: number;
  offset: number;
};

/**
 * Handler for the List Recent Exercises use case.
 */
export class ListRecentExercisesHandler {
  constructor(private readonly exerciseService: ExerciseService) {}

  /**
   * Executes the query to list recently used exercises for a user.
   * @param query The query parameters.
   * @returns A list of ExerciseDTOs.
   */
  async execute(query: ListRecentExercisesQuery): Promise<ExerciseDto[]> {
    const { userId, locale, limit, offset } = query;

    const exercises = await this.exerciseService.getRecentExercisesForUser(
      userId.value,
      locale,
      limit,
      offset,
    );

    return toExerciseDtoList(exercises, locale);
  }
}
