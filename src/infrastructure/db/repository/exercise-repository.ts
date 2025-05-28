import { type SQL, and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { SQLiteSelect } from "drizzle-orm/sqlite-core";
import { normalizeToHiragana } from "../../../app/utils/text-processor";
import {
  Exercise,
  type ExerciseId,
  type ExerciseTranslation,
} from "../../../domain/exercise/entity";
import type { IExerciseRepository } from "../../../domain/exercise/repository";
import { ExerciseNameVO } from "../../../domain/exercise/vo";
import { ExerciseIdVO } from "../../../domain/shared/vo/identifier";
import type * as schema from "../schema";
import { exerciseUsage } from "../schema";

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
  lastUsedAt: string | null; // In DB it's TEXT (ISO8601 string)
  createdAt: string; // In DB it's TEXT (ISO8601 string)
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

  private mapDbRowsToExerciseEntities(
    rows: (DbExerciseRow | DbRecentExerciseRow)[],
  ): Exercise[] {
    if (!rows || rows.length === 0) {
      return [];
    }

    const exercisesMap = new Map<
      string,
      {
        exerciseData: Omit<
          DbExerciseRow,
          "translationLocale" | "translationName" | "translationAliases"
        > & { userLastUsedAt?: string };
        translations: ExerciseTranslation[];
      }
    >();

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
            lastUsedAt: row.lastUsedAt,
            createdAt: row.createdAt,
            userLastUsedAt:
              "userLastUsedAt" in row
                ? (row as DbRecentExerciseRow).userLastUsedAt
                : undefined,
          },
          translations: [],
        });
      }

      const entry = exercisesMap.get(row.id);
      if (entry && row.translationLocale && row.translationName) {
        const aliases = row.translationAliases
          ? row.translationAliases.split(",").map((s: string) => s.trim())
          : undefined;
        entry.translations.push({
          locale: row.translationLocale,
          name: row.translationName,
          aliases: aliases,
        });
      }
    }

    return Array.from(exercisesMap.values()).map(
      (entry) =>
        new Exercise(
          new ExerciseIdVO(entry.exerciseData.id),
          ExerciseNameVO.create(entry.exerciseData.canonicalName),
          entry.exerciseData.defaultMuscleId,
          Boolean(entry.exerciseData.isCompound),
          Boolean(entry.exerciseData.isOfficial),
          entry.exerciseData.authorUserId,
          entry.exerciseData.userLastUsedAt
            ? new Date(entry.exerciseData.userLastUsedAt)
            : entry.exerciseData.lastUsedAt
              ? new Date(entry.exerciseData.lastUsedAt)
              : null,
          entry.translations,
          [],
        ),
    );
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
        eq(
          this.tables.exercises.id,
          this.tables.exerciseTranslations.exerciseId,
        ),
      )
      .where(eq(this.tables.exercises.id, id.value))
      .all();

    const mappedExercises = this.mapDbRowsToExerciseEntities(results);
    return mappedExercises.length > 0 ? mappedExercises[0] : null;
  }

  async search(
    query: string | null,
    locale = "ja",
    limit: number = DEFAULT_SEARCH_LIMIT,
    offset = 0,
  ): Promise<Exercise[]> {
    console.debug(
      `[ExerciseRepository.search] Start: query="${query}", locale="${locale}", limit=${limit}, offset=${offset}`,
    );

    if (!query || query.trim() === "") {
      console.debug(
        "[ExerciseRepository.search] No query provided. Listing all exercises.",
      );
      // クエリがない場合は全件取得 (limit/offset を考慮)
      const allExerciseRows: DbExerciseRow[] = await this.db
        .select({
          id: this.tables.exercises.id,
          canonicalName: this.tables.exercises.canonicalName,
          defaultMuscleId: this.tables.exercises.defaultMuscleId,
          isCompound: this.tables.exercises.isCompound,
          isOfficial: this.tables.exercises.isOfficial,
          authorUserId: this.tables.exercises.authorUserId,
          lastUsedAt: this.tables.exercises.lastUsedAt,
          createdAt: this.tables.exercises.createdAt,
          // 特定ロケールの翻訳を取得するか、全翻訳を取得してmap側でフィルタリングするか検討
          // ここでは指定ロケールのみ取得 (mapDbRowsToExerciseEntitiesは複数ロケールを扱えるが、
          // 全件取得時は特定ロケールのみで十分な場合が多い)
          // もし全翻訳が必要なら、ここのJOIN条件とmapDbRowsToExerciseEntitiesのロジックを確認
          translationLocale: this.tables.exerciseTranslations.locale,
          translationName: this.tables.exerciseTranslations.name,
          translationAliases: this.tables.exerciseTranslations.aliases,
        })
        .from(this.tables.exercises)
        .leftJoin(
          this.tables.exerciseTranslations,
          and(
            eq(
              this.tables.exercises.id,
              this.tables.exerciseTranslations.exerciseId,
            ),
            eq(this.tables.exerciseTranslations.locale, locale), // 指定ロケールの翻訳のみJOIN
          ),
        )
        // TODO: 必要であれば isOfficial = true のような条件を追加
        .orderBy(this.tables.exercises.canonicalName) // 何らかの順序付け
        .limit(limit)
        .offset(offset)
        .all();

      const mappedExercises = this.mapDbRowsToExerciseEntities(allExerciseRows);
      console.debug(
        `[ExerciseRepository.search] Returning ${mappedExercises.length} exercises from all list.`,
      );
      return mappedExercises;
    }

    // FTS検索のためのクエリ長チェック (2文字以上)
    if (query.trim().length < 2) {
      console.debug(
        "[ExerciseRepository.search_FTS] Query is too short (less than 2 chars) for FTS. Returning empty array.",
      );
      return [];
    }

    // ユーザー入力クエリの正規化: ひらがな化 -> 小文字化 -> 特殊文字除去
    const normalizedQuery = normalizeToHiragana(query.trim())
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " "); // 英数字、ひらがな、カタカナ、漢字、スペース以外をスペースに

    const keywords = normalizedQuery
      .split(/\s+/)
      .filter((k) => k.length > 0)
      .map((k) => `${k}*`)
      .join(" AND ");

    if (!keywords) {
      console.debug(
        "[ExerciseRepository.search_FTS] No effective keywords after normalizing and processing. Returning empty array.",
      );
      return [];
    }

    console.debug(
      `[ExerciseRepository.search_FTS] Normalized query: "${normalizedQuery}", Executing FTS query with keywords: "${keywords}", for locale: "${locale}" (and 'unknown')`,
    );

    const targetLocales = [locale, "unknown"];

    const ftsResults: { exercise_id: string; score: number }[] =
      await this.db.all(sql`
      SELECT
        exercise_id,
        bm25(exercises_fts) AS score
      FROM exercises_fts
      WHERE text_normalized MATCH ${keywords} -- 検索対象を text_normalized に変更
        AND locale IN ${targetLocales}
      ORDER BY score ASC 
      LIMIT ${limit} OFFSET ${offset}
    `);

    console.debug(
      `[ExerciseRepository.search_FTS] Found ${ftsResults.length} exercises from FTS stage 1.`,
    );

    if (ftsResults.length === 0) {
      return [];
    }

    const exerciseIds = ftsResults.map((r) => r.exercise_id);

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
      .leftJoin(
        // 全翻訳情報を取得
        this.tables.exerciseTranslations,
        eq(
          this.tables.exercises.id,
          this.tables.exerciseTranslations.exerciseId,
        ),
      )
      .where(inArray(this.tables.exercises.id, exerciseIds)) // FTSで見つかったIDで絞り込み
      .all();

    const mappedExercises =
      this.mapDbRowsToExerciseEntities(fullExerciseDataRows);

    if (exerciseIds.length === 0 && mappedExercises.length > 0) {
      // このケースは通常発生しないはず (FTSでIDが見つからなければmappedExercisesも空になる)
      // しかし、念のためログを出してそのまま返す
      console.warn(
        "[ExerciseRepository.search_FTS] exerciseIds is empty, but mappedExercises is not. Returning mappedExercises as is.",
      );
      return mappedExercises;
    }
    if (mappedExercises.length === 0) {
      // FTSの結果があっても、詳細取得で0件になることはないはずだが、安全のため
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

    console.debug(
      `[ExerciseRepository.search_FTS] Returning ${sortedExercises.length} exercises after mapping and FTS-order sorting.`,
    );
    return sortedExercises;
  }

  async findRecentByUserId(
    userId: string,
    locale: string,
    limit: number,
    offset: number,
  ): Promise<Exercise[]> {
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

    const exerciseIds = recentUsageRows.map((row) => row.exerciseId);
    // Store lastUsedAt from exerciseUsage to ensure correct time is used later for Exercise entity
    const userLastUsedAtMap = new Map(
      recentUsageRows.map((row) => [row.exerciseId, row.lastUsedAt]),
    );

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
          eq(
            this.tables.exercises.id,
            this.tables.exerciseTranslations.exerciseId,
          ),
          eq(this.tables.exerciseTranslations.locale, locale),
        ),
      )
      .where(inArray(this.tables.exercises.id, exerciseIds))
      .all();

    // Map DbExerciseRow to DbRecentExerciseRow by adding userLastUsedAt from the map
    const recentExerciseRows: DbRecentExerciseRow[] = fullExerciseDataRows.map(
      (row) => {
        const userLastUsedTime = userLastUsedAtMap.get(row.id);
        if (!userLastUsedTime) {
          // This case should ideally not happen if exerciseUsage is consistent
          // However, to prevent crashes, we can log an error or use a fallback
          console.warn(
            `Exercise ID ${row.id} found in exercises but not in user's recent usage map. Using exercise.lastUsedAt.`,
          );
          // Fallback to exercises.lastUsedAt if not in map, or make userLastUsedAt nullable in DbRecentExerciseRow
          // Forcing a string here, but it might be better to allow undefined and handle in mapDbRowsToExerciseEntities
          return {
            ...row,
            userLastUsedAt: row.lastUsedAt || new Date(0).toISOString(),
          };
        }
        return { ...row, userLastUsedAt: userLastUsedTime };
      },
    );

    const mappedExercises =
      this.mapDbRowsToExerciseEntities(recentExerciseRows);

    // Sort based on the order from recentUsageRows (which is already sorted by lastUsedAt desc)
    // This ensures that the primary sort key (user's last usage) is respected.
    return mappedExercises.sort((a, b) => {
      const aIndex = exerciseIds.indexOf(a.id.value);
      const bIndex = exerciseIds.indexOf(b.id.value);
      return aIndex - bIndex;
    });
  }

  async create(exercise: Exercise): Promise<void> {
    await this.db.insert(this.tables.exercises).values({
      id: exercise.id.value,
      canonicalName: exercise.canonicalName.value,
      defaultMuscleId: exercise.defaultMuscleId,
      isCompound: exercise.isCompound,
      isOfficial: exercise.isOfficial,
      authorUserId: exercise.authorUserId,
      lastUsedAt: exercise.lastUsedAt
        ? exercise.lastUsedAt.toISOString()
        : null,
    });

    for (const translation of exercise.translations) {
      await this.saveExerciseTranslationInternal(
        exercise.id,
        translation,
        exercise.canonicalName.value,
        normalizeToHiragana(exercise.canonicalName.value),
      );
    }
    if (exercise.exerciseMuscles && exercise.exerciseMuscles.length > 0) {
      const muscleValues = exercise.exerciseMuscles.map((em) => ({
        exerciseId: exercise.id.value,
        muscleId: em.muscleId,
        relativeShare: em.relativeShare,
        sourceId: em.sourceId,
        sourceDetails: em.sourceDetails,
      }));
      const muscleValuesCorrected = exercise.exerciseMuscles.map((em) => ({
        exerciseId: exercise.id.value,
        muscleId: em.muscleId,
        relativeShare: em.relativeShare,
        sourceId: em.sourceId,
        notes: em.sourceDetails,
      }));
      await this.db
        .insert(this.tables.exerciseMuscles)
        .values(muscleValuesCorrected)
        .onConflictDoNothing();
    }
  }

  async upsertExerciseUsage(
    userId: string,
    exerciseId: ExerciseId,
    usedAt: Date,
    incrementUseCount = true,
  ): Promise<void> {
    const nowIso = usedAt.toISOString();
    await this.db
      .insert(this.tables.exerciseUsage)
      .values({
        userId: userId,
        exerciseId: exerciseId.value,
        lastUsedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: [
          this.tables.exerciseUsage.userId,
          this.tables.exerciseUsage.exerciseId,
        ],
        set: {
          lastUsedAt: nowIso,
        },
      });
  }

  // --- FTS更新用ヘルパーメソッド ---
  private async upsertExerciseFtsData(
    exerciseId: string,
    locale: string,
    originalTexts: (string | null | undefined)[], // [canonicalName, name, aliasesCsv]
    hiraganaTexts: (string | null | undefined)[], // [hiraCanonical, hiraName, hiraAliasesCsv]
  ): Promise<void> {
    const combinedOriginalText = originalTexts.filter(Boolean).join(" ").trim();
    const combinedNormalizedText = hiraganaTexts
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .trim();

    if (!combinedOriginalText && !combinedNormalizedText) {
      // 両方のテキストが空ならFTSエントリは削除
      await this.db.run(
        sql`DELETE FROM exercises_fts WHERE exercise_id = ${exerciseId} AND locale = ${locale}`,
      );
      console.debug(
        `[ExerciseRepo.upsertFts] Deleted FTS (empty texts) for exId:${exerciseId}, locale:${locale}`,
      );
      return;
    }

    // exercises_fts テーブルの text には原文、text_normalized には正規化済みひらがなテキストを保存
    // DELETE & INSERT でUPSERTを実装
    await this.db.run(
      sql`DELETE FROM exercises_fts WHERE exercise_id = ${exerciseId} AND locale = ${locale}`,
    );
    await this.db.run(sql`
      INSERT INTO exercises_fts (exercise_id, locale, text, text_normalized)
      VALUES (${exerciseId}, ${locale}, ${combinedOriginalText || ""}, ${combinedNormalizedText || ""})
    `);
    console.debug(
      `[ExerciseRepo.upsertFts] Upserted FTS for exId:${exerciseId}, locale:${locale}, original: "${(combinedOriginalText || "").substring(0, 25)}...", normalized: "${(combinedNormalizedText || "").substring(0, 25)}..."`,
    );
  }

  private async deleteExerciseFtsData(
    exerciseId: string,
    locale?: string,
  ): Promise<void> {
    if (locale) {
      await this.db.run(
        sql`DELETE FROM exercises_fts WHERE exercise_id = ${exerciseId} AND locale = ${locale}`,
      );
      console.debug(
        `[ExerciseRepo.deleteFts] Deleted FTS for exId:${exerciseId}, locale:${locale}`,
      );
    } else {
      await this.db.run(
        sql`DELETE FROM exercises_fts WHERE exercise_id = ${exerciseId}`,
      );
      console.debug(
        `[ExerciseRepo.deleteFts] Deleted all FTS for exId:${exerciseId}`,
      );
    }
  }

  // --- exercises テーブルへの永続化メソッド (仮の例、実際のメソッドに組み込む) ---
  // このリポジトリがExerciseエンティティ全体を保存する責任を持つ場合
  public async saveFullExercise(exercise: Exercise): Promise<void> {
    await this.db
      .insert(this.tables.exercises)
      .values({
        id: exercise.id.value,
        canonicalName: exercise.canonicalName.value,
        defaultMuscleId: exercise.defaultMuscleId,
        isCompound: exercise.isCompound,
        isOfficial: exercise.isOfficial,
        authorUserId: exercise.authorUserId,
        lastUsedAt: exercise.lastUsedAt
          ? exercise.lastUsedAt.toISOString()
          : null,
      })
      .onConflictDoUpdate({
        target: this.tables.exercises.id,
        set: {
          canonicalName: exercise.canonicalName.value,
          defaultMuscleId: exercise.defaultMuscleId,
          isCompound: exercise.isCompound,
          isOfficial: exercise.isOfficial,
          authorUserId: exercise.authorUserId,
          lastUsedAt: exercise.lastUsedAt
            ? exercise.lastUsedAt.toISOString()
            : null,
        },
      })
      .run();
    console.debug(
      `[ExerciseRepo.saveFullExercise] Saved exercise ${exercise.id.value} to main table.`,
    );

    const hiraCanonical = normalizeToHiragana(exercise.canonicalName.value);
    await this.upsertExerciseFtsData(
      exercise.id.value,
      "unknown",
      [exercise.canonicalName.value],
      [hiraCanonical],
    );

    if (exercise.translations && exercise.translations.length > 0) {
      for (const trans of exercise.translations) {
        await this.saveExerciseTranslationInternal(
          exercise.id,
          trans,
          exercise.canonicalName.value,
          hiraCanonical,
        );
      }
      await this.deleteExerciseFtsData(exercise.id.value, "unknown");
    }
  }

  // exercises テーブルの canonicalName のみの更新など、より細かい操作がある場合は別途メソッドを用意

  public async deleteFullExerciseById(
    exerciseIdVo: ExerciseIdVO,
  ): Promise<void> {
    const exerciseId = exerciseIdVo.value;
    await this.db
      .delete(this.tables.exercises)
      .where(eq(this.tables.exercises.id, exerciseId))
      .run();
    await this.deleteExerciseFtsData(exerciseId);
    console.debug(
      `[ExerciseRepo.deleteFullExercise] Deleted exercise ${exerciseId} and its FTS entries.`,
    );
  }

  // --- exercise_translations テーブルへの永続化メソッド (仮の例) ---
  // このメソッドは、Exerciseの canonicalName を引数で受け取るか、内部で参照取得する
  private async saveExerciseTranslationInternal(
    exerciseId: ExerciseIdVO,
    translation: ExerciseTranslation,
    canonicalName: string,
    hiraCanonicalName: string,
  ): Promise<void> {
    const exIdStr = exerciseId.value;
    // exercise_translations テーブルへのUPSERT
    await this.db
      .insert(this.tables.exerciseTranslations)
      .values({
        exerciseId: exIdStr,
        locale: translation.locale,
        name: translation.name,
        aliases: translation.aliases?.join(","),
      })
      .onConflictDoUpdate({
        target: [
          this.tables.exerciseTranslations.exerciseId,
          this.tables.exerciseTranslations.locale,
        ],
        set: {
          name: translation.name,
          aliases: translation.aliases?.join(","),
        },
      })
      .run();
    console.debug(
      `[ExerciseRepo.saveTransInternal] Saved translation for exId:${exIdStr}, locale:${translation.locale}`,
    );

    // FTS更新
    const hiraName = normalizeToHiragana(translation.name);
    // DBから読み出すaliasesはCSVなので、正規化のために一度配列に戻すか、CSVのまま正規化するか検討。
    // ここでは ExerciseTranslation.aliases が string[] である前提。
    const aliasesStr = translation.aliases?.join(" "); // FTS用にスペース区切り
    const hiraAliases = translation.aliases
      ? translation.aliases.map((a) => normalizeToHiragana(a)).join(" ")
      : "";

    await this.upsertExerciseFtsData(
      exIdStr,
      translation.locale,
      [canonicalName, translation.name, aliasesStr],
      [hiraCanonicalName, hiraName, hiraAliases],
    );
  }

  // 外部から翻訳のみを保存/更新する場合の公開メソッド
  public async saveExerciseTranslation(
    exerciseIdVo: ExerciseIdVO,
    translation: ExerciseTranslation,
  ): Promise<void> {
    const exercise = await this.findById(exerciseIdVo);
    if (!exercise) {
      throw new Error(
        `Exercise with id ${exerciseIdVo.value} not found when trying to save translation.`,
      );
    }
    const canonicalNameStr = exercise.canonicalName.value;
    const hiraCanonical = normalizeToHiragana(canonicalNameStr);
    await this.saveExerciseTranslationInternal(
      exerciseIdVo,
      translation,
      canonicalNameStr,
      hiraCanonical,
    );
    await this.deleteExerciseFtsData(exerciseIdVo.value, "unknown");
  }

  public async deleteExerciseTranslation(
    exerciseIdVo: ExerciseIdVO,
    locale: string,
  ): Promise<void> {
    const exerciseId = exerciseIdVo.value;
    // 1. exercise_translations テーブルから削除
    await this.db
      .delete(this.tables.exerciseTranslations)
      .where(
        and(
          eq(this.tables.exerciseTranslations.exerciseId, exerciseId),
          eq(this.tables.exerciseTranslations.locale, locale),
        ),
      )
      .run();
    console.debug(
      `[ExerciseRepo.deleteTrans] Deleted translation for exId:${exerciseId}, locale:${locale}`,
    );

    // 2. 対応するFTSエントリを削除
    await this.deleteExerciseFtsData(exerciseId, locale);

    // 3. もし他に翻訳が残っていなければ、'unknown' ロケールのFTSエントリを再作成
    const remainingTranslations = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(this.tables.exerciseTranslations)
      .where(eq(this.tables.exerciseTranslations.exerciseId, exerciseId))
      .get();

    if (remainingTranslations && remainingTranslations.count === 0) {
      const exerciseData = await this.db
        .select({ canonicalName: this.tables.exercises.canonicalName })
        .from(this.tables.exercises)
        .where(eq(this.tables.exercises.id, exerciseId))
        .get();
      if (exerciseData) {
        const hiraCanonical = normalizeToHiragana(exerciseData.canonicalName);
        await this.upsertExerciseFtsData(
          exerciseId,
          "unknown",
          [exerciseData.canonicalName],
          [hiraCanonical],
        );
      }
    }
  }
}
