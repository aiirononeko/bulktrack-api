import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { UserIdVO } from "../../../domain/shared/vo/identifier";
import type * as schema from "../../../infrastructure/db/schema";
import type {
  DailyWorkoutDetailDTO,
  ExerciseDetailDTO,
  MuscleVolumeBreakdownDTO,
  WorkoutSetDTO,
} from "../../dto/workout-history.dto";

export class GetWorkoutDetailQuery {
  constructor(
    private readonly db: DrizzleD1Database<any>,
    private readonly dbSchema: typeof schema,
  ) {}

  async execute(
    userId: UserIdVO,
    date: string,
    locale = "en",
  ): Promise<DailyWorkoutDetailDTO | null> {
    // 指定日のワークアウトサマリーを取得
    const summary = await this.db
      .select({
        totalVolume: this.dbSchema.dailyWorkoutSummaries.totalVolume,
        avgRM: this.dbSchema.dailyWorkoutSummaries.avgRM,
      })
      .from(this.dbSchema.dailyWorkoutSummaries)
      .where(
        and(
          eq(this.dbSchema.dailyWorkoutSummaries.userId, userId.value),
          eq(this.dbSchema.dailyWorkoutSummaries.date, date),
        ),
      )
      .limit(1);

    if (summary.length === 0) {
      return null;
    }

    // エクササイズ詳細を取得
    const exercises = await this.getExerciseDetails(userId, date, locale);

    return {
      date,
      totalVolume: summary[0].totalVolume,
      avgRM: summary[0].avgRM,
      exercises,
    };
  }

  private async getExerciseDetails(
    userId: UserIdVO,
    date: string,
    locale: string,
  ): Promise<ExerciseDetailDTO[]> {
    // エクササイズサマリーを取得
    const exerciseSummaries = (await this.db
      .select({
        exerciseId: this.dbSchema.dailyExerciseSummaries.exerciseId,
        exerciseName: sql<string>`COALESCE(${this.dbSchema.exerciseTranslations.name}, ${this.dbSchema.exercises.canonicalName})`,
        totalVolume: this.dbSchema.dailyExerciseSummaries.totalVolume,
        avgRM: this.dbSchema.dailyExerciseSummaries.avgRM,
        setIds: this.dbSchema.dailyExerciseSummaries.setIds,
      })
      .from(this.dbSchema.dailyExerciseSummaries)
      .innerJoin(
        this.dbSchema.exercises,
        eq(
          this.dbSchema.dailyExerciseSummaries.exerciseId,
          this.dbSchema.exercises.id,
        ),
      )
      .leftJoin(
        this.dbSchema.exerciseTranslations,
        and(
          eq(
            this.dbSchema.exerciseTranslations.exerciseId,
            this.dbSchema.exercises.id,
          ),
          eq(this.dbSchema.exerciseTranslations.locale, locale),
        ),
      )
      .where(
        and(
          eq(this.dbSchema.dailyExerciseSummaries.userId, userId.value),
          eq(this.dbSchema.dailyExerciseSummaries.date, date),
        ),
      )) as any[];

    const exercises: ExerciseDetailDTO[] = [];

    for (const exerciseSummary of exerciseSummaries) {
      // セット詳細を取得
      const sets = await this.getSetsForExercise(
        userId,
        date,
        exerciseSummary.exerciseId,
      );

      // 筋群ボリューム分解を取得
      const muscleVolumeBreakdown = await this.getMuscleVolumeBreakdown(
        userId,
        date,
        exerciseSummary.exerciseId,
        locale,
      );

      exercises.push({
        exerciseId: exerciseSummary.exerciseId,
        exerciseName: exerciseSummary.exerciseName,
        sets,
        totalVolume: exerciseSummary.totalVolume,
        avgRM: exerciseSummary.avgRM,
        muscleVolumeBreakdown,
      });
    }

    return exercises;
  }

  private async getSetsForExercise(
    userId: UserIdVO,
    date: string,
    exerciseId: string,
  ): Promise<WorkoutSetDTO[]> {
    const sets = await this.db
      .select({
        id: this.dbSchema.workoutSets.id,
        exerciseId: this.dbSchema.workoutSets.exerciseId,
        setNumber: this.dbSchema.workoutSets.setNumber,
        weight: this.dbSchema.workoutSets.weight,
        reps: this.dbSchema.workoutSets.reps,
        rpe: this.dbSchema.workoutSets.rpe,
        notes: this.dbSchema.workoutSets.notes,
        performedAt: this.dbSchema.workoutSets.performedAt,
      })
      .from(this.dbSchema.workoutSets)
      .where(
        and(
          eq(this.dbSchema.workoutSets.userId, userId.value),
          eq(this.dbSchema.workoutSets.exerciseId, exerciseId),
          sql`DATE(${this.dbSchema.workoutSets.performedAt}) = ${date}`,
        ),
      );

    return sets.map((set) => ({
      id: set.id,
      exerciseId: set.exerciseId,
      setNumber: set.setNumber,
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe,
      notes: set.notes,
      performedAt: set.performedAt,
    }));
  }

  private async getMuscleVolumeBreakdown(
    userId: UserIdVO,
    date: string,
    exerciseId: string,
    locale: string,
  ): Promise<MuscleVolumeBreakdownDTO[]> {
    const muscleVolumes = (await this.db
      .select({
        muscleGroupId: this.dbSchema.dailyExerciseMuscleVolumes.muscleId,
        muscleGroupName: sql<string>`COALESCE(${this.dbSchema.muscleGroupTranslations.name}, ${this.dbSchema.muscleGroups.name})`,
        effectiveVolume:
          this.dbSchema.dailyExerciseMuscleVolumes.effectiveVolume,
      })
      .from(this.dbSchema.dailyExerciseMuscleVolumes)
      .innerJoin(
        this.dbSchema.muscleGroups,
        eq(
          this.dbSchema.dailyExerciseMuscleVolumes.muscleId,
          this.dbSchema.muscleGroups.id,
        ),
      )
      .leftJoin(
        this.dbSchema.muscleGroupTranslations,
        and(
          eq(
            this.dbSchema.muscleGroupTranslations.muscleGroupId,
            this.dbSchema.muscleGroups.id,
          ),
          eq(this.dbSchema.muscleGroupTranslations.locale, locale),
        ),
      )
      .where(
        and(
          eq(this.dbSchema.dailyExerciseMuscleVolumes.userId, userId.value),
          eq(this.dbSchema.dailyExerciseMuscleVolumes.date, date),
          eq(this.dbSchema.dailyExerciseMuscleVolumes.exerciseId, exerciseId),
        ),
      )) as any[];

    return muscleVolumes.map((muscle) => ({
      muscleGroupId: muscle.muscleGroupId,
      muscleGroupName: muscle.muscleGroupName,
      effectiveVolume: muscle.effectiveVolume,
    }));
  }
}
