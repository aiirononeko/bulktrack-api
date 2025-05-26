PRAGMA foreign_keys = ON;

------------------------------------------------------------
-- 0. Evidence sources (参考文献のDOI一覧)
--    各エクササイズの筋活動データや効果に関する研究論文の情報を格納します。
--    id: DOI (Digital Object Identifier)
--    title: 論文タイトル
--    url: 論文へのリンク (主にDOIのURL)
------------------------------------------------------------
INSERT INTO exercise_sources(id,title,url) VALUES
 -- ベンチプレスに関する研究
 ('10.1519/JSC.0000000000004629','Incline vs Flat Bench Press EMG','https://doi.org/10.1519/JSC.0000000000004629'),
 ('10.3390/app13085203', 'Electromyographic Activity of the Pectoralis Major: Systematic Review and Meta-analysis', 'https://doi.org/10.3390/app13085203'),
 -- スクワットに関する研究
 ('10.1080/14763141.2020.1820355','Muscle activity in Back vs Front Squat','https://doi.org/10.1080/14763141.2020.1820355'),
 ('10.1080/10826084.2022.2029960','Hip Thrust vs Squat Glute EMG','https://doi.org/10.1080/10826084.2022.2029960'),
 -- デッドリフトに関する研究
 ('10.1080/15438627.2019.1586700','Deadlift muscle activation review','https://doi.org/10.1080/15438627.2019.1586700'),
 ('10.1519/JSC.0000000000003738','Hamstrings activation Romanian DL','https://doi.org/10.1519/JSC.0000000000003738'),
 -- ショルダープレスに関する研究
 ('10.1519/JSC.0000000000003953','Comparison of Overhead-Press variations','https://doi.org/10.1519/JSC.0000000000003953'),
 ('10.5604/17342260.1055261', 'Electromyographical Analysis of the Deltoid Muscle During Different Upper-Limb Strength-Training Exercises', 'https://doi.org/10.5604/17342260.1055261'),
 -- プルアップ/チンアップに関する研究
 ('10.1519/JSC.0000000000003158','Pull-up vs Chin-up EMG','https://doi.org/10.1519/JSC.0000000000003158'),
 -- 上腕二頭筋カールに関する研究
 ('10.1055/a-2517-0509', 'Distinct Muscle Growth and Strength Adaptations After Preacher and Incline Biceps Curls', 'https://doi.org/10.1055/a-2517-0509'),
 -- その他の上半身エクササイズに関する研究
 ('10.1519/JSC.0000000000002878','Upright Row EMG','https://doi.org/10.1519/JSC.0000000000002878'),
 ('10.1519/JSC.0000000000002742','Lateral vs Cable Raise Deltoid EMG','https://doi.org/10.1519/JSC.0000000000002742'),
 -- 腹筋エクササイズに関する研究
 ('10.1007/s00421-022-05029-6','Muscle activation in Abdominal exercises','https://doi.org/10.1007/s00421-022-05029-6'),
 -- ハムストリングスのエクササイズに関する研究
 ('10.1519/JSC.0000000000005829', 'Hamstring Muscle Activation During Seated Versus Prone Leg-Curl Exercise', 'https://doi.org/10.1519/JSC.0000000000005829');

------------------------------------------------------------
-- 1. Muscle groups (筋肉群)
--    主要な筋肉のグループを定義します。
--    id: 筋肉群ID
--    name: 筋肉群の名称 (英語)
------------------------------------------------------------
INSERT INTO muscle_groups(id,name) VALUES
 (1,'Chest'),        -- 胸
 (2,'Back'),         -- 背中
 (3,'Shoulders'),    -- 肩
 (4,'Arms'),         -- 腕
 (5,'Core'),         -- 体幹
 (6,'Hip & Glutes'), -- 股関節・臀部
 (7,'Legs');          -- 脚

INSERT INTO muscle_group_translations (muscle_group_id, locale, name) VALUES
-- Based on scripts/seed_v2.sql muscle_groups definition
(1, 'ja', '胸'),            -- Chest
(2, 'ja', '背中'),          -- Back  
(3, 'ja', '肩'),            -- Shoulders
(4, 'ja', '腕'),            -- Arms
(5, 'ja', '体幹'),          -- Core
(6, 'ja', '股関節・臀部'),   -- Hip & Glutes
(7, 'ja', '脚');            -- Legs

