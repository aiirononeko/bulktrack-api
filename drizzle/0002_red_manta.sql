-- Step 1: FTS5 仮想テーブルの作成
CREATE VIRTUAL TABLE exercises_fts
USING fts5(
  exercise_id UNINDEXED,
  locale UNINDEXED,
  text, -- このカラムがFTSによってインデックスされる
  text_normalized, -- ひらがな検索用の正規化済みテキスト
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3 4'
);

-- Step 2: 初回データロード

-- 1. 各エクササイズの翻訳済み情報をロード
-- (canonical_name + translated_name + translated_aliases)
INSERT INTO exercises_fts(exercise_id, locale, text, text_normalized)
SELECT
    t.exercise_id,
    t.locale,
    e.canonical_name || ' ' || COALESCE(t.name, '') || ' ' || COALESCE(t.aliases, ''),
    lower(e.canonical_name || ' ' || COALESCE(t.name, '') || ' ' || COALESCE(t.aliases, ''))
FROM exercise_translations t
JOIN exercises e ON e.id = t.exercise_id;

-- 2. 翻訳が存在しないエクササイズについてのみ、canonical_name を 'unknown' ロケールでロード
INSERT INTO exercises_fts(exercise_id, locale, text, text_normalized)
SELECT
    e.id,
    'unknown',
    e.canonical_name,
    lower(e.canonical_name)
FROM exercises e
WHERE NOT EXISTS (
    SELECT 1 FROM exercise_translations et WHERE et.exercise_id = e.id
);
