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
   - [ ] TrainingIntensity
   - [ ] RestPeriod
   - [ ] MuscleGroup

3. **ビジネスルールの実装**
   - [ ] 最大ボリューム閾値のチェック
   - [ ] 適切な休息期間の検証
   - [ ] プログレッシブオーバーロードの計算

### Phase 3: Worker実装（1-2週間）

1. **Aggregation Worker**
   - [ ] 日次集計ロジックの実装
   - [ ] 週次筋群別ボリューム集計
   - [ ] 進捗メトリクスの計算

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

## 成功指標

- レスポンスタイム: 95パーセンタイルで200ms以下
- エラー率: 0.1%以下
- Queue処理遅延: 平均1秒以内
- コードカバレッジ: 80%以上
