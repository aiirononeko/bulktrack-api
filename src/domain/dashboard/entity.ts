import type { UserIdVO, MuscleIdVO } from "../shared/vo/identifier";

/**
 * ユーザーの週ごとの総トレーニングボリュームと関連メトリクス
 */
export type WeeklyUserVolume = {
  userId: UserIdVO;
  /** ISO 8601形式の週の開始日 (月曜日, YYYY-MM-DD) */
  weekStart: string;
  /** その週の総トレーニングボリューム (例: Σ(weight * reps)) */
  totalVolume: number;
  /** その週の平均セットボリューム */
  avgSetVolume: number;
  /** その週の主要リフトの平均e1RM (推定1RM) 、存在しない場合はnull */
  e1rmAvg: number | null;
  /** 更新日時 */
  updatedAt: Date;
};

/**
 * ユーザーの週ごとの部位別トレーニングボリューム
 */
export type WeeklyUserMuscleVolume = {
  userId: UserIdVO;
  /** ISO 8601形式の週の開始日 (月曜日, YYYY-MM-DD) */
  weekStart: string;
  muscleId: MuscleIdVO;
  /** 部位名 (リポジトリ層でmusclesテーブルからJOINして取得することを想定) */
  muscleName?: string; // Optional as it might be joined
  muscleGroupId?: number; // 追加: 紐づくmuscle_groups.id
  muscleGroupName?: string; // 追加: 紐づくmuscle_groups.name
  /** その部位のその週の総トレーニングボリューム (例: Σ(weight * reps * tension_ratio)) */
  volume: number;
  setCount: number;
  e1rmSum: number;
  e1rmCount: number;
  /** 更新日時 */
  updatedAt: Date;
};

/**
 * ユーザーの週ごとの汎用メトリクス (体重、睡眠時間など)
 */
export type WeeklyUserMetric = {
  userId: UserIdVO;
  /** ISO 8601形式の週の開始日 (月曜日, YYYY-MM-DD) */
  weekStart: string;
  /** メトリクスのキー (例: 'body_weight', 'sleep_hours') */
  metricKey: string;
  /** メトリクスの値 */
  metricValue: number;
  /** メトリクスの単位 (例: 'kg', 'hours')、存在しない場合はnull */
  metricUnit: string | null;
  /** 更新日時 */
  updatedAt: Date;
};

/**
 * ダッシュボード表示用データ全体のコンテナ
 * 必要に応じてさらにフィールドを追加できます。
 */
export type DashboardData = {
  // 今週のサマリー (単一のWeeklyUserVolumeと部位別ボリュームのリスト)
  currentWeekSummary?: {
    volumeStats: WeeklyUserVolume | null;
    muscleVolumes: WeeklyUserMuscleVolume[];
  };
  // 指定期間の週ごとのボリューム推移
  historicalWeeklyVolumes?: WeeklyUserVolume[];
  // 指定期間の週ごとの部位別ボリューム推移
  historicalWeeklyMuscleVolumes?: WeeklyUserMuscleVolume[];
  // 指定期間の週ごとのメトリクス推移
  historicalMetrics?: WeeklyUserMetric[];
};
