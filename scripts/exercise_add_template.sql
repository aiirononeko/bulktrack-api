-- 1. exercise_sources に DOI を追加
INSERT INTO exercise_sources(id,title,url) VALUES
 ('DOIまたはUUID','Study Title','https://doi.org/…');

-- 2. exercises へ登録
INSERT INTO exercises(id,canonical_name,default_muscle_id,is_compound,is_official)
VALUES ('<uuid>','Exercise Name',<muscle_id>,1,1);

-- 3. exercise_muscles 合計1000で挿入
INSERT INTO exercise_muscles VALUES
 ('<uuid>',<muscle_id>,1000,NULL,'DOIまたはUUID','optional notes');