------------------------------------------------------------
-- 2. Muscles (個別筋肉)
--    より詳細な個別の筋肉 (筋頭レベル) を定義します。
--    id: 筋肉ID
--    name: 筋肉の名称 (英語)
--    muscle_group_id: 所属する筋肉群ID (muscle_groups.id を参照)
------------------------------------------------------------
INSERT INTO muscles(id,name,muscle_group_id) VALUES
 -- Chest (胸)
 (101,'Pectoralis Major - Clavicular',1), -- 大胸筋 (鎖骨部)
 (102,'Pectoralis Major - Sternal',1),    -- 大胸筋 (胸肋部)
 -- Back (背中)
 (201,'Latissimus Dorsi',2),              -- 広背筋
 (202,'Rhomboids',2),                     -- 菱形筋
 (203,'Trapezius Upper',2),               -- 僧帽筋 (上部)
 (204,'Trapezius Mid',2),                 -- 僧帽筋 (中部)
 (205,'Trapezius Lower',2),               -- 僧帽筋 (下部)
 -- Shoulders (肩)
 (301,'Deltoid Anterior',3),              -- 三角筋 (前部)
 (302,'Deltoid Lateral',3),               -- 三角筋 (側部)
 (303,'Deltoid Posterior',3),             -- 三角筋 (後部)
 -- Arms (腕)
 (401,'Triceps Brachii',4),               -- 上腕三頭筋
 (402,'Biceps Brachii',4),                -- 上腕二頭筋
 (403,'Forearm Flex-Ext',4),              -- 前腕屈筋・伸筋群
 -- Core (体幹)
 (501,'Rectus Abdominis',5),              -- 腹直筋
 (502,'Obliques',5),                      -- 腹斜筋群
 (503,'Erector Spinae',5),                -- 脊柱起立筋
 -- Hip & Glutes (股関節・臀部)
 (601,'Gluteus Maximus',6),               -- 大臀筋
 (602,'Gluteus Medius/Min',6),            -- 中臀筋・小臀筋
 (603,'Hip Flexors (Iliopsoas)',6),       -- 股関節屈筋群 (腸腰筋)
 (604,'Hip Adductors',6),                 -- 股関節内転筋群
 -- Legs (脚)
 (701,'Quadriceps',7),                    -- 大腿四頭筋
 (702,'Hamstrings',7),                    -- ハムストリングス (大腿二頭筋など)
 (703,'Gastrocnemius',7),                 -- 腓腹筋
 (704,'Soleus',7),                        -- ヒラメ筋
 (705,'Tibialis Anterior',7),             -- 前脛骨筋
 (706,'Adductors Magnus/Longus',7);       -- 大内転筋・長内転筋

