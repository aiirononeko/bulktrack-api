// OpenAPI: #/components/schemas/MuscleVolumeItem
export interface MuscleVolumeItemDto {
  muscleId: number;
  name: string;
  volume: number;
}

// OpenAPI: #/components/schemas/WeeklyVolumeByMuscleItem -> weeks property
export interface WeeklyVolumeDataPointDto {
  week: string; // YYYY-Www 形式
  volume: number;
}

// OpenAPI: #/components/schemas/WeeklyVolumeByMuscleItem
export interface WeeklyVolumeByMuscleItemDto {
  muscleId: number;
  name: string;
  weeks: WeeklyVolumeDataPointDto[];
}

// OpenAPI: #/components/schemas/ExerciseVolumeItem
export interface ExerciseVolumeItemDto {
  exerciseId: string; // UUID
  name: string;
  totalVolume: number;
}

// OpenAPI: #/components/schemas/CurrentWeekSummary
export interface CurrentWeekSummaryDto {
  totalWorkouts: number;
  currentStreak: number;
  totalVolume: number;
  volumeByMuscle: MuscleVolumeItemDto[];
}

// OpenAPI: #/components/schemas/PeriodSummary
export interface PeriodSummaryDto {
  period: string; // '1w', '4w', '12w', '24w'
  totalVolume: number;
  averageWeeklyVolume: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable' | 'N/A';
  volumeByMuscleOverTime: WeeklyVolumeByMuscleItemDto[];
  topExercisesByVolume: ExerciseVolumeItemDto[];
}

// OpenAPI: #/components/schemas/ProgressMetricItem
export interface ProgressMetricItemDto {
  metricKey: string;
  value: string;
  unit?: string | null;
  recordedAt: string; // ISO Date string
}

// OpenAPI: #/components/schemas/UnderstimulatedMuscleItem
export interface UnderstimulatedMuscleItemDto {
  muscleId: number;
  name: string;
  lastTrained?: string | null; // ISO Date string
}

// OpenAPI: #/components/schemas/DashboardResponse
export interface DashboardResponseDto {
  userId: string; // UUID
  lastSessionId?: string | null; // UUID
  deloadWarningSignal: boolean;
  lastCalculatedAt: string; // ISO Date string
  currentWeekSummary: CurrentWeekSummaryDto;
  periodSummary: PeriodSummaryDto;
  progressMetrics: ProgressMetricItemDto[];
  understimulatedMuscles: UnderstimulatedMuscleItemDto[];
}
