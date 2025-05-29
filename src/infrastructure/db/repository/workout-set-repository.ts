import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { DailyAggregationService } from "../../../application/services/daily-aggregation.service";
import type {
  UserIdVO,
  WorkoutSetIdVO,
} from "../../../domain/shared/vo/identifier";
import { WorkoutSet } from "../../../domain/workout/entities/workout-set.entity";
import type { WorkoutSetRawData } from "../../../domain/workout/entities/workout-set.entity";
import type { IWorkoutSetRepository } from "../../../domain/workout/workout-set-repository";
import type * as fullSchema from "../schema"; // Drizzle schema

export class DrizzleWorkoutSetRepository implements IWorkoutSetRepository {
  private readonly aggregationService: DailyAggregationService;

  constructor(
    private readonly db: DrizzleD1Database<typeof fullSchema>,
    private readonly schema: typeof fullSchema,
  ) {
    this.aggregationService = new DailyAggregationService(this.db, this.schema);
  }

  async saveSet(set: WorkoutSet, userId: UserIdVO): Promise<void> {
    const setPrimitives = set.toPrimitives();
    const setToInsert: typeof this.schema.workoutSets.$inferInsert = {
      id: setPrimitives.id,
      userId: userId.value,
      exerciseId: setPrimitives.exerciseId,
      setNumber: setPrimitives.setNumber,
      reps: setPrimitives.reps ?? undefined,
      weight: setPrimitives.weight ?? undefined,
      notes: setPrimitives.notes ?? undefined,
      performedAt: setPrimitives.performedAt,
      rpe: setPrimitives.rpe ?? undefined,
      restSec: setPrimitives.restSec ?? undefined,
    };

    await this.db.insert(this.schema.workoutSets).values(setToInsert);

    // 日別集計を更新
    const performedDate = new Date(setPrimitives.performedAt)
      .toISOString()
      .split("T")[0];
    await this.aggregationService.updateDailyAggregation(userId, performedDate);
  }

  async findSetByIdAndUserId(
    id: WorkoutSetIdVO,
    userId: UserIdVO,
  ): Promise<WorkoutSet | null> {
    const result = await this.db
      .select()
      .from(this.schema.workoutSets)
      .where(
        and(
          eq(this.schema.workoutSets.id, id.value),
          eq(this.schema.workoutSets.userId, userId.value),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }
    const dbSet = result[0];

    const rawData: WorkoutSetRawData = {
      id: dbSet.id,
      exerciseId: dbSet.exerciseId,
      setNumber: dbSet.setNumber,
      reps: dbSet.reps,
      weight: dbSet.weight,
      notes: dbSet.notes,
      performedAt: dbSet.performedAt,
      createdAt: dbSet.createdAt,
      rpe: dbSet.rpe,
      restSec: dbSet.restSec,
      volume: dbSet.volume ?? undefined,
    };
    return WorkoutSet.fromPersistence(rawData);
  }

  async updateSet(set: WorkoutSet, userId: UserIdVO): Promise<void> {
    const setPrimitives = set.toPrimitives();
    const existingSet = await this.findSetByIdAndUserId(set.id, userId);
    if (!existingSet) {
      throw new Error(
        `Set with id ${set.id.value} not found or user ${userId.value} is not authorized.`,
      );
    }

    const existingPrimitives = existingSet.toPrimitives();
    const oldPerformedDate = new Date(existingPrimitives.performedAt)
      .toISOString()
      .split("T")[0];
    const newPerformedDate = new Date(setPrimitives.performedAt)
      .toISOString()
      .split("T")[0];

    await this.db
      .update(this.schema.workoutSets)
      .set({
        exerciseId: setPrimitives.exerciseId,
        setNumber: setPrimitives.setNumber,
        reps: setPrimitives.reps ?? undefined,
        weight: setPrimitives.weight ?? undefined,
        notes: setPrimitives.notes ?? undefined,
        performedAt: setPrimitives.performedAt,
        rpe: setPrimitives.rpe ?? undefined,
        restSec: setPrimitives.restSec ?? undefined,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(this.schema.workoutSets.id, set.id.value),
          eq(this.schema.workoutSets.userId, userId.value),
        ),
      );

    // 日別集計を更新（日付が変更された場合は両方の日付を更新）
    if (oldPerformedDate !== newPerformedDate) {
      await this.aggregationService.updateDailyAggregation(
        userId,
        oldPerformedDate,
      );
    }
    await this.aggregationService.updateDailyAggregation(
      userId,
      newPerformedDate,
    );
  }

  async deleteSet(id: WorkoutSetIdVO, userId: UserIdVO): Promise<void> {
    // 削除前にセットの情報を取得（日付を特定するため）
    const existingSet = await this.findSetByIdAndUserId(id, userId);

    const result = await this.db
      .delete(this.schema.workoutSets)
      .where(
        and(
          eq(this.schema.workoutSets.id, id.value),
          eq(this.schema.workoutSets.userId, userId.value),
        ),
      )
      .returning({ deletedId: this.schema.workoutSets.id });

    if (result.length === 0) {
      console.warn(
        `Set with id ${id.value} not found or user ${userId.value} not authorized for deletion.`,
      );
      return;
    }

    // 日別集計を更新
    if (existingSet) {
      const existingPrimitives = existingSet.toPrimitives();
      const performedDate = new Date(existingPrimitives.performedAt)
        .toISOString()
        .split("T")[0];
      await this.aggregationService.updateDailyAggregation(
        userId,
        performedDate,
      );
    }
  }
}
