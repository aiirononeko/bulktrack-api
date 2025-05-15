import { eq, like, or, and, desc, sql, inArray, type SQL } from 'drizzle-orm';
import type { SQLiteSelect } from 'drizzle-orm/sqlite-core';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { IExerciseRepository } from '../../../domain/exercise/repository';
import { Exercise, type ExerciseId, type ExerciseTranslation } from '../../../domain/exercise/entity';
import { ExerciseIdVO } from '../../../domain/shared/vo/identifier';
import type * as schema from '../schema';
import { exerciseUsage } from '../schema';

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

// Added interface for rows that include user-specific last used time
interface DbRecentExerciseRow extends DbExerciseRow {
  userLastUsedAt: string; 
}

export class DrizzleExerciseRepository implements IExerciseRepository {
  constructor(
    private readonly db: DrizzleD1Database<AllTables>,
    private readonly tables: AllTables,
  ) {}

  private mapDbRowsToExerciseEntities(rows: (DbExerciseRow | DbRecentExerciseRow)[]): Exercise[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    const exercisesMap = new Map<string, {
      exerciseData: Omit<DbExerciseRow, 'translationLocale' | 'translationName' | 'translationAliases'> & { userLastUsedAt?: string };
      translations: ExerciseTranslation[];
    }>();

    for (const row of rows) {
      if (!exercisesMap.has(row.id)) {
        exercisesMap.set(row.id, {
          exerciseData: {
            id: row.id,
            canonicalName: row.canonicalName,
            defaultMuscleId: row.defaultMuscleId,
            isCompound: row.isCompound, 
            isOfficial: row.isOfficial, 
            authorUserId: row.authorUserId,
            lastUsedAt: row.lastUsedAt, // Original lastUsedAt from exercises table
            createdAt: row.createdAt,
            // Check if userLastUsedAt property exists and assign it
            userLastUsedAt: 'userLastUsedAt' in row ? (row as DbRecentExerciseRow).userLastUsedAt : undefined,
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
      Boolean(entry.exerciseData.isCompound), 
      Boolean(entry.exerciseData.isOfficial), 
      entry.exerciseData.authorUserId,
      // Prioritize userLastUsedAt if available, otherwise use exercises.lastUsedAt
      entry.exerciseData.userLastUsedAt ? new Date(entry.exerciseData.userLastUsedAt) : (entry.exerciseData.lastUsedAt ? new Date(entry.exerciseData.lastUsedAt) : null),
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

  async findRecentByUserId(userId: string, locale: string, limit: number, offset: number): Promise<Exercise[]> {
    const recentUsageRows = await this.db
      .select({
        exerciseId: this.tables.exerciseUsage.exerciseId,
        lastUsedAt: this.tables.exerciseUsage.lastUsedAt,
        useCount: this.tables.exerciseUsage.useCount,
      })
      .from(this.tables.exerciseUsage)
      .where(eq(this.tables.exerciseUsage.userId, userId))
      .orderBy(desc(this.tables.exerciseUsage.useCount), desc(this.tables.exerciseUsage.lastUsedAt))
      .limit(limit)
      .offset(offset)
      .all();

    if (recentUsageRows.length === 0) {
      return [];
    }

    const exerciseIds = recentUsageRows.map(row => row.exerciseId);
    // Store lastUsedAt from exerciseUsage to ensure correct time is used later for Exercise entity
    const userLastUsedAtMap = new Map(recentUsageRows.map(row => [row.exerciseId, row.lastUsedAt]));

    const fullExerciseDataRows: DbExerciseRow[] = await this.db // Temporarily DbExerciseRow, will be mapped to DbRecentExerciseRow
      .select({
        id: this.tables.exercises.id,
        canonicalName: this.tables.exercises.canonicalName,
        defaultMuscleId: this.tables.exercises.defaultMuscleId,
        isCompound: this.tables.exercises.isCompound,
        isOfficial: this.tables.exercises.isOfficial,
        authorUserId: this.tables.exercises.authorUserId,
        lastUsedAt: this.tables.exercises.lastUsedAt, // This is exercises.lastUsedAt
        createdAt: this.tables.exercises.createdAt,
        translationLocale: this.tables.exerciseTranslations.locale,
        translationName: this.tables.exerciseTranslations.name,
        translationAliases: this.tables.exerciseTranslations.aliases,
      })
      .from(this.tables.exercises)
      .leftJoin(
        this.tables.exerciseTranslations,
        and(
          eq(this.tables.exercises.id, this.tables.exerciseTranslations.exerciseId),
          eq(this.tables.exerciseTranslations.locale, locale)
        )
      )
      .where(inArray(this.tables.exercises.id, exerciseIds))
      .all();

    // Map DbExerciseRow to DbRecentExerciseRow by adding userLastUsedAt from the map
    const recentExerciseRows: DbRecentExerciseRow[] = fullExerciseDataRows.map(row => {
      const userLastUsedTime = userLastUsedAtMap.get(row.id);
      if (!userLastUsedTime) {
        // This case should ideally not happen if exerciseUsage is consistent
        // However, to prevent crashes, we can log an error or use a fallback
        console.warn(`Exercise ID ${row.id} found in exercises but not in user's recent usage map. Using exercise.lastUsedAt.`);
        // Fallback to exercises.lastUsedAt if not in map, or make userLastUsedAt nullable in DbRecentExerciseRow
        // Forcing a string here, but it might be better to allow undefined and handle in mapDbRowsToExerciseEntities
        return { ...row, userLastUsedAt: row.lastUsedAt || new Date(0).toISOString() }; 
      }
      return { ...row, userLastUsedAt: userLastUsedTime };
    });
    
    const mappedExercises = this.mapDbRowsToExerciseEntities(recentExerciseRows);
    
    // Sort based on the order from recentUsageRows (which is already sorted by lastUsedAt desc)
    // This ensures that the primary sort key (user's last usage) is respected.
    return mappedExercises.sort((a, b) => {
      const aIndex = exerciseIds.indexOf(a.id.value);
      const bIndex = exerciseIds.indexOf(b.id.value);
      return aIndex - bIndex;
    });
  }

  async create(exerciseData: Exercise): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async upsertExerciseUsage(userId: string, exerciseId: string, usedAt: Date, incrementUseCount = true): Promise<void> {
    const usedAtISO = usedAt.toISOString();

    // Using Drizzle's way to do an "upsert" for SQLite
    // This relies on the primary key (userId, exerciseId) on the exercise_usage table
    await this.db.insert(this.tables.exerciseUsage)
      .values({
        userId: userId,
        exerciseId: exerciseId,
        lastUsedAt: usedAtISO,
        useCount: 1, // Initial count if new, will be updated if conflict
      })
      .onConflictDoUpdate({
        target: [this.tables.exerciseUsage.userId, this.tables.exerciseUsage.exerciseId],
        set: {
          lastUsedAt: usedAtISO,
          // Conditionally increment useCount. 
          // The sql template below is a common way to increment a column on conflict.
          // Note: Drizzle ORM might have more direct ways to increment, but sql helper is robust.
          useCount: incrementUseCount 
            ? sql`${this.tables.exerciseUsage.useCount} + 1` 
            : this.tables.exerciseUsage.useCount,
        }
      })
      .execute(); // Use .execute() for D1 driver as per Drizzle docs for writes
  }
}
