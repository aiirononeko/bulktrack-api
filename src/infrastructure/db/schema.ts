import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ------------------------------------------------
// 1.  Users & Devices
// ------------------------------------------------
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID v7
  displayName: text("display_name").notNull(),
  goalJson: text("goal_json"), // JSON: goals, injuries, etc.
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userDevices = sqliteTable("user_devices", {
  deviceId: text("device_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  platform: text("platform"),
  linkedAt: text("linked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ------------------------------------------------
// 2.  Muscles & Exercises (multilingual)
// ------------------------------------------------
export const muscleGroups = sqliteTable("muscle_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // e.g., "Chest", "Back", "Shoulders", "Arms", "Legs", "Core"
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const muscles = sqliteTable("muscles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // e.g., "Pectoralis Major (Clavicular Head)", "Deltoid (Anterior Head)"
  muscleGroupId: integer("muscle_group_id")
    .notNull()
    .references(() => muscleGroups.id, { onDelete: "no action", onUpdate: "cascade" }),
  tensionFactor: real("tension_factor").notNull().default(1.0), // relative stimulus multiplier (legacy, might be reviewed later)
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --------------------------------------------------------------------
// 2-1.  Modifier メタ定義（例: グリップ幅, ベンチ角度, スタンス幅 …）
// --------------------------------------------------------------------
export const modifiers = sqliteTable("modifiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** 例: 'grip_width', 'bench_incline', 'stance_width' */
  key: text("key").notNull().unique(),
  /** 多言語 UI 用の表示名 */
  name: text("name").notNull(),
  /** 'enum' | 'deg' | 'cm' | 'ratio' など自由記述。単位が無い時は NULL */
  unit: text("unit"),
  /** 備考・定義の根拠など */
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --------------------------------------------------------------------
// 2-2.  Exercise × Modifier 値 & 筋負荷補正係数
//    ─ 1 種目に複数の修飾子を付与可
// --------------------------------------------------------------------
export const exerciseModifierValues = sqliteTable(
  "exercise_modifier_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** FK: 種目 */
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade", onUpdate: "cascade" }),

    /** FK: 修飾子 */
    modifierId: integer("modifier_id")
      .notNull()
      .references(() => modifiers.id, { onDelete: "cascade", onUpdate: "cascade" }),

    /** 数値パラメータ（インクライン角=30° 等）——数値不要なら NULL */
    valueNum: real("value_num"),

    /** 列挙・自由記述パラメータ（'wide', 'close' 等）——数値の場合は NULL でOK */
    valueText: text("value_text"),

    /** valueNum と valueText を結合したキー（複合UNIQUE制約用） */
    valueKey: text("value_key")
      .notNull()
      .generatedAlwaysAs(sql`COALESCE(CAST(value_num AS TEXT), value_text)`),

    /** relative_share 全体に掛ける倍率 (例: +15% → 1.15) */
    relShareMultiplier: real("rel_share_multiplier").notNull().default(1.0),

    /** peak_emg_pct に加算するオフセット (例: +10%MVC → 10) */
    peakEmgOffset: real("peak_emg_offset").notNull().default(0),

    notes: text("notes"),

    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    /** 倍率は 0–2 程度の実用域に制限 */
    multCheck: check(
      "ck_rel_share_multiplier",
      sql`${table.relShareMultiplier} >= 0 AND ${table.relShareMultiplier} <= 2`,
    ),
    idxModExercise: index("idx_mod_exercise").on(table.exerciseId),
    unqExerciseModifierValue: uniqueIndex("unq_emv_eid_mid_vkey")
      .on(table.exerciseId, table.modifierId, table.valueKey),
  }),
);

export const exerciseSources = sqliteTable("exercise_sources", {
  id: text("id").primaryKey(), // DOI, ISBN, URL, or custom UUID
  title: text("title").notNull(),
  citation: text("citation"), // APA, MLA, etc.
  url: text("url"),
  retrievedAt: text("retrieved_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(), // UUID v7
  canonicalName: text("canonical_name").notNull(), // fallback name (EN/JA any)
  defaultMuscleId: integer("default_muscle_id").references(() => muscles.id, { onUpdate: "cascade" }),
  isCompound: integer("is_compound", { mode: "boolean" })
    .notNull()
    .default(false),
  isOfficial: integer("is_official", { mode: "boolean" })
    .notNull()
    .default(false),
  authorUserId: text("author_user_id").references(() => users.id, { onUpdate: "cascade" }),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const exerciseMuscles = sqliteTable(
  "exercise_muscles",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade", onUpdate: "cascade" }),
    muscleId: integer("muscle_id")
      .notNull()
      .references(() => muscles.id, { onUpdate: "cascade" }),
    relativeShare: integer("relative_share").notNull(), // Changed to integer, 0-1000, sum for an exercise should be 1000
    peakEmgPct: real("peak_emg_pct"), // %MVIC, optional
    sourceId: text("source_id").references(() => exerciseSources.id, { onDelete: "set null", onUpdate: "cascade" }), // Link to evidence
    notes: text("notes"), // e.g., "Based on wide grip variation"
  },
  (table) => ({
    pk: primaryKey({ columns: [table.exerciseId, table.muscleId] }),
    relativeShareCheck: check(
      "ck_relative_share",
      sql`${table.relativeShare} >= 0 AND ${table.relativeShare} <= 1000`, // Adjusted for 0-1000 range
    ),
    muscleIdx: index("idx_exercise_muscles_muscle").on(table.muscleId),
    exerciseIdx: index("idx_muscles_exercise").on(table.exerciseId),
  }),
);

export const exerciseTranslations = sqliteTable(
  "exercise_translations",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade", onUpdate: "cascade" }),
    locale: text("locale").notNull(), // 'en', 'ja', …
    name: text("name").notNull(),
    aliases: text("aliases"), // CSV or JSON list
  },
  (table) => ({
    pk: primaryKey({ columns: [table.exerciseId, table.locale] }),
  }),
);

// Full-text search tables (exercise_fts)
// They are VIRTUAL TABLEs created via migrations, but schema definition is needed for Drizzle ORM queries.
export const exercisesFts = sqliteTable("exercises_fts", {
  exerciseId: text("exercise_id").notNull(),
  locale: text("locale").notNull(),
  text: text("text").notNull(),
  textNormalized: text("text_normalized"), // For hiragana normalized search
  // rowid: integer('rowid').primaryKey(), // FTS5 virtual tables have a rowid, but it's usually managed by SQLite.
                                           // Defining it here might be optional or depend on Drizzle's FTS handling.
                                           // For now, omitting to let Drizzle/SQLite handle it by default.
});

// ------------------------------------------------
// 3.  Menus (templates) & Composition
// ------------------------------------------------
export const menus = sqliteTable("menus", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull().default("manual"), // 'manual' | 'official' | 'ai'
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const menuExercises = sqliteTable(
  "menu_exercises",
  {
    menuId: text("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(), // 1-based order
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onUpdate: "cascade" }),
    defaultWeight: real("default_weight"),
    defaultReps: text("default_reps"), // e.g. "8-10"
  },
  (table) => ({
    pk: primaryKey({ columns: [table.menuId, table.position] }),
  }),
);

// ------------------------------------------------
// 4.  Workout Sessions & Sets (fact tables)
// ------------------------------------------------
export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onUpdate: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onUpdate: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    weight: real("weight"),
    notes: text("notes"),
    performedAt: text("performed_at").notNull(),
    rpe: real("rpe"),
    restSec: integer("rest_sec"),
    volume: real("volume").generatedAlwaysAs(sql`(COALESCE(weight, 0) * COALESCE(reps, 0))`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    exerciseRecIdx: index("idx_sets_exercise_rec").on(
      table.userId,
      table.exerciseId,
      table.createdAt,
    ),
    userPerformedAtIdx: index("idx_sets_user_performed_at").on(
      table.userId,
      table.performedAt,
    ),
    rpeCheck: check("ck_rpe_range", sql`${table.rpe} >= 1 AND ${table.rpe} <= 10`),
  }),
);

// ------------------------------------------------
// 5.  Recent Usage for fast suggestion
// ------------------------------------------------
export const exerciseUsage = sqliteTable(
  "exercise_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onUpdate: "cascade" }),
    lastUsedAt: text("last_used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.exerciseId] }),
  }),
);

// Upsert trigger (trg_usage_after_insert) is not directly defined in schema.ts.
// This logic needs to be handled by database triggers (migrations) or application logic.

// ------------------------------------------------
// 6.  Dashboard Aggregates (Revised 2025‑05‑10)
// ------------------------------------------------
// After dropping the legacy tables (userDashboardStats, weeklyMuscleVolumes,
// weeklyUserActivity), add the following three tables. They cover:
//   • user‑level weekly totals & intensity (weeklyUserVolumes)
//   • muscle‑level weekly volumes for UI drill‑down (weeklyUserMuscleVolumes)
//   • generic key‑value metrics to overlay on graphs (weeklyUserMetrics)
//
// The week boundary is ISO‑8601 Monday. Store it as TEXT `yyyy‑mm‑dd` so
// SQLite/D1 can index & range‑query efficiently.

// --------------------------------------------------
// 6.1  Weekly total volume per user
// --------------------------------------------------
export const weeklyUserVolumes = sqliteTable(
  "weekly_user_volumes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),

    // ISO Monday of the target week (e.g. '2025-05-05')
    weekStart: text("week_start").notNull(),

    // Σ(weight × reps) for all sets that week
    totalVolume: real("total_volume").notNull(),

    // mean set volume – motivational context when total drops but intensity rises
    avgSetVolume: real("avg_set_volume").notNull(),

    // mean estimated 1RM of key lifts (optional, nullable)
    e1rmAvg: real("e1rm_avg"),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.weekStart] }),
    idxUserWeek: index("idx_weekly_uv_user_week").on(table.userId, table.weekStart),
  }),
);

