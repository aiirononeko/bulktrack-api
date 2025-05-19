PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

------------------------------------------------------------
-- 0. Evidence sources (DOI 一覧)
------------------------------------------------------------
INSERT INTO exercise_sources(id,title,url) VALUES
 ('10.1519/JSC.0000000000004629','Incline vs Flat Bench Press EMG','https://doi.org/10.1519/JSC.0000000000004629'),
 ('10.1080/14763141.2020.1820355','Muscle activity in Back vs Front Squat','https://doi.org/10.1080/14763141.2020.1820355'),
 ('10.1080/15438627.2019.1586700','Deadlift muscle activation review','https://doi.org/10.1080/15438627.2019.1586700'),
 ('10.1519/JSC.0000000000003953','Comparison of Overhead-Press variations','https://doi.org/10.1519/JSC.0000000000003953'),
 ('10.1519/JSC.0000000000003158','Pull-up vs Chin-up EMG','https://doi.org/10.1519/JSC.0000000000003158'),
 ('10.1080/10826084.2022.2029960','Hip Thrust vs Squat Glute EMG','https://doi.org/10.1080/10826084.2022.2029960'),
 ('10.1519/JSC.0000000000003738','Hamstrings activation Romanian DL','https://doi.org/10.1519/JSC.0000000000003738'),
 ('10.1519/JSC.0000000000002878','Upright Row EMG','https://doi.org/10.1519/JSC.0000000000002878'),
 ('10.1519/JSC.0000000000002742','Lateral vs Cable Raise Deltoid EMG','https://doi.org/10.1519/JSC.0000000000002742'),
 ('10.1007/s00421-022-05029-6','Muscle activation in Abdominal exercises','https://doi.org/10.1007/s00421-022-05029-6');

INSERT OR IGNORE INTO exercise_sources (id, title, url)
VALUES
  ('10.3390/app13085203',
   'Electromyographic Activity of the Pectoralis Major: Systematic Review and Meta-analysis',
   'https://doi.org/10.3390/app13085203'),

  ('10.5604/17342260.1055261',
   'Electromyographical Analysis of the Deltoid Muscle During Different Upper-Limb Strength-Training Exercises',
   'https://doi.org/10.5604/17342260.1055261'),

  ('10.1055/a-2517-0509',
   'Distinct Muscle Growth and Strength Adaptations After Preacher and Incline Biceps Curls',
   'https://doi.org/10.1055/a-2517-0509');

------------------------------------------------------------
-- 1. Muscle groups
------------------------------------------------------------
INSERT INTO muscle_groups(id,name) VALUES
 (1,'Chest'),(2,'Back'),(3,'Shoulders'),(4,'Arms'),
 (5,'Core'),(6,'Hip & Glutes'),(7,'Legs');

------------------------------------------------------------
-- 2. Muscles（26 筋頭）
------------------------------------------------------------
INSERT INTO muscles(id,name,muscle_group_id) VALUES
 (101,'Pectoralis Major - Clavicular',1),
 (102,'Pectoralis Major - Sternal',1),
 (201,'Latissimus Dorsi',2),
 (202,'Rhomboids',2),
 (203,'Trapezius Upper',2),
 (204,'Trapezius Mid',2),
 (205,'Trapezius Lower',2),
 (301,'Deltoid Anterior',3),
 (302,'Deltoid Lateral',3),
 (303,'Deltoid Posterior',3),
 (401,'Triceps Brachii',4),
 (402,'Biceps Brachii',4),
 (403,'Forearm Flex-Ext',4),
 (501,'Rectus Abdominis',5),
 (502,'Obliques',5),
 (503,'Erector Spinae',5),
 (601,'Gluteus Maximus',6),
 (602,'Gluteus Medius/Min',6),
 (603,'Hip Flexors (Iliopsoas)',6),
 (604,'Hip Adductors',6),
 (701,'Quadriceps',7),
 (702,'Hamstrings',7),
 (703,'Gastrocnemius',7),
 (704,'Soleus',7),
 (705,'Tibialis Anterior',7),
 (706,'Adductors Magnus/Longus',7);

