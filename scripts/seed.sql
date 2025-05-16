-- =========================================================
-- seed.sql — master data for BulkTrack (muscles INT PK,
--               exercises UUID PK, exercise_muscles map)
-- =========================================================
PRAGMA foreign_keys = ON;

-- Clear existing data from tables in an order that respects foreign key constraints
DELETE FROM exercise_muscles;
DELETE FROM exercise_translations;
DELETE FROM exercises;
DELETE FROM muscles;
DELETE FROM exercises_fts; -- FTSテーブルのデータをクリア
-- Add DELETE statements for other seeded tables if necessary, respecting order

------------------------------------------------------------
-- 1. Muscles (10 classic groups)
------------------------------------------------------------
INSERT INTO muscles (id, name, tension_factor) VALUES
-- ────────────  Upper-body ────────────
 ( 1 , 'Pectoralis Major',                    1.0), -- 胸
 ( 2 , 'Deltoids (Ant/Mid/Post)',             1.0), -- 三角筋
 ( 3 , 'Triceps Brachii',                     1.0), -- 上腕三頭筋
 ( 4 , 'Biceps Brachii',                      1.0), -- 上腕二頭筋
 ( 5 , 'Forearms (Flex./Ext.)',               1.0), -- 前腕屈伸
 ( 6 , 'Latissimus Dorsi',                    1.0), -- 広背筋
 ( 7 , 'Trapezius (Upper/Mid/Lower)',         1.0), -- 僧帽筋
 ( 8 , 'Rhomboids',                           1.0), -- 菱形筋
 ( 9 , 'Serratus Anterior',                   1.0), -- 前鋸筋
 (10 , 'Rotator Cuff (SIT + Subscap)',        1.0), -- 回旋筋腱板

-- ────────────  Core / Torso ────────────
 (11 , 'Rectus Abdominis',                    1.0), -- 腹直筋
 (12 , 'Obliques & Transverse Abdominis',     1.0), -- 腹斜＋腹横
 (13 , 'Erector Spinae',                      1.0), -- 脊柱起立筋

-- ────────────  Hip & Glutes ────────────
 (14 , 'Hip Flexors (Iliopsoas)',             1.0), -- 腸腰筋
 (15 , 'Hip Adductors',                       1.0), -- 内転筋群
 (16 , 'Gluteus Maximus',                     1.0), -- 大臀筋
 (17 , 'Gluteus Medius/Minimus',              1.0), -- 中・小臀筋

-- ────────────  Lower-body ────────────
 (18 , 'Quadriceps',                          1.0), -- 大腿四頭筋
 (19 , 'Hamstrings',                          1.0), -- ハムストリング
 (20 , 'Gastrocnemius',                       1.0), -- 腓腹筋
 (21 , 'Soleus',                              1.0), -- ヒラメ筋
 (22 , 'Tibialis Anterior',                   1.0); -- 前脛骨筋

------------------------------------------------------------
-- 1. Exercises  (is_compound: 1 = multi-joint, 0 = isolation)
------------------------------------------------------------
INSERT INTO exercises
  (id, canonical_name, default_muscle_id, is_compound, is_official, created_at)
VALUES
 ('437c3738-b98d-4647-badf-2800da6653e8','Bench Press',         1 ,1,1,CURRENT_TIMESTAMP),
 ('3a60bb2d-48a0-4409-81c9-102999355d73','Back Squat',          18,1,1,CURRENT_TIMESTAMP),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75','Barbell Deadlift',    13,1,1,CURRENT_TIMESTAMP),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910','Overhead Press',      2 ,1,1,CURRENT_TIMESTAMP),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5','Bent-Over Row',       6 ,1,1,CURRENT_TIMESTAMP),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','Pull-up',             6 ,1,1,CURRENT_TIMESTAMP),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92','Glute Bridge',        16,1,1,CURRENT_TIMESTAMP),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f','Reverse Lunge',       18,1,1,CURRENT_TIMESTAMP),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77','Incline Bench Press',  1 ,1,1,CURRENT_TIMESTAMP),
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9','Dumbbell Fly',         1 ,0,1,CURRENT_TIMESTAMP),
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92','Lat Pulldown',         6 ,1,1,CURRENT_TIMESTAMP),
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7','Seated Cable Row',     6 ,1,1,CURRENT_TIMESTAMP),
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a','Face Pull',            7 ,1,1,CURRENT_TIMESTAMP),
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437','Lateral Raise',        2 ,0,1,CURRENT_TIMESTAMP),
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e','Barbell Curl',         4 ,0,1,CURRENT_TIMESTAMP),
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1','Skull Crusher',        3 ,0,1,CURRENT_TIMESTAMP),
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539','Dip',                  1 ,1,1,CURRENT_TIMESTAMP),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb','Romanian Deadlift',    19,1,1,CURRENT_TIMESTAMP),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c','Hip Thrust',           16,1,1,CURRENT_TIMESTAMP),
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003','Leg Press',            18,1,1,CURRENT_TIMESTAMP),
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d','Leg Extension',        18,0,1,CURRENT_TIMESTAMP),
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5','Leg Curl',             19,0,1,CURRENT_TIMESTAMP),
 ('6762571e-62af-4254-b260-043e496f8ea0','Standing Calf Raise',  20,0,1,CURRENT_TIMESTAMP),
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49','Seated Calf Raise',    21,0,1,CURRENT_TIMESTAMP),
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be','Plank',                11,0,1,CURRENT_TIMESTAMP),
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202','Russian Twist',        12,0,1,CURRENT_TIMESTAMP),
 ('6b94d424-dcea-45ff-b748-78f24f7a3a92','Hanging Leg Raise',    14,1,1,CURRENT_TIMESTAMP),
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791','Ab Wheel Rollout',     11,1,1,CURRENT_TIMESTAMP),
 ('4f8e4523-053e-422c-8bed-6efa8b78c123','Dumbbell Curl',          4 ,0,1,CURRENT_TIMESTAMP),
 ('47062dbe-d70f-4477-9734-2bcd6c05e662','Incline Dumbbell Curl',  4 ,0,1,CURRENT_TIMESTAMP),
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e','Chin-up',                6 ,1,1,CURRENT_TIMESTAMP),
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21','Bulgarian Split Squat', 18 ,1,1,CURRENT_TIMESTAMP),
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5','Dumbbell Shoulder Press',2 ,1,1,CURRENT_TIMESTAMP);