------------------------------------------------------------
-- 3. Exercises (エクササイズ種目)
--    トレーニング種目の基本情報を定義します。
--    id: エクササイズID (UUID v7)
--    canonical_name: エクササイズの英語正式名
--    default_muscle_id: 主に鍛えられる筋肉ID (muscles.id を参照)
--    is_compound: コンパウンド種目 (複数の関節・筋肉を動員) かどうか (1: True, 0: False)
--    is_official: 公式データかどうか (1: True, 0: False)
------------------------------------------------------------
INSERT INTO exercises(id,canonical_name,default_muscle_id,is_compound,is_official) VALUES
 -- Chest Exercises (胸のエクササイズ)
 ('437c3738-b98d-4647-badf-2800da6653e8','Bench Press',102,1,1),                          -- ベンチプレス
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77','Incline Bench Press 30°',101,1,1),              -- インクラインベンチプレス (30度)
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0001','Decline Bench Press',102,1,1),                  -- デクラインベンチプレス
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0002','Push-up',102,1,1),                              -- プッシュアップ (腕立て伏せ)
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539','Weighted Dip',102,1,1),                         -- ウェイテッドディップス
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9','Dumbbell Fly',102,0,1),                         -- ダンベルフライ
 ('8d1c5c52-1111-4a1f-b111-1234567890ca', 'Machine Chest Press',102,1,1),                 -- マシンチェストプレス
 ('f1a0d333-3333-4acd-b333-1234567890cc', 'Pec-Deck Fly (Machine)',102,0,1),              -- ペックデックフライ (マシン)
 ('c5e7f444-4444-4bdf-b444-1234567890cd', 'Cable Fly (Standing)',102,0,1),                -- ケーブルフライ (スタンディング)
 ('b2b19bba-aeaf-4c0e-b4c5-9e5f5d4e7b10', 'Dumbbell Bench Press',102,1,1),                -- ダンベルベンチプレス
 -- Shoulder Exercises (肩のエクササイズ)
 ('2504cbb2-7b95-4237-931d-c9ab080a1910','Overhead Press',301,1,1),                       -- オーバーヘッドプレス
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5','Seated DB Shoulder Press',301,1,1),             -- シーテッドダンベルショルダープレス
 ('f3e67011-2f4f-444d-8e75-0b99c9000001','Arnold Press',301,1,1),                         -- アーノルドプレス
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437','Lateral Raise',302,0,1),                         -- ラテラルレイズ (サイドレイズ)
 ('f3e67011-2f4f-444d-8e75-0b99c9000002','Cable Lateral Raise',302,0,1),                   -- ケーブルラテラルレイズ
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a','Face Pull',303,1,1),                             -- フェイスプル
 ('f3e67011-2f4f-444d-8e75-0b99c9000003','Upright Row',301,1,1),                           -- アップライトロウ
 ('b2e6a123-2222-4eef-b222-1234567890cb', 'Machine Shoulder Press',301,1,1),              -- マシンショルダープレス
 ('e9c9f666-6666-4def-b666-1234567890cf', 'Barbell Shoulder Press',301,1,1),              -- バーベルショルダープレス
 -- Back Exercises (背中のエクササイズ)
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5','Bent-Over Row',201,1,1),                        -- ベントオーバーロウ
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7','Seated Cable Row',202,1,1),                      -- シーテッドケーブルロウ
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92','Lat Pulldown',201,1,1),                         -- ラットプルダウン
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','Pull-up',201,1,1),                              -- プルアップ (懸垂)
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e','Chin-up',201,1,1),                              -- チンアップ (チンニング)
 -- Leg & Glute Exercises (脚・臀部のエクササイズ)
 ('3a60bb2d-48a0-4409-81c9-102999355d73','Back Squat',701,1,1),                           -- バックスクワット
 ('f8a76177-21a7-4db9-bf08-0d9e40000001','Front Squat',701,1,1),                           -- フロントスクワット
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75','Barbell Deadlift',503,1,1),                     -- バーベルデッドリフト
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb','Romanian Deadlift',702,1,1),                     -- ルーマニアンデッドリフト
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c','Hip Thrust',601,1,1),                           -- ヒップスラスト
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003','Leg Press',701,1,1),                             -- レッグプレス
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d','Leg Extension',701,0,1),                         -- レッグエクステンション
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5','Seated Leg Curl',702,0,1),                       -- シーテッドレッグカール
 ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff','Prone Leg Curl',702,0,1),                         -- プローンレッグカール (ライイングレッグカール)
 ('6762571e-62af-4254-b260-043e496f8ea0','Standing Calf Raise',703,0,1),                   -- スタンディングカーフレイズ
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49','Seated Calf Raise',704,0,1),                     -- シーテッドカーフレイズ
 -- Arm Exercises (腕のエクササイズ)
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e','Barbell Curl',402,0,1),                         -- バーベルカール
 ('4f8e4523-053e-422c-8bed-6efa8b78c123','Dumbbell Curl',402,0,1),                        -- ダンベルカール
 ('47062dbe-d70f-4477-9734-2bcd6c05e662','Incline Dumbbell Curl',402,0,1),                -- インクラインダンベルカール
 ('d6b8e555-5555-4ccf-b555-1234567890ce', 'Preacher Curl',402,0,1),                       -- プリーチャーカール
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1','Skull Crusher',401,0,1),                        -- スカルクラッシャー
 ('f8a76177-21a7-4db9-bf08-0d9e40000002','Triceps Pushdown',401,0,1),                     -- トライセプスプッシュダウン
 -- Core Exercises (体幹のエクササイズ)
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be','Plank',501,0,1),                                 -- プランク
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791','Ab Wheel Rollout',501,1,1),                     -- アブホイールロールアウト
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202','Russian Twist',502,0,1);                         -- ロシアンツイスト

------------------------------------------------------------
-- 4. Exercise-Muscle shares (エクササイズ毎の筋肉負荷割合)
--    各エクササイズがどの筋肉にどの程度の負荷を与えるかを示します。
--    relative_share: 筋肉への相対的な負荷の割合 (合計で1000になるように調整)
--    source_id: 負荷割合の根拠となる参考文献ID (exercise_sources.id を参照)
--    notes: 参考文献内の詳細情報 (例: "30deg" は30度のインクライン)
--
--    ※主要なコンパウンド種目を中心に、エビデンスに基づいたデータを登録。
--    ※アイソレーション種目は、主にターゲットとする筋肉に1000を割り当てるか、
--      エビデンスがあればそれに従います。
------------------------------------------------------------

-- Bench Press (flat) -- DOI: 10.1519/JSC.0000000000004629
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
 ('437c3738-b98d-4647-badf-2800da6653e8',102,600,'10.1519/JSC.0000000000004629'), -- Pectoralis Major - Sternal
 ('437c3738-b98d-4647-badf-2800da6653e8',401,250,'10.1519/JSC.0000000000004629'), -- Triceps Brachii
 ('437c3738-b98d-4647-badf-2800da6653e8',301,150,'10.1519/JSC.0000000000004629'); -- Deltoid Anterior

-- Incline Bench Press (30°) -- DOI: 10.1519/JSC.0000000000004629
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',101,550,'10.1519/JSC.0000000000004629','30deg'), -- Pectoralis Major - Clavicular
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',102,200,'10.1519/JSC.0000000000004629',''),    -- Pectoralis Major - Sternal
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',401,150,'10.1519/JSC.0000000000004629',''),    -- Triceps Brachii
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77',301,100,'10.1519/JSC.0000000000004629','');    -- Deltoid Anterior

-- Decline Bench Press -- (仮データ: 主に大胸筋下部)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0001',102,1000,NULL,''); -- Pectoralis Major - Sternal (主に下部線維)

-- Push-up -- (仮データ: ベンチプレスに類似)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0002',102,1000,NULL,''); -- Pectoralis Major - Sternal