------------------------------------------------------------
-- 3. Exercises（32 種）
------------------------------------------------------------
INSERT INTO exercises(id,canonical_name,default_muscle_id,is_compound,is_official) VALUES
 -- Chest
 ('437c3738-b98d-4647-badf-2800da6653e8','Bench Press',102,1,1),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77','Incline Bench Press 30°',101,1,1),
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0001','Decline Bench Press',102,1,1),
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0002','Push-up',102,1,1),
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539','Weighted Dip',102,1,1),
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9','Dumbbell Fly',102,0,1),
 -- Shoulders
 ('2504cbb2-7b95-4237-931d-c9ab080a1910','Overhead Press',301,1,1),
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5','Seated DB Shoulder Press',301,1,1),
 ('f3e67011-2f4f-444d-8e75-0b99c9000001','Arnold Press',301,1,1),
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437','Lateral Raise',302,0,1),
 ('f3e67011-2f4f-444d-8e75-0b99c9000002','Cable Lateral Raise',302,0,1),
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a','Face Pull',303,1,1),
 ('f3e67011-2f4f-444d-8e75-0b99c9000003','Upright Row',301,1,1),
 -- Back
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5','Bent-Over Row',201,1,1),
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7','Seated Cable Row',202,1,1),
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92','Lat Pulldown',201,1,1),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','Pull-up',201,1,1),
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e','Chin-up',201,1,1),
 -- Legs / Glutes
 ('3a60bb2d-48a0-4409-81c9-102999355d73','Back Squat',701,1,1),
 ('f8a76177-21a7-4db9-bf08-0d9e40000001','Front Squat',701,1,1),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75','Barbell Deadlift',503,1,1),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb','Romanian Deadlift',702,1,1),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c','Hip Thrust',601,1,1),
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003','Leg Press',701,1,1),
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d','Leg Extension',701,0,1),
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5','Seated Leg Curl',702,0,1),
 ('6762571e-62af-4254-b260-043e496f8ea0','Standing Calf Raise',703,0,1),
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49','Seated Calf Raise',704,0,1),
 -- Arms
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e','Barbell Curl',402,0,1),
 ('4f8e4523-053e-422c-8bed-6efa8b78c123','Dumbbell Curl',402,0,1),
 ('47062dbe-d70f-4477-9734-2bcd6c05e662','Incline Dumbbell Curl',402,0,1),
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1','Skull Crusher',401,0,1),
 ('f8a76177-21a7-4db9-bf08-0d9e40000002','Triceps Pushdown',401,0,1),
 -- Core
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be','Plank',501,0,1),
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791','Ab Wheel Rollout',501,1,1),
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202','Russian Twist',502,0,1);

INSERT INTO exercises
  (id, canonical_name, default_muscle_id, is_compound, is_official)
VALUES
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 'Machine Chest Press',          102, 1, 1),
  ('b2e6a123-2222-4eef-b222-1234567890cb', 'Machine Shoulder Press',       301, 1, 1),
  ('f1a0d333-3333-4acd-b333-1234567890cc', 'Pec-Deck Fly (Machine)',       102, 0, 1),
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 'Cable Fly (Standing)',         102, 0, 1),
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 'Preacher Curl',                402, 0, 1),
  ('e9c9f666-6666-4def-b666-1234567890cf', 'Barbell Shoulder Press',       301, 1, 1);

------------------------------------------------------------
-- 4. Exercise-Muscle shares (整数 1000)
--    ※主要 12 種のみ例示。他は defaultMuscle =1000 で仮登録し
--      後で更新してもトリガに抵触しません。
------------------------------------------------------------

-- Bench Press  (flat)  -- DOI:4629
INSERT INTO exercise_muscles VALUES
 ('437c3738-b98d-4647-badf-2800da6653e8',102,600,NULL,'10.1519/JSC.0000000000004629',''),
 ('437c3738-b98d-4647-badf-2800da6653e8',401,250,NULL,'10.1519/JSC.0000000000004629',''),
 ('437c3738-b98d-4647-badf-2800da6653e8',301,150,NULL,'10.1519/JSC.0000000000004629','');

-- Incline Bench (30°)  -- DOI:4629
INSERT INTO exercise_muscles VALUES
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',101,550,NULL,'10.1519/JSC.0000000000004629','30deg'),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',102,200,NULL,'10.1519/JSC.0000000000004629',''),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',401,150,NULL,'10.1519/JSC.0000000000004629',''),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',301,100,NULL,'10.1519/JSC.0000000000004629','');

-- Back Squat  -- DOI:1820355
INSERT INTO exercise_muscles VALUES
 ('3a60bb2d-48a0-4409-81c9-102999355d73',701,500,NULL,'10.1080/14763141.2020.1820355',''),
 ('3a60bb2d-48a0-4409-81c9-102999355d73',601,250,NULL,'10.1080/14763141.2020.1820355',''),
 ('3a60bb2d-48a0-4409-81c9-102999355d73',702,200,NULL,'10.1080/14763141.2020.1820355',''),
 ('3a60bb2d-48a0-4409-81c9-102999355d73',703, 50,NULL,'10.1080/14763141.2020.1820355','');

