import { eq, like, or, and, desc, sql, inArray, type SQL } from 'drizzle-orm';
import type { SQLiteSelect } from 'drizzle-orm/sqlite-core';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { IExerciseRepository } from '../../../domain/exercise/repository';
import { Exercise, type ExerciseId, type ExerciseTranslation } from '../../../domain/exercise/entity';
import { ExerciseIdVO } from '../../../domain/shared/vo/identifier';
import type * as schema from '../schema';

type AllTables = typeof schema;
const DEFAULT_SEARCH_LIMIT = 50;

// Type for the raw database row returned by the common select query
interface DbExerciseRow {
  id: string;
  canonicalName: string;
  defaultMuscleId: number | null;
  isCompound: boolean | null; // Drizzle mode:"boolean" converts DB 0/1 to boolean
  isOfficial: boolean | null; // Drizzle mode:"boolean" converts DB 0/1 to boolean
  authorUserId: string | null;
  lastUsedAt: string | null;   // In DB it's TEXT (ISO8601 string)
  createdAt: string;         // In DB it's TEXT (ISO8601 string)
  translationLocale: string | null;
  translationName: string | null;
  translationAliases: string | null; // CSV string
}

export class DrizzleExerciseRepository implements IExerciseRepository {
  constructor(
    private readonly db: DrizzleD1Database<AllTables>,
    private readonly tables: AllTables,
  ) {}

  private mapDbRowsToExerciseEntities(rows: DbExerciseRow[]): Exercise[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    const exercisesMap = new Map<string, {
      exerciseData: Omit<DbExerciseRow, 'translationLocale' | 'translationName' | 'translationAliases'>;
      translations: ExerciseTranslation[];
    }>();

    for (const row of rows) {
      if (!exercisesMap.has(row.id)) {
        exercisesMap.set(row.id, {
          exerciseData: {
            id: row.id,
            canonicalName: row.canonicalName,
            defaultMuscleId: row.defaultMuscleId,
            isCompound: row.isCompound, // Already boolean | null from select
            isOfficial: row.isOfficial, // Already boolean | null from select
            authorUserId: row.authorUserId,
            lastUsedAt: row.lastUsedAt,
            createdAt: row.createdAt,
          },
          translations: [],
        });
      }

      const entry = exercisesMap.get(row.id);
      if (entry && row.translationLocale && row.translationName) {
        const aliases = row.translationAliases ? row.translationAliases.split(',').map((s: string) => s.trim()) : undefined;
        entry.translations.push({
          locale: row.translationLocale,
          name: row.translationName,
          aliases: aliases,
        });
      }
    }
    
    return Array.from(exercisesMap.values()).map(entry => new Exercise(
      new ExerciseIdVO(entry.exerciseData.id),
      entry.exerciseData.canonicalName,
      entry.exerciseData.defaultMuscleId,
      Boolean(entry.exerciseData.isCompound), // Converts null to false, boolean to boolean
      Boolean(entry.exerciseData.isOfficial), // Converts null to false, boolean to boolean
      entry.exerciseData.authorUserId,
      entry.exerciseData.lastUsedAt ? new Date(entry.exerciseData.lastUsedAt) : null,
      new Date(entry.exerciseData.createdAt),
      entry.translations,
    ));
  }

  async findById(id: ExerciseId): Promise<Exercise | null> {
    // Drizzle's select with schema having mode:"boolean" will return boolean for isCompound/isOfficial
    const results: DbExerciseRow[] = await this.db
      .select({
        id: this.tables.exercises.id,
        canonicalName: this.tables.exercises.canonicalName,
        defaultMuscleId: this.tables.exercises.defaultMuscleId,
        isCompound: this.tables.exercises.isCompound, // Returns boolean | null
        isOfficial: this.tables.exercises.isOfficial, // Returns boolean | null
        authorUserId: this.tables.exercises.authorUserId,
        lastUsedAt: this.tables.exercises.lastUsedAt,
        createdAt: this.tables.exercises.createdAt,
        translationLocale: this.tables.exerciseTranslations.locale,
        translationName: this.tables.exerciseTranslations.name,
        translationAliases: this.tables.exerciseTranslations.aliases,
      })
      .from(this.tables.exercises)
      .leftJoin(
        this.tables.exerciseTranslations,
        eq(this.tables.exercises.id, this.tables.exerciseTranslations.exerciseId),
      )
      .where(eq(this.tables.exercises.id, id.value))
      .all();

    const mappedExercises = this.mapDbRowsToExerciseEntities(results);
    return mappedExercises.length > 0 ? mappedExercises[0] : null;
  }

