import {
  ExerciseFull as Exercise,
  ExerciseIdVO,
  ExerciseNameVO,
  type ExerciseFullTranslation as ExerciseTranslation,
  type ExerciseMuscle,
  type ExerciseQueryPort,
  type ExerciseCommandPort,
  type ExerciseAdminPort,
  type SearchParams,
  type RecentExerciseParams,
} from "@bulktrack/core";
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

/**
 * Consolidated Exercise Repository implementing all exercise-related ports
 * Following Interface Segregation Principle by implementing multiple focused interfaces
 */
export class ExerciseRepository
  implements ExerciseQueryPort, ExerciseCommandPort, ExerciseAdminPort
{
  private db;

  constructor(private readonly d1: D1Database) {
    this.db = drizzle(d1);
  }

  // ExerciseQueryPort methods

  async findById(id: ExerciseIdVO): Promise<Result<Exercise | null, Error>> {
    try {
      const exerciseId = id.value;

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

      return ok(exercise || null);
    } catch (error) {
      return err(
        new Error(`Failed to find exercise by id: ${(error as Error).message}`),
      );
    }
  }

  async search(params: SearchParams): Promise<Result<Exercise[], Error>> {
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

  async findRecentByUserId(
    params: RecentExerciseParams,
  ): Promise<Result<Exercise[], Error>> {
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

  // ExerciseCommandPort methods

  async create(exercise: Exercise): Promise<Result<void, Error>> {
    try {
      await this.db.transaction(async (tx) => {
        // Insert the main exercise record
        await tx.insert(exercises).values({
          id: exercise.id.value,
          canonicalName: exercise.canonicalName.value,
          defaultMuscleId: exercise.defaultMuscleId,
          isCompound: exercise.isCompound,
          isOfficial: exercise.isOfficial,
          authorUserId: exercise.authorUserId,
          lastUsedAt: exercise.lastUsedAt?.toISOString() || null,
        });

        // Insert translations
        if (exercise.translations.length > 0) {
          await tx.insert(exerciseTranslations).values(
            exercise.translations.map((translation) => ({
              exerciseId: exercise.id.value,
              locale: translation.locale,
              name: translation.name,
              aliases: translation.aliases?.join(",") || null,
            })),
          );
        }

        // Insert muscle relationships
        if (exercise.exerciseMuscles.length > 0) {
          await tx.insert(exerciseMuscles).values(
            exercise.exerciseMuscles.map((muscle) => ({
              exerciseId: exercise.id.value,
              muscleId: muscle.muscleId,
              relativeShare: muscle.relativeShare,
              sourceId: muscle.sourceId || null,
              notes: muscle.sourceDetails || null,
            })),
          );
        }

        // Update FTS index
        await this.updateFtsIndex(tx, exercise);
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new Error(`Failed to create exercise: ${(error as Error).message}`),
      );
    }
  }

  async updateUsage(
    userId: string,
    exerciseId: ExerciseIdVO,
    usedAt: Date,
    incrementUseCount = true,
  ): Promise<Result<void, Error>> {
    try {
      // The schema uses an upsert trigger or we handle it in application logic
      // Since there's no useCount field, we just update/insert the lastUsedAt timestamp
      const existingUsage = await this.db
        .select()
        .from(exerciseUsage)
        .where(
          and(
            eq(exerciseUsage.userId, userId),
            eq(exerciseUsage.exerciseId, exerciseId.value),
          ),
        )
        .limit(1);

      if (existingUsage.length > 0) {
        // Update existing usage
        await this.db
          .update(exerciseUsage)
          .set({
            lastUsedAt: usedAt.toISOString(),
          })
          .where(
            and(
              eq(exerciseUsage.userId, userId),
              eq(exerciseUsage.exerciseId, exerciseId.value),
            ),
          );
      } else {
        // Create new usage record
        await this.db.insert(exerciseUsage).values({
          userId,
          exerciseId: exerciseId.value,
          lastUsedAt: usedAt.toISOString(),
        });
      }

      return ok(undefined);
    } catch (error) {
      return err(
        new Error(`Failed to update exercise usage: ${(error as Error).message}`),
      );
    }
  }

  // ExerciseAdminPort methods

  async saveFullExercise(exercise: Exercise): Promise<Result<void, Error>> {
    try {
      await this.db.transaction(async (tx) => {
        // Check if exercise exists
        const existing = await tx
          .select()
          .from(exercises)
          .where(eq(exercises.id, exercise.id.value))
          .limit(1);

        if (existing.length > 0) {
          // Update existing exercise
          await tx
            .update(exercises)
            .set({
              canonicalName: exercise.canonicalName.value,
              defaultMuscleId: exercise.defaultMuscleId,
              isCompound: exercise.isCompound,
              isOfficial: exercise.isOfficial,
              authorUserId: exercise.authorUserId,
              lastUsedAt: exercise.lastUsedAt?.toISOString() || null,
            })
            .where(eq(exercises.id, exercise.id.value));

          // Delete existing translations and muscles
          await tx
            .delete(exerciseTranslations)
            .where(eq(exerciseTranslations.exerciseId, exercise.id.value));
          await tx
            .delete(exerciseMuscles)
            .where(eq(exerciseMuscles.exerciseId, exercise.id.value));
        } else {
          // Insert new exercise
          await tx.insert(exercises).values({
            id: exercise.id.value,
            canonicalName: exercise.canonicalName.value,
            defaultMuscleId: exercise.defaultMuscleId,
            isCompound: exercise.isCompound,
            isOfficial: exercise.isOfficial,
            authorUserId: exercise.authorUserId,
            lastUsedAt: exercise.lastUsedAt?.toISOString() || null,
          });
        }

        // Insert translations
        if (exercise.translations.length > 0) {
          await tx.insert(exerciseTranslations).values(
            exercise.translations.map((translation) => ({
              exerciseId: exercise.id.value,
              locale: translation.locale,
              name: translation.name,
              aliases: translation.aliases?.join(",") || null,
            })),
          );
        }

        // Insert muscle relationships
        if (exercise.exerciseMuscles.length > 0) {
          await tx.insert(exerciseMuscles).values(
            exercise.exerciseMuscles.map((muscle) => ({
              exerciseId: exercise.id.value,
              muscleId: muscle.muscleId,
              relativeShare: muscle.relativeShare,
              sourceId: muscle.sourceId || null,
              notes: muscle.sourceDetails || null,
            })),
          );
        }

        // Update FTS index
        await this.updateFtsIndex(tx, exercise);
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new Error(`Failed to save full exercise: ${(error as Error).message}`),
      );
    }
  }

  async deleteFullExerciseById(
    exerciseId: ExerciseIdVO,
  ): Promise<Result<void, Error>> {
    try {
      await this.db.transaction(async (tx) => {
        // Delete from all related tables
        await tx
          .delete(exercisesFts)
          .where(eq(exercisesFts.exerciseId, exerciseId.value));
        await tx
          .delete(exerciseMuscles)
          .where(eq(exerciseMuscles.exerciseId, exerciseId.value));
        await tx
          .delete(exerciseTranslations)
          .where(eq(exerciseTranslations.exerciseId, exerciseId.value));
        await tx
          .delete(exerciseUsage)
          .where(eq(exerciseUsage.exerciseId, exerciseId.value));
        await tx
          .delete(exercises)
          .where(eq(exercises.id, exerciseId.value));
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new Error(`Failed to delete exercise: ${(error as Error).message}`),
      );
    }
  }

  async saveExerciseTranslation(
    exerciseId: ExerciseIdVO,
    translation: ExerciseTranslation,
  ): Promise<Result<void, Error>> {
    try {
      await this.db.transaction(async (tx) => {
        // Check if translation exists
        const existing = await tx
          .select()
          .from(exerciseTranslations)
          .where(
            and(
              eq(exerciseTranslations.exerciseId, exerciseId.value),
              eq(exerciseTranslations.locale, translation.locale),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing translation
          await tx
            .update(exerciseTranslations)
            .set({
              name: translation.name,
              aliases: translation.aliases?.join(",") || null,
            })
            .where(
              and(
                eq(exerciseTranslations.exerciseId, exerciseId.value),
                eq(exerciseTranslations.locale, translation.locale),
              ),
            );
        } else {
          // Insert new translation
          await tx.insert(exerciseTranslations).values({
            exerciseId: exerciseId.value,
            locale: translation.locale,
            name: translation.name,
            aliases: translation.aliases?.join(",") || null,
          });
        }

        // Update FTS index for this locale
        await this.updateFtsIndexForLocale(tx, exerciseId.value, translation);
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new Error(
          `Failed to save exercise translation: ${(error as Error).message}`,
        ),
      );
    }
  }

  async deleteExerciseTranslation(
    exerciseId: ExerciseIdVO,
    locale: string,
  ): Promise<Result<void, Error>> {
    try {
      await this.db.transaction(async (tx) => {
        // Delete translation
        await tx
          .delete(exerciseTranslations)
          .where(
            and(
              eq(exerciseTranslations.exerciseId, exerciseId.value),
              eq(exerciseTranslations.locale, locale),
            ),
          );

        // Delete FTS index for this locale
        await tx
          .delete(exercisesFts)
          .where(
            and(
              eq(exercisesFts.exerciseId, exerciseId.value),
              eq(exercisesFts.locale, locale),
            ),
          );
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new Error(
          `Failed to delete exercise translation: ${(error as Error).message}`,
        ),
      );
    }
  }

  // Private helper methods

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

  private async updateFtsIndex(tx: any, exercise: Exercise): Promise<void> {
    // Delete existing FTS entries for this exercise
    await tx.delete(exercisesFts).where(eq(exercisesFts.exerciseId, exercise.id.value));

    // Add canonical name to FTS
    await tx.insert(exercisesFts).values({
      exerciseId: exercise.id.value,
      locale: "unknown",
      text: exercise.canonicalName.value,
      textNormalized: this.normalizeToHiragana(exercise.canonicalName.value).toLowerCase(),
    });

    // Add translations to FTS
    for (const translation of exercise.translations) {
      const texts = [translation.name];
      if (translation.aliases) {
        texts.push(...translation.aliases);
      }

      for (const text of texts) {
        await tx.insert(exercisesFts).values({
          exerciseId: exercise.id.value,
          locale: translation.locale,
          text,
          textNormalized: this.normalizeToHiragana(text).toLowerCase(),
        });
      }
    }
  }

  private async updateFtsIndexForLocale(
    tx: any,
    exerciseId: string,
    translation: ExerciseTranslation,
  ): Promise<void> {
    // Delete existing FTS entries for this exercise and locale
    await tx
      .delete(exercisesFts)
      .where(
        and(
          eq(exercisesFts.exerciseId, exerciseId),
          eq(exercisesFts.locale, translation.locale),
        ),
      );

    // Add translation and aliases to FTS
    const texts = [translation.name];
    if (translation.aliases) {
      texts.push(...translation.aliases);
    }

    for (const text of texts) {
      await tx.insert(exercisesFts).values({
        exerciseId,
        locale: translation.locale,
        text,
        textNormalized: this.normalizeToHiragana(text).toLowerCase(),
      });
    }
  }
}