-- Deadlift  -- DOI:1586700
INSERT INTO exercise_muscles VALUES
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',702,350,NULL,'10.1080/15438627.2019.1586700',''),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',601,250,NULL,'10.1080/15438627.2019.1586700',''),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',503,200,NULL,'10.1080/15438627.2019.1586700',''),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',201,100,NULL,'10.1080/15438627.2019.1586700',''),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',703,100,NULL,'10.1080/15438627.2019.1586700','');

-- Hip Thrust  -- DOI:2029960
INSERT INTO exercise_muscles VALUES
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c',601,700,NULL,'10.1080/10826084.2022.2029960',''),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c',602,200,NULL,'10.1080/10826084.2022.2029960',''),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c',702,100,NULL,'10.1080/10826084.2022.2029960','');

-- Romanian Deadlift  -- DOI:3738
INSERT INTO exercise_muscles VALUES
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb',702,600,NULL,'10.1519/JSC.0000000000003738',''),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb',601,200,NULL,'10.1519/JSC.0000000000003738',''),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb',503,200,NULL,'10.1519/JSC.0000000000003738','');

-- Overhead Press  -- DOI:3953
INSERT INTO exercise_muscles VALUES
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',301,450,NULL,'10.1519/JSC.0000000000003953','standing'),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',401,300,NULL,'10.1519/JSC.0000000000003953',''),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',302,150,NULL,'10.1519/JSC.0000000000003953',''),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',503,100,NULL,'10.1519/JSC.0000000000003953','');

-- Upright Row  -- DOI:2878
INSERT INTO exercise_muscles VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000003',301,300,NULL,'10.1519/JSC.0000000000002878',''),
 ('f3e67011-2f4f-444d-8e75-0b99c9000003',302,500,NULL,'10.1519/JSC.0000000000002878',''),
 ('f3e67011-2f4f-444d-8e75-0b99c9000003',303,200,NULL,'10.1519/JSC.0000000000002878','');

-- Lateral Raise  -- DOI:2742
INSERT INTO exercise_muscles VALUES
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437',302,800,NULL,'10.1519/JSC.0000000000002742',''),
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437',303,200,NULL,'10.1519/JSC.0000000000002742','');

-- Pull-up / Chin-up  -- DOI:3158
INSERT INTO exercise_muscles VALUES
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',201,550,NULL,'10.1519/JSC.0000000000003158','pronated'),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',402,250,NULL,'10.1519/JSC.0000000000003158',''),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',202,100,NULL,'10.1519/JSC.0000000000003158',''),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',203,100,NULL,'10.1519/JSC.0000000000003158','');

INSERT INTO exercise_muscles VALUES
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',201,450,NULL,'10.1519/JSC.0000000000003158','supinated'),
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',402,350,NULL,'10.1519/JSC.0000000000003158',''),
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',202,100,NULL,'10.1519/JSC.0000000000003158',''),
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',203,100,NULL,'10.1519/JSC.0000000000003158','');

-- Isolation 種目（単一筋 1000）
INSERT INTO exercise_muscles VALUES
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9',102,1000,NULL,NULL,''),
 ('f3e67011-2f4f-444d-8e75-0b99c9000002',302,1000,NULL,'10.1519/JSC.0000000000002742',''),
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e',402,700,NULL,NULL,''),
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e',403,300,NULL,NULL,''),
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1',401,1000,NULL,NULL,''),
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d',701,1000,NULL,NULL,''),
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5',702,800,NULL,NULL,''),
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5',703,200,NULL,NULL,''),
 ('6762571e-62af-4254-b260-043e496f8ea0',703,600,NULL,NULL,''),
 ('6762571e-62af-4254-b260-043e496f8ea0',704,400,NULL,NULL,''),
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49',704,700,NULL,NULL,''),
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49',703,300,NULL,NULL,'');

-- Chest
INSERT INTO exercise_muscles VALUES
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0001',102,1000,NULL,NULL,'');  -- Decline Bench Press
INSERT INTO exercise_muscles VALUES
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0002',102,1000,NULL,NULL,'');  -- Push-up
INSERT INTO exercise_muscles VALUES
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539',102,1000,NULL,NULL,'');  -- Weighted Dip