------------------------------------------------------------
-- 3. Japanese Translations (optional)
------------------------------------------------------------
INSERT INTO exercise_translations (exercise_id, locale, name, aliases) VALUES
('437c3738-b98d-4647-badf-2800da6653e8','ja','ベンチプレス',''),
('3a60bb2d-48a0-4409-81c9-102999355d73','ja','バックスクワット',''),
('e21bd027-0b23-4d33-a6b0-29e2f878cd75','ja','デッドリフト',''),
('2504cbb2-7b95-4237-931d-c9ab080a1910','ja','オーバーヘッドプレス','ショルダープレス'),
('4505171d-9d3d-4656-9947-e3fd7c57d4c5','ja','ベントオーバーロウ',''),
('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','ja','懸垂','チンニング'),
('1fdc3b77-b304-47c3-8146-75d4f2654f92','ja','グルートブリッジ',''),
('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f','ja','リバースランジ',''),
('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77','ja','インクラインベンチプレス',''),
('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9','ja','ダンベルフライ',''),
('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92','ja','ラットプルダウン',''),
('b61e9d06-49ba-4b22-af26-32cf9152e7c7','ja','シーテッドケーブルロウ','シーテッドロー'),
('67d80b5b-d3f4-4e58-9b95-3147d119c73a','ja','フェイスプル',''),
('e3d0acd9-5573-4db5-af8c-4a9fa5f60437','ja','サイドレイズ',''),
('c352b06d-4aed-4cf9-9c4b-d3779542c56e','ja','バーベルカール','アームカール'),
('5641b19d-1acf-4e59-8a00-bbde7077c8c1','ja','ライイングトライセップスエクステンション','スカルクラッシャー'),
('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539','ja','ディップス',''),
('b0a4d29e-d640-4bfb-808f-9a2621c99ceb','ja','ルーマニアンデッドリフト',''),
('a50de2f8-2ecb-4ed4-b108-793d842c698c','ja','ヒップスラスト',''),
('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003','ja','レッグプレス',''),
('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d','ja','レッグエクステンション',''),
('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5','ja','レッグカール',''),
('6762571e-62af-4254-b260-043e496f8ea0','ja','スタンディングカーフレイズ',''),
('7fd0722e-3b4b-4dbc-a2df-538659168e49','ja','シーテッドカーフレイズ',''),
('d675c8f0-d542-4bfb-9de4-3772fe8a70be','ja','プランク',''),
('28c69121-3ef7-49d2-bb5a-5a6cc9e04202','ja','ロシアンツイスト',''),
('6b94d424-dcea-45ff-b748-78f24f7a3a92','ja','ハンギングレッグレイズ',''),
('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791','ja','アブローラー','アブホイール'),
('4f8e4523-053e-422c-8bed-6efa8b78c123','ja','ダンベルカール',''),
('47062dbe-d70f-4477-9734-2bcd6c05e662','ja','インクラインダンベルカール',''),
('97a4ac5f-62e5-43ba-b618-12f7a4c0913e','ja','チンニング','チンアップ'),
('c98a50a2-4669-4a3d-8bbf-6671c2c5af21','ja','ブルガリアンスクワット',''),
('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5','ja','ダンベルショルダープレス','');

