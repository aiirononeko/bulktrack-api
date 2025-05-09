import type { UserIdVO } from "../shared/vo/identifier";
// 必要に応じて WorkoutSessionIdVO もインポートできます
// import type { WorkoutSessionIdVO } from "../shared/vo/identifier";

export interface AggregationResult {
  success: boolean;
  message?: string;
  // 必要に応じて、集計結果の概要などを返すことも可能です
}

/**
 * ユーザーのワークアウトデータを集計し、関連する統計情報を更新するサービス。
 * このサービスはドメインロジックに集中し、具体的なデータ永続化は
 * アプリケーション層またはインフラストラクチャ層のリポジトリ経由で行われることを想定する。
 */
export interface IAggregationService {
  /**
   * 指定されたユーザーの最新のワークアウトデータを基に、
   * 週間筋肉ボリュームや進捗メトリクス（RM推定値など）を集計・更新する。
   * @param userId 集計対象のユーザーID
   * @returns 集計処理の結果
   */
  aggregateWorkoutDataForUser(userId: UserIdVO): Promise<AggregationResult>;

  /**
   * (オプション) 特定のワークアウトセッション完了時にデータを集計する。
   * @param userId ユーザーID
   * @param sessionId 完了したワークアウトセッションID
   * @returns 集計処理の結果
   */
  // aggregateWorkoutSession(userId: UserIdVO, sessionId: WorkoutSessionIdVO): Promise<AggregationResult>;
}
