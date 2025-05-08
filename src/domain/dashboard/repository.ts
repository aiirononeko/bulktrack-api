import type { UserIdVO, WorkoutSessionIdVO, ExerciseIdVO, MuscleIdVO } from "../shared/vo/identifier";
import type { MuscleName } from "../muscle/vo";
import type { ExerciseNameVO } from "../exercise/vo";
import type { DashboardPeriod } from "./vo";

// APIレスポンスの DashboardResponse.currentWeekSummary.volumeByMuscle の要素
export interface CurrentWeekMuscleVolume {
  muscleId: MuscleIdVO;
  muscleName: MuscleName;
  volume: number;
}

// APIレスポンスの DashboardResponse.periodSummary.volumeByMuscleOverTime.weeks の要素
export interface WeeklyVolumeDataPoint {
  week: string; // 例: "2023-W40"
  volume: number;
}

// APIレスポンスの DashboardResponse.periodSummary.volumeByMuscleOverTime の要素
export interface MuscleVolumeOverTime {
  muscleId: MuscleIdVO;
  muscleName: MuscleName;
  weeks: WeeklyVolumeDataPoint[];
}

// APIレスポンスの DashboardResponse.periodSummary.topExercisesByVolume の要素
export interface ExerciseTotalVolume {
  exerciseId: ExerciseIdVO;
  exerciseName: ExerciseNameVO;
  totalVolume: number;
}

// APIレスポンスの DashboardResponse.progressMetrics の要素
export interface UserProgressMetric {
  metricKey: string;
  value: string;
  unit?: string | null;
  recordedAt: Date;
}

// APIレスポンスの DashboardResponse.understimulatedMuscles の要素
export interface UnderstimulatedMuscle {
  muscleId: MuscleIdVO;
  muscleName: MuscleName;
  lastTrained?: Date | null;
}

// userDashboardStats テーブルの基本情報
export interface UserDashboardBaseStats {
  lastSessionId: WorkoutSessionIdVO | null;
  deloadWarningSignal: boolean;
  lastCalculatedAt: Date;
}

// weeklyUserActivity テーブルの情報
export interface CurrentWeekUserActivity {
  totalWorkouts: number;
  currentStreak: number;
}


export interface IDashboardRepository {
  findBaseStats(userId: UserIdVO): Promise<UserDashboardBaseStats | null>;

  findCurrentWeekActivity(userId: UserIdVO, currentWeekIdentifier: string): Promise<CurrentWeekUserActivity | null>;
  
  findCurrentWeekMuscleVolumes(
    userId: UserIdVO,
    currentWeekIdentifier: string
  ): Promise<CurrentWeekMuscleVolume[]>;

  findPeriodMuscleVolumesOverTime(
    userId: UserIdVO,
    period: DashboardPeriod
  ): Promise<MuscleVolumeOverTime[]>;

  findPeriodTopExercisesByVolume(
    userId: UserIdVO,
    period: DashboardPeriod
  ): Promise<ExerciseTotalVolume[]>;
  
  findUserProgressMetrics(
    userId: UserIdVO,
    period: DashboardPeriod // 期間に関連するメトリクスを取得する想定
  ): Promise<UserProgressMetric[]>;

  findUnderstimulatedMuscles(
    userId: UserIdVO,
    periodIdentifier: string // 例: "current_week"
  ): Promise<UnderstimulatedMuscle[]>;
}
