import type {
  WeeklyUserVolume,
  WeeklyUserMuscleVolume,
  WeeklyUserMetric,
} from "./entity";
import type { UserIdVO } from "../shared/vo/identifier";

export type DashboardFilters = {
  userId: UserIdVO;
  /** ISO 8601形式の週の開始日 (YYYY-MM-DD) */
  startDate?: string; 
  /** ISO 8601形式の週の終了日 (YYYY-MM-DD) */
  endDate?: string;
  /** 特定のメトリクスキューの配列 (例: ['body_weight', 'sleep_hours']) */
  metricKeys?: string[];
  /** 現在の週の開始日 (YYYY-MM-DD) */
  currentWeekStart?: string;
};

export interface IDashboardRepository {
  /**
   * 指定されたユーザーと期間の週ごとの総ボリュームを取得します。
   * @param filters ユーザーIDと期間フィルター
   * @returns WeeklyUserVolume の配列
   */
  findWeeklyUserVolumes(filters: DashboardFilters): Promise<WeeklyUserVolume[]>;

  /**
   * 指定されたユーザーと期間の週ごとの部位別ボリュームを取得します。
   * @param filters ユーザーIDと期間フィルター
   * @returns WeeklyUserMuscleVolume の配列
   */
  findWeeklyUserMuscleVolumes(
    filters: DashboardFilters,
  ): Promise<WeeklyUserMuscleVolume[]>;

  /**
   * 指定されたユーザーと期間の週ごとの汎用メトリクスを取得します。
   * @param filters ユーザーID、期間、メトリックキーフィルター
   * @returns WeeklyUserMetric の配列
   */
  findWeeklyUserMetrics(filters: DashboardFilters): Promise<WeeklyUserMetric[]>;

  /**
   * 指定されたユーザーの現在の週の総ボリュームを取得します。
   * @param userId ユーザーID
   * @param currentWeekStart 現在の週の開始日 (YYYY-MM-DD)
   * @returns WeeklyUserVolume または null (データが存在しない場合)
   */
  findCurrentWeeklyUserVolume(
    userId: UserIdVO,
    currentWeekStart: string,
  ): Promise<WeeklyUserVolume | null>;

  /**
   * 指定されたユーザーの現在の週の部位別ボリュームを取得します。
   * @param userId ユーザーID
   * @param currentWeekStart 現在の週の開始日 (YYYY-MM-DD)
   * @returns WeeklyUserMuscleVolume の配列
   */
  findCurrentWeeklyUserMuscleVolumes(
    userId: UserIdVO,
    currentWeekStart: string,
  ): Promise<WeeklyUserMuscleVolume[]>;
}