-- Shoulders
INSERT INTO exercise_muscles VALUES
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5',301,1000,NULL,NULL,'');  -- Seated DB Shoulder Press
INSERT INTO exercise_muscles VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000001',301,1000,NULL,NULL,'');  -- Arnold Press
INSERT INTO exercise_muscles VALUES
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a',303,1000,NULL,NULL,'');  -- Face Pull

-- Back
INSERT INTO exercise_muscles VALUES
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5',201,1000,NULL,NULL,'');  -- Bent-Over Row
INSERT INTO exercise_muscles VALUES
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7',202,1000,NULL,NULL,'');  -- Seated Cable Row
INSERT INTO exercise_muscles VALUES
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92',201,1000,NULL,NULL,'');  -- Lat Pulldown

-- Legs / Glutes
INSERT INTO exercise_muscles VALUES
 ('f8a76177-21a7-4db9-bf08-0d9e40000001',701,1000,NULL,NULL,'');  -- Front Squat
INSERT INTO exercise_muscles VALUES
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003',701,1000,NULL,NULL,'');  -- Leg Press

-- Arms
INSERT INTO exercise_muscles VALUES
 ('4f8e4523-053e-422c-8bed-6efa8b78c123',402,1000,NULL,NULL,'');  -- Dumbbell Curl
INSERT INTO exercise_muscles VALUES
 ('47062dbe-d70f-4477-9734-2bcd6c05e662',402,1000,NULL,NULL,'');  -- Incline Dumbbell Curl
INSERT INTO exercise_muscles VALUES
 ('f8a76177-21a7-4db9-bf08-0d9e40000002',401,1000,NULL,NULL,'');  -- Triceps Pushdown

-- Core
INSERT INTO exercise_muscles VALUES
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be',501,1000,NULL,NULL,'');  -- Plank
INSERT INTO exercise_muscles VALUES
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791',501,1000,NULL,NULL,'');  -- Ab Wheel Rollout
INSERT INTO exercise_muscles VALUES
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202',502,1000,NULL,NULL,'');  -- Russian Twist

/* 4-1. Machine Chest Press ─ DOI:10.3390/app13085203 */
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 102, 650, '10.3390/app13085203'), -- Pectoralis Major - Sternal
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 401, 200, '10.3390/app13085203'), -- Triceps Brachii
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 301, 150, '10.3390/app13085203'); -- Deltoid Anterior

/* 4-2. Machine Shoulder Press ─ DOI:10.5604/17342260.1055261 */
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('b2e6a123-2222-4eef-b222-1234567890cb', 301, 600, '10.5604/17342260.1055261'), -- Deltoid Anterior
  ('b2e6a123-2222-4eef-b222-1234567890cb', 401, 300, '10.5604/17342260.1055261'), -- Triceps Brachii
  ('b2e6a123-2222-4eef-b222-1234567890cb', 203, 100, '10.5604/17342260.1055261'); -- Trapezius Upper

/* 4-3. Pec-Deck Fly ─ DOI:10.5604/17342260.1055261 */
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('f1a0d333-3333-4acd-b333-1234567890cc', 102, 800, '10.5604/17342260.1055261'), -- Pectoralis Major - Sternal
  ('f1a0d333-3333-4acd-b333-1234567890cc', 301, 150, '10.5604/17342260.1055261'), -- Deltoid Anterior
  ('f1a0d333-3333-4acd-b333-1234567890cc', 203,  50, '10.5604/17342260.1055261'); -- Trapezius Upper

/* 4-4. Cable Fly (Standing) ─ DOI:10.3390/app13085203 */
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 102, 750, '10.3390/app13085203'), -- Pectoralis Major - Sternal
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 301, 180, '10.3390/app13085203'), -- Deltoid Anterior
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 203,  70, '10.3390/app13085203'); -- Trapezius Upper

/* 4-5. Preacher Curl ─ DOI:10.1055/a-2517-0509 */
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 402, 850, '10.1055/a-2517-0509'), -- Biceps Brachii
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 403, 120, '10.1055/a-2517-0509'), -- Forearm Flex-Ext
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 301,  30, '10.1055/a-2517-0509'); -- Deltoid Anterior

/* 4-6. Barbell Shoulder Press ─ DOI:10.5604/17342260.1055261 */
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('e9c9f666-6666-4def-b666-1234567890cf', 301, 550, '10.5604/17342260.1055261'), -- Deltoid Anterior
  ('e9c9f666-6666-4def-b666-1234567890cf', 401, 300, '10.5604/17342260.1055261'), -- Triceps Brachii
  ('e9c9f666-6666-4def-b666-1234567890cf', 203, 150, '10.5604/17342260.1055261'); -- Trapezius Upper

