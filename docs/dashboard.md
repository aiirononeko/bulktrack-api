# ダッシュボード集計仕様

## 1. はじめに

このドキュメントは、ユーザーダッシュボードに表示される各種トレーニングデータの集計ロジックと、関連するデータベーススキーマについて記述します。
主な目的は、ユーザーのトレーニング成果を可視化し、進捗管理をサポートすることです。
集計処理は、`session/finish` イベント後に非同期Workerによって実行され、結果は正規化されたテーブルに保存されます。

## 2. 主要な集計項目とSQLクエリ例

### 2.1. ユーザーの現在の週間トレーニングボリューム

#### 2.1.1. 全部位の総ボリューム (現在の週)

-   **目的:** 現在の週に行ったトレーニングの総量を把握する。
-   **関連テーブル:** `weeklyMuscleVolumes`
-   **SQLクエリ例:**
    ```sql
    SELECT SUM(volume) AS current_total_weekly_volume
    FROM weeklyMuscleVolumes
    WHERE userId = '対象ユーザーID' AND weekIdentifier = '現在の週の識別子'; 
    -- 例: weekIdentifier = '2023-W52-current'
    ```

#### 2.1.2. 部位別のトレーニングボリューム (現在の週)

-   **目的:** 現在の週に各部位がどれだけトレーニングされたかを把握する。
-   **関連テーブル:** `weeklyMuscleVolumes`, `muscles`
-   **SQLクエリ例:**
    ```sql
    SELECT m.name AS muscle_name, wmv.volume
    FROM weeklyMuscleVolumes wmv
    JOIN muscles m ON wmv.muscleId = m.id
    WHERE wmv.userId = '対象ユーザーID' AND wmv.weekIdentifier = '現在の週の識別子';
    ```

### 2.2. 指定した期間でのトレーニングボリュームの一覧 (週ごと)

-   **目的:** 過去のトレーニングボリュームの推移を週単位で確認する。
-   **関連テーブル:** `workoutSets` (元データ), または `weeklyMuscleVolumes` (集計済みデータ)
-   **SQLクエリ例 (workoutSetsから集計):**
    ```sql
    SELECT strftime('%Y-W%W', performed_at) AS week, SUM(volume) AS weekly_total_volume
    FROM workoutSets
    WHERE userId = '対象ユーザーID' AND performed_at BETWEEN '期間開始日' AND '期間終了日'
    GROUP BY week
    ORDER BY week;
    ```
-   **SQLクエリ例 (weeklyMuscleVolumesから取得、weekIdentifierが時系列ソート可能な場合):**
    ```sql
    SELECT weekIdentifier, SUM(volume) AS weekly_total_volume 
    FROM weeklyMuscleVolumes
    WHERE userId = '対象ユーザーID' AND weekIdentifier BETWEEN '開始週の識別子' AND '終了週の識別子'
    GROUP BY weekIdentifier
    ORDER BY weekIdentifier;
    ```

### 2.3. 部位別のトレーニングボリューム (指定した期間)

-   **目的:** 指定した期間において、各部位がどれだけトレーニングされたかの推移を週単位で確認する。
-   **関連テーブル:** `workoutSets`, `exerciseMuscles`, `muscles` (元データから集計), または `weeklyMuscleVolumes` (集計済みデータ)
-   **SQLクエリ例 (workoutSetsから集計、tensionRatioを考慮):**
    ```sql
    SELECT 
        m.name AS muscle_name, 
        strftime('%Y-W%W', ws.performed_at) AS week, 
        SUM(ws.volume * em.tensionRatio) AS muscle_volume -- tensionRatioを考慮する場合
        -- SUM(ws.volume) AS muscle_volume -- 単純なセットボリュームの場合
    FROM workoutSets ws
    JOIN exerciseMuscles em ON ws.exerciseId = em.exerciseId
    JOIN muscles m ON em.muscleId = m.id
    WHERE ws.userId = '対象ユーザーID' AND ws.performed_at BETWEEN '期間開始日' AND '期間終了日'
    GROUP BY muscle_name, week
    ORDER BY week, muscle_name;
    ```
-   **SQLクエリ例 (weeklyMuscleVolumesから取得):**
    ```sql
    SELECT m.name AS muscle_name, wmv.weekIdentifier, wmv.volume
    FROM weeklyMuscleVolumes wmv
    JOIN muscles m ON wmv.muscleId = m.id
    WHERE wmv.userId = '対象ユーザーID' AND wmv.weekIdentifier BETWEEN '開始週の識別子' AND '終了週の識別子'
    ORDER BY wmv.weekIdentifier, m.name;
    ```

### 2.4. 種目別のトレーニングボリューム (現在の週と、指定した期間)

-   **目的:** 各トレーニング種目のボリュームを週単位または指定期間で確認する。
-   **関連テーブル:** `workoutSets`, `exercises`
-   **SQLクエリ例 (指定期間、週ごと):**
    ```sql
    SELECT 
        e.canonicalName AS exercise_name, 
        strftime('%Y-W%W', ws.performed_at) AS week, 
        SUM(ws.volume) AS exercise_volume
    FROM workoutSets ws
    JOIN exercises e ON ws.exerciseId = e.id
    WHERE ws.userId = '対象ユーザーID' AND ws.performed_at BETWEEN '期間開始日' AND '期間終了日' 
    GROUP BY exercise_name, week
    ORDER BY week, exercise_name;
    ```
    *注: 「現在の週」の場合は、`performed_at` の期間を現在の週に絞り込みます。*

### 2.5. トレーニング強度 (RM) の保存と参照