  async search(query: string | null, locale: string, limit: number = DEFAULT_SEARCH_LIMIT): Promise<Exercise[]> {
    const searchLower = query ? query.toLowerCase().trim() : null;
    const conditions: SQL[] = [];

    if (searchLower) {
      const searchQuery = `%${searchLower}%`;
      conditions.push(like(sql<string>`lower(${this.tables.exercises.canonicalName})`, searchQuery));

      const translatedMatchSubquery = this.db
        .selectDistinct({ id: this.tables.exerciseTranslations.exerciseId })
        .from(this.tables.exerciseTranslations)
        .where(and(
          eq(this.tables.exerciseTranslations.locale, locale),
          or(
            like(sql<string>`lower(${this.tables.exerciseTranslations.name})`, searchQuery),
            like(sql<string>`lower(${this.tables.exerciseTranslations.aliases})`, searchQuery)
          )
        )).as('translated_match');
      
      conditions.push(inArray(this.tables.exercises.id, sql`(select id from ${translatedMatchSubquery})`));
    } 

    const finalCondition = conditions.length > 0 ? or(...conditions) : undefined;

    const exerciseIdsQuery = this.db
      .selectDistinct({ id: this.tables.exercises.id })
      .from(this.tables.exercises)
      .orderBy(
        desc(sql`${this.tables.exercises.lastUsedAt} IS NULL`), 
        desc(this.tables.exercises.lastUsedAt),
        desc(this.tables.exercises.isOfficial),
        desc(this.tables.exercises.createdAt) 
      )
      .limit(limit);

    if (finalCondition) {
      exerciseIdsQuery.where(finalCondition);
    }
    
    const exerciseIdRows = await exerciseIdsQuery.all();

    if (exerciseIdRows.length === 0) {
      return [];
    }
    const exerciseIds = exerciseIdRows.map(row => row.id);

    const fullExerciseDataRows: DbExerciseRow[] = await this.db
      .select({
        id: this.tables.exercises.id,
        canonicalName: this.tables.exercises.canonicalName,
        defaultMuscleId: this.tables.exercises.defaultMuscleId,
        isCompound: this.tables.exercises.isCompound, // Returns boolean | null
        isOfficial: this.tables.exercises.isOfficial, // Returns boolean | null
        authorUserId: this.tables.exercises.authorUserId,
        lastUsedAt: this.tables.exercises.lastUsedAt,
        createdAt: this.tables.exercises.createdAt,
        translationLocale: this.tables.exerciseTranslations.locale,
        translationName: this.tables.exerciseTranslations.name,
        translationAliases: this.tables.exerciseTranslations.aliases,
      })
      .from(this.tables.exercises)
      .leftJoin(
        this.tables.exerciseTranslations,
        eq(this.tables.exercises.id, this.tables.exerciseTranslations.exerciseId),
      )
      .where(inArray(this.tables.exercises.id, exerciseIds))
      .all();
    
    const mappedExercises = this.mapDbRowsToExerciseEntities(fullExerciseDataRows);
    
    return mappedExercises.sort((a, b) => {
      const aIndex = exerciseIds.indexOf(a.id.value); 
      const bIndex = exerciseIds.indexOf(b.id.value);
      return aIndex - bIndex;
    });
  }

  async create(exerciseData: Exercise): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