-- Weighted Dip -- (仮データ: 大胸筋下部、上腕三頭筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539',102,1000,NULL,''); -- Pectoralis Major - Sternal (主に下部線維)

-- Dumbbell Fly -- (アイソレーション: 大胸筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9',102,1000,NULL,''); -- Pectoralis Major - Sternal

-- Machine Chest Press -- DOI: 10.3390/app13085203
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 102, 650, '10.3390/app13085203'), -- Pectoralis Major - Sternal
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 401, 200, '10.3390/app13085203'), -- Triceps Brachii
  ('8d1c5c52-1111-4a1f-b111-1234567890ca', 301, 150, '10.3390/app13085203'); -- Deltoid Anterior

-- Pec-Deck Fly (Machine) -- DOI: 10.5604/17342260.1055261 (類似研究から推定)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('f1a0d333-3333-4acd-b333-1234567890cc', 102, 800, '10.5604/17342260.1055261'), -- Pectoralis Major - Sternal
  ('f1a0d333-3333-4acd-b333-1234567890cc', 301, 150, '10.5604/17342260.1055261'), -- Deltoid Anterior
  ('f1a0d333-3333-4acd-b333-1234567890cc', 203,  50, '10.5604/17342260.1055261'); -- Trapezius Upper (安定筋として)

-- Cable Fly (Standing) -- DOI: 10.3390/app13085203
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 102, 750, '10.3390/app13085203'), -- Pectoralis Major - Sternal
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 301, 180, '10.3390/app13085203'), -- Deltoid Anterior
  ('c5e7f444-4444-4bdf-b444-1234567890cd', 203,  70, '10.3390/app13085203'); -- Trapezius Upper (安定筋として)

INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
 ('b2b19bba-aeaf-4c0e-b4c5-9e5f5d4e7b10',102,600,'10.1519/JSC.0000000000004629'), -- Pectoralis Major - Sternal
 ('b2b19bba-aeaf-4c0e-b4c5-9e5f5d4e7b10',401,250,'10.1519/JSC.0000000000004629'), -- Triceps Brachii
 ('b2b19bba-aeaf-4c0e-b4c5-9e5f5d4e7b10',301,150,'10.1519/JSC.0000000000004629'); -- Deltoid Anterior

-- Overhead Press (Standing) -- DOI: 10.1519/JSC.0000000000003953
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',301,450,'10.1519/JSC.0000000000003953','standing'), -- Deltoid Anterior
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',401,300,'10.1519/JSC.0000000000003953',''),          -- Triceps Brachii
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',302,150,'10.1519/JSC.0000000000003953',''),          -- Deltoid Lateral
 ('2504cbb2-7b95-4237-931d-c9ab080a1910',503,100,'10.1519/JSC.0000000000003953','');          -- Erector Spinae (体幹安定)

-- Seated Dumbbell Shoulder Press -- (仮データ: OHPに類似、体幹安定の負荷減)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5',301,1000,NULL,''); -- Deltoid Anterior

-- Arnold Press -- (仮データ: 三角筋全体)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000001',301,1000,NULL,''); -- Deltoid Anterior (前部・中部中心)

-- Lateral Raise -- DOI: 10.1519/JSC.0000000000002742
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437',302,800,'10.1519/JSC.0000000000002742',''), -- Deltoid Lateral
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437',303,200,'10.1519/JSC.0000000000002742',''); -- Deltoid Posterior (補助的に)

-- Cable Lateral Raise -- DOI: 10.1519/JSC.0000000000002742 (ダンベルと比較)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000002',302,1000,'10.1519/JSC.0000000000002742',''); -- Deltoid Lateral

-- Face Pull -- (仮データ: 三角筋後部、僧帽筋中部・下部)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a',303,1000,NULL,''); -- Deltoid Posterior

-- Upright Row -- DOI: 10.1519/JSC.0000000000002878
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('f3e67011-2f4f-444d-8e75-0b99c9000003',302,500,'10.1519/JSC.0000000000002878',''), -- Deltoid Lateral
 ('f3e67011-2f4f-444d-8e75-0b99c9000003',301,300,'10.1519/JSC.0000000000002878',''), -- Deltoid Anterior
 ('f3e67011-2f4f-444d-8e75-0b99c9000003',203,200,'10.1519/JSC.0000000000002878',''); -- Trapezius Upper (文献では僧帽筋全体として評価されている場合あり)

-- Machine Shoulder Press -- DOI: 10.5604/17342260.1055261
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('b2e6a123-2222-4eef-b222-1234567890cb', 301, 600, '10.5604/17342260.1055261'), -- Deltoid Anterior
  ('b2e6a123-2222-4eef-b222-1234567890cb', 401, 300, '10.5604/17342260.1055261'), -- Triceps Brachii
  ('b2e6a123-2222-4eef-b222-1234567890cb', 203, 100, '10.5604/17342260.1055261'); -- Trapezius Upper