------------------------------------------------------------
-- 5. Exercise translations (JP 主要 10 種のみ例示)
------------------------------------------------------------
INSERT INTO exercise_translations VALUES
 ('437c3738-b98d-4647-badf-2800da6653e8','ja','ベンチプレス',''),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77','ja','インクラインベンチプレス',''),
 ('3a60bb2d-48a0-4409-81c9-102999355d73','ja','バックスクワット',''),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75','ja','デッドリフト',''),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910','ja','オーバーヘッドプレス','ショルダープレス'),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','ja','プルアップ','懸垂'),
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e','ja','チンアップ','チンニング'),
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e','ja','バーベルカール',''),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c','ja','ヒップスラスト',''),
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437','ja','サイドレイズ','ラテラルレイズ');

-- Chest
INSERT INTO exercise_translations VALUES
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0001','ja','デクラインベンチプレス','デクラインBP');
INSERT INTO exercise_translations VALUES
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0002','ja','プッシュアップ','腕立て伏せ');
INSERT INTO exercise_translations VALUES
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539','ja','ディップス','ディップ');

INSERT INTO exercise_translations VALUES
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9','ja','ダンベルフライ','フライ');

-- Shoulders
INSERT INTO exercise_translations VALUES
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5','ja','シーテッドダンベルショルダープレス','シーテッドショルダープレス');
INSERT INTO exercise_translations VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000001','ja','アーノルドプレス','アーノルドショルダープレス');
INSERT INTO exercise_translations VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000002','ja','ケーブルサイドレイズ','ケーブルラテラルレイズ');
INSERT INTO exercise_translations VALUES
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a','ja','フェイスプル','リアデルトロウ');
INSERT INTO exercise_translations VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000003','ja','アップライトロウ','');

-- Back
INSERT INTO exercise_translations VALUES
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5','ja','ベントオーバーロウ','バーベルロウ');
INSERT INTO exercise_translations VALUES
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7','ja','シーテッドケーブルロウ','');
INSERT INTO exercise_translations VALUES
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92','ja','ラットプルダウン','');

-- Legs / Glutes
INSERT INTO exercise_translations VALUES
 ('f8a76177-21a7-4db9-bf08-0d9e40000001','ja','フロントスクワット','');
INSERT INTO exercise_translations VALUES
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb','ja','ルーマニアンデッドリフト','RDL');
INSERT INTO exercise_translations VALUES
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003','ja','レッグプレス','');
INSERT INTO exercise_translations VALUES
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d','ja','レッグエクステンション','');
INSERT INTO exercise_translations VALUES
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5','ja','シーテッドレッグカール','');
INSERT INTO exercise_translations VALUES
 ('6762571e-62af-4254-b260-043e496f8ea0','ja','スタンディングカーフレイズ','');
INSERT INTO exercise_translations VALUES
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49','ja','シーテッドカーフレイズ','');

-- Arms
INSERT INTO exercise_translations VALUES
 ('4f8e4523-053e-422c-8bed-6efa8b78c123','ja','ダンベルカール','');
INSERT INTO exercise_translations VALUES
 ('47062dbe-d70f-4477-9734-2bcd6c05e662','ja','インクラインダンベルカール','');
INSERT INTO exercise_translations VALUES
 ('f8a76177-21a7-4db9-bf08-0d9e40000002','ja','トライセプスプッシュダウン','プレスダウン');
INSERT INTO exercise_translations VALUES
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1','ja','スカルクラッシャー','');

-- Core
INSERT INTO exercise_translations VALUES
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be','ja','プランク','フロントブリッジ');
INSERT INTO exercise_translations VALUES
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791','ja','アブホイールローアウト','アブローラー');
INSERT INTO exercise_translations VALUES
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202','ja','ロシアンツイスト','');

INSERT INTO exercise_translations (exercise_id, locale, name)
VALUES
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 'ja', 'チェストプレス（マシン）'),
  ('b2e6a123-2222-4eef-b222-1234567890cb', 'ja', 'ショルダープレス（マシン）'),
  ('f1a0d333-3333-4acd-b333-1234567890cc', 'ja', 'ペックフライ（マシン）'),
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 'ja', 'ケーブルフライ'),
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 'ja', 'プリーチャーカール'),
  ('e9c9f666-6666-4def-b666-1234567890cf', 'ja', 'バーベルショルダープレス');

COMMIT;
