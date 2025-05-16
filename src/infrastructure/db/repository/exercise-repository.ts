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

  async search(query: string | null, locale = 'ja', limit: number = DEFAULT_SEARCH_LIMIT): Promise<Exercise[]> {
    console.debug(`[ExerciseRepository.search_FTS] Start: query="${query}", locale="${locale}", limit=${limit}`);

    if (!query || query.trim().length < 2) {
      console.debug('[ExerciseRepository.search_FTS] Query is too short (less than 2 chars). Returning empty array.');
      // ここで最近使ったエクササイズなどを返すフォールバックも検討できますが、今回は空配列とします。
      // OpenAPI 仕様では "Search or list recent exercises" とあるため、
      // query がない場合は最近のものをリストする、という分岐もここで可能です。
      // 例: if (!query) { return this.findRecentByUserId(...); }
      return [];
    }

    // FTS特殊文字のサニタイズ: " ' - * ( ) : など FTSクエリで問題を起こしうる文字をスペースに置換
    // アスタリスクは前方一致で後から付加するので、入力からは除去する。
    // ハイフンも除去対象とする（例: "barbell-row" -> "barbell row" のようにしたい場合）。
    // 句読点などは unicode61 トークナイザがある程度処理してくれるが、明示的に対処する。
    const sanitizedQuery = query
    .trim()
    .toLowerCase()
    // 英数字、ひらがな、カタカナ、漢字、スペース以外の文字をスペースに置換
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');

    const keywords = sanitizedQuery
      .split(/\s+/) // 1つ以上の空白文字で区切る
      .filter(k => k.length > 0) // 空のキーワードを除去 (サニタイズの結果空になる場合もある)
      .map((k) => `${k}*`) // 各キーワードに前方一致演算子を追加
      .join(' AND ');

    if (!keywords) {
        console.debug('[ExerciseRepository.search_FTS] No effective keywords after sanitizing and processing. Returning empty array.');
        return [];
    }

    console.debug(`[ExerciseRepository.search_FTS] Sanitized query: "${sanitizedQuery}", Executing FTS query with keywords: "${keywords}", for locale: "${locale}" (and 'unknown')`);

    // 検索対象のロケール: 指定されたロケールと、canonical_nameのみを格納する 'unknown'
    const targetLocales = [locale, 'unknown'];
    
    // FTSクエリの組み立て
    // exercises_fts.text を MATCH で検索
    // exercises テーブルを JOIN して、最終的に Exercise エンティティに必要な情報を取得
    // bm25() でスコアリングし、並び替えに使用
    const ftsQuery = sql`
      SELECT
        e.id as exercise_id_val, -- エイリアスをつけて他のidと区別
        -- mapDbRowsToExerciseEntities に必要なカラムを exercises から取得
        e.canonical_name,
        e.default_muscle_id,
        e.is_compound,
        e.is_official,
        e.author_user_id,
        e.last_used_at,
        e.created_at,
        -- FTSスコア (bm25の値が小さいほど関連性が高い)
        bm25(exercises_fts) AS score
      FROM exercises_fts
      JOIN exercises e ON e.id = exercises_fts.exercise_id
      WHERE exercises_fts.text MATCH ${keywords}
        AND exercises_fts.locale IN ${targetLocales}
      ORDER BY score ASC, e.is_official DESC, e.last_used_at DESC
      LIMIT ${limit}
    `;
    // SQLiteのbm25()はスコアが小さいほど良いので ASC

    // Drizzleで型付けされた結果を得るには、各カラムを明示的に sql.identifier や sql.raw で指定する必要がある場合があるが、
    // db.all() は any[] を返すので、ここで型定義と合わない場合は実行時エラーになる可能性がある。
    // 厳密には、SELECT句で取得するカラムを Exercise エンティティの構造に合わせて全て列挙し、
    // それを元に mapDbRowsToExerciseEntities を呼び出すか、新しいマッピング関数を作る。
    // ここでは、まずFTSでIDとスコアを取得し、その後IDリストで完全な情報を取得する二段階方式を採用。
    
    const ftsResults: { exercise_id: string; score: number }[] = await this.db.all(sql`
      SELECT
        exercise_id,
        bm25(exercises_fts) AS score
      FROM exercises_fts
      WHERE text MATCH ${keywords}
        AND locale IN ${targetLocales}
      ORDER BY score ASC -- SQLite bm25はスコアが小さいほど良い
      LIMIT ${limit} 
    `);


    console.debug(`[ExerciseRepository.search_FTS] Found ${ftsResults.length} exercises from FTS stage 1.`);

    if (ftsResults.length === 0) {
      return [];
    }

    const exerciseIds = ftsResults.map(r => r.exercise_id);

    // FTSで見つかったIDを使って、翻訳情報を含む完全なエクササイズ情報を取得
    // (mapDbRowsToExerciseEntities を再利用するため)
    const fullExerciseDataRows: DbExerciseRow[] = await this.db
      .select({
        id: this.tables.exercises.id,
        canonicalName: this.tables.exercises.canonicalName,
        defaultMuscleId: this.tables.exercises.defaultMuscleId,
        isCompound: this.tables.exercises.isCompound,
        isOfficial: this.tables.exercises.isOfficial,
        authorUserId: this.tables.exercises.authorUserId,
        lastUsedAt: this.tables.exercises.lastUsedAt,
        createdAt: this.tables.exercises.createdAt,
        translationLocale: this.tables.exerciseTranslations.locale,
        translationName: this.tables.exerciseTranslations.name,
        translationAliases: this.tables.exerciseTranslations.aliases,
      })
      .from(this.tables.exercises)
      .leftJoin( // 全翻訳情報を取得
        this.tables.exerciseTranslations,
        eq(this.tables.exercises.id, this.tables.exerciseTranslations.exerciseId)
      )
      .where(inArray(this.tables.exercises.id, exerciseIds)) // FTSで見つかったIDで絞り込み
      .all();

    const mappedExercises = this.mapDbRowsToExerciseEntities(fullExerciseDataRows);
    
    if (exerciseIds.length === 0 && mappedExercises.length > 0) {
      // このケースは通常発生しないはず (FTSでIDが見つからなければmappedExercisesも空になる)
      // しかし、念のためログを出してそのまま返す
      console.warn('[ExerciseRepository.search_FTS] exerciseIds is empty, but mappedExercises is not. Returning mappedExercises as is.');
      return mappedExercises;
    }
    if (mappedExercises.length === 0) { // FTSの結果があっても、詳細取得で0件になることはないはずだが、安全のため
        return [];
    }

    // IDとその元の順序(インデックス)をMapに格納
    const orderMap = new Map<string, number>();
    exerciseIds.forEach((id, index) => {
      orderMap.set(id, index);
    });

    const sortedExercises = mappedExercises.sort((a, b) => {
      const orderA = orderMap.get(a.id.value); // a.id は ExerciseIdVO
      const orderB = orderMap.get(b.id.value); // b.id は ExerciseIdVO

      // orderMap にIDが存在しないケースは原則ありえないが、万が一を考慮
      if (orderA === undefined && orderB === undefined) return 0;
      if (orderA === undefined) return 1; // orderA がないものを後ろへ
      if (orderB === undefined) return -1; // orderB がないものを後ろへ (orderAはあるので a が先)

      return orderA - orderB;
    });
    
    console.debug(`[ExerciseRepository.search_FTS] Returning ${sortedExercises.length} exercises after mapping and FTS-order sorting.`);
    return sortedExercises;
  }

  async findRecentByUserId(userId: string, locale: string, limit: number, offset: number): Promise<Exercise[]> {
    const recentUsageRows = await this.db
      .select({
        exerciseId: this.tables.exerciseUsage.exerciseId,
        lastUsedAt: this.tables.exerciseUsage.lastUsedAt,
      })
      .from(this.tables.exerciseUsage)
      .where(eq(this.tables.exerciseUsage.userId, userId))
      .orderBy(desc(this.tables.exerciseUsage.lastUsedAt))
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
      })
      .onConflictDoUpdate({
        target: [this.tables.exerciseUsage.userId, this.tables.exerciseUsage.exerciseId],
        set: {
          lastUsedAt: usedAtISO,
        }
      })
      .execute(); // Use .execute() for D1 driver as per Drizzle docs for writes
  }
}
