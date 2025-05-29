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
import { type TrainingSet as TrainingSetRow, trainingSets } from "../schema";

export class D1TrainingSetRepository implements TrainingSetRepository {
  private db: DrizzleD1Database;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async save(trainingSet: TrainingSet): Promise<Result<void, RepositoryError>> {
    try {
      const data = this.toPersistence(trainingSet);

      await this.db.insert(trainingSets).values(data);

      return ok(undefined);
    } catch (error) {
      return err(new RepositoryError("save", error as Error));
    }
  }

  async findById(
    id: WorkoutSetIdVO,
  ): Promise<Result<TrainingSet | null, RepositoryError>> {
    try {
      const rows = await this.db
        .select()
        .from(trainingSets)
        .where(eq(trainingSets.id, id.value))
        .limit(1);

      if (rows.length === 0) {
        return ok(null);
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
      // Build conditions
      const conditions = [eq(trainingSets.userId, userId)];

      if (options?.startDate && options?.endDate) {
        conditions.push(
          between(
            trainingSets.performedAt,
            options.startDate.toISOString(),
            options.endDate.toISOString(),
          ),
        );
      } else if (options?.startDate) {
        conditions.push(
          gte(trainingSets.performedAt, options.startDate.toISOString()),
        );
      } else if (options?.endDate) {
        conditions.push(
          lte(trainingSets.performedAt, options.endDate.toISOString()),
        );
      }

      // Build query with all conditions at once
      const baseQuery = this.db
        .select()
        .from(trainingSets)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0])
        .orderBy(desc(trainingSets.performedAt));

      // Apply pagination and execute
      const rows = await (options?.limit !== undefined &&
      options?.offset !== undefined
        ? baseQuery.limit(options.limit).offset(options.offset)
        : options?.limit !== undefined
          ? baseQuery.limit(options.limit)
          : options?.offset !== undefined
            ? baseQuery.offset(options.offset)
            : baseQuery);
      const sets = rows.map((row: TrainingSetRow) => this.toDomain(row));

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
        .from(trainingSets)
        .where(eq(trainingSets.exerciseId, exerciseId))
        .orderBy(desc(trainingSets.performedAt));

      const rows = await (options?.limit !== undefined &&
      options?.offset !== undefined
        ? baseQuery.limit(options.limit).offset(options.offset)
        : options?.limit !== undefined
          ? baseQuery.limit(options.limit)
          : options?.offset !== undefined
            ? baseQuery.offset(options.offset)
            : baseQuery);
      const sets = rows.map((row: TrainingSetRow) => this.toDomain(row));

      return ok(sets);
    } catch (error) {
      return err(new RepositoryError("findByExerciseId", error as Error));
    }
  }

  async delete(id: WorkoutSetIdVO): Promise<Result<void, RepositoryError>> {
    try {
      await this.db.delete(trainingSets).where(eq(trainingSets.id, id.value));

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
        .select({ count: trainingSets.id })
        .from(trainingSets)
        .where(eq(trainingSets.userId, userId.value));

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
        .from(trainingSets)
        .where(
          and(
            eq(trainingSets.userId, userId.value),
            between(
              trainingSets.performedAt,
              startDate.toISOString(),
              endDate.toISOString(),
            ),
          ),
        )
        .orderBy(trainingSets.performedAt);

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

  private toPersistence(trainingSet: TrainingSet): TrainingSetRow {
    return {
      id: trainingSet.id.value,
      userId: trainingSet.userId.value,
      exerciseId: trainingSet.exerciseId.value,
      weight: trainingSet.weight.value,
      reps: trainingSet.reps.value,
      rpe: trainingSet.rpe?.value ?? null,
      restSeconds: trainingSet.restSeconds ?? null,
      notes: trainingSet.notes ?? null,
      performedAt: trainingSet.performedAt.toISOString(),
      createdAt: trainingSet.createdAt.toISOString(),
    };
  }

  private toDomain(row: TrainingSetRow): TrainingSet {
    const weight = Weight.create(row.weight).unwrap();
    const reps = Reps.create(row.reps).unwrap();
    const rpe = row.rpe ? RPE.create(row.rpe).unwrap() : undefined;

    return TrainingSet.reconstitute({
      id: new WorkoutSetIdVO(row.id),
      userId: new UserIdVO(row.userId),
      exerciseId: new ExerciseIdVO(row.exerciseId),
      weight,
      reps,
      rpe,
      restSeconds: row.restSeconds ?? undefined,
      notes: row.notes ?? undefined,
      performedAt: new Date(row.performedAt),
      createdAt: new Date(row.createdAt),
    });
  }
}