------------------------------------------------------------
-- 4. Exercise-to-Muscle Tension Ratios
--    (sums may exceed 1.0 — that's OK: absolute stimulus share)
------------------------------------------------------------
-- == Bench Press ==
INSERT INTO exercise_muscles VALUES
 ('437c3738-b98d-4647-badf-2800da6653e8',  1, 1.0),
 ('437c3738-b98d-4647-badf-2800da6653e8',  3, 0.7),
 ('437c3738-b98d-4647-badf-2800da6653e8',  2, 0.5),
 ('437c3738-b98d-4647-badf-2800da6653e8',  9, 0.2);

-- == Back Squat ==
INSERT INTO exercise_muscles VALUES
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 18, 1.0),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 16, 0.8),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 19, 0.6),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 13, 0.4),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 15, 0.3),
 ('3a60bb2d-48a0-4409-81c9-102999355d73', 20, 0.15);

-- == Deadlift ==
INSERT INTO exercise_muscles VALUES
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75', 13, 1.0),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75', 16, 0.8),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75', 19, 0.8),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',  6, 0.6),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',  7, 0.5),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75', 18, 0.4),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',  5, 0.3);

-- == Overhead Press ==
INSERT INTO exercise_muscles VALUES
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',  2, 1.0),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',  3, 0.7),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',  9, 0.3),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910', 10, 0.3);

-- == Bent-Over Row ==
INSERT INTO exercise_muscles VALUES
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5',  6, 1.0),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5',  8, 0.8),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5',  4, 0.6),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5',  7, 0.6),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5', 13, 0.4),
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5',  2, 0.3);

-- == Pull-up ==
INSERT INTO exercise_muscles VALUES
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',  6, 1.0),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',  4, 0.8),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',  8, 0.6),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',  7, 0.4),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',  5, 0.4),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0', 11, 0.3);

-- == Glute Bridge ==
INSERT INTO exercise_muscles VALUES
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92', 16, 1.0),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92', 19, 0.6),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92', 17, 0.4),
 ('1fdc3b77-b304-47c3-8146-75d4f2654f92', 13, 0.3);

-- == Reverse Lunge ==
INSERT INTO exercise_muscles VALUES
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 18, 1.0),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 16, 0.7),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 19, 0.5),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 17, 0.4),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 15, 0.3),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 20, 0.3),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 22, 0.2),
 ('0e37b7cc-7e42-4fa0-bfdf-c031441a5b7f', 11, 0.25);

-- == Incline Bench Press ==
INSERT INTO exercise_muscles VALUES
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',  1, 1.0),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',  2, 0.6),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',  3, 0.5),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',  9, 0.2);

-- == Dumbbell Fly ==
INSERT INTO exercise_muscles VALUES
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9',  1, 1.0),
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9',  2, 0.3);

-- == Lat Pulldown ==
INSERT INTO exercise_muscles VALUES
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92',  6, 1.0),
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92',  4, 0.8),
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92',  7, 0.5),
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92',  8, 0.4),
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92',  5, 0.4);

-- == Seated Cable Row ==
INSERT INTO exercise_muscles VALUES
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7',  8, 1.0),
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7',  6, 0.8),
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7',  4, 0.6),
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7',  7, 0.5),
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7', 13, 0.3);

-- == Face Pull ==
INSERT INTO exercise_muscles VALUES
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a',  7, 1.0),
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a',  2, 0.8), -- rear delts
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a',  8, 0.6),
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a', 10, 0.5);

-- == Lateral Raise ==
INSERT INTO exercise_muscles VALUES
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437',  2, 1.0),
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437',  7, 0.4);

-- == Barbell Curl ==
INSERT INTO exercise_muscles VALUES
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e',  4, 1.0),
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e',  5, 0.6),
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e',  2, 0.2);

-- == Skull Crusher ==
INSERT INTO exercise_muscles VALUES
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1',  3, 1.0),
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1',  5, 0.4);

-- == Dip ==
INSERT INTO exercise_muscles VALUES
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539',  1, 1.0),
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539',  3, 0.9),
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539',  2, 0.6),
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539',  9, 0.3);

-- == Romanian Deadlift ==
INSERT INTO exercise_muscles VALUES
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb', 19, 1.0),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb', 16, 0.8),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb', 13, 0.7),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb', 15, 0.3);

-- == Hip Thrust ==
INSERT INTO exercise_muscles VALUES
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c', 16, 1.0),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c', 17, 0.5),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c', 19, 0.6),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c', 13, 0.3);

-- == Leg Press ==
INSERT INTO exercise_muscles VALUES
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003', 18, 1.0),
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003', 16, 0.7),
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003', 19, 0.5),
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003', 15, 0.4);

