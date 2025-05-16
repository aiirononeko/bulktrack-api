-- Step 1: FTS5 仮想テーブルの作成
CREATE VIRTUAL TABLE exercises_fts
USING fts5(
  exercise_id UNINDEXED,
  locale UNINDEXED,
  text, -- このカラムがFTSによってインデックスされる
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3 4'
);

-- Step 2: トリガーの作成

-- exercises テーブル INSERT 時
-- canonical_name のみを 'unknown' ロケールで登録
CREATE TRIGGER trg_exercise_fts_after_insert_exercise
AFTER INSERT ON exercises
BEGIN
    INSERT INTO exercises_fts(rowid, exercise_id, locale, text)
    VALUES (new.rowid, new.id, 'unknown', lower(new.canonical_name));
END;

-- exercises テーブル UPDATE (canonical_name 変更時)
CREATE TRIGGER trg_exercise_fts_after_update_exercise
AFTER UPDATE ON exercises
WHEN old.canonical_name IS NOT new.canonical_name
BEGIN
    -- 'unknown' ロケールのエントリを更新
    UPDATE exercises_fts
    SET text = lower(new.canonical_name)
    WHERE exercise_id = new.id AND locale = 'unknown';

    -- 関連する翻訳済みFTSエントリのtext部分に含まれる旧canonical_nameも更新
    -- (text は canonical_name + translated_name + translated_aliases の想定)
    UPDATE exercises_fts
    SET text = lower(new.canonical_name || substr(text, length(old.canonical_name) + 1)) -- 旧canonical_name部分を新しいものに置換
    WHERE exercise_id = new.id AND locale != 'unknown';
END;

-- exercises テーブル DELETE 時
CREATE TRIGGER trg_exercise_fts_after_delete_exercise
AFTER DELETE ON exercises
BEGIN
    DELETE FROM exercises_fts WHERE exercise_id = old.id;
END;

-- exercise_translations テーブル INSERT 時
CREATE TRIGGER trg_exercise_fts_after_insert_translation
AFTER INSERT ON exercise_translations
BEGIN
    -- 翻訳が追加されたexercise_idに対応する 'unknown' ロケールのFTSエントリは削除
    DELETE FROM exercises_fts WHERE exercise_id = new.exercise_id AND locale = 'unknown';

    -- 新しい翻訳情報を、対応するcanonical_nameと結合してFTSに挿入
    INSERT INTO exercises_fts(exercise_id, locale, text)
    SELECT
    new.exercise_id,
    new.locale,
    lower(e.canonical_name || ' ' || COALESCE(new.name, '') || ' ' || COALESCE(new.aliases, ''))
    FROM exercises e
    WHERE e.id = new.exercise_id;
END;

-- exercise_translations テーブル UPDATE 時
CREATE TRIGGER trg_exercise_fts_after_update_translation
AFTER UPDATE ON exercise_translations
WHEN old.name IS NOT new.name OR old.aliases IS NOT new.aliases OR old.locale IS NOT new.locale
BEGIN
    -- 既存のFTSエントリを一度削除
    DELETE FROM exercises_fts WHERE exercise_id = new.exercise_id AND locale = old.locale;
    -- 更新後の情報でFTSエントリを再挿入
    INSERT INTO exercises_fts(exercise_id, locale, text)
    SELECT
    new.exercise_id,
    new.locale,
    lower(e.canonical_name || ' ' || COALESCE(new.name, '') || ' ' || COALESCE(new.aliases, ''))
    FROM exercises e
    WHERE e.id = new.exercise_id;
END;

-- exercise_translations テーブル DELETE 時
CREATE TRIGGER trg_exercise_fts_after_delete_translation
AFTER DELETE ON exercise_translations
BEGIN
    -- 削除された翻訳に対応するFTSエントリを削除
    DELETE FROM exercises_fts WHERE exercise_id = old.exercise_id AND locale = old.locale;

    -- もし、このエクササイズに他の翻訳が残っていなければ、canonical_name のみの 'unknown' エントリを再作成
    INSERT INTO exercises_fts (exercise_id, locale, text)
    SELECT e.id, 'unknown', lower(e.canonical_name)
    FROM exercises e
    WHERE e.id = old.exercise_id
    AND NOT EXISTS (SELECT 1 FROM exercise_translations et WHERE et.exercise_id = old.exercise_id);
END;


-- Step 3: 初回データロード (マイグレーションの最後に記述)
-- 既存のFTSデータをクリア
DELETE FROM exercises_fts;

-- 1. 各エクササイズの翻訳済み情報をロード
-- (canonical_name + translated_name + translated_aliases)
INSERT INTO exercises_fts(exercise_id, locale, text)
SELECT
    t.exercise_id,
    t.locale,
    lower(e.canonical_name || ' ' || COALESCE(t.name, '') || ' ' || COALESCE(t.aliases, ''))
FROM exercise_translations t
JOIN exercises e ON e.id = t.exercise_id;

-- 2. 翻訳が存在しないエクササイズについてのみ、canonical_name を 'unknown' ロケールでロード
-- exercises.rowid を exercises_fts.rowid にマッピングするのは、FTS5のrowidと一致させるため
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
