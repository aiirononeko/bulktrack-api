import { sql } from "drizzle-orm";
import {
  foreignKey,
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
// 6.  AI Recommendation minimal tables (implementation later)
// ------------------------------------------------
export const aiRecommendations = sqliteTable(
  "ai_recommendations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    generatedAt: text("generated_at").notNull(),
    modelVersion: text("model_version"),
    menuJson: text("menu_json").notNull(), // full recommended program
    expiresAt: text("expires_at"),
    accepted: integer("accepted", { mode: "boolean" }), // SQLite doesn't have a native boolean, often stored as 0/1
    feedbackJson: text("feedback_json"), // diff / edits from user
  },
  (table) => ({
    userGeneratedIdx: index("idx_ai_rec_user_gen").on(
      table.userId,
      table.generatedAt, // Drizzle doesn't explicitly support DESC here
    ),
  }),
);

// ------------------------------------------------
// 7.  Utility Views (example)
// ------------------------------------------------
// Views (vw_latest_set) are not directly defined in schema.ts.
// They should be handled via migrations or by defining them as custom queries in your application code.

// ------------------------------------------------
// 8.  End of schema
// ------------------------------------------------

// Migration helper notes (like pragma user_version) are for migration files, not the schema.ts itself.