-   **目的:** トレーニングの強度指標（例: 1RM推定値）を記録し、推移を追跡する。
-   **保存先テーブル:** `userProgressMetrics`
-   **保存データ例:**
    -   `userId`: ユーザーID
    -   `metricKey`: "exercise_squat_1rm_estimate", "exercise_bench_press_1rm_calculated"
    -   `metricValue`: RMの値 (例: "100.5")
    -   `metricType`: "kg"
    -   `periodIdentifier`: "2023-W52" (週単位), "2023-12-31" (日単位)
    -   `calculatedAt`: 計算日時
-   **RM計算:** 各セットの `weight` と `reps` からEpley法などの計算式を用いて推定。計算はアプリケーション側で行う。
-   **SQLクエリ例 (指定期間の特定種目の1RM推定値の推移):**
    ```sql
    SELECT periodIdentifier, metricValue
    FROM userProgressMetrics
    WHERE userId = '対象ユーザーID' 
      AND metricKey = 'exercise_squat_1rm_estimate' 
      AND periodIdentifier BETWEEN '開始期間識別子' AND '終了期間識別子'
    ORDER BY periodIdentifier;
    ```

### 2.6. 指定した期間のトレーニングボリュームの平均

#### 2.6.1. 単純な週平均ボリューム

-   **目的:** 指定期間における週ごとの平均トレーニング総量を把握する。
-   **関連テーブル:** `workoutSets` (元データ), または `weeklyMuscleVolumes` (集計済みデータ)
-   **SQLクエリ例 (workoutSetsから集計):**
    ```sql
    WITH WeeklyTotalVolumes AS (
        SELECT 
            strftime('%Y-W%W', performed_at) AS week, 
            SUM(volume) AS total_volume_per_week
        FROM workoutSets
        WHERE userId = '対象ユーザーID' AND performed_at BETWEEN '期間開始日' AND '期間終了日'
        GROUP BY week
    )
    SELECT AVG(total_volume_per_week) AS average_weekly_volume
    FROM WeeklyTotalVolumes;
    ```

#### 2.6.2. ボリューム増加トレンドの指標

-   **目的:** トレーニングボリュームが指定期間で平均的に増加しているかどうかの傾向を把握する。
-   **アプローチ:**
    1.  週ごとの総ボリュームを算出 (上記2.2参照)。
    2.  算出された時系列データ (週の連番, ボリューム) を用いて線形回帰分析を行う。
    3.  回帰直線の傾きが正であれば増加傾向、負であれば減少傾向と判断。
-   **実装:** この計算はSQLのみでは複雑なため、アプリケーション側で統計ライブラリなどを使用して行うことを推奨。データベースは元データを提供する役割を担う。

## 3. 関連テーブルスキーマ概要

### `userDashboardStats`
-   `userId` (PK)
-   `lastSessionId`
-   `deloadWarningSignal`
-   `lastCalculatedAt`

### `weeklyMuscleVolumes`
-   `userId` (FK, PK)
-   `muscleId` (FK, PK)
-   `weekIdentifier` (PK) - 例: "2023-W52-current", "YYYY-WW"
-   `volume`
-   `calculatedAt`

### `weeklyUserActivity`
-   `userId` (FK, PK)
-   `weekIdentifier` (PK) - 例: "2023-W52"
-   `totalWorkouts`
-   `currentStreak`
-   `calculatedAt`

### `userUnderstimulatedMuscles`
-   `userId` (FK, PK)
-   `muscleId` (FK, PK)
-   `periodIdentifier` (PK) - 例: "current_week", "2023-Q4"
-   `calculatedAt`

### `userProgressMetrics`
-   `userId` (FK, PK)
-   `metricKey` (PK) - 例: "overall_progress_percentage", "squat_1rm_estimate"
-   `periodIdentifier` (PK) - 例: "latest", "2023-W40"
-   `metricValue` (TEXT)
-   `metricType` (TEXT, optional) - 例: "percentage", "kg"
-   `calculatedAt`

### その他重要な関連テーブル (データソース)
-   `workoutSets`: 個々のセット記録、ボリューム計算の元データ。
-   `exercises`: 種目情報。
-   `muscles`: 部位情報。
-   `exerciseMuscles`: 種目と部位の関連、`tensionRatio` を含む。

## 4. 考慮事項

-   **`weekIdentifier` の形式:**
    -   `weeklyMuscleVolumes` や `weeklyUserActivity` における `weekIdentifier` は、時系列でのソートや期間指定を容易にするため、一貫性のある形式（例: `YYYY-WW` ISO週番号）を推奨します。
    -   "current" や "previous" といった相対的な識別子と、`YYYY-WW` のような絶対的な識別子を組み合わせる場合は、その管理方法とクエリ方法を明確にする必要があります。
-   **RM計算と保存戦略:**
    -   RMの計算ロジック（例: Epley法）をアプリケーション内で標準化します。
    -   RMを計算するタイミング（セットごと、セッション終了時など）と、`userProgressMetrics` に保存する粒度（種目ごと、日ごと、週ごと最高値など）を定義します。
-   **複雑な集計（トレンド分析など）:**
    -   高度な統計分析は、アプリケーション側のライブラリを利用することを推奨します。
    -   データベースは、分析に必要な元データを効率的に提供する役割を担います。
-   **データ整合性:**
    -   非同期Workerで集計処理を行う際、エラーハンドリングとリトライ戦略を実装し、データの整合性を担保します。
-   **パフォーマンス:**
    -   頻繁にアクセスされる集計データや、複雑なクエリが予想される箇所には、適切にインデックスを設定します。
    -   `EXPLAIN QUERY PLAN` などを活用してクエリのパフォーマンスを評価し、必要に応じて最適化を行います。
