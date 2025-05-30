# BulkTrack Backend Migration Plan

## 概要

BulkTrackのバックエンドを単一のCloudflare Workersアプリケーションから、イベント駆動型のマイクロサービスアーキテクチャへ移行します。

## 完了した作業

### 1. モノレポ構造の構築

- Turborepoを使用したモノレポのセットアップ
- 以下のパッケージ構造を実装：

```
bulktrack-api/
├── apps/
│   ├── api/                    # REST API (Cloudflare Workers)
│   ├── aggregation-worker/     # 集計処理Worker
│   ├── ai-worker/              # AI分析Worker (TODO)
│   └── webhook-worker/         # Webhook Worker (TODO)
├── packages/
│   ├── shared-kernel/          # 共有カーネル
│   ├── core/                   # ドメイン層 + ユースケース層
│   ├── infrastructure/         # インフラ層
│   └── scientific-calc/        # 筋肥大科学計算 (TODO)
```

### 2. クリーンアーキテクチャの実装

#### Shared Kernel (`packages/shared-kernel`)
- 基本的な値オブジェクト（Identifier）
- Result型とエラーハンドリング
- ドメインイベントの定義
- 共通インターフェース（DomainEventPublisher）

#### Core Domain (`packages/core`)
- **値オブジェクト**: Weight, Reps, RPE, Volume, ExerciseName
- **エンティティ**: TrainingSet, Exercise
- **リポジトリインターフェース**: TrainingSetRepository, ExerciseRepository
- **ユースケース**: RecordTrainingSetUseCase

#### Infrastructure (`packages/infrastructure`)
- **データベース**: D1TrainingSetRepository（Drizzle ORM使用）
- **Queue実装**: CloudflareQueueEventPublisher
- **スキーマ定義**: SQLiteテーブル定義

#### API Application (`apps/api`)
- Honoフレームワークを使用
- 依存性注入コンテナ
- トレーニングセット記録エンドポイント

### 3. イベント駆動アーキテクチャ

- Cloudflare Queuesを使用したイベントパブリッシング
- 集計処理をWorkerに分離
- イベントタイプとキューのマッピング定義

## 完了した作業（Phase 1: 既存機能の移行）

### リポジトリ実装の完成
- ✅ D1ExerciseRepository の実装
- ✅ ユーザーリポジトリの実装
- ✅ デバイスリポジトリの実装
- ✅ 既存のデータベーススキーマとの互換性確保

### 認証・認可の移行
- ✅ JWT認証ミドルウェアの実装
- ✅ デバイスベース認証の移行
- ✅ KVストアを使用したリフレッシュトークン管理
- ✅ ActivateDeviceユースケースの実装

### APIエンドポイントの移行
- ✅ 認証エンドポイント（/v1/auth/device, /v1/auth/refresh）
- ✅ トレーニングセット記録エンドポイント
- ✅ エクササイズ検索API（/v1/exercises, /v1/me/exercises/recent）
  - SearchExercisesUseCase と ListRecentExercisesUseCase の実装
  - 既存のドメインエンティティとの統合
  - Honoルーターとハンドラーの実装
- [ ] ワークアウト履歴API
- [ ] ダッシュボードAPI

## アーキテクチャの改善点

### ドメイン層の強化

1. **エンティティの充実**
   - TrainingSetエンティティにビジネスロジックを集約
   - calculateEffectiveReps()メソッドでBaz-Valle et al. (2022)の知見を実装
   - evaluateHypertrophyStimulus()で筋肥大刺激を評価

2. **値オブジェクトの拡充**
   - RPE（6-10が筋肥大に最適、Helms et al., 2018）
   - Weight、Reps（6-30レップス、Schoenfeld et al., 2019）
   - RestTime（1-5分の範囲検証）
   - EffectiveReps、TrainingVolume、HypertrophyStimulus

3. **ドメインサービス**
   - VolumeAnalysisService: プログレッシブオーバーロード判定
   - HypertrophyStimulusCalculator: 複合的な筋肥大刺激評価

### リポジトリインターフェースの改善

ドメイン特化のクエリメソッドを追加：
- findRecentSetsForMuscleGroup()：特定筋群の最近のセット取得
- findLastSetForExercise()：エクササイズの前回実施データ
- calculateWeeklyVolumeForMuscleGroup()：筋群別週間ボリューム集計
- findSetsWithinDateRange()：期間指定でのセット取得
- findPersonalRecords()：パーソナルレコードの取得

データベースレベルでの集計を活用し、効率的なクエリを実現。

### ユースケースの改善

RecordTrainingSetUseCaseに以下を追加：
- プログレッシブオーバーロードの自動判定
- 週間ボリューム閾値チェック（Schoenfeld et al., 2019 - 週12-20セット）
- ドメインイベントの発行（TrainingSetRecordedEvent、VolumeThresholdExceededEvent）
- 前回セットとの比較による進捗状況の評価
- 筋肥大刺激の総合評価

## 次のステップ

### Phase 1.5: 残りのAPIエンドポイントの移行（1週間）

