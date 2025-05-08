-- ================================================================
-- schema.sql  (Cloudflare D1 / SQLite 3.46+)                     
-- 2025-05-08  - initial user-centric schema for Bulktrack API
-- ================================================================

PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;              -- bump when ddl changes

-- ------------------------------------------------
-- 1.  Users & Devices
-- ------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,             -- UUID v7
  display_name  TEXT NOT NULL,
  goal_json     TEXT,                         -- JSON: goals, injuries, etc.
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_devices (
  device_id     TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform      TEXT,
  linked_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------
-- 2.  Muscles & Exercises (multilingual)
-- ------------------------------------------------
CREATE TABLE muscles (
  id             INTEGER PRIMARY KEY,          -- autoincrement OK
  name           TEXT NOT NULL UNIQUE,
  tension_factor REAL  NOT NULL DEFAULT 1.0    -- relative stimulus multiplier
);

CREATE TABLE exercises (
  id                TEXT PRIMARY KEY,         -- UUID v7
  canonical_name    TEXT NOT NULL,            -- fallback name (EN/JA any)
  default_muscle_id INTEGER REFERENCES muscles(id),
  is_compound       BOOLEAN NOT NULL DEFAULT FALSE,
  is_official       BOOLEAN NOT NULL DEFAULT FALSE,
  author_user_id    TEXT REFERENCES users(id),
  last_used_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exercise_translations (
  exercise_id   TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  locale        TEXT NOT NULL,                -- 'en', 'ja', …
  name          TEXT NOT NULL,
  aliases       TEXT,                         -- CSV or JSON list
  PRIMARY KEY (exercise_id, locale)
);

-- Full-text search over names & aliases
CREATE VIRTUAL TABLE exercise_fts USING fts5(
  exercise_id UNINDEXED,
  locale      UNINDEXED,
  name,
  aliases,
  content='exercise_translations'
);

-- FTS triggers ---------------------------------------------------
CREATE TRIGGER exercise_fts_ai AFTER INSERT ON exercise_translations BEGIN
  INSERT INTO exercise_fts(rowid, exercise_id, locale, name, aliases)
  VALUES (new.rowid, new.exercise_id, new.locale, new.name, new.aliases);
END;
CREATE TRIGGER exercise_fts_au AFTER UPDATE ON exercise_translations BEGIN
  UPDATE exercise_fts
     SET exercise_id = new.exercise_id,
         locale      = new.locale,
         name        = new.name,
         aliases     = new.aliases
   WHERE rowid = old.rowid;
END;
CREATE TRIGGER exercise_fts_ad AFTER DELETE ON exercise_translations BEGIN
  DELETE FROM exercise_fts WHERE rowid = old.rowid;
END;

-- ------------------------------------------------
-- 3.  Menus (templates) & Composition
-- ------------------------------------------------
CREATE TABLE menus (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  source_type  TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'official' | 'ai'
  is_public    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_exercises (
  menu_id         TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,                  -- 1-based order
  exercise_id     TEXT NOT NULL REFERENCES exercises(id),
  default_weight  REAL,
  default_reps    TEXT,                              -- e.g. "8-10"
  PRIMARY KEY (menu_id, position)
);

-- ------------------------------------------------
-- 4.  Workout Sessions & Sets (fact tables)
-- ------------------------------------------------
CREATE TABLE workout_sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_id      TEXT REFERENCES menus(id),          -- NULL = ad-hoc per-exercise start
  started_at   TEXT NOT NULL,
  finished_at  TEXT,                               -- set at end of session
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_user_started ON workout_sessions(user_id, started_at DESC);

CREATE TABLE workout_sets (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id     TEXT NOT NULL REFERENCES exercises(id),
  set_no          INTEGER NOT NULL,                -- 1,2,3… inside session
  weight          REAL NOT NULL,
  reps            INTEGER NOT NULL,
  rpe             REAL,                            -- nullable
  tempo           TEXT,                            -- e.g. "3-1-2"
  rest_sec        INTEGER,                         -- seconds actually rested
  volume          REAL GENERATED ALWAYS AS (weight * reps) STORED,
  device_id       TEXT NOT NULL,
  created_offline BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Query helpers
CREATE INDEX idx_sets_session     ON workout_sets(session_id, set_no);
CREATE INDEX idx_sets_exercise_rec ON workout_sets(user_id, exercise_id, created_at DESC);

-- ------------------------------------------------
-- 5.  Recent Usage for fast suggestion
-- ------------------------------------------------
CREATE TABLE exercise_usage (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  TEXT NOT NULL REFERENCES exercises(id),
  last_used_at TEXT NOT NULL,
  use_count    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, exercise_id)
);
CREATE INDEX idx_usage_recent ON exercise_usage(user_id, last_used_at DESC);

-- Upsert usage on every new set
CREATE TRIGGER trg_usage_after_insert AFTER INSERT ON workout_sets BEGIN
  INSERT INTO exercise_usage(user_id, exercise_id, last_used_at, use_count)
  VALUES (new.user_id, new.exercise_id, new.created_at, 1)
  ON CONFLICT(user_id, exercise_id)
  DO UPDATE SET last_used_at = excluded.last_used_at,
                use_count    = exercise_usage.use_count + 1;
END;

-- ------------------------------------------------
-- 6.  AI Recommendation minimal tables (implementation later)
-- ------------------------------------------------
CREATE TABLE ai_recommendations (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generated_at   TEXT NOT NULL,
  model_version  TEXT,
  menu_json      TEXT NOT NULL,      -- full recommended program
  expires_at     TEXT,
  accepted       BOOLEAN,
  feedback_json  TEXT                -- diff / edits from user
);
CREATE INDEX idx_ai_rec_user_gen ON ai_recommendations(user_id, generated_at DESC);

-- ------------------------------------------------
-- 7.  Utility Views (example)
-- ------------------------------------------------
-- Latest set per exercise per user – used for preset autofill
CREATE VIEW vw_latest_set AS
SELECT ws.user_id,
       ws.exercise_id,
       ws.weight,
       ws.reps,
       ws.rpe,
       MAX(ws.created_at) AS last_at
  FROM workout_sets ws
 GROUP BY ws.user_id, ws.exercise_id;

-- ------------------------------------------------
-- 8.  End of schema
-- ------------------------------------------------

-- Migration helper - bump pragma user_version when altering schema.
