import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
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
    .references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform"),
  linkedAt: text("linked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ------------------------------------------------
// 2.  Muscles & Exercises (multilingual)
// ------------------------------------------------
export const muscles = sqliteTable("muscles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  tensionFactor: real("tension_factor").notNull().default(1.0), // relative stimulus multiplier
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(), // UUID v7
  canonicalName: text("canonical_name").notNull(), // fallback name (EN/JA any)
  defaultMuscleId: integer("default_muscle_id").references(() => muscles.id),
  isCompound: integer("is_compound", { mode: "boolean" })
    .notNull()
    .default(false),
  isOfficial: integer("is_official", { mode: "boolean" })
    .notNull()
    .default(false),
  authorUserId: text("author_user_id").references(() => users.id),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const exerciseMuscles = sqliteTable(
  "exercise_muscles",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    muscleId: integer("muscle_id")
      .notNull()
      .references(() => muscles.id),
    // CHECK constraint (tension_ratio BETWEEN 0 AND 1) should be handled by DB migration or application validation.
    // Drizzle ORM schema definition doesn't directly support CHECK constraints in a portable way for all DBs,
    // though SQLite itself does. For now, we define the column and its type.
    // Application logic or a database trigger would be responsible for enforcing the 0-1 range.
    tensionRatio: real("tension_ratio").notNull(), 
  },
  (table) => ({
    pk: primaryKey({ columns: [table.exerciseId, table.muscleId] }),
    // Optional: Index for querying by exercise_id or muscle_id if needed frequently
    // exerciseIdx: index("idx_exercise_muscles_exercise").on(table.exerciseId),
    // muscleIdx: index("idx_exercise_muscles_muscle").on(table.muscleId),
  }),
);

export const exerciseTranslations = sqliteTable(
  "exercise_translations",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(), // 'en', 'ja', …
    name: text("name").notNull(),
    aliases: text("aliases"), // CSV or JSON list
  },
  (table) => ({
    pk: primaryKey({ columns: [table.exerciseId, table.locale] }),
  }),
);

// Full-text search tables (exercise_fts) and triggers are not directly defined in schema.ts.
// They should be handled via migrations.

// ------------------------------------------------
// 3.  Menus (templates) & Composition
// ------------------------------------------------
export const menus = sqliteTable("menus", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
      .references(() => menus.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // 1-based order
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
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
export const workoutSessions = sqliteTable(
  "workout_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    menuId: text("menu_id").references(() => menus.id), // NULL = ad-hoc per-exercise start
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"), // set at end of session
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userStartedIdx: index("idx_sessions_user_started").on(
      table.userId,
      table.startedAt, // Drizzle doesn't explicitly support DESC here, but SQLite implies it for index usage
    ),
  }),
);

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    setNo: integer("set_no").notNull(),
    reps: integer("reps"),
    weight: real("weight"),
    notes: text("notes"),
    performed_at: text("performed_at").notNull(),
    rpe: real("rpe"),
    restSec: integer("rest_sec"),
    volume: real("volume").generatedAlwaysAs(sql`(weight * reps)`),
    deviceId: text("device_id").notNull(),
    createdOffline: integer("created_offline", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sessionSetIdx: index("idx_sets_session").on(table.sessionId, table.setNo),
    exerciseRecIdx: index("idx_sets_exercise_rec").on(
      table.userId,
      table.exerciseId,
      table.createdAt,
    ),
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
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    lastUsedAt: text("last_used_at").notNull(),
    useCount: integer("use_count").notNull().default(1),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.exerciseId] }),
    recentUsageIdx: index("idx_usage_recent").on(
      table.userId,
      table.lastUsedAt, // Drizzle doesn't explicitly support DESC here
    ),
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
      .references(() => users.id, { onDelete: "cascade" }),

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
      .references(() => users.id, { onDelete: "cascade" }),

    weekStart: text("week_start").notNull(),

    muscleId: integer("muscle_id")
      .notNull()
      .references(() => muscles.id, { onDelete: "cascade" }),

    // Σ(weight × reps × tension_ratio) for that muscle
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
      .references(() => users.id, { onDelete: "cascade" }),

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
