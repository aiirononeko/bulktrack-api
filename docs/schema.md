## 目次

1. [全体設計の要旨](#全体設計の要旨)
2. [ER ざっくり図](#er-ざっくり図)
3. [テーブル詳細](#テーブル詳細)

   1. [ユーザー & デバイス](#ユーザー--デバイス)
   2. [解剖学オントロジー](#解剖学オントロジー)
   3. [種目 & 種目関連](#種目--種目関連)
   4. [ワークアウト実績](#ワークアウト実績)
   5. [ダッシュボード週次集計](#ダッシュボード週次集計)
4. [トリガー・チェック制約](#トリガー・チェック制約)
5. [全文検索 (FTS5)](#全文検索-fts5)
6. [拡張ポイント](#拡張ポイント)

---

## 全体設計の要旨

| 方針                                | 採用理由                                                 |
| --------------------------------- | ---------------------------------------------------- |
| **正規化 3NF+**                      | 演算の再利用性・データ重複の抑制。                                    |
| **整数 PK／UUID v7**                 | CF D1 の `TEXT` PK を許容しつつ人間可読性を確保。                    |
| **解剖学 2 層 (group→muscle)**        | UI 集計と学術的粒度（筋頭レベル）の両立。                               |
| **`relative_share`=0-1000 (千分率)** | 浮動誤差を排除し、合計=1000 トリガで厳密管理。                           |
| **Evidence First**                | `exercise_sources` で DOI 等を FK 管理し “論文トレーサビリティ” を担保。 |

---

## ER ざっくり図

```
users ─┬── user_devices
       ├── workout_sets ─┬── exercises ─┬── exercise_muscles ─┬── muscles ─ muscle_groups
       │                 │              │                     └── modifiers (via exercise_modifier_values)
       │                 │              └── exercise_translations
       │                 └── menus ─── menu_exercises
       ├── weekly_user_volumes
       ├── weekly_user_muscle_volumes
       └── weekly_user_metrics
exercises ─ exercise_sources (1-n)
```

*（実線＝FK、破線＝集計ビュー的テーブル）*

---

## テーブル詳細

### ユーザー & デバイス

| テーブル           | 主なカラム      | 役割                              |
| -------------- | ---------- | ------------------------------- |
| `users`        | `goalJson` | 怪我歴・目標を JSON で保持し将来のパーソナライズに活用。 |
| `user_devices` | `platform` | Push 通知のターゲット OS 判別。            |

### 解剖学オントロジー

| テーブル            | カラム             | 意味                                       |
| --------------- | --------------- | ---------------------------------------- |
| `muscle_groups` | `name`          | 「Chest / Leg …」UI 側タブ名。                  |
| `muscles`       | `tensionFactor` | **長筋長優位 ×1.1** など、将来 “有効レップ係数” に掛けるスケーラ。 |

### 種目 & 種目関連

| テーブル                       | カラム                      | ポイント                                   |
| -------------------------- | ------------------------ | -------------------------------------- |
| `exercises`                | `isCompound`             | メニュー提案時、同一部位のアイソレーションを自動追加する際に利用。      |
| `exercise_sources`         | `citation / url`         | APA 文字列と DOI/PMID URL を分離。             |
| `exercise_muscles`         | `relativeShare` (0-1000) | 合計=1000 をトリガで強制。整数化により誤差ゼロ。            |
| `modifiers`                | `unit`                   | `"deg" / "cm" / "enum"` など限定 ENUM を想定。 |
| `exercise_modifier_values` | `valueKey`               | `NULL` を含まない一意キー。`wide` と `30` は別レコード。 |

### ワークアウト実績

| テーブル           | カラム         | 算出関連                                          |
| -------------- | ----------- | --------------------------------------------- |
| `workout_sets` | `volume`    | `GENERATED ALWAYS`。NULL を 0 に変換済みで可視化ロジックが簡単。 |
| 〃              | `rpe` CHECK | 1–10 範囲で入力ミス防止（UI 側は 1 ステップ刻み）。               |

### ダッシュボード週次集計

*ISO-8601 月曜始まり。`weekStart` は **TEXT 'YYYY-MM-DD'** → 範囲検索が高速。*

| テーブル                         | 用途                                    |
| ---------------------------- | ------------------------------------- |
| `weekly_user_volumes`        | 総ボリュームと平均セットボリュームを重ねて “量・質” の両指標を可視化。 |
| `weekly_user_muscle_volumes` | 部位ごとバー／ヒートマップ Drill-down 用。           |
| `weekly_user_metrics`        | 体重や平均睡眠時間などのオーバーレイ。                   |

---

## トリガー・チェック制約

| 名称                                            | タイミング                          | 概要                                                            |
| --------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| `trg_exercise_muscles_relative_share_[I/U/D]` | AFTER INSERT / UPDATE / DELETE | `exercise_id` ひとつ分の `relative_share` 合計が **1000** でないと ABORT。 |
| `ck_relative_share_multiplier`                | CHECK                          | バリエーション倍率を 0–2 に制限。極端な誤入力防止。                                  |
| `ck_rpe_range`                                | CHECK                          | RPE 1–10。0 で “未入力” を表したい場合は `NULL` を使用。                       |

---

## 全文検索 (FTS5)

```sql
CREATE VIRTUAL TABLE exercises_fts USING fts5(
  exercise_id UNINDEXED,
  locale      UNINDEXED,
  text,
  text_normalized,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3 4'
);
```

* **`text`** : 英語／カナ混在ワード。
* **`text_normalized`** : ひらがな正規化・半角/全角統一後を別カラムに保持。
* プレフィックス検索 (`bench*`) と 2-4 文字 n-gram が走り、日本語でも高速。

---

## 拡張ポイント

| 想定シナリオ                    | 追加策                                                                |
| ------------------------- | ------------------------------------------------------------------ |
| **長筋長 vs 短筋長** 刺激差を取り込みたい | `exercise_muscles.muscleLengthFactor` 追加 or `tensionFactor` を更新。   |
| フォーム計測 (Computer Vision)  | `workout_sets.videoUrl` と `jointAnglesJson` を別テーブルで参照。             |
| AI おすすめメニュー生成             | `menus.sourceType='ai'` ＋ `aiPrompt` 列を拡張し、生成元を保存。                 |
| 複数言語 (韓国語など) 追加           | `exercise_translations.locale` を ISO-639-1 固定にし、FTS に同 locale を投入。 |

---

### 最後に

本スキーマは **Cloudflare D1 ＋ Drizzle ORM** を前提に、
*スキーマの機械的整合性* と *スポーツ科学の実証性* を両立した構造です。

今後のマイグレーションでは

1. **エビデンス DOI の登録運用フロー**
2. **seed データの `relative_share` 1000 分率化**
   を進めることで、ダッシュボードの示唆精度をさらに高められます。