-- Barbell Shoulder Press -- DOI: 10.5604/17342260.1055261 (OHPと類似)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('e9c9f666-6666-4def-b666-1234567890cf', 301, 550, '10.5604/17342260.1055261'), -- Deltoid Anterior
  ('e9c9f666-6666-4def-b666-1234567890cf', 401, 300, '10.5604/17342260.1055261'), -- Triceps Brachii
  ('e9c9f666-6666-4def-b666-1234567890cf', 203, 150, '10.5604/17342260.1055261'); -- Trapezius Upper

-- Bent-Over Row -- (仮データ: 広背筋、僧帽筋、菱形筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5',201,1000,NULL,''); -- Latissimus Dorsi

-- Seated Cable Row -- (仮データ: 広背筋、僧帽筋中部、菱形筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7',202,1000,NULL,''); -- Rhomboids (僧帽筋中部も含む)

-- Lat Pulldown -- (仮データ: 広背筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92',201,1000,NULL,''); -- Latissimus Dorsi

-- Pull-up (Pronated grip) -- DOI: 10.1519/JSC.0000000000003158
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',201,550,'10.1519/JSC.0000000000003158','pronated'), -- Latissimus Dorsi
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',402,250,'10.1519/JSC.0000000000003158',''),          -- Biceps Brachii
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',202,100,'10.1519/JSC.0000000000003158',''),          -- Rhomboids
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0',203,100,'10.1519/JSC.0000000000003158','');          -- Trapezius Upper (文献では僧帽筋全体として評価されている場合あり)

-- Chin-up (Supinated grip) -- DOI: 10.1519/JSC.0000000000003158
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',201,450,'10.1519/JSC.0000000000003158','supinated'), -- Latissimus Dorsi
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',402,350,'10.1519/JSC.0000000000003158',''),           -- Biceps Brachii
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',202,100,'10.1519/JSC.0000000000003158',''),           -- Rhomboids
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e',203,100,'10.1519/JSC.0000000000003158','');           -- Trapezius Upper

-- Back Squat -- DOI: 10.1080/14763141.2020.1820355
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('3a60bb2d-48a0-4409-81c9-102999355d73',701,500,'10.1080/14763141.2020.1820355',''), -- Quadriceps
 ('3a60bb2d-48a0-4409-81c9-102999355d73',601,250,'10.1080/14763141.2020.1820355',''), -- Gluteus Maximus
 ('3a60bb2d-48a0-4409-81c9-102999355d73',702,200,'10.1080/14763141.2020.1820355',''), -- Hamstrings
 ('3a60bb2d-48a0-4409-81c9-102999355d73',703, 50,'10.1080/14763141.2020.1820355',''); -- Gastrocnemius (腓腹筋)

-- Front Squat -- (仮データ: バックスクワットに類似、大腿四頭筋への比重増)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('f8a76177-21a7-4db9-bf08-0d9e40000001',701,1000,NULL,''); -- Quadriceps

-- Barbell Deadlift -- DOI: 10.1080/15438627.2019.1586700
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',702,350,'10.1080/15438627.2019.1586700',''), -- Hamstrings
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',601,250,'10.1080/15438627.2019.1586700',''), -- Gluteus Maximus
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',503,200,'10.1080/15438627.2019.1586700',''), -- Erector Spinae
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',201,100,'10.1080/15438627.2019.1586700',''), -- Latissimus Dorsi (体幹安定)
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75',703,100,'10.1080/15438627.2019.1586700',''); -- Gastrocnemius

-- Romanian Deadlift -- DOI: 10.1519/JSC.0000000000003738
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb',702,600,'10.1519/JSC.0000000000003738',''), -- Hamstrings
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb',601,200,'10.1519/JSC.0000000000003738',''), -- Gluteus Maximus
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb',503,200,'10.1519/JSC.0000000000003738',''); -- Erector Spinae

-- Hip Thrust -- DOI: 10.1080/10826084.2022.2029960
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c',601,700,'10.1080/10826084.2022.2029960',''), -- Gluteus Maximus
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c',602,200,'10.1080/10826084.2022.2029960',''), -- Gluteus Medius/Min
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c',702,100,'10.1080/10826084.2022.2029960',''); -- Hamstrings

-- Leg Press -- (仮データ: スクワットに類似、大腿四頭筋中心)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003',701,1000,NULL,''); -- Quadriceps

-- Leg Extension -- (アイソレーション: 大腿四頭筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d',701,1000,NULL,''); -- Quadriceps

-- Seated Leg Curl -- DOI: 10.1519/JSC.0000000000005829
-- 旧シェアを削除
DELETE FROM exercise_muscles WHERE exercise_id = '2ef94be3-3f5e-45d1-95c4-67a21bcb88d5';
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 702, 780, '10.1519/JSC.0000000000005829'), -- Hamstrings
  ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 703, 150, '10.1519/JSC.0000000000005829'), -- Gastrocnemius
  ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 704,  70, '10.1519/JSC.0000000000005829'); -- Soleus

-- Prone Leg Curl (Lying Leg Curl) -- DOI: 10.1519/JSC.0000000000005829
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff', 702, 850, '10.1519/JSC.0000000000005829'), -- Hamstrings
  ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff', 703, 100, '10.1519/JSC.0000000000005829'), -- Gastrocnemius
  ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff', 704,  50, '10.1519/JSC.0000000000005829'); -- Soleus

-- Standing Calf Raise -- (アイソレーション: 腓腹筋、ヒラメ筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('6762571e-62af-4254-b260-043e496f8ea0',703,600,NULL,''), -- Gastrocnemius
 ('6762571e-62af-4254-b260-043e496f8ea0',704,400,NULL,''); -- Soleus

-- Seated Calf Raise -- (アイソレーション: ヒラメ筋、腓腹筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49',704,700,NULL,''), -- Soleus
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49',703,300,NULL,''); -- Gastrocnemius

-- Barbell Curl -- (アイソレーション: 上腕二頭筋、前腕)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e',402,700,NULL,''), -- Biceps Brachii
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e',403,300,NULL,''); -- Forearm Flex-Ext

-- Dumbbell Curl -- (アイソレーション: 上腕二頭筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('4f8e4523-053e-422c-8bed-6efa8b78c123',402,1000,NULL,''); -- Biceps Brachii

-- Incline Dumbbell Curl -- (アイソレーション: 上腕二頭筋 長頭)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('47062dbe-d70f-4477-9734-2bcd6c05e662',402,1000,NULL,''); -- Biceps Brachii

-- Preacher Curl -- DOI: 10.1055/a-2517-0509
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id) VALUES
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 402, 850, '10.1055/a-2517-0509'), -- Biceps Brachii
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 403, 120, '10.1055/a-2517-0509'), -- Forearm Flex-Ext
  ('d6b8e555-5555-4ccf-b555-1234567890ce', 301,  30, '10.1055/a-2517-0509'); -- Deltoid Anterior (補助的に)

-- Skull Crusher -- (アイソレーション: 上腕三頭筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1',401,1000,NULL,''); -- Triceps Brachii

-- Triceps Pushdown -- (アイソレーション: 上腕三頭筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('f8a76177-21a7-4db9-bf08-0d9e40000002',401,1000,NULL,''); -- Triceps Brachii

-- Plank -- (アイソレーション: 腹直筋、体幹深層筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be',501,1000,NULL,''); -- Rectus Abdominis

-- Ab Wheel Rollout -- (コンパウンド: 腹直筋、腹斜筋、広背筋など)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791',501,1000,NULL,''); -- Rectus Abdominis

-- Russian Twist -- (アイソレーション: 腹斜筋)
INSERT INTO exercise_muscles (exercise_id, muscle_id, relative_share, source_id, notes) VALUES
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202',502,1000,NULL,''); -- Obliques

------------------------------------------------------------
-- 5. Exercise translations (エクササイズの日本語訳)
--    エクササイズ名の日本語訳とエイリアス (別名) を定義します。
--    exercise_id: 翻訳対象のエクササイズID (exercises.id を参照)
--    locale: 言語コード (例: 'ja' は日本語)
--    name: 日本語の主要な名称
--    aliases: 日本語の別名 (カンマ区切りで複数指定可、省略可)
------------------------------------------------------------
INSERT INTO exercise_translations(exercise_id,locale,name,aliases) VALUES
 -- 主要なコンパウンド種目
 ('437c3738-b98d-4647-badf-2800da6653e8','ja','ベンチプレス','バーベルベンチプレス'),
 ('62d5e1af-7c34-463b-8d3b-1c4d16fc5f77','ja','インクラインベンチプレス',''),
 ('3a60bb2d-48a0-4409-81c9-102999355d73','ja','バックスクワット','スクワット'),
 ('e21bd027-0b23-4d33-a6b0-29e2f878cd75','ja','デッドリフト',''),
 ('2504cbb2-7b95-4237-931d-c9ab080a1910','ja','オーバーヘッドプレス','ショルダープレス,ミリタリープレス'),
 ('14d4665b-6f3b-4c78-afb4-9a466a97a6d0','ja','チンニング','懸垂'),
 ('97a4ac5f-62e5-43ba-b618-12f7a4c0913e','ja','チンアップ','チンニング（逆手）'),
 ('b2b19bba-aeaf-4c0e-b4c5-9e5f5d4e7b10','ja','ダンベルベンチプレス','ベンチプレス')
 -- 胸
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0001','ja','デクラインベンチプレス','デクラインBP'),
 ('d0f1c4c6-2700-47d9-a7ab-011e5e5b0002','ja','プッシュアップ','腕立て伏せ'),
 ('2f1b44c9-1fcf-4db2-927e-5b1b6b14c539','ja','ディップス','ディップ'),
 ('a0b29be0-3a9e-4f57-8c93-34d9faebcdc9','ja','ダンベルフライ','フライ'),
 ('8d1c5c52-1111-4a1f-b111-1234567890ca', 'ja', 'チェストプレス（マシン）','マシンチェストプレス'),
 ('f1a0d333-3333-4acd-b333-1234567890cc', 'ja', 'ペックフライ（マシン）','マシンフライ,バタフライマシン'),
 ('c5e7f444-4444-4bdf-b444-1234567890cd', 'ja', 'ケーブルフライ','ケーブルクロスオーバー'),
 -- 肩
 ('ecc4d9e3-678b-4ba5-9df2-a2cdb9b741e5','ja','シーテッドダンベルショルダープレス','シーテッドショルダープレス'),
 ('f3e67011-2f4f-444d-8e75-0b99c9000001','ja','アーノルドプレス','アーノルドショルダープレス'),
 ('e3d0acd9-5573-4db5-af8c-4a9fa5f60437','ja','サイドレイズ','ラテラルレイズ,ダンベルサイドレイズ'),
 ('f3e67011-2f4f-444d-8e75-0b99c9000002','ja','ケーブルサイドレイズ','ケーブルラテラルレイズ'),
 ('67d80b5b-d3f4-4e58-9b95-3147d119c73a','ja','フェイスプル','リアデルトロウ'),
 ('f3e67011-2f4f-444d-8e75-0b99c9000003','ja','アップライトロウ',''),
 ('b2e6a123-2222-4eef-b222-1234567890cb', 'ja', 'ショルダープレス（マシン）','マシンショルダープレス'),
 ('e9c9f666-6666-4def-b666-1234567890cf', 'ja', 'バーベルショルダープレス','フロントプレス'),
 -- 背中
 ('4505171d-9d3d-4656-9947-e3fd7c57d4c5','ja','ベントオーバーロウ','バーベルロウ'),
 ('b61e9d06-49ba-4b22-af26-32cf9152e7c7','ja','シーテッドケーブルロウ','ケーブルロウ'),
 ('f37f0c6f-bd6a-4df3-9d10-dae2db0e6d92','ja','ラットプルダウン',''),
 -- 脚・臀部
 ('f8a76177-21a7-4db9-bf08-0d9e40000001','ja','フロントスクワット',''),
 ('b0a4d29e-d640-4bfb-808f-9a2621c99ceb','ja','ルーマニアンデッドリフト','RDL'),
 ('a50de2f8-2ecb-4ed4-b108-793d842c698c','ja','ヒップスラスト',''),
 ('ab8ff6c9-1481-4d3a-8b71-5f9bd64e2003','ja','レッグプレス',''),
 ('90f54f9f-76a2-4d29-bc87-ebd9d2d9c34d','ja','レッグエクステンション',''),
 ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5','ja','レッグカール（シーテッド）','シーテッドレッグカール'),
 ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff','ja','レッグカール（ライイング）','ライイングレッグカール,プローンレッグカール'),
 ('6762571e-62af-4254-b260-043e496f8ea0','ja','スタンディングカーフレイズ','カーフレイズ'),
 ('7fd0722e-3b4b-4dbc-a2df-538659168e49','ja','シーテッドカーフレイズ',''),
 -- 腕
 ('c352b06d-4aed-4cf9-9c4b-d3779542c56e','ja','バーベルカール',''),
 ('4f8e4523-053e-422c-8bed-6efa8b78c123','ja','ダンベルカール','アームカール'),
 ('47062dbe-d70f-4477-9734-2bcd6c05e662','ja','インクラインダンベルカール',''),
 ('d6b8e555-5555-4ccf-b555-1234567890ce', 'ja', 'プリーチャーカール',''),
 ('5641b19d-1acf-4e59-8a00-bbde7077c8c1','ja','スカルクラッシャー','ライイングトライセプスエクステンション'),
 ('f8a76177-21a7-4db9-bf08-0d9e40000002','ja','トライセプスプッシュダウン','プレスダウン,ケーブルプッシュダウン'),
 -- 体幹
 ('d675c8f0-d542-4bfb-9de4-3772fe8a70be','ja','プランク','フロントブリッジ'),
 ('47e2c2aa-5bce-44c7-9ec7-d596cb8f1791','ja','アブホイールローアウト','アブローラー'),
 ('28c69121-3ef7-49d2-bb5a-5a6cc9e04202','ja','ロシアンツイスト','');

-- =========================================================
--  以下は、特定の研究論文に基づくエクササイズデータの追加・更新例
--  (上記で既に整理・統合されているため、ここではコメントアウトまたは削除)
-- =========================================================

-- /*
--  * Lying / Prone Leg-Curl (アイソレーション)
--  * 参考文献：Evangelidis et al. “Hamstring activation during seated
--  *            vs prone leg-curl” J Strength Cond Res DOI:10.1519/JSC.0000000000005829
--  */

-- /* 0. まずエビデンスソースを登録（既に存在すれば無視） */
-- INSERT OR IGNORE INTO exercise_sources (id, title, url)
-- VALUES (
--   '10.1519/JSC.0000000000005829',
--   'Hamstring Muscle Activation During Seated Versus Prone Leg-Curl Exercise',
--   'https://doi.org/10.1519/JSC.0000000000005829'
-- );

-- /* 1. エクササイズ本体を登録 (既に exercises テーブルで 'aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff' として登録済み) */
-- -- INSERT INTO exercises
-- --   (id, canonical_name, default_muscle_id, is_compound, is_official, created_at)
-- -- VALUES
-- --   ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff',  -- 任意の UUID v7
-- --    'Prone Leg Curl',                        -- 英語正式名
-- --    702,                                     -- default: Hamstrings
-- --    0,                                       -- isolation
-- --    1,                                       -- official
-- --    CURRENT_TIMESTAMP);

-- /* 2. 日本語訳（必要に応じて）(既に exercise_translations テーブルで登録済み) */
-- -- INSERT OR IGNORE INTO exercise_translations
-- --   (exercise_id, locale, name, aliases)
-- -- VALUES
-- --   ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff', 'ja',
-- --    'レッグカール（ライイング）', 'ライイングレッグカール');

-- /* 3. 筋負荷シェア（合計 1000）(既に exercise_muscles テーブルで登録済み) */
-- -- INSERT INTO exercise_muscles
-- --   (exercise_id, muscle_id, relative_share, source_id)
-- -- VALUES
-- --   -- Hamstrings（大腿二頭筋など）
-- --   ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff', 702, 850, '10.1519/JSC.0000000000005829'),
-- --   -- Gastrocnemius
-- --   ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff', 703, 100, '10.1519/JSC.0000000000005829'),
-- --   -- Soleus（わずかに協働）
-- --   ('aa1b2c3d-4e5f-6789-aaaa-bbccccddeeff', 704,  50, '10.1519/JSC.0000000000005829');


-- /*
--  * Seated Leg-Curl（着座式） isolation
--  * 参考文献：Evangelidis et al. “Hamstring activation during seated
--  *            vs prone leg-curl” J Strength Cond Res
--  *            DOI:10.1519/JSC.0000000000005829
--  */

-- /* 0. エビデンスソースは既に登録済みだが、念のため安全に投入 */
-- INSERT OR IGNORE INTO exercise_sources (id, title, url)
-- VALUES (
--   '10.1519/JSC.0000000000005829',
--   'Hamstring Muscle Activation During Seated Versus Prone Leg-Curl Exercise',
--   'https://doi.org/10.1519/JSC.0000000000005829'
-- );

-- /* 1. エクササイズ本体は seed で登録済み (id = '2ef94be3-3f5e-45d1-95c4-67a21bcb88d5')
--       更新は不要なためコメントアウト
-- */
-- -- INSERT INTO exercises
-- --   (id, canonical_name, default_muscle_id, is_compound, is_official, created_at)
-- -- VALUES
-- --   ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 'Seated Leg Curl', 702, 0, 1, CURRENT_TIMESTAMP)
-- -- ON CONFLICT(id) DO UPDATE SET
-- --   canonical_name = excluded.canonical_name,
-- --   default_muscle_id = excluded.default_muscle_id,
-- --   is_compound = excluded.is_compound,
-- --   is_official = excluded.is_official,
-- --   updated_at = CURRENT_TIMESTAMP; -- updated_at カラムがある場合

-- /* 2. 旧シェアを削除（relative_share=1000 の制約を満たすため）(既に exercise_muscles テーブルで更新済み) */
-- -- DELETE FROM exercise_muscles
-- -- WHERE exercise_id = '2ef94be3-3f5e-45d1-95c4-67a21bcb88d5';

-- /* 3. 新しい筋負荷シェアを投入（合計 1000）(既に exercise_muscles テーブルで更新済み)
--  *   同論文の %MVIC（膝屈曲 30–70° 区間平均）を正規化
--  *   ─ Hamstrings        ≈ 78 %
--  *   ─ Gastrocnemius     ≈ 15 %
--  *   ─ Soleus            ≈  7 %
--  */
-- -- INSERT INTO exercise_muscles
-- --   (exercise_id, muscle_id, relative_share, source_id)
-- -- VALUES
-- --   -- Hamstrings
-- --   ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 702, 780, '10.1519/JSC.0000000000005829'),
-- --   -- Gastrocnemius
-- --   ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 703, 150, '10.1519/JSC.0000000000005829'),
-- --   -- Soleus
-- --   ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 704,  70, '10.1519/JSC.0000000000005829');

-- /* 4. 日本語訳（未登録の場合のみ）(既に exercise_translations テーブルで登録済み) */
-- -- INSERT OR IGNORE INTO exercise_translations
-- --   (exercise_id, locale, name, aliases)
-- -- VALUES
-- --   ('2ef94be3-3f5e-45d1-95c4-67a21bcb88d5', 'ja',
-- --    'レッグカール（シーテッド）', 'シーテッドレッグカール');