1. **エクササイズ検索APIの実装**
   - ✅ 全文検索エンドポイント（/v1/exercises）
   - ✅ 最近使用したエクササイズ取得（/v1/me/exercises/recent）
   - ✅ 多言語対応（Accept-Languageヘッダー対応）

2. **ワークアウト履歴APIの実装**
   - [ ] 履歴一覧取得
   - [ ] 詳細情報取得
   - [ ] 集計データ取得

3. **ダッシュボードAPIの実装**
   - [ ] 統計情報取得
   - [ ] 筋群別ボリューム取得
   - [ ] 進捗メトリクス取得

### Phase 2: ドメインロジックの充実（1週間）

1. **ドメインサービスの実装**
   - [ ] VolumeCalculationService
   - [ ] ProgressMetricsService
   - [ ] MuscleGroupAggregationService

2. **値オブジェクトの拡充**
   - [ ] RPE (Rate of Perceived Exertion): 1-10の範囲、0.5刻み、RIR変換
   - [ ] Weight: 単位変換（kg/lbs）、現実的な範囲検証
   - [ ] Reps: 1-100の範囲、筋肥大最適レップ数判定
   - [ ] RestTime: 秒単位、推奨休息時間の提案
   - [ ] EffectiveReps: RIRベースの効果的レップ数計算
   - [ ] TrainingVolume: セット×レップ×重量の計算
   - [ ] HypertrophyStimulus: 総合的な筋肥大刺激評価
   - [ ] MuscleGroup: 筋群の階層構造、最適週間セット数

3. **ビジネスルールの実装**
   - [ ] 最大ボリューム閾値のチェック（筋群別週20セット上限）
   - [ ] 適切な休息期間の検証（複合種目3-5分、単関節1-3分）
   - [ ] プログレッシブオーバーロードの計算（前回比較、トレンド分析）
   - [ ] 効果的レップ数の計算（Baz-Valle et al., 2022）
   - [ ] 筋肥大刺激の評価（ボリューム、強度、頻度の複合評価）

### Phase 3: Worker実装（1-2週間）

1. **Aggregation Worker**
   - [ ] バッチ処理の実装（ユーザーごとのグループ化）
   - [ ] 日次集計ロジックの実装
   - [ ] 週次筋群別ボリューム集計（効果的レップ数考慮）
   - [ ] 進捗メトリクスの計算（トレンド分析、達成度）
   - [ ] 閾値超過時の通知トリガー

2. **AI Worker**
   - [ ] トレーニングパターン分析
   - [ ] フォーム改善提案の生成
   - [ ] パフォーマンス予測

3. **Webhook Worker**
   - [ ] 外部サービス連携
   - [ ] 通知送信

### Phase 4: マイグレーションとデプロイ（1週間）

1. **データマイグレーション**
   - [ ] 既存データの新スキーマへの移行スクリプト
   - [ ] データ整合性の検証

2. **段階的デプロイ**
   - [ ] カナリアデプロイメントの設定
   - [ ] ロールバック手順の準備
   - [ ] モニタリングとアラートの設定

3. **パフォーマンステスト**
   - [ ] 負荷テストの実施
   - [ ] レスポンスタイムの最適化

## 技術的な考慮事項

### 依存性の解決

現在、TypeScriptのモジュール解決でエラーが発生しています：
```bash
pnpm install
pnpm build
```

### 環境変数の設定

各`wrangler.toml`で以下の値を設定する必要があります：
- D1データベースID
- KVネームスペースID
- JWT_SECRET

### Queueの作成

以下のQueueをCloudflareダッシュボードで作成：
- volume-aggregation
- ai-analysis
- webhook-notifications

## リスクと対策

1. **データ整合性**: イベントソーシングパターンにより、すべての状態変更を追跡
2. **パフォーマンス**: 適切なインデックスとキャッシング戦略
3. **可用性**: Queue処理の冪等性とリトライメカニズム
4. **セキュリティ**: 各レイヤーでの適切な検証とサニタイゼーション

## テスト戦略

### 単体テスト
- ドメインエンティティ：ビジネスロジックの検証
- 値オブジェクト：バリデーションルールの検証
- ドメインサービス：複雑な計算ロジックの検証
- カバレッジ目標：80%以上

### 統合テスト
- リポジトリ実装：D1データベースとの連携
- ユースケース：エンドツーエンドのフロー
- イベントパブリッシング：Queue連携の確認

### E2Eテスト
- APIエンドポイント：実際のHTTPリクエスト/レスポンス
- 認証フロー：JWT発行と検証
- エラーハンドリング：異常系のテスト

### パフォーマンステスト
- 負荷テスト：k6を使用した並行アクセステスト
- レスポンスタイム測定：95パーセンタイルで200ms以下
- Queue処理遅延：平均1秒以内

## 成功指標

- レスポンスタイム: 95パーセンタイルで200ms以下
- エラー率: 0.1%以下
- Queue処理遅延: 平均1秒以内
- コードカバレッジ: 80%以上
- ドメインロジックの適切なカプセル化
- 筋肥大科学の知見の正確な実装
