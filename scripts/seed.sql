-- =========================================================
-- seed.sql — master data for BulkTrack (muscles INT PK,
--               exercises UUID PK, exercise_muscles map)
-- =========================================================
PRAGMA foreign_keys = ON;

------------------------------------------------------------
-- 1. Muscles (10 classic groups)
------------------------------------------------------------
INSERT INTO muscles (id, name, tension_factor) VALUES
 (1 , 'Chest',        1.0),
 (2 , 'Back',         1.0),
 (3 , 'Shoulders',    1.0),
 (4 , 'Biceps',       1.0),
 (5 , 'Triceps',      1.0),
 (6 , 'Quadriceps',   1.0),
 (7 , 'Hamstrings',   1.0),
 (8 , 'Glutes',       1.0),
 (9 , 'Calves',       1.0),
 (10, 'Core',         1.0);

------------------------------------------------------------
-- 2. Official Exercises (UUID v4 IDs)
------------------------------------------------------------
INSERT INTO exercises
  (id, canonical_name, default_muscle_id,
   is_compound, is_official, created_at)
VALUES
 ('437c3738-b98d-4647-badf-2800da6653e8','Bench Press',        1 ,1,1,CURRENT_TIMESTAMP),
 ('3a60bb2d-48a0-4409-81c9-102999355d73','Back Squat',         6 ,1,1,CURRENT_TIMESTAMP),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75','Barbell Deadlift',   2 ,1,1,CURRENT_TIMESTAMP),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910','Overhead Press',     3 ,1,1,CURRENT_TIMESTAMP),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5','Bent-Over Row',      2 ,1,1,CURRENT_TIMESTAMP),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','Pull-up',            2 ,1,1,CURRENT_TIMESTAMP),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92','Glute Bridge',       8 ,0,1,CURRENT_TIMESTAMP),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f','Reverse Lunge',      6 ,1,1,CURRENT_TIMESTAMP);

------------------------------------------------------------
-- 3. Japanese Translations (optional)
------------------------------------------------------------
INSERT INTO exercise_translations
  (exercise_id, locale, name, aliases) VALUES
 ('437c3738-b98d-4647-badf-2800da6653e8','ja','ベンチプレス',''),
 ('3a60bb2d-48a0-4409-81c9-102999355d73','ja','バックスクワット',''),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75','ja','デッドリフト',''),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910','ja','オーバーヘッドプレス',''),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5','ja','ベントオーバーロウ',''),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','ja','懸垂','チンアップ'),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92','ja','グルートブリッジ',''),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f','ja','リバースランジ','');

------------------------------------------------------------
-- 4. Exercise-to-Muscle Tension Ratios
--    (sums may exceed 1.0 — that’s OK: absolute stimulus share)
------------------------------------------------------------
INSERT INTO exercise_muscles (exercise_id, muscle_id, tension_ratio) VALUES
-- Bench Press
 ('437c3738-b98d-4647-badf-2800da6653e8', 1 , 1.0),
 ('437c3738-b98d-4647-badf-2800da6653e8', 5 , 0.5),
 ('437c3738-b98d-4647-badf-2800da6653e8', 3 , 0.3),

-- Back Squat
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 6 , 1.0),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 7 , 0.5),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 8 , 0.7),
 ('3a60bb2d-48a0-4409-81c9-102999355d73',10 , 0.2),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 9 , 0.1),

-- Deadlift
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75', 2 , 1.0),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75', 7 , 0.7),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75', 8 , 0.8),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',10 , 0.3),

-- Overhead Press
 ('2504cbb2-7b95-4237-931d-c9ab080a1910', 3 , 1.0),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910', 5 , 0.6),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',10 , 0.2),

-- Bent-Over Row
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5', 2 , 1.0),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5', 4 , 0.6),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5', 3 , 0.3),

-- Pull-up
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0', 2 , 1.0),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0', 4 , 0.7),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',10 , 0.2),

-- Glute Bridge
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92', 8 , 1.0),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92', 7 , 0.5),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92',10 , 0.2),

-- Reverse Lunge
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 6 , 1.0),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 8 , 0.5),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 7 , 0.4),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 9 , 0.2),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f',10 , 0.2);
