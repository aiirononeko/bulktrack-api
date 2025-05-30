import {
  RPE,
  Reps,
  TrainingSet,
  type TrainingSetRepository,
  Weight,
} from "@bulktrack/core";
import {
  ExerciseIdVO,
  RepositoryError,
  type Result,
  UserIdVO,
  WorkoutSetIdVO,
  err,
  ok,
} from "@bulktrack/shared-kernel";
import { and, between, desc, eq, gte, lte } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

import { workoutSets } from "../schema";

export class D1TrainingSetRepository implements TrainingSetRepository {
  private db: DrizzleD1Database;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async save(trainingSet: TrainingSet): Promise<Result<void, RepositoryError>> {
    try {
      const data = this.toPersistence(trainingSet);

      await this.db.insert(workoutSets).values(data);

      return ok(undefined);
    } catch (error) {
      return err(new RepositoryError("save", error as Error));
    }
  }

  async findById(id: string): Promise<Result<TrainingSet, RepositoryError>> {
    try {
      const rows = await this.db
        .select()
        .from(workoutSets)
        .where(eq(workoutSets.id, id))
        .limit(1);

      if (rows.length === 0) {
        return err(
          new RepositoryError("findById", new Error("Training set not found")),
        );
      }

      const trainingSet = this.toDomain(rows[0]);
      return ok(trainingSet);
    } catch (error) {
      return err(new RepositoryError("findById", error as Error));
    }
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<Result<TrainingSet[], Error>> {
    try {
      let baseQuery = this.db.select().from(workoutSets).$dynamic();

      // Add date filters if provided
      const conditions = [eq(workoutSets.userId, userId)];

      if (options?.startDate && options?.endDate) {
        conditions.push(
          between(
            workoutSets.performedAt,
            options.startDate.toISOString(),
            options.endDate.toISOString(),
          ),
        );
      } else if (options?.startDate) {
        conditions.push(
          gte(workoutSets.performedAt, options.startDate.toISOString()),
        );
      } else if (options?.endDate) {
        conditions.push(
          lte(workoutSets.performedAt, options.endDate.toISOString()),
        );
      }

      baseQuery = baseQuery
        .where(and(...conditions))
        .orderBy(desc(workoutSets.performedAt));

      const rows = await (options?.limit !== undefined &&
      options?.offset !== undefined
        ? baseQuery.limit(options.limit).offset(options.offset)
        : options?.limit !== undefined
          ? baseQuery.limit(options.limit)
          : options?.offset !== undefined
            ? baseQuery.offset(options.offset)
            : baseQuery);

      const sets = rows.map((row) => this.toDomain(row));

      return ok(sets);
    } catch (error) {
      return err(new RepositoryError("findByUserId", error as Error));
    }
  }

  async findByExerciseId(
    exerciseId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<Result<TrainingSet[], Error>> {
    try {
      const baseQuery = this.db
        .select()
        .from(workoutSets)
        .where(eq(workoutSets.exerciseId, exerciseId))
        .orderBy(desc(workoutSets.performedAt))
        .$dynamic();

      const rows = await (options?.limit !== undefined &&
      options?.offset !== undefined
        ? baseQuery.limit(options.limit).offset(options.offset)
        : options?.limit !== undefined
          ? baseQuery.limit(options.limit)
          : options?.offset !== undefined
            ? baseQuery.offset(options.offset)
            : baseQuery);

      const sets = rows.map((row) => this.toDomain(row));

      return ok(sets);
    } catch (error) {
      return err(new RepositoryError("findByExerciseId", error as Error));
    }
  }

  async update(
    trainingSet: TrainingSet,
  ): Promise<Result<void, RepositoryError>> {
    try {
      const data = this.toPersistence(trainingSet);

      await this.db
        .update(workoutSets)
        .set({
          exerciseId: data.exerciseId,
          weight: data.weight,
          reps: data.reps,
          rpe: data.rpe,
          notes: data.notes,
          performedAt: data.performedAt,
          restSec: data.restSec,
        })
        .where(
          and(eq(workoutSets.id, data.id), eq(workoutSets.userId, data.userId)),
        );

      return ok(undefined);
    } catch (error) {
      return err(new RepositoryError("update", error as Error));
    }
  }

  async delete(
    id: string,
    userId: string,
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.db
        .delete(workoutSets)
        .where(and(eq(workoutSets.id, id), eq(workoutSets.userId, userId)));

      return ok(undefined);
    } catch (error) {
      return err(new RepositoryError("delete", error as Error));
    }
  }

  async countByUserId(
    userId: UserIdVO,
  ): Promise<Result<number, RepositoryError>> {
    try {
      const result = await this.db
        .select({ count: workoutSets.id })
        .from(workoutSets)
        .where(eq(workoutSets.userId, userId.value));

      return ok(result.length);
    } catch (error) {
      return err(new RepositoryError("countByUserId", error as Error));
    }
  }

  async findGroupedByDate(
    userId: UserIdVO,
    startDate: Date,
    endDate: Date,
  ): Promise<Result<Map<string, TrainingSet[]>, RepositoryError>> {
    try {
      const rows = await this.db
        .select()
        .from(workoutSets)
        .where(
          and(
            eq(workoutSets.userId, userId.value),
            between(
              workoutSets.performedAt,
              startDate.toISOString(),
              endDate.toISOString(),
            ),
          ),
        )
        .orderBy(workoutSets.performedAt);

      const grouped = new Map<string, TrainingSet[]>();

      for (const row of rows) {
        const set = this.toDomain(row);
        const dateKey = set.performedAt.toISOString().split("T")[0];

        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, []);
        }
        grouped.get(dateKey)?.push(set);
      }

      return ok(grouped);
    } catch (error) {
      return err(new RepositoryError("findGroupedByDate", error as Error));
    }
  }

  private toPersistence(trainingSet: TrainingSet): any {
    // Generate set number - in a real implementation, this would be calculated
    const setNumber = 1;

    return {
      id: trainingSet.id.value,
      userId: trainingSet.userId.value,
      exerciseId: trainingSet.exerciseId.value,
      setNumber,
      weight: trainingSet.weight.value,
      reps: trainingSet.reps.value,
      rpe: trainingSet.rpe?.value ?? null,
      restSec: trainingSet.restSeconds ?? null,
      notes: trainingSet.notes ?? null,
      performedAt: trainingSet.performedAt.toISOString(),
      createdAt: trainingSet.createdAt.toISOString(),
    };
  }

  private toDomain(row: any): TrainingSet {
    const weight = Weight.create(row.weight || 0).unwrap();
    const reps = Reps.create(row.reps || 0).unwrap();
    const rpe = row.rpe ? RPE.create(row.rpe).unwrap() : undefined;

    return TrainingSet.reconstitute({
      id: new WorkoutSetIdVO(row.id),
      userId: new UserIdVO(row.userId),
      exerciseId: new ExerciseIdVO(row.exerciseId),
      weight,
      reps,
      rpe,
      restSeconds: row.restSec ?? undefined,
      notes: row.notes ?? undefined,
      performedAt: new Date(row.performedAt),
      createdAt: new Date(row.createdAt),
    });
  }
}
