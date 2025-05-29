import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Exercises table
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  primaryMuscleId: integer("primary_muscle_id").notNull(),
  secondaryMuscleIds: text("secondary_muscle_ids"), // JSON array
  isCustom: integer("is_custom").notNull().default(0), // 0 = false, 1 = true
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Training sets table
export const trainingSets = sqliteTable("training_sets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id),
  weight: real("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),
  restSeconds: integer("rest_seconds"),
  notes: text("notes"),
  performedAt: text("performed_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// Muscle groups table
export const muscleGroups = sqliteTable("muscle_groups", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  nameJa: text("name_ja"),
  category: text("category").notNull(),
});

// Daily aggregations table
export const dailyAggregations = sqliteTable("daily_aggregations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  date: text("date").notNull(),
  totalSets: integer("total_sets").notNull().default(0),
  totalVolume: real("total_volume").notNull().default(0),
  muscleGroupVolumes: text("muscle_group_volumes"), // JSON object
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type TrainingSet = typeof trainingSets.$inferSelect;
export type NewTrainingSet = typeof trainingSets.$inferInsert;
export type MuscleGroup = typeof muscleGroups.$inferSelect;
export type DailyAggregation = typeof dailyAggregations.$inferSelect;
export type NewDailyAggregation = typeof dailyAggregations.$inferInsert;
