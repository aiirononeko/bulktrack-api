import type {
  Exercise,
  ExerciseId,
  ExerciseRepository,
  RecentExerciseParams,
  SearchParams,
} from "@bulktrack/core";
import {
  Exercise as ExerciseEntity,
  ExerciseMuscle,
  ExerciseTranslation,
} from "@bulktrack/core";
import { Result } from "@bulktrack/shared-kernel";
import type { D1Database } from "@cloudflare/workers-types";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  exerciseMuscles,
  exerciseTranslations,
  exerciseUsage,
  exercises,
  exercisesFts,
} from "../schema/tables";

type DBRow = {
  exercise: typeof exercises.$inferSelect;
  translation?: typeof exerciseTranslations.$inferSelect | null;
  muscle?: typeof exerciseMuscles.$inferSelect | null;
};

export class D1ExerciseRepository implements ExerciseRepository {
  private db;

  constructor(private readonly d1: D1Database) {
    this.db = drizzle(d1);
  }

  async findById(id: ExerciseId): Promise<Result<Exercise | null, Error>> {
    try {
      const rows = await this.db
        .select({
          exercise: exercises,
          translation: exerciseTranslations,
          muscle: exerciseMuscles,
        })
        .from(exercises)
        .leftJoin(
          exerciseTranslations,
          eq(exercises.id, exerciseTranslations.exerciseId),
        )
        .leftJoin(exerciseMuscles, eq(exercises.id, exerciseMuscles.exerciseId))
        .where(eq(exercises.id, id.getValue()));

      if (rows.length === 0) {
        return Result.ok(null);
      }

      const exercise = this.mapRowsToExercise(rows);
      return Result.ok(exercise);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to find exercise: ${(error as Error).message}`),
      );
    }
  }

  async search(params: SearchParams): Promise<Result<Exercise[], Error>> {
    try {
      const normalizedQuery = this.normalizeToHiragana(params.query);

      const whereCondition =
        params.locale !== "all"
          ? and(
              sql`${exercisesFts.text} MATCH ${normalizedQuery}`,
              eq(exercisesFts.locale, params.locale),
            )
          : sql`${exercisesFts.text} MATCH ${normalizedQuery}`;

      const ftsQuery = this.db
        .select({
          exerciseId: exercisesFts.exerciseId,
          rank: sql<number>`rank`,
        })
        .from(exercisesFts)
        .where(whereCondition)
        .orderBy(sql`rank`);

      const limitOffsetQuery = params.limit
        ? params.offset
          ? ftsQuery.limit(params.limit).offset(params.offset)
          : ftsQuery.limit(params.limit)
        : params.offset
          ? ftsQuery.offset(params.offset)
          : ftsQuery;

      const ftsResults = await limitOffsetQuery;

      if (ftsResults.length === 0) {
        return Result.ok([]);
      }

      const exerciseIds = ftsResults.map((r) => r.exerciseId);
      const exerciseRows = await this.db
        .select({
          exercise: exercises,
          translation: exerciseTranslations,
          muscle: exerciseMuscles,
        })
        .from(exercises)
        .leftJoin(
          exerciseTranslations,
          eq(exercises.id, exerciseTranslations.exerciseId),
        )
        .leftJoin(exerciseMuscles, eq(exercises.id, exerciseMuscles.exerciseId))
        .where(sql`${exercises.id} IN ${exerciseIds}`);

      const exerciseMap = this.mapRowsToExercises(exerciseRows);
      const orderedExercises = exerciseIds
        .map((id) => exerciseMap.get(id))
        .filter((e): e is Exercise => e !== undefined);

      return Result.ok(orderedExercises);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to search exercises: ${(error as Error).message}`),
      );
    }
  }

  async findRecentByUserId(
    params: RecentExerciseParams,
  ): Promise<Result<Exercise[], Error>> {
    try {
      const whereCondition = params.muscleId
        ? and(
            eq(exerciseUsage.userId, params.userId),
            eq(exerciseMuscles.muscleId, Number(params.muscleId)),
          )
        : eq(exerciseUsage.userId, params.userId);

      const query = this.db
        .select({
          exercise: exercises,
          translation: exerciseTranslations,
          muscle: exerciseMuscles,
        })
        .from(exerciseUsage)
        .innerJoin(exercises, eq(exerciseUsage.exerciseId, exercises.id))
        .leftJoin(
          exerciseTranslations,
          eq(exercises.id, exerciseTranslations.exerciseId),
        )
        .leftJoin(exerciseMuscles, eq(exercises.id, exerciseMuscles.exerciseId))
        .where(whereCondition)
        .orderBy(exerciseUsage.lastUsedAt);

      const rows = await query;
      const exerciseMap = this.mapRowsToExercises(rows);
      const uniqueExercises = Array.from(exerciseMap.values());

      const start = params.offset || 0;
      const end = params.limit ? start + params.limit : undefined;
      const paginatedExercises = uniqueExercises.slice(start, end);

      return Result.ok(paginatedExercises);
    } catch (error) {
      return Result.fail(
        new Error(
          `Failed to find recent exercises: ${(error as Error).message}`,
        ),
      );
    }
  }

  async save(exercise: Exercise): Promise<Result<void, Error>> {
    try {
      await this.db.transaction(async (tx) => {
        // Save main exercise
        await tx
          .insert(exercises)
          .values({
            id: exercise.getId().getValue(),
            canonicalName: exercise.getCanonicalName(),
            isCompound: exercise.isCompoundExercise(),
          })
          .onConflictDoUpdate({
            target: exercises.id,
            set: {
              canonicalName: exercise.getCanonicalName(),
              isCompound: exercise.isCompoundExercise(),
            },
          });

        // Delete existing translations and muscles
        await tx
          .delete(exerciseTranslations)
          .where(
            eq(exerciseTranslations.exerciseId, exercise.getId().getValue()),
          );
        await tx
          .delete(exerciseMuscles)
          .where(eq(exerciseMuscles.exerciseId, exercise.getId().getValue()));
        await tx
          .delete(exercisesFts)
          .where(eq(exercisesFts.exerciseId, exercise.getId().getValue()));

        // Save translations
        const translations = exercise.getTranslations();
        if (translations.length > 0) {
          await tx.insert(exerciseTranslations).values(
            translations.map((t: ExerciseTranslation) => ({
              exerciseId: exercise.getId().getValue(),
              locale: t.locale,
              name: t.name,
            })),
          );

          // Update FTS
          await tx.insert(exercisesFts).values(
            translations.map((t: ExerciseTranslation) => ({
              exerciseId: exercise.getId().getValue(),
              locale: t.locale,
              text: this.normalizeToHiragana(t.name),
            })),
          );
        } else {
          // Create FTS entry with canonical name if no translations
          await tx.insert(exercisesFts).values({
            exerciseId: exercise.getId().getValue(),
            locale: "unknown",
            text: this.normalizeToHiragana(exercise.getCanonicalName()),
          });
        }

        // Save muscles
        const muscles = exercise.getMuscles();
        if (muscles.length > 0) {
          await tx.insert(exerciseMuscles).values(
            muscles.map((m: ExerciseMuscle) => ({
              exerciseId: exercise.getId().getValue(),
              muscleId: Number(m.muscleId),
              relativeShare: Math.round(m.relativeTensionRatio * 1000),
            })),
          );
        }
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to save exercise: ${(error as Error).message}`),
      );
    }
  }

  async delete(id: ExerciseId): Promise<Result<void, Error>> {
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .delete(exerciseTranslations)
          .where(eq(exerciseTranslations.exerciseId, id.getValue()));
        await tx
          .delete(exerciseMuscles)
          .where(eq(exerciseMuscles.exerciseId, id.getValue()));
        await tx
          .delete(exercisesFts)
          .where(eq(exercisesFts.exerciseId, id.getValue()));
        await tx.delete(exercises).where(eq(exercises.id, id.getValue()));
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to delete exercise: ${(error as Error).message}`),
      );
    }
  }

  async updateUsage(
    userId: string,
    exerciseId: ExerciseId,
  ): Promise<Result<void, Error>> {
    try {
      await this.db
        .insert(exerciseUsage)
        .values({
          userId,
          exerciseId: exerciseId.getValue(),
          lastUsedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [exerciseUsage.userId, exerciseUsage.exerciseId],
          set: {
            lastUsedAt: new Date().toISOString(),
          },
        });

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to update usage: ${(error as Error).message}`),
      );
    }
  }

  private mapRowsToExercise(rows: DBRow[]): Exercise {
    const firstRow = rows[0];
    if (!firstRow) {
      throw new Error("No rows to map");
    }

    const translations = new Map<string, ExerciseTranslation>();
    const muscles = new Map<string, ExerciseMuscle>();

    for (const row of rows) {
      if (row.translation) {
        translations.set(
          row.translation.locale,
          new ExerciseTranslation(row.translation.locale, row.translation.name),
        );
      }

      if (row.muscle) {
        muscles.set(
          String(row.muscle.muscleId),
          new ExerciseMuscle(
            String(row.muscle.muscleId),
            row.muscle.relativeShare / 1000,
          ),
        );
      }
    }

    return ExerciseEntity.create({
      id: firstRow.exercise.id,
      canonicalName: firstRow.exercise.canonicalName,
      isCompound: firstRow.exercise.isCompound,
      translations: Array.from(translations.values()),
      muscles: Array.from(muscles.values()),
    });
  }

  private mapRowsToExercises(rows: DBRow[]): Map<string, Exercise> {
    const groupedRows = new Map<string, DBRow[]>();

    for (const row of rows) {
      const exerciseId = row.exercise.id;
      if (!groupedRows.has(exerciseId)) {
        groupedRows.set(exerciseId, []);
      }
      groupedRows.get(exerciseId)?.push(row);
    }

    const exerciseMap = new Map<string, Exercise>();
    for (const [exerciseId, exerciseRows] of groupedRows) {
      const exercise = this.mapRowsToExercise(exerciseRows);
      exerciseMap.set(exerciseId, exercise);
    }

    return exerciseMap;
  }

  private normalizeToHiragana(text: string): string {
    // カタカナをひらがなに変換
    return text.replace(/[\u30A0-\u30FF]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
  }
}
