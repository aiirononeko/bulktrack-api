import {
  ExerciseFull as Exercise,
  ExerciseIdVO,
  ExerciseNameVO,
  type ExerciseFullTranslation as ExerciseTranslation,
} from "@bulktrack/core";
import type { ExerciseMuscle } from "@bulktrack/core";
import { type Result, err, ok } from "@bulktrack/shared-kernel";
import type { D1Database } from "@cloudflare/workers-types";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  exerciseMuscles,
  exerciseTranslations,
  exerciseUsage,
  exercises,
  exercisesFts,
} from "./schema";

type DBRow = {
  exercise: typeof exercises.$inferSelect;
  translation?: typeof exerciseTranslations.$inferSelect | null;
  muscle?: typeof exerciseMuscles.$inferSelect | null;
};

export interface SearchExerciseRepository {
  search(params: {
    query: string | null;
    locale: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<Exercise[], Error>>;
}

export interface RecentExerciseRepository {
  findRecentByUserId(params: {
    userId: string;
    locale: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<Exercise[], Error>>;
}

export class D1ExerciseRepositoryV2
  implements SearchExerciseRepository, RecentExerciseRepository
{
  // Additional methods for compatibility (stubbed for now)
  async findById(id: any): Promise<Result<any, Error>> {
    try {
      // Handle both ExerciseIdVO and string
      const exerciseId =
        typeof id === "string" ? id : id.value || id.getValue?.();

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
        .where(eq(exercises.id, exerciseId));

      if (rows.length === 0) {
        return ok(null);
      }

      const exerciseMap = this.mapRowsToExercises(rows);
      const exercise = exerciseMap.get(exerciseId);

      // Return a simplified version that matches the domain Exercise interface
      // This is a temporary adapter until the architecture is clarified
      return ok(exercise || null);
    } catch (error) {
      return err(
        new Error(`Failed to find exercise by id: ${(error as Error).message}`),
      );
    }
  }

  async save(exercise: any): Promise<Result<void, Error>> {
    return err(new Error("save not implemented"));
  }

  async delete(id: any): Promise<Result<void, Error>> {
    return err(new Error("delete not implemented"));
  }

  async updateUsage(
    userId: string,
    exerciseId: any,
  ): Promise<Result<void, Error>> {
    return err(new Error("updateUsage not implemented"));
  }
  private db;

  constructor(private readonly d1: D1Database) {
    this.db = drizzle(d1);
  }

  async search(params: {
    query: string | null;
    locale: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<Exercise[], Error>> {
    try {
      const { query, locale, limit = 20, offset = 0 } = params;

      if (!query || query.trim() === "") {
        // Return default exercises if no query
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
          .leftJoin(
            exerciseMuscles,
            eq(exercises.id, exerciseMuscles.exerciseId),
          )
          .limit(limit)
          .offset(offset);

        const exerciseMap = this.mapRowsToExercises(rows);
        return ok(Array.from(exerciseMap.values()));
      }

      // FTS search requires at least 2 characters
      if (query.trim().length < 2) {
        return ok([]);
      }

      // Search using FTS
      const normalizedQuery = this.normalizeToHiragana(query.trim())
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ");

      const keywords = normalizedQuery
        .split(/\s+/)
        .filter((k) => k.length > 0)
        .map((k) => `${k}*`)
        .join(" AND ");

      if (!keywords) {
        return ok([]);
      }

      const targetLocales = [locale, "unknown"];

      const ftsResults: { exercise_id: string; score: number }[] =
        await this.db.all(sql`
        SELECT
          exercise_id,
          bm25(exercises_fts) AS score
        FROM exercises_fts
        WHERE text_normalized MATCH ${keywords}
          AND locale IN (${sql.join(
            targetLocales.map((l) => sql`${l}`),
            sql`, `,
          )})
        ORDER BY score ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      if (ftsResults.length === 0) {
        return ok([]);
      }

      const exerciseIds = ftsResults.map((r) => r.exercise_id);
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
        .where(inArray(exercises.id, exerciseIds));

      const exerciseMap = this.mapRowsToExercises(exerciseRows);
      const orderedExercises = exerciseIds
        .map((id) => exerciseMap.get(id))
        .filter((e): e is Exercise => e !== undefined);

      return ok(orderedExercises);
    } catch (error) {
      return err(
        new Error(`Failed to search exercises: ${(error as Error).message}`),
      );
    }
  }

  async findRecentByUserId(params: {
    userId: string;
    locale: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<Exercise[], Error>> {
    try {
      const { userId, locale, limit = 10, offset = 0 } = params;

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
        .where(eq(exerciseUsage.userId, userId))
        .orderBy(sql`${exerciseUsage.lastUsedAt} DESC`)
        .limit(limit)
        .offset(offset);

      const rows = await query;
      const exerciseMap = this.mapRowsToExercises(rows);
      return ok(Array.from(exerciseMap.values()));
    } catch (error) {
      return err(
        new Error(
          `Failed to find recent exercises: ${(error as Error).message}`,
        ),
      );
    }
  }

  private mapRowsToExercise(rows: DBRow[]): Exercise {
    const firstRow = rows[0];
    if (!firstRow) {
      throw new Error("No rows to map");
    }

    const translations = new Map<string, ExerciseTranslation>();
    const muscles: ExerciseMuscle[] = [];

    for (const row of rows) {
      if (row.translation && !translations.has(row.translation.locale)) {
        translations.set(row.translation.locale, {
          locale: row.translation.locale,
          name: row.translation.name,
          aliases: row.translation.aliases
            ? row.translation.aliases.split(",")
            : undefined,
        });
      }

      if (row.muscle) {
        const muscleKey = `${row.muscle.exerciseId}-${row.muscle.muscleId}`;
        if (
          !muscles.find((m) => `${m.exerciseId}-${m.muscleId}` === muscleKey)
        ) {
          muscles.push({
            exerciseId: new ExerciseIdVO(row.muscle.exerciseId),
            muscleId: row.muscle.muscleId,
            relativeShare: row.muscle.relativeShare,
            sourceId: row.muscle.sourceId || undefined,
            sourceDetails: row.muscle.notes || undefined,
          });
        }
      }
    }

    return new Exercise(
      new ExerciseIdVO(firstRow.exercise.id),
      ExerciseNameVO.create(firstRow.exercise.canonicalName),
      firstRow.exercise.defaultMuscleId,
      firstRow.exercise.isCompound,
      firstRow.exercise.isOfficial,
      firstRow.exercise.authorUserId,
      firstRow.exercise.lastUsedAt
        ? new Date(firstRow.exercise.lastUsedAt)
        : null,
      Array.from(translations.values()),
      muscles,
    );
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
