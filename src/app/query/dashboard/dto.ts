/**
 * ユーザーの週ごとの総トレーニングボリュームと関連メトリクス (DTO)
 */
export type WeeklyUserVolumeDto = {
  userId: string;
  weekStart: string;
  totalVolume: number;
  avgSetVolume: number;
  e1rmAvg: number | null;
  updatedAt: string; // ISO string representation of Date
};

/**
 * ユーザーの週ごとの部位別トレーニングボリューム (DTO)
 */
export type WeeklyUserMuscleVolumeDto = {
  userId: string;
  weekStart: string;
  muscleId: number;
  muscleName?: string;
  muscleGroupId?: number;
  muscleGroupName?: string;
  volume: number;
  setCount: number;
  e1rmSum: number;
  e1rmCount: number;
  updatedAt: string; // ISO string representation of Date
};

/**
 * ユーザーの週ごとの汎用メトリクス (DTO)
 */
export type WeeklyUserMetricDto = {
  userId: string;
  weekStart: string;
  metricKey: string;
  metricValue: number;
  metricUnit: string | null;
  updatedAt: string; // ISO string representation of Date
};

/**
 * ダッシュボード表示用データ全体のコンテナ (DTO)
 */
export type DashboardDataDto = {
  currentWeekSummary?: {
    volumeStats: WeeklyUserVolumeDto | null;
    muscleVolumes: WeeklyUserMuscleVolumeDto[];
  };
  historicalWeeklyVolumes?: WeeklyUserVolumeDto[];
  historicalWeeklyMuscleVolumes?: WeeklyUserMuscleVolumeDto[];
  historicalMetrics?: WeeklyUserMetricDto[];
};