-- == Leg Extension ==
INSERT INTO exercise_muscles VALUES
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d', 18, 1.0);

-- == Leg Curl ==
INSERT INTO exercise_muscles VALUES
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 19, 1.0),
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 20, 0.3),
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 21, 0.2);

-- == Standing Calf Raise ==
INSERT INTO exercise_muscles VALUES
 ('6762571e-62af-4254-b260-043e496f8ea0', 20, 1.0),
 ('6762571e-62af-4254-b260-043e496f8ea0', 21, 0.8);

-- == Seated Calf Raise ==
INSERT INTO exercise_muscles VALUES
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49', 21, 1.0),
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49', 20, 0.6);

-- == Plank ==
INSERT INTO exercise_muscles VALUES
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be', 11, 1.0),
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be', 12, 0.9),
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be', 13, 0.5),
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be',  9, 0.3);

-- == Russian Twist ==
INSERT INTO exercise_muscles VALUES
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202', 12, 1.0),
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202', 11, 0.6),
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202', 13, 0.4);

-- == Hanging Leg Raise ==
INSERT INTO exercise_muscles VALUES
 ('6b94d424-dcea-45ff-b748-78f24f7a3a92', 14, 1.0),
 ('6b94d424-dcea-45ff-b748-78f24f7a3a92', 11, 0.8),
 ('6b94d424-dcea-45ff-b748-78f24f7a3a92', 12, 0.4),
 ('6b94d424-dcea-45ff-b748-78f24f7a3a92',  5, 0.4);

-- == Ab Wheel Rollout ==
INSERT INTO exercise_muscles VALUES
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791', 11, 1.0),
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791', 12, 0.8),
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791',  9, 0.4),
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791', 13, 0.5),
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791', 14, 0.4);

-- == Dumbbell Curl ==
INSERT INTO exercise_muscles VALUES
 ('4f8e4523-053e-422c-8bed-6efa8b78c123',  4, 1.0),  -- Biceps
 ('4f8e4523-053e-422c-8bed-6efa8b78c123',  5, 0.6),  -- Forearms
 ('4f8e4523-053e-422c-8bed-6efa8b78c123',  2, 0.2);  -- Delts（前部）

-- == Incline Dumbbell Curl ==
INSERT INTO exercise_muscles VALUES
 ('47062dbe-d70f-4477-9734-2bcd6c05e662',  4, 1.0),
 ('47062dbe-d70f-4477-9734-2bcd6c05e662',  5, 0.6),
 ('47062dbe-d70f-4477-9734-2bcd6c05e662',  2, 0.2);

-- == Chin-up ==
INSERT INTO exercise_muscles VALUES
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',  6, 1.0),  -- Lats
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',  4, 0.9),  -- Biceps
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',  8, 0.6),  -- Rhomboids
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',  7, 0.4),  -- Traps
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',  5, 0.4),  -- Forearms
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e', 11, 0.3);  -- Rectus Abdominis

-- == Bulgarian Split Squat ==
INSERT INTO exercise_muscles VALUES
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21', 18, 1.0),  -- Quads
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21', 16, 0.7),  -- Glute Max
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21', 17, 0.5),  -- Glute Med/Min
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21', 19, 0.4),  -- Hamstrings
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21', 15, 0.3),  -- Adductors
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21', 20, 0.2),  -- Gastrocnemius
 ('c98a50a2-4669-4a3d-8bbf-6671c2c5af21', 13, 0.3);  -- Erector Spinae

-- == Dumbbell Shoulder Press ==
INSERT INTO exercise_muscles VALUES
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5',  2, 1.0),  -- Delts
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5',  3, 0.6),  -- Triceps
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5',  9, 0.3),  -- Serratus
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5', 10, 0.3),  -- Rotator Cuff
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5', 13, 0.3);  -- Erector Spinae

------------------------------------------------------------
-- 5. Populate exercises_fts table
------------------------------------------------------------
-- Clear existing data from FTS table (already done above, but good for clarity if run standalone)
-- DELETE FROM exercises_fts;

-- 1. Load translated exercises into FTS table
INSERT INTO exercises_fts(exercise_id, locale, text)
SELECT
    t.exercise_id,
    t.locale,
    lower(e.canonical_name || ' ' || COALESCE(t.name, '') || ' ' || COALESCE(t.aliases, ''))
FROM exercise_translations t
JOIN exercises e ON e.id = t.exercise_id;

-- 2. Load exercises without translations into FTS table
-- For exercises without translations, their original exercises.rowid can be used for fts.rowid
INSERT INTO exercises_fts(rowid, exercise_id, locale, text)
SELECT
    e.rowid,
    e.id,
    'unknown',
    lower(e.canonical_name)
FROM exercises e
WHERE NOT EXISTS (
    SELECT 1 FROM exercise_translations et WHERE et.exercise_id = e.id
);
