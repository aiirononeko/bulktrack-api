-- Script to populate aggregation tables from existing workout data
-- Run this with: pnpm wrangler d1 execute bulktrack-db --file=scripts/populate_aggregations.sql

-- 1. Populate weekly_user_volumes table
INSERT OR REPLACE INTO weekly_user_volumes (
  user_id,
  week_start,
  total_volume,
  avg_set_volume,
  e1rm_avg,
  updated_at
)
SELECT 
  user_id,
  DATE(performed_at, 'weekday 0', '-6 days') as week_start,
  SUM(volume) as total_volume,
  AVG(volume) as avg_set_volume,
  AVG(CASE 
    WHEN weight IS NOT NULL AND reps IS NOT NULL AND reps > 0 
    THEN weight * (1.0 + CAST(reps AS REAL) / 30.0)
    ELSE NULL
  END) as e1rm_avg,
  CURRENT_TIMESTAMP as updated_at
FROM workout_sets
WHERE user_id IS NOT NULL
GROUP BY user_id, week_start;

-- 2. Populate weekly_user_muscle_volumes table
INSERT OR REPLACE INTO weekly_user_muscle_volumes (
  user_id,
  week_start,
  muscle_id,
  volume,
  set_count,
  e1rm_sum,
  e1rm_count,
  updated_at
)
SELECT 
  ws.user_id,
  DATE(ws.performed_at, 'weekday 0', '-6 days') as week_start,
  em.muscle_id,
  SUM(ws.volume * (em.relative_share / 1000.0) * m.tension_factor) as volume,
  COUNT(*) as set_count,
  SUM(CASE 
    WHEN ws.weight IS NOT NULL AND ws.reps IS NOT NULL AND ws.reps > 0 
    THEN ws.weight * (1.0 + CAST(ws.reps AS REAL) / 30.0)
    ELSE 0
  END) as e1rm_sum,
  SUM(CASE 
    WHEN ws.weight IS NOT NULL AND ws.reps IS NOT NULL AND ws.reps > 0 
    THEN 1
    ELSE 0
  END) as e1rm_count,
  CURRENT_TIMESTAMP as updated_at
FROM workout_sets ws
INNER JOIN exercise_muscles em ON ws.exercise_id = em.exercise_id
INNER JOIN muscles m ON em.muscle_id = m.id
WHERE ws.user_id IS NOT NULL
GROUP BY ws.user_id, week_start, em.muscle_id;

-- Verify the data was populated
SELECT 'weekly_user_volumes' as table_name, COUNT(*) as row_count FROM weekly_user_volumes
UNION ALL
SELECT 'weekly_user_muscle_volumes' as table_name, COUNT(*) as row_count FROM weekly_user_muscle_volumes;