// --------------------------------------------------
// 6.2  Weekly volume per muscle (for drill‑down charts)
// --------------------------------------------------
export const weeklyUserMuscleVolumes = sqliteTable(
  "weekly_user_muscle_volumes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),

    weekStart: text("week_start").notNull(),

    muscleId: integer("muscle_id")
      .notNull()
      .references(() => muscles.id, { onDelete: "cascade", onUpdate: "cascade" }),

    // Σ(weight × reps × relativeShare) for that muscle
    volume: real("volume").notNull(),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.weekStart, table.muscleId] }),
    idxMuscleWeek: index("idx_weekly_umv").on(table.userId, table.weekStart),
  }),
);

// --------------------------------------------------
// 6.3  Weekly user metrics (generic key‑value overlay)
// --------------------------------------------------
export const weeklyUserMetrics = sqliteTable(
  "weekly_user_metrics",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),

    weekStart: text("week_start").notNull(),

    metricKey: text("metric_key").notNull(),  // e.g. 'body_weight', 'sleep_h', 'avg_RPE'
    metricValue: real("metric_value").notNull(),
    metricUnit: text("metric_unit"),           // 'kg', 'h', etc.

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.weekStart, table.metricKey] }),
    idxMetric: index("idx_wum_user_week_metric").on(table.userId, table.weekStart),
  }),
);

// --------------------------------------------------
//  End of dashboard aggregates
// --------------------------------------------------

// ------------------------------------------------
// 7. End of schema
// ------------------------------------------------

// Migration helper notes (like pragma user_version) are for migration files, not the schema.ts itself.
