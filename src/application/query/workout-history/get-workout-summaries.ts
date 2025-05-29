import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { UserIdVO } from "../../../domain/shared/vo/identifier";
import type * as schema from "../../../infrastructure/db/schema";
import type { DailyWorkoutSummaryDTO } from "../../dto/workout-history.dto";

export class GetWorkoutSummariesQuery {
  constructor(
    private readonly db: DrizzleD1Database<any>,
    private readonly dbSchema: typeof schema,
  ) {}

  async execute(
    userId: UserIdVO,
    limit = 20,
    offset = 0,
    locale = "en",
  ): Promise<DailyWorkoutSummaryDTO[]> {
    // 日別ワークアウトサマリーを取得
    const summaries = await this.db
      .select({
        date: this.dbSchema.dailyWorkoutSummaries.date,
        totalVolume: this.dbSchema.dailyWorkoutSummaries.totalVolume,
        avgRM: this.dbSchema.dailyWorkoutSummaries.avgRM,
        setCount: this.dbSchema.dailyWorkoutSummaries.setCount,
      })
      .from(this.dbSchema.dailyWorkoutSummaries)
      .where(eq(this.dbSchema.dailyWorkoutSummaries.userId, userId.value))
      .orderBy(desc(this.dbSchema.dailyWorkoutSummaries.date))
      .limit(limit)
      .offset(offset);

    // 各日のエクササイズ情報を取得
    const result: DailyWorkoutSummaryDTO[] = [];
    for (const summary of summaries) {
      const exercises = await this.getExercisesForDate(
        userId,
        summary.date,
        locale,
      );
      result.push({
        date: summary.date,
        exercises,
        totalVolume: summary.totalVolume,
        avgRM: summary.avgRM,
        setCount: summary.setCount,
      });
    }

    return result;
  }

  private async getExercisesForDate(
    userId: UserIdVO,
    date: string,
    locale: string,
  ): Promise<{ exerciseId: string; exerciseName: string }[]> {
    const exercises = (await this.db
      .select({
        exerciseId: this.dbSchema.dailyExerciseSummaries.exerciseId,
        exerciseName: sql<string>`COALESCE(${this.dbSchema.exerciseTranslations.name}, ${this.dbSchema.exercises.canonicalName})`,
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

    return exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
    }));
  }
